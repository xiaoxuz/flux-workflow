"""Skill 管理 API — CRUD、ZIP 上传、同步。

Skill 内容以文件系统为事实来源（skills/{name}/ 目录），
数据库 SkillModel 表仅存储元数据用于 Agent 绑定关联。
"""

from __future__ import annotations

import io
import logging
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models import SkillModel
from schemas import SkillSummary, SkillDetail, SkillCreate, SkillUpdate
from services import skill_sync

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_skills_dir() -> Path:
    dir_str = os.environ.get("SKILLS_DIR", os.path.join(os.getcwd(), "skills"))
    return Path(dir_str)


def _parse_skill_frontmatter(content: str) -> dict[str, Any]:
    """解析 SKILL.md 的 YAML frontmatter"""
    if not content.startswith("---"):
        return {"body": content}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {"body": content}
    import yaml

    meta = yaml.safe_load(parts[1]) or {}
    return {**meta, "body": parts[2].strip()}


def _build_skill_md(data: SkillCreate) -> str:
    """构建 SKILL.md 内容（frontmatter + body）"""
    import yaml

    frontmatter = {
        "name": data.name,
        "description": data.description,
        "disable-model-invocation": data.disable_model_invocation,
        "user-invocable": data.user_invocable,
        "allowed-tools": data.allowed_tools,
        "argument-hint": data.argument_hint,
    }
    yaml_str = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
    return f"---\n{yaml_str}---\n\n{data.content}"


def _update_skill_md(skill_dir: Path, data: SkillUpdate) -> None:
    """更新已有 SKILL.md 的 frontmatter 和/或 body"""
    import yaml

    md_path = skill_dir / "SKILL.md"
    if not md_path.exists():
        raise HTTPException(status_code=404, detail=f"Skill '{skill_dir.name}' 不存在")

    parsed = _parse_skill_frontmatter(md_path.read_text(encoding="utf-8"))
    if data.description is not None:
        parsed["description"] = data.description
    if data.disable_model_invocation is not None:
        parsed["disable-model-invocation"] = data.disable_model_invocation
    if data.user_invocable is not None:
        parsed["user-invocable"] = data.user_invocable
    if data.allowed_tools is not None:
        parsed["allowed-tools"] = data.allowed_tools
    if data.argument_hint is not None:
        parsed["argument-hint"] = data.argument_hint
    body = data.content if data.content is not None else parsed.get("body", "")

    frontmatter = {
        "name": skill_dir.name,
        "description": parsed.get("description", ""),
        "disable-model-invocation": parsed.get("disable-model-invocation", False),
        "user-invocable": parsed.get("user-invocable", True),
        "allowed-tools": parsed.get("allowed-tools", []),
        "argument-hint": parsed.get("argument-hint", ""),
    }
    yaml_str = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
    md_path.write_text(f"---\n{yaml_str}---\n\n{body}", encoding="utf-8")


def _manage_subdir(skill_dir: Path, subdir: str, files: dict[str, str] | None, is_replace: bool = False) -> None:
    """管理 Skill 子目录（scripts/references/assets）。"""
    d = skill_dir / subdir
    if files is None:
        return
    if is_replace and d.exists():
        for existing in d.iterdir():
            if existing.name not in files:
                if existing.is_file():
                    existing.unlink()
                else:
                    shutil.rmtree(existing, ignore_errors=True)
    for fname, content in files.items():
        (d / fname).write_text(content, encoding="utf-8")


# ============================================================
# GET /skills
# ============================================================


@router.get("/skills", response_model=list[SkillSummary])
async def list_skills(db: AsyncSession = Depends(get_db)):
    """返回 DB 缓存的 Skill 摘要列表，异步触发文件系统同步"""
    import asyncio

    asyncio.create_task(skill_sync.sync_skills_from_fs(db))

    result = await db.execute(select(SkillModel).order_by(SkillModel.created_at.desc()))
    records = result.scalars().all()
    return [
        SkillSummary(
            name=r.name,
            description=r.description,
            disable_model_invocation=False,
            user_invocable=True,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]


# ============================================================
# GET /skills/{name}
# ============================================================


@router.get("/skills/{name}", response_model=SkillDetail)
async def get_skill(name: str):
    """从文件系统直接读取 Skill 详情"""
    skills_dir = _get_skills_dir()
    skill_dir = skills_dir / name

    if not skill_dir.exists():
        raise HTTPException(status_code=404, detail=f"Skill '{name}' 在文件系统中不存在")

    md_path = skill_dir / "SKILL.md"
    if not md_path.exists():
        raise HTTPException(status_code=404, detail=f"Skill '{name}' 缺少 SKILL.md")

    content = md_path.read_text(encoding="utf-8")
    parsed = _parse_skill_frontmatter(content)

    return SkillDetail(
        name=parsed.get("name", name),
        description=parsed.get("description", ""),
        content=parsed.get("body", ""),
        disable_model_invocation=parsed.get("disable-model-invocation", False),
        user_invocable=parsed.get("user-invocable", True),
        allowed_tools=parsed.get("allowed-tools", []),
        argument_hint=parsed.get("argument-hint", ""),
        scripts=[f.name for f in (skill_dir / "scripts").iterdir()] if (skill_dir / "scripts").exists() else [],
        references=[f.name for f in (skill_dir / "references").iterdir()]
        if (skill_dir / "references").exists()
        else [],
        assets=[f.name for f in (skill_dir / "assets").iterdir()] if (skill_dir / "assets").exists() else [],
    )


# ============================================================
# POST /skills
# ============================================================


@router.post("/skills", status_code=201)
async def create_skill(data: SkillCreate, db: AsyncSession = Depends(get_db)):
    """通过表单创建 Skill，生成标准目录结构并写入 DB"""
    skills_dir = _get_skills_dir()
    skill_dir = skills_dir / data.name

    if skill_dir.exists():
        raise HTTPException(status_code=409, detail=f"Skill '{data.name}' 已存在")

    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(_build_skill_md(data), encoding="utf-8")

    if data.scripts:
        _manage_subdir(skill_dir, "scripts", data.scripts)
    if data.references:
        _manage_subdir(skill_dir, "references", data.references)
    if data.assets:
        _manage_subdir(skill_dir, "assets", data.assets)

    db.add(SkillModel(name=data.name, description=data.description))
    await db.commit()

    return {"name": data.name, "description": data.description, "message": f"Skill '{data.name}' 创建成功"}


# ============================================================
# PUT /skills/{name}
# ============================================================


@router.put("/skills/{name}")
async def update_skill(name: str, data: SkillUpdate, db: AsyncSession = Depends(get_db)):
    """编辑 Skill，同步更新文件系统和 DB"""
    skills_dir = _get_skills_dir()
    skill_dir = skills_dir / name

    if not skill_dir.exists():
        raise HTTPException(status_code=404, detail=f"Skill '{name}' 不存在")

    _update_skill_md(skill_dir, data)

    if data.scripts is not None or data.references is not None or data.assets is not None:
        _manage_subdir(skill_dir, "scripts", data.scripts, is_replace=True)
        _manage_subdir(skill_dir, "references", data.references, is_replace=True)
        _manage_subdir(skill_dir, "assets", data.assets, is_replace=True)

    if data.description is not None:
        result = await db.execute(select(SkillModel).where(SkillModel.name == name))
        record = result.scalar_one_or_none()
        if record:
            record.description = data.description
            await db.commit()

    return {"message": f"Skill '{name}' 更新成功"}


# ============================================================
# POST /skills/upload
# ============================================================


@router.post("/skills/upload")
async def upload_skill_zip(
    file: UploadFile = File(...),
    overwrite: bool = Query(False, description="是否覆盖已存在的同名 Skill"),
    db: AsyncSession = Depends(get_db),
):
    """上传 Skill ZIP 包，解压校验后注册"""
    # 1. 格式校验
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="只支持 .zip 格式文件")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")

    skills_dir = _get_skills_dir()
    temp_dir = tempfile.mkdtemp(prefix="skill_upload_")

    try:
        # 2. 解压 + zip slip 校验
        with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
            for member in zf.namelist():
                member_path = os.path.realpath(os.path.join(temp_dir, member))
                if not member_path.startswith(os.path.realpath(temp_dir) + os.sep) and member_path != os.path.realpath(
                    temp_dir
                ):
                    raise HTTPException(status_code=400, detail=f"非法文件路径: {member}")
            zf.extractall(temp_dir)

        # 3. 定位 SKILL.md（根目录或一级子目录）
        sk_root = Path(temp_dir)
        sk_md = sk_root / "SKILL.md"
        extract_dir = sk_root  # 要移动的目录

        if not sk_md.exists():
            subdirs = [d for d in sk_root.iterdir() if d.is_dir()]
            if len(subdirs) == 1 and (subdirs[0] / "SKILL.md").exists():
                sk_md = subdirs[0] / "SKILL.md"
                extract_dir = subdirs[0]

        if not sk_md.exists():
            raise HTTPException(status_code=422, detail="ZIP 包中缺少 SKILL.md 文件")

        parsed = _parse_skill_frontmatter(sk_md.read_text(encoding="utf-8"))
        skill_name = parsed.get("name")
        if not skill_name:
            raise HTTPException(status_code=422, detail="SKILL.md 的 frontmatter 中缺少 name 字段")

        # 4. 冲突检测
        target_dir = skills_dir / skill_name
        if target_dir.exists():
            if not overwrite:
                raise HTTPException(
                    status_code=409,
                    detail=f"Skill '{skill_name}' 已存在，请使用 ?overwrite=true 参数覆盖",
                )
            # 覆盖：删除旧目录 + 清理 Agent 绑定 + 删除 DB 记录
            await skill_sync.cleanup_skill_bindings(skill_name, db)
            await db.execute(text("DELETE FROM skills WHERE name = :name"), {"name": skill_name})
            await db.commit()
            shutil.rmtree(target_dir, ignore_errors=True)

        # 5. 原子移动到目标位置
        shutil.move(str(extract_dir), str(target_dir))

        # 6. 写入 DB
        db.add(SkillModel(name=skill_name, description=parsed.get("description", "")))
        await db.commit()

        return {
            "name": skill_name,
            "description": parsed.get("description", ""),
            "message": f"Skill '{skill_name}' 上传成功",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ZIP 上传处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"ZIP 处理失败: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# ============================================================
# DELETE /skills/{name}
# ============================================================


@router.delete("/skills/{name}")
async def delete_skill(name: str, confirm: bool = Query(False), db: AsyncSession = Depends(get_db)):
    """删除 Skill。confirm=false 时返回受影响的 Agent 列表（预检），confirm=true 时执行删除"""
    skills_dir = _get_skills_dir()
    skill_dir = skills_dir / name

    if not skill_dir.exists():
        raise HTTPException(status_code=404, detail=f"Skill '{name}' 不存在")

    if not confirm:
        bound_agents = await skill_sync.get_bound_agents_for_skill(name, db)
        return {"skill_name": name, "bound_agents": bound_agents, "message": "确认删除请添加 ?confirm=true"}

    await skill_sync.cleanup_skill_bindings(name, db)
    await db.execute(text("DELETE FROM skills WHERE name = :name"), {"name": name})
    await db.commit()
    shutil.rmtree(skill_dir, ignore_errors=True)

    return {"message": f"Skill '{name}' 已删除"}


# ============================================================
# POST /skills/sync
# ============================================================


@router.post("/skills/sync")
async def sync_skills(db: AsyncSession = Depends(get_db)):
    """手动触发文件系统与数据库同步"""
    stats = await skill_sync.sync_skills_from_fs(db)
    return {"message": "同步完成", **stats}

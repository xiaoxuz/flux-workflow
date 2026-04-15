"""Skill 文件系统与数据库同步服务。

职责：
1. 扫描 skills/ 目录，与数据库 SkillModel 表双向同步
2. 查询/清理绑定某 Skill 的 Agent 引用
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from models import SkillModel, AgentModel
from flux_agent.agents import SkillLoader

logger = logging.getLogger(__name__)


def _get_skills_dir() -> Path:
    """获取 skills 根目录"""
    import os

    dir_str = os.environ.get("SKILLS_DIR", os.path.join(os.getcwd(), "skills"))
    return Path(dir_str)


async def sync_skills_from_fs(db: AsyncSession) -> dict[str, int]:
    """扫描文件系统并与数据库同步。

    Returns:
        {"created": n, "updated": n, "deleted": n}
    """
    skills_dir = _get_skills_dir()
    stats = {"created": 0, "updated": 0, "deleted": 0}

    if not skills_dir.exists():
        return stats

    loader = SkillLoader(str(skills_dir))
    fs_names = set(loader.list_skills())

    # 获取 DB 中已有的记录
    result = await db.execute(select(SkillModel.name))
    db_names = set(result.scalars().all())

    # 1. 文件系统有但 DB 没有 → INSERT
    for name in fs_names - db_names:
        try:
            skill = loader.load(name)
            db.add(SkillModel(name=name, description=skill.description))
            stats["created"] += 1
        except Exception as e:
            logger.warning(f"同步 Skill '{name}' 失败: {e}")

    # 2. 文件系统没有但 DB 有 → DELETE（含清理 Agent 绑定）
    for name in db_names - fs_names:
        await cleanup_skill_bindings(name, db)
        await db.execute(text("DELETE FROM skills WHERE name = :name"), {"name": name})
        stats["deleted"] += 1

    # 3. 都有但描述不同 → UPDATE（以文件系统 frontmatter 为准）
    for name in fs_names & db_names:
        try:
            skill = loader.load(name)
            result = await db.execute(select(SkillModel).where(SkillModel.name == name))
            record = result.scalar_one_or_none()
            if record and record.description != skill.description:
                record.description = skill.description
                stats["updated"] += 1
        except Exception as e:
            logger.warning(f"更新 Skill '{name}' 描述失败: {e}")

    if stats["created"] or stats["deleted"] or stats["updated"]:
        await db.commit()
        logger.info(f"Skill 同步完成: {stats}")

    return stats


async def get_bound_agents_for_skill(name: str, db: AsyncSession) -> list[dict[str, Any]]:
    """查询绑定了指定 Skill 的 Agent 列表"""
    # SQLite 中 JSON 数组包含某元素: json_each 展开后过滤
    result = await db.execute(
        text(
            """
            SELECT id, name, skills FROM agents
            WHERE EXISTS (
                SELECT 1 FROM json_each(agents.skills) WHERE value = :name
            )
            """
        ),
        {"name": name},
    )
    rows = result.fetchall()
    return [{"id": row[0], "name": row[1], "skills": row[2]} for row in rows]


async def cleanup_skill_bindings(name: str, db: AsyncSession) -> int:
    """从所有绑定该 Skill 的 Agent 的 skills 数组中移除指定 name。

    Returns:
        受影响的 Agent 数量
    """
    import json

    result = await db.execute(
        text(
            """
            SELECT id, skills FROM agents
            WHERE EXISTS (
                SELECT 1 FROM json_each(agents.skills) WHERE value = :name
            )
            """
        ),
        {"name": name},
    )
    rows = result.fetchall()
    count = 0
    for row in rows:
        agent_id, skills_json = row[0], row[1]
        skills = json.loads(skills_json) if skills_json else []
        if name in skills:
            skills.remove(name)
            await db.execute(
                text("UPDATE agents SET skills = :skills WHERE id = :id"),
                {"skills": json.dumps(skills), "id": agent_id},
            )
            count += 1

    if count > 0:
        await db.commit()
        logger.info(f"清理了 {count} 个 Agent 对 Skill '{name}' 的绑定")

    return count

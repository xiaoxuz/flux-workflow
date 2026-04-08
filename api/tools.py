from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
from datetime import datetime
import time
import traceback

from core.database import get_db
from models import CustomTool
from schemas import ToolCreate, ToolUpdate, ToolSchema, ToolTestRequest, ToolTestResponse

router = APIRouter()


@router.get("/tools", response_model=List[ToolSchema])
async def list_tools(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomTool).order_by(CustomTool.is_builtin.desc(), CustomTool.name))
    tools = result.scalars().all()
    return [
        ToolSchema(
            id=t.id,
            name=t.name,
            display_name=t.display_name,
            description=t.description,
            code=t.code,
            parameters=t.parameters,
            return_type=t.return_type,
            is_builtin=bool(t.is_builtin),
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tools
    ]


@router.get("/tools/{tool_id}", response_model=ToolSchema)
async def get_tool(tool_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomTool).where(CustomTool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="工具不存在")
    return ToolSchema(
        id=tool.id,
        name=tool.name,
        display_name=tool.display_name,
        description=tool.description,
        code=tool.code,
        parameters=tool.parameters,
        return_type=tool.return_type,
        is_builtin=bool(tool.is_builtin),
        created_at=tool.created_at,
        updated_at=tool.updated_at,
    )


@router.post("/tools", response_model=ToolSchema)
async def create_tool(data: ToolCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(CustomTool).where(CustomTool.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="工具名称已存在")

    now = datetime.utcnow()
    tool = CustomTool(
        id=f"tool_{uuid.uuid4().hex[:12]}",
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        code=data.code,
        parameters=data.parameters,
        return_type=data.return_type,
        is_builtin=0,
        created_at=now,
        updated_at=now,
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return ToolSchema(
        id=tool.id,
        name=tool.name,
        display_name=tool.display_name,
        description=tool.description,
        code=tool.code,
        parameters=tool.parameters,
        return_type=tool.return_type,
        is_builtin=False,
        created_at=tool.created_at,
        updated_at=tool.updated_at,
    )


@router.put("/tools/{tool_id}", response_model=ToolSchema)
async def update_tool(tool_id: str, data: ToolUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomTool).where(CustomTool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="工具不存在")
    if tool.is_builtin:
        raise HTTPException(status_code=400, detail="内置工具不可修改")

    if data.display_name is not None:
        tool.display_name = data.display_name
    if data.description is not None:
        tool.description = data.description
    if data.code is not None:
        tool.code = data.code
    if data.parameters is not None:
        tool.parameters = data.parameters
    if data.return_type is not None:
        tool.return_type = data.return_type
    tool.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(tool)
    return ToolSchema(
        id=tool.id,
        name=tool.name,
        display_name=tool.display_name,
        description=tool.description,
        code=tool.code,
        parameters=tool.parameters,
        return_type=tool.return_type,
        is_builtin=False,
        created_at=tool.created_at,
        updated_at=tool.updated_at,
    )


@router.delete("/tools/{tool_id}")
async def delete_tool(tool_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomTool).where(CustomTool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="工具不存在")
    if tool.is_builtin:
        raise HTTPException(status_code=400, detail="内置工具不可删除")
    await db.delete(tool)
    await db.commit()
    return {"message": "删除成功"}


@router.post("/tools/{tool_id}/test", response_model=ToolTestResponse)
async def test_tool(tool_id: str, data: ToolTestRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomTool).where(CustomTool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="工具不存在")

    start_time = time.time()
    try:
        from typing import Any, Dict, List, Tuple, Optional, Union

        exec_globals = {
            "__builtins__": __builtins__,
            "Any": Any,
            "Dict": Dict,
            "List": List,
            "Tuple": Tuple,
            "Optional": Optional,
            "Union": Union,
        }
        exec(tool.code, exec_globals)

        func_name = tool.name
        if func_name not in exec_globals:
            return ToolTestResponse(
                result=None,
                error=f"代码中未找到函数 '{func_name}'",
                execution_time=time.time() - start_time,
            )

        func = exec_globals[func_name]
        if not callable(func):
            return ToolTestResponse(
                result=None,
                error=f"'{func_name}' 不是可调用的函数",
                execution_time=time.time() - start_time,
            )

        import inspect

        sig = inspect.signature(func)
        params = list(sig.parameters.values())

        if isinstance(data.args, dict):
            result_value = func(**data.args)
        elif isinstance(data.args, (list, tuple)):
            if len(params) == 1 and len(data.args) > 1:
                result_value = func(data.args)
            else:
                result_value = func(*data.args)
        elif data.args is None or data.args == {}:
            result_value = func()
        else:
            result_value = func(data.args)

        return ToolTestResponse(
            result=result_value,
            error=None,
            execution_time=time.time() - start_time,
        )
    except Exception as e:
        return ToolTestResponse(
            result=None,
            error=f"{str(e)}\n{traceback.format_exc()}",
            execution_time=time.time() - start_time,
        )

import uuid
import time
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import AgentModel
from schemas import (
    AgentCreate,
    AgentUpdate,
    AgentSchema,
    AgentChatRequest,
    AgentChatResponse,
)
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agents"])


@router.get("/agents", response_model=List[AgentSchema])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentModel).order_by(AgentModel.created_at.desc()))
    agents = result.scalars().all()
    return agents


@router.get("/agents/{agent_id}", response_model=AgentSchema)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    return agent


@router.post("/agents", response_model=AgentSchema)
async def create_agent(data: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent_id = f"agent_{uuid.uuid4().hex[:16]}"

    agent = AgentModel(
        id=agent_id,
        name=data.name,
        description=data.description,
        mode=data.mode,
        model_name=data.model_name,
        base_url=data.base_url,
        api_key=data.api_key,
        system_prompt=data.system_prompt,
        tools=data.tools,
        max_steps=data.max_steps,
        verbose=1 if data.verbose else 0,
    )

    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.put("/agents/{agent_id}", response_model=AgentSchema)
async def update_agent(agent_id: str, data: AgentUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")

    if data.name is not None:
        agent.name = data.name
    if data.description is not None:
        agent.description = data.description
    if data.mode is not None:
        agent.mode = data.mode
    if data.model_name is not None:
        agent.model_name = data.model_name
    if data.base_url is not None:
        agent.base_url = data.base_url
    if data.api_key is not None:
        agent.api_key = data.api_key
    if data.system_prompt is not None:
        agent.system_prompt = data.system_prompt
    if data.tools is not None:
        agent.tools = data.tools
    if data.max_steps is not None:
        agent.max_steps = data.max_steps
    if data.verbose is not None:
        agent.verbose = 1 if data.verbose else 0

    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")

    await db.delete(agent)
    await db.commit()
    return {"message": "删除成功"}


@router.post("/agents/{agent_id}/chat", response_model=AgentChatResponse)
async def chat_with_agent(agent_id: str, data: AgentChatRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")

    try:
        from langchain_openai import ChatOpenAI
        from flux_agent.agents import create_agent, AgentConfig
    except ImportError as e:
        return AgentChatResponse(
            answer="",
            status="failed",
            error=f"缺少依赖: {str(e)}",
        )

    try:
        from services.session_manager import SessionManager

        session_id = data.session_id
        if not session_id:
            session_id = SessionManager.create_session()

        history = SessionManager.get_history(session_id)

        llm_params = {"model": agent.model_name}
        if agent.api_key:
            llm_params["api_key"] = agent.api_key
        if agent.base_url:
            llm_params["base_url"] = agent.base_url

        llm = ChatOpenAI(**llm_params)

        from services.tool_executor import ToolExecutor

        await ToolExecutor.load_all_tools(force_refresh=True)
        all_tools = ToolExecutor._tools_cache

        tools = []
        for tool_name in agent.tools:
            if tool_name in all_tools:
                tools.append(all_tools[tool_name])

        agent_config = AgentConfig(
            verbose=bool(agent.verbose),
            max_steps=agent.max_steps,
        )

        agent_instance = create_agent(
            mode=agent.mode,
            llm=llm,
            tools=tools if tools else None,
            system_prompt=agent.system_prompt or None,
            config=agent_config,
        )

        start_time = time.time()

        invoke_params = {"input": data.message}
        if history:
            invoke_params["messages"] = history

        response = agent_instance.invoke(**invoke_params)
        elapsed = time.time() - start_time

        if history:
            step_start_index = len(history) * 2
            current_steps = (
                response.steps[step_start_index:]
                if step_start_index < len(response.steps)
                else response.steps[-2:]
                if response.steps
                else []
            )
        else:
            current_steps = response.steps

        SessionManager.add_message(session_id, "user", data.message)
        SessionManager.add_message(session_id, "assistant", response.answer)

        return AgentChatResponse(
            answer=response.answer,
            session_id=session_id,
            status=response.status.value if hasattr(response.status, "value") else str(response.status),
            steps=[
                {
                    "content": s.content,
                    "type": s.step_type.value if hasattr(s.step_type, "value") else str(s.step_type),
                    "tool_name": s.tool_name,
                    "tool_input": s.tool_input,
                    "tool_output": s.tool_output,
                }
                for s in current_steps
            ],
            total_steps=response.total_steps,
            elapsed_time=elapsed,
        )

    except Exception as e:
        logger.error(f"Agent 对话失败: {e}")
        return AgentChatResponse(
            answer="",
            status="failed",
            error=str(e),
        )

    try:
        llm_params = {"model": agent.model_name}
        if agent.api_key:
            llm_params["api_key"] = agent.api_key
        if agent.base_url:
            llm_params["base_url"] = agent.base_url

        llm = ChatOpenAI(**llm_params)

        from services.tool_executor import ToolExecutor

        await ToolExecutor.load_all_tools(force_refresh=True)
        all_tools = ToolExecutor._tools_cache

        tools = []
        for tool_name in agent.tools:
            if tool_name in all_tools:
                tools.append(all_tools[tool_name])

        agent_config = AgentConfig(
            verbose=bool(agent.verbose),
            max_steps=agent.max_steps,
        )

        agent_instance = create_agent(
            mode=agent.mode,
            llm=llm,
            tools=tools if tools else None,
            system_prompt=agent.system_prompt or None,
            config=agent_config,
        )

        start_time = time.time()

        invoke_params = {"query": data.message}
        if data.history:
            invoke_params["messages"] = data.history

        response = agent_instance.invoke(**invoke_params)
        elapsed = time.time() - start_time

        return AgentChatResponse(
            answer=response.answer,
            status=response.status.value if hasattr(response.status, "value") else str(response.status),
            steps=[
                {
                    "content": s.content,
                    "type": s.step_type.value if hasattr(s.step_type, "value") else str(s.step_type),
                    "tool_name": s.tool_name,
                    "tool_input": s.tool_input,
                    "tool_output": s.tool_output,
                }
                for s in response.steps
            ],
            total_steps=response.total_steps,
            elapsed_time=elapsed,
        )

    except Exception as e:
        logger.error(f"Agent 对话失败: {e}")
        return AgentChatResponse(
            answer="",
            status="failed",
            error=str(e),
        )

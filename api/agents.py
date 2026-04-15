import uuid
import os
import json
import time
import asyncio
import logging
from typing import List, AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

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
        skills=data.skills,
        mcp_servers=data.mcp_servers,
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
    if data.skills is not None:
        agent.skills = data.skills
    if data.mcp_servers is not None:
        agent.mcp_servers = data.mcp_servers
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


def _build_agent_from_model(agent: AgentModel, data: AgentChatRequest):
    """从 AgentModel 构建 agent 实例和 session_id。

    返回: (agent_instance, session_id, llm, tools, skills, agent_config)
    """
    from langchain_openai import ChatOpenAI
    from flux_agent.agents import create_agent, AgentConfig

    # Session 管理
    from services.session_manager import SessionManager

    session_id = data.session_id
    if not session_id:
        session_id = SessionManager.create_session()

    history = SessionManager.get_history(session_id)

    # LLM 初始化
    llm_params = {"model": agent.model_name}
    if agent.api_key:
        llm_params["api_key"] = agent.api_key
    if agent.base_url:
        llm_params["base_url"] = agent.base_url

    llm = ChatOpenAI(**llm_params)

    # Tool 加载
    from services.tool_executor import ToolExecutor

    import asyncio as _asyncio
    try:
        loop = _asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # 在运行中的事件循环中，不能直接 await，用 run_until_complete 的替代方案
        # 这里我们假设 ToolExecutor.load_all_tools 是异步的，需要在调用前加载
        # 实际上这个函数是同步调用的，我们需要让它能工作
        pass

    all_tools = {}
    try:
        if loop and loop.is_running():
            # 如果已经在事件循环中，尝试同步加载
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    asyncio.run,
                    ToolExecutor.load_all_tools(force_refresh=True)
                )
                future.result(timeout=30)
        else:
            asyncio.run(ToolExecutor.load_all_tools(force_refresh=True))
        all_tools = ToolExecutor._tools_cache
    except Exception as e:
        logger.warning(f"ToolExecutor.load_all_tools 失败: {e}")
        all_tools = getattr(ToolExecutor, "_tools_cache", {})

    tools = []
    for tool_name in (agent.tools or []):
        if tool_name in all_tools:
            tools.append(all_tools[tool_name])

    # Skill 加载
    skills = []
    if agent.skills:
        try:
            from flux_agent.agents import SkillLoader

            skills_dir = os.environ.get("SKILLS_DIR", os.path.join(os.getcwd(), "skills"))
            loader = SkillLoader(skills_dir)
            for skill_name in agent.skills:
                try:
                    skill = loader.load(skill_name)
                    skills.append(skill)
                except Exception as e:
                    logger.warning(f"Skill '{skill_name}' 加载失败: {e}")
        except Exception as e:
            logger.warning(f"SkillLoader 初始化失败: {e}")

    agent_config = AgentConfig(
        verbose=bool(agent.verbose),
        max_steps=agent.max_steps,
    )

    agent_instance = create_agent(
        mode=agent.mode,
        llm=llm,
        tools=tools if tools else None,
        skills=skills if skills else None,
        system_prompt=agent.system_prompt or None,
        config=agent_config,
        mcp_servers=agent.mcp_servers or None,
    )

    return agent_instance, session_id, history


async def _load_tools_async():
    """异步加载工具缓存。"""
    from services.tool_executor import ToolExecutor
    await ToolExecutor.load_all_tools(force_refresh=True)
    return ToolExecutor._tools_cache


def _build_agent_from_model_sync(agent: AgentModel, data: AgentChatRequest, all_tools: dict):
    """从 AgentModel 构建 agent 实例（同步版本，工具已预加载）。

    返回: (agent_instance, session_id, history)
    """
    from langchain_openai import ChatOpenAI
    from flux_agent.agents import create_agent, AgentConfig

    # Session 管理
    from services.session_manager import SessionManager

    session_id = data.session_id
    if not session_id:
        session_id = SessionManager.create_session()

    history = SessionManager.get_history(session_id)

    # LLM 初始化
    llm_params = {"model": agent.model_name}
    if agent.api_key:
        llm_params["api_key"] = agent.api_key
    if agent.base_url:
        llm_params["base_url"] = agent.base_url

    llm = ChatOpenAI(**llm_params)

    # Tool 过滤
    tools = []
    for tool_name in (agent.tools or []):
        if tool_name in all_tools:
            tools.append(all_tools[tool_name])

    # Skill 加载
    skills = []
    if agent.skills:
        try:
            from flux_agent.agents import SkillLoader

            skills_dir = os.environ.get("SKILLS_DIR", os.path.join(os.getcwd(), "skills"))
            loader = SkillLoader(skills_dir)
            for skill_name in agent.skills:
                try:
                    skill = loader.load(skill_name)
                    skills.append(skill)
                except Exception as e:
                    logger.warning(f"Skill '{skill_name}' 加载失败: {e}")
        except Exception as e:
            logger.warning(f"SkillLoader 初始化失败: {e}")

    agent_config = AgentConfig(
        verbose=bool(agent.verbose),
        max_steps=agent.max_steps,
    )

    agent_instance = create_agent(
        mode=agent.mode,
        llm=llm,
        tools=tools if tools else None,
        skills=skills if skills else None,
        system_prompt=agent.system_prompt or None,
        config=agent_config,
    )

    return agent_instance, session_id, history


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

        # 预加载工具
        from services.tool_executor import ToolExecutor
        await ToolExecutor.load_all_tools(force_refresh=True)
        all_tools = ToolExecutor._tools_cache

        agent_instance, session_id, history = _build_agent_from_model_sync(agent, data, all_tools)

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


async def sse_event_generator(agent: AgentModel, data: AgentChatRequest):
    """SSE 事件异步生成器。"""
    from services.session_manager import SessionManager
    from services.tool_executor import ToolExecutor

    # 预加载工具
    await ToolExecutor.load_all_tools(force_refresh=True)
    all_tools = ToolExecutor._tools_cache

    agent_instance, session_id, history = _build_agent_from_model_sync(agent, data, all_tools)

    queue: asyncio.Queue = asyncio.Queue()
    result_holder = {"response": None}

    def on_step_callback(step):
        """同步回调，将 step 放入队列。"""
        queue.put_nowait(step)

    from flux_agent.agents import AgentConfig
    agent_config = AgentConfig(
        verbose=bool(agent.verbose),
        max_steps=agent.max_steps,
        on_step=on_step_callback,
    )

    # 重新创建带回调的 agent 实例
    from langchain_openai import ChatOpenAI
    from flux_agent.agents import create_agent

    llm_params = {"model": agent.model_name}
    if agent.api_key:
        llm_params["api_key"] = agent.api_key
    if agent.base_url:
        llm_params["base_url"] = agent.base_url

    llm = ChatOpenAI(**llm_params)

    tools = []
    for tool_name in (agent.tools or []):
        if tool_name in all_tools:
            tools.append(all_tools[tool_name])

    skills = []
    if agent.skills:
        try:
            from flux_agent.agents import SkillLoader
            skills_dir = os.environ.get("SKILLS_DIR", os.path.join(os.getcwd(), "skills"))
            loader = SkillLoader(skills_dir)
            for skill_name in agent.skills:
                try:
                    skill = loader.load(skill_name)
                    skills.append(skill)
                except Exception as e:
                    logger.warning(f"Skill '{skill_name}' 加载失败: {e}")
        except Exception as e:
            logger.warning(f"SkillLoader 初始化失败: {e}")

    agent_with_callback = create_agent(
        mode=agent.mode,
        llm=llm,
        tools=tools if tools else None,
        skills=skills if skills else None,
        system_prompt=agent.system_prompt or None,
        config=agent_config,
        mcp_servers=agent.mcp_servers or None,
    )

    start_time = time.time()

    async def run_agent():
        """后台执行 agent.invoke。"""
        try:
            invoke_params = {"input": data.message}
            if history:
                invoke_params["messages"] = history
            response = agent_with_callback.invoke(**invoke_params)
            result_holder["response"] = response
        except Exception as e:
            logger.error(f"Agent invoke 失败: {e}")
            result_holder["error"] = str(e)
        finally:
            # 发送结束信号
            queue.put_nowait(None)

    # 启动后台任务
    asyncio.create_task(run_agent())

    try:
        # 从队列读取并 yield SSE 事件
        while True:
            step = await queue.get()
            if step is None:
                break

            step_data = {}
            if hasattr(step, "content"):
                step_data["content"] = step.content
            if hasattr(step, "step_type"):
                step_data["step_type"] = step.step_type.value if hasattr(step.step_type, "value") else str(step.step_type)
            if hasattr(step, "tool_name"):
                step_data["tool_name"] = step.tool_name
            if hasattr(step, "tool_input"):
                step_data["tool_input"] = step.tool_input
            if hasattr(step, "tool_output"):
                step_data["tool_output"] = step.tool_output
            if hasattr(step, "__dict__"):
                for k, v in step.__dict__.items():
                    if k not in step_data and not k.startswith("_"):
                        try:
                            json.dumps(v)
                            step_data[k] = v
                        except (TypeError, ValueError):
                            step_data[k] = str(v)

            yield {
                "event": "step",
                "data": json.dumps({"type": "step", "data": step_data}),
            }

        # 完成事件
        elapsed = time.time() - start_time
        response = result_holder.get("response")
        error = result_holder.get("error")

        if error:
            done_data = {
                "type": "done",
                "data": {
                    "answer": "",
                    "total_steps": 0,
                    "elapsed_time": elapsed,
                    "session_id": session_id,
                    "error": error,
                },
            }
        else:
            answer = response.answer if response else ""
            total_steps = response.total_steps if response else 0

            # 保存消息到 session
            SessionManager.add_message(session_id, "user", data.message)
            if answer:
                SessionManager.add_message(session_id, "assistant", answer)

            done_data = {
                "type": "done",
                "data": {
                    "answer": answer,
                    "total_steps": total_steps,
                    "elapsed_time": elapsed,
                    "session_id": session_id,
                },
            }

        yield {
            "event": "done",
            "data": json.dumps(done_data),
        }

    except Exception as e:
        logger.error(f"SSE 流式输出异常: {e}")
        yield {
            "event": "error",
            "data": json.dumps({"type": "error", "data": {"error": str(e)}}),
        }


@router.post("/agents/{agent_id}/chat/stream")
async def chat_with_agent_stream(agent_id: str, data: AgentChatRequest, db: AsyncSession = Depends(get_db)):
    """SSE 流式对话端点。"""
    result = await db.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")

    try:
        from langchain_openai import ChatOpenAI
        from flux_agent.agents import create_agent, AgentConfig
    except ImportError as e:
        async def error_generator():
            yield {
                "event": "error",
                "data": json.dumps({"type": "error", "data": {"error": f"缺少依赖: {str(e)}"}}),
            }
        return EventSourceResponse(error_generator())

    return EventSourceResponse(sse_event_generator(agent, data))

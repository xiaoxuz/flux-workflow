from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import workflows, executions, nodes
from api import tools as tools_api
from api import knowledge_bases as kb_api
from api import agents as agents_api
from api import skills as skills_api
from api import mcp_servers as mcp_servers_api
from core.database import engine
from models import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_skills_dir() -> str:
    """获取 skills 根目录，默认应用工作目录下的 skills/，可通过 SKILLS_DIR 环境变量覆盖"""
    return os.environ.get("SKILLS_DIR", os.path.join(os.getcwd(), "skills"))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # 1. 创建所有 ORM 表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized")

    # 2. 幂等迁移：为 agents 表添加 skills 列（SQLite 忽略已存在的列）
    from sqlalchemy import text

    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE agents ADD COLUMN skills JSON"))
            logger.info("Added 'skills' column to agents table")
        except Exception:
            pass  # 列已存在，忽略

    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE agents ADD COLUMN mcp_servers JSON"))
            logger.info("Added 'mcp_servers' column to agents table")
        except Exception:
            pass  # 列已存在，忽略

    logger.info("Database migrations completed")

    # 3. 确保 skills/ 目录存在
    skills_dir = _get_skills_dir()
    os.makedirs(skills_dir, exist_ok=True)
    logger.info(f"Skills directory ensured: {skills_dir}")

    from services.builtin_tools import init_builtin_tools

    await init_builtin_tools()
    logger.info("Builtin tools initialized")

    yield
    await engine.dispose()


app = FastAPI(
    title="Flux Workflow",
    description="工作流编排模块 - 前端编排 + 后端管理",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows.router, prefix="/flux-workflow/api", tags=["工作流"])
app.include_router(executions.router, prefix="/flux-workflow/api", tags=["执行"])
app.include_router(nodes.router, prefix="/flux-workflow/api", tags=["节点"])
app.include_router(tools_api.router, prefix="/flux-workflow/api", tags=["工具"])
app.include_router(kb_api.router, prefix="/flux-workflow/api", tags=["知识库"])
app.include_router(agents_api.router, prefix="/flux-workflow/api", tags=["Agent"])
app.include_router(skills_api.router, prefix="/flux-workflow/api", tags=["Skill"])
app.include_router(mcp_servers_api.router, prefix="/flux-workflow/api", tags=["MCP Server"])


@app.get("/flux-workflow/api/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8006, reload=True)

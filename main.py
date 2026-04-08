from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import workflows, executions, nodes
from api import tools as tools_api
from api import knowledge_bases as kb_api
from api import agents as agents_api
from core.database import engine
from models import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized")

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


@app.get("/flux-workflow/api/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8006, reload=True)

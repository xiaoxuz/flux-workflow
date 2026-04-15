import logging
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from schemas import MCPServerConfig, MCPServerTestRequest, MCPServerTestResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mcp-servers"])


class MCPServerListResponse(BaseModel):
    servers: List[dict] = []
    total: int = 0


@router.get("/mcp-servers", response_model=MCPServerListResponse)
async def list_mcp_servers():
    """列出所有 agent 上的 MCP 服务器（聚合去重）。"""
    from models import AgentModel
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from core.database import get_db

    db: AsyncSession = next(get_db())
    try:
        result = await db.execute(select(AgentModel))
        agents = result.scalars().all()

        server_map = {}
        for agent in agents:
            if agent.mcp_servers:
                for srv in agent.mcp_servers:
                    key = srv.get("name", "")
                    if key and key not in server_map:
                        server_map[key] = {**srv, "used_by": []}
                    if key:
                        server_map[key]["used_by"].append(agent.id)

        return MCPServerListResponse(
            servers=list(server_map.values()),
            total=len(server_map),
        )
    finally:
        await db.close()


@router.post("/mcp-servers/test", response_model=MCPServerTestResponse)
async def test_mcp_server(req: MCPServerTestRequest):
    """测试 MCP 服务器连通性。"""
    try:
        from flux_agent.mcp import MultiServerMCPClient

        client = MultiServerMCPClient()

        config = req.server
        if config.transport == "stdio":
            await client.add_stdio_server(
                name=config.name,
                command=config.command,
                args=config.args or [],
                env=config.env,
                tool_name_prefix=config.tool_name_prefix,
            )
        elif config.transport == "http":
            await client.add_http_server(
                name=config.name,
                url=config.url,
                headers=config.headers,
                tool_name_prefix=config.tool_name_prefix,
            )
        elif config.transport == "streamable_http":
            await client.add_streamable_http_server(
                name=config.name,
                url=config.url,
                headers=config.headers,
                tool_name_prefix=config.tool_name_prefix,
            )
        else:
            return MCPServerTestResponse(
                success=False,
                error=f"不支持的传输类型: {config.transport}",
            )

        tools = await client.get_tools()
        tool_names = [t.name for t in tools] if tools else []

        await client.cleanup()

        return MCPServerTestResponse(
            success=True,
            tools=tool_names,
        )
    except Exception as e:
        logger.error(f"MCP Server 测试失败: {e}")
        return MCPServerTestResponse(
            success=False,
            error=str(e),
        )

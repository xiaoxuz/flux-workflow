import logging
from typing import Dict, Any, Callable, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ToolExecutor:
    """工具执行器"""

    _instance = None
    _tools_cache: Dict[str, Callable] = {}
    _last_refresh: Optional[datetime] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    async def load_all_tools(cls, force_refresh: bool = False) -> Dict[str, Callable]:
        """加载所有工具"""
        if not force_refresh and cls._tools_cache and cls._last_refresh:
            if (datetime.utcnow() - cls._last_refresh).total_seconds() < 60:
                return cls._tools_cache

        tools = {}

        tools.update(cls._load_builtin_tools())

        custom_tools = await cls._load_custom_tools()
        tools.update(custom_tools)

        cls._tools_cache = tools
        cls._last_refresh = datetime.utcnow()

        logger.info(f"Loaded {len(tools)} tools: {list(tools.keys())}")
        return tools

    @classmethod
    def _load_builtin_tools(cls) -> Dict[str, Callable]:
        """加载内置工具"""
        from services.builtin_tools import BUILTIN_TOOLS_CODE
        from langchain_core.tools import BaseTool

        tools = {}
        for name, tool_data in BUILTIN_TOOLS_CODE.items():
            try:
                local_vars = {}
                exec(tool_data["code"], {"__builtins__": __builtins__}, local_vars)
                tool_obj = local_vars.get(name)
                if tool_obj is not None and isinstance(tool_obj, BaseTool):
                    tools[name] = tool_obj
            except Exception as e:
                logger.error(f"Failed to load builtin tool {name}: {e}")

        return tools

    @classmethod
    async def _load_custom_tools(cls) -> Dict[str, Callable]:
        """从数据库加载自定义工具"""
        from langchain_core.tools import BaseTool

        tools = {}

        try:
            from core.database import async_session_maker
            from models import CustomTool
            from sqlalchemy import select

            async with async_session_maker() as session:
                result = await session.execute(select(CustomTool).where(CustomTool.is_builtin == 0))
                custom_tools = result.scalars().all()

                for tool in custom_tools:
                    try:
                        local_vars = {}
                        exec(tool.code, {"__builtins__": __builtins__}, local_vars)
                        tool_obj = local_vars.get(tool.name)
                        if tool_obj is not None and isinstance(tool_obj, BaseTool):
                            tools[tool.name] = tool_obj
                            logger.debug(f"Loaded custom tool: {tool.name}")
                    except Exception as e:
                        logger.error(f"Failed to load custom tool {tool.name}: {e}")
        except Exception as e:
            logger.error(f"Failed to load custom tools from database: {e}")

        return tools

    @classmethod
    async def get_tool(cls, tool_name: str) -> Optional[Callable]:
        """获取单个工具"""
        tools = await cls.load_all_tools()
        return tools.get(tool_name)

    @classmethod
    async def execute_tool(cls, tool_name: str, args: dict) -> Any:
        """执行工具"""
        tool = await cls.get_tool(tool_name)
        if not tool:
            raise ValueError(f"Tool not found: {tool_name}")

        return tool(**args)

    @classmethod
    def clear_cache(cls):
        """清除缓存"""
        cls._tools_cache = {}
        cls._last_refresh = None


async def get_all_tools() -> Dict[str, Callable]:
    """获取所有工具的便捷函数"""
    return await ToolExecutor.load_all_tools()

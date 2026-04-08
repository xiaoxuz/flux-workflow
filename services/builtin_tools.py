import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger(__name__)

BUILTIN_TOOLS_CODE = {
    "web_fetch": {
        "display_name": "网页抓取",
        "description": "通过URL抓取网页内容并返回文本",
        "code": '''from langchain_core.tools import tool

@tool
def web_fetch(url: str, extract_links: bool = False) -> str:
    """通过URL抓取网页内容。
    参数:
        url: 完整的URL地址，如 https://example.com
        extract_links: 是否同时提取页面中的链接，默认 False
    """
    import requests
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            return "错误：请安装 bs4: pip install beautifulsoup4"
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        links_text = ""
        if extract_links:
            links = []
            for a in soup.find_all("a", href=True):
                text = a.get_text(strip=True)
                href = a["href"]
                if text and href.startswith("http"):
                    links.append(f"- [{text}]({href})")
            if links:
                links_text = "\\n\\n## 页面链接\\n" + "\\n".join(links[:20])
        
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        
        text = soup.get_text(separator="\\n", strip=True)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        clean_text = "\\n".join(lines)
        
        max_length = 4000
        if len(clean_text) > max_length:
            clean_text = clean_text[:max_length] + "\\n...(已截断)"
        
        return clean_text + links_text
    except Exception as e:
        return f"错误：{str(e)}"
''',
        "parameters": {
            "url": {"type": "string", "description": "网页URL", "required": True},
            "extract_links": {
                "type": "boolean",
                "description": "是否提取页面链接",
                "default": False,
                "required": False,
            },
        },
        "return_type": "str",
    },
    "calculator": {
        "display_name": "计算器",
        "description": "执行数学表达式计算并返回结果",
        "code": '''from langchain_core.tools import tool

@tool
def calculator(expression: str) -> float:
    """执行数学表达式计算并返回结果
    参数:
        expression: 数学表达式，如 2 + 3 * 4
    返回:
        计算结果（浮点数）
    """
    import math
    allowed_names = {
        "abs": abs, "round": round, "min": min, "max": max,
        "sum": sum, "pow": pow, "sqrt": math.sqrt,
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "log": math.log, "log10": math.log10, "exp": math.exp,
        "pi": math.pi, "e": math.e,
    }
    result = eval(expression, {"__builtins__": {}}, allowed_names)
    return float(result)
''',
        "parameters": {
            "expression": {"type": "string", "description": "数学表达式", "required": True},
        },
        "return_type": "float",
    },
    "datetime_now": {
        "display_name": "当前时间",
        "description": "获取当前日期时间并格式化返回",
        "code": '''from langchain_core.tools import tool

@tool
def datetime_now(format_string: str = "%Y-%m-%d %H:%M:%S", use_utc: bool = False) -> str:
    """获取当前日期时间并格式化返回
    参数:
        format_string: 时间格式字符串，默认为年月日时分秒格式
        use_utc: 是否使用UTC时间，默认使用本地时间
    返回:
        格式化后的时间字符串
    """
    from datetime import datetime, timezone
    if use_utc:
        now = datetime.now(timezone.utc)
    else:
        now = datetime.now()
    return now.strftime(format_string)
''',
        "parameters": {
            "format_string": {
                "type": "string",
                "description": "时间格式",
                "default": "%Y-%m-%d %H:%M:%S",
                "required": False,
            },
            "use_utc": {"type": "boolean", "description": "是否使用UTC时间", "default": False, "required": False},
        },
        "return_type": "str",
    },
    "json_parser": {
        "display_name": "JSON解析器",
        "description": "解析JSON字符串并提取指定字段的值",
        "code": '''from langchain_core.tools import tool
import json

@tool
def json_parser(json_string: str, key_path: str = "") -> str:
    """解析JSON字符串并提取指定字段的值
    参数:
        json_string: 要解析的JSON字符串
        key_path: 字段路径，用点号分隔，如 data.name。为空则返回格式化的JSON
    返回:
        提取的值或格式化的JSON字符串
    """
    data = json.loads(json_string)
    if not key_path:
        return json.dumps(data, ensure_ascii=False, indent=2)
    for k in key_path.split("."):
        if isinstance(data, dict):
            data = data.get(k)
        elif isinstance(data, list) and k.isdigit():
            data = data[int(k)]
        else:
            return ""
    return str(data) if data is not None else ""
''',
        "parameters": {
            "json_string": {"type": "string", "description": "JSON字符串", "required": True},
            "key_path": {"type": "string", "description": "字段路径", "default": "", "required": False},
        },
        "return_type": "str",
    },
    "text_length": {
        "display_name": "文本长度",
        "description": "计算文本的字符数量",
        "code": '''from langchain_core.tools import tool

@tool
def text_length(text: str) -> int:
    """计算文本的字符数量
    参数:
        text: 要计算的文本内容
    返回:
        文本的字符数
    """
    return len(text)
''',
        "parameters": {
            "text": {"type": "string", "description": "文本内容", "required": True},
        },
        "return_type": "integer",
    },
}


async def init_builtin_tools():
    """初始化内置工具到数据库"""
    from core.database import async_session_maker
    from models import CustomTool
    from datetime import datetime
    import uuid

    async with async_session_maker() as session:
        for name, tool_data in BUILTIN_TOOLS_CODE.items():
            result = await session.execute(
                __import__("sqlalchemy", fromlist=["select"]).select(CustomTool).where(CustomTool.name == name)
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.display_name = tool_data["display_name"]
                existing.description = tool_data["description"]
                existing.code = tool_data["code"]
                existing.parameters = tool_data["parameters"]
                existing.return_type = tool_data["return_type"]
                existing.updated_at = datetime.utcnow()
                logger.info(f"Updated builtin tool: {name}")
            else:
                now = datetime.utcnow()
                tool = CustomTool(
                    id=f"builtin_{name}",
                    name=name,
                    display_name=tool_data["display_name"],
                    description=tool_data["description"],
                    code=tool_data["code"],
                    parameters=tool_data["parameters"],
                    return_type=tool_data["return_type"],
                    is_builtin=1,
                    created_at=now,
                    updated_at=now,
                )
                session.add(tool)
                logger.info(f"Created builtin tool: {name}")

        await session.commit()


def get_builtin_tool_code(tool_name: str) -> str:
    """获取内置工具代码"""
    return BUILTIN_TOOLS_CODE.get(tool_name, {}).get("code", "")

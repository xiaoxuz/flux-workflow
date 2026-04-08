from fastapi import APIRouter
from typing import List
from schemas import NodeInfo

router = APIRouter()

NODE_TYPES = {
    "llm": "LLM 节点 - 大模型调用",
    "http": "HTTP 请求节点 - 发送 HTTP 请求",
    "condition": "条件分支节点 - 根据条件分支",
    "loop": "循环节点 - 循环执行",
    "transform": "数据转换节点 - 数据处理",
    "tool": "工具调用节点 - 调用外部工具",
    "parallel": "并行执行节点 - 并行运行",
    "subgraph": "子图节点 - 嵌入子工作流",
    "human": "人工输入节点 - 等待人工输入",
    "start": "开始节点 - 流程起点",
    "end": "结束节点 - 流程终点",
}


@router.get("/nodes", response_model=List[NodeInfo])
async def list_nodes():
    return [NodeInfo(type=node_type, available=True) for node_type in NODE_TYPES.keys()]


@router.get("/nodes/{node_type}")
async def get_node_info(node_type: str):
    if node_type not in NODE_TYPES:
        return {"error": "未知节点类型"}
    return {
        "type": node_type,
        "description": NODE_TYPES[node_type],
    }

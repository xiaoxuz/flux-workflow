import logging
from datetime import datetime
from typing import Dict, Any
import uuid
import json

from flux_agent import WorkflowRunner

from models import Execution, ExecutionStatus, TraceNode
from core.database import async_session_maker

logger = logging.getLogger(__name__)


def serialize_data(obj):
    """把对象转换成可 JSON 序列化的格式"""
    if obj is None:
        return None
    if hasattr(obj, "content"):
        return {"type": obj.__class__.__name__, "content": str(obj.content)}
    if isinstance(obj, dict):
        return {k: serialize_data(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [serialize_data(item) for item in obj]
    if isinstance(obj, (str, int, float, bool)):
        return obj
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


NODE_TYPE_MAP = {
    "llm": "LLMNode",
    "http": "HTTPRequestNode",
    "condition": "ConditionNode",
    "loop": "LoopNode",
    "transform": "TransformNode",
    "tool": "ToolNode",
    "parallel": "ParallelNode",
    "subgraph": "SubgraphNode",
    "human": "HumanInputNode",
    "start": None,
    "end": None,
}


def convert_canvas_to_flux_config(graph: Dict) -> Dict[str, Any]:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node_id_to_type = {}
    node_id_to_data = {}
    start_node_id = None
    end_node_ids = []

    for node in nodes:
        node_type = node.get("type", "")
        node_id = node.get("id")
        node_id_to_type[node_id] = node_type
        node_id_to_data[node_id] = node.get("data", {})

        if node_type == "start":
            start_node_id = node_id
        elif node_type == "end":
            end_node_ids.append(node_id)

    flux_nodes = []
    for node in nodes:
        node_type = node.get("type", "")
        node_data = node.get("data", {})

        if node_type in ("start", "end"):
            continue

        flux_type = NODE_TYPE_MAP.get(node_type, node_type)
        if not flux_type:
            continue

        config = node_data.get("config", {})

        if node_type == "condition":
            branches = config.get("branches", [])
            updated_branches = []
            for branch in branches:
                new_branch = dict(branch)
                new_branch["target"] = "END"
                updated_branches.append(new_branch)
            config = dict(config)
            config["branches"] = updated_branches

        flux_node = {
            "id": node.get("id"),
            "type": flux_type,
            "config": config,
        }

        if "retry_policy" in node_data:
            flux_node["retry_policy"] = node_data["retry_policy"]
        if "cache_policy" in node_data:
            flux_node["cache_policy"] = node_data["cache_policy"]

        flux_nodes.append(flux_node)

    condition_map_by_source: Dict[str, Dict[str, str]] = {}
    flux_edges = []

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        source_handle = edge.get("sourceHandle")

        if source == start_node_id or source == "START":
            source = "START"
        if target in end_node_ids or target == "END":
            target = "END"

        source_node_type = node_id_to_type.get(source, "")

        if source_node_type == "condition" and source_handle:
            node_data = node_id_to_data.get(source, {})
            branches = node_data.get("config", {}).get("branches", [])

            branch_index = None
            if source_handle.startswith("branch_"):
                try:
                    branch_index = int(source_handle.replace("branch_", ""))
                except ValueError:
                    pass

            if branch_index is not None and branch_index < len(branches):
                if source not in condition_map_by_source:
                    condition_map_by_source[source] = {}

                condition_map_by_source[source][target] = target

                flux_node = next((n for n in flux_nodes if n["id"] == source), None)
                if flux_node and "branches" in flux_node["config"]:
                    if branch_index < len(flux_node["config"]["branches"]):
                        flux_node["config"]["branches"][branch_index]["target"] = target
        else:
            if source not in condition_map_by_source:
                flux_edges.append({"from": source, "to": target})

    for source, condition_map in condition_map_by_source.items():
        flux_edges.append(
            {
                "from": source,
                "condition_map": condition_map,
            }
        )

    return {
        "workflow": {"name": "workflow"},
        "nodes": flux_nodes,
        "edges": flux_edges,
    }


async def execute_workflow_async(execution_id: str, graph: Dict, inputs: Dict, db=None):
    async with async_session_maker() as session:
        from sqlalchemy import select

        result = await session.execute(select(Execution).where(Execution.id == execution_id))
        execution = result.scalar_one_or_none()

        if not execution:
            logger.error(f"Execution {execution_id} not found")
            return

        execution.status = ExecutionStatus.RUNNING
        execution.started_at = datetime.utcnow()
        await session.commit()

        trace_records = []

        def input_hook(node_id, state):
            logger.info(f"[IN] Node: {node_id}")
            trace_records.append(
                {
                    "node_id": node_id,
                    "event": "input",
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": state.get("data", {}),
                }
            )

        def output_hook(node_id, state, output):
            logger.info(f"[OUT] Node: {node_id}")
            for trace in trace_records:
                if trace["node_id"] == node_id and trace["event"] == "input":
                    trace["output"] = output
                    trace["finished_at"] = datetime.utcnow()
                    break

        try:
            flux_config = convert_canvas_to_flux_config(graph)
            logger.info(f"Flux config: {json.dumps(flux_config, indent=2, ensure_ascii=False)}")

            from services.tool_executor import ToolExecutor

            await ToolExecutor.load_all_tools(force_refresh=True)
            all_tools = ToolExecutor._tools_cache

            runner = WorkflowRunner(
                config_dict=flux_config,
                on_node_input=input_hook,
                on_node_output=output_hook,
                tools=all_tools,
            )

            initial_state = {
                "data": inputs,
                "context": {"execution_id": execution_id},
            }

            result = runner.invoke(initial_state)

            execution.outputs = serialize_data(result.get("data", {}))
            execution.status = ExecutionStatus.SUCCESS
            execution.finished_at = datetime.utcnow()

            for trace_data in trace_records:
                trace = TraceNode(
                    id=f"trace_{uuid.uuid4().hex[:12]}",
                    execution_id=execution_id,
                    node_id=trace_data.get("node_id", ""),
                    node_type="",
                    status="success",
                    input_data=serialize_data(trace_data.get("data", {})),
                    output_data=serialize_data(trace_data.get("output", {})),
                    finished_at=trace_data.get("finished_at"),
                )
                session.add(trace)

            logger.info(f"Execution {execution_id} completed successfully")

        except Exception as e:
            logger.error(f"Execution {execution_id} failed: {e}", exc_info=True)
            execution.status = ExecutionStatus.FAILED
            execution.error = str(e)
            execution.finished_at = datetime.utcnow()

        await session.commit()

        return execution

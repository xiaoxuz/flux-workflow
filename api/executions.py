from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
from datetime import datetime

from core.database import get_db
from models import Execution, Workflow, ExecutionStatus, TraceNode
from schemas import ExecutionSchema, ExecutionCreate, TraceNodeSchema

router = APIRouter()


@router.get("/workflows/{workflow_id}/executions", response_model=List[ExecutionSchema])
async def list_executions(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Execution).where(Execution.workflow_id == workflow_id).order_by(Execution.created_at.desc())
    )
    executions = result.scalars().all()
    return [
        ExecutionSchema(
            id=e.id,
            workflow_id=e.workflow_id,
            workflow_version=e.workflow_version,
            status=e.status.value,
            inputs=e.inputs,
            outputs=e.outputs,
            total_tokens=e.total_tokens,
            total_cost=e.total_cost,
            duration_ms=e.duration_ms,
            error=e.error,
            started_at=e.started_at,
            finished_at=e.finished_at,
            created_at=e.created_at,
        )
        for e in executions
    ]


@router.get("/executions/{execution_id}", response_model=ExecutionSchema)
async def get_execution(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Execution).where(Execution.id == execution_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return ExecutionSchema(
        id=execution.id,
        workflow_id=execution.workflow_id,
        workflow_version=execution.workflow_version,
        status=execution.status.value,
        inputs=execution.inputs,
        outputs=execution.outputs,
        total_tokens=execution.total_tokens,
        total_cost=execution.total_cost,
        duration_ms=execution.duration_ms,
        error=execution.error,
        started_at=execution.started_at,
        finished_at=execution.finished_at,
        created_at=execution.created_at,
    )


@router.get("/executions/{execution_id}/trace")
async def get_execution_trace(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TraceNode).where(TraceNode.execution_id == execution_id).order_by(TraceNode.started_at)
    )
    trace_nodes = result.scalars().all()
    return {
        "nodes": [
            TraceNodeSchema(
                id=t.id,
                node_id=t.node_id,
                node_name=t.node_name,
                node_type=t.node_type,
                status=t.status,
                input_data=t.input_data,
                output_data=t.output_data,
                error=t.error,
                tokens=t.tokens,
                cost=t.cost,
                duration_ms=t.duration_ms,
                started_at=t.started_at,
                finished_at=t.finished_at,
            ).model_dump()
            for t in trace_nodes
        ],
        "logs": [],
    }


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, data: ExecutionCreate, db: AsyncSession = Depends(get_db)):
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = wf_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")
    if workflow.status != "published":
        raise HTTPException(status_code=400, detail="工作流未发布")

    execution = Execution(
        id=f"exec_{uuid.uuid4().hex[:12]}",
        workflow_id=workflow.id,
        workflow_version=workflow.version,
        status=ExecutionStatus.PENDING,
        inputs=data.inputs,
        created_at=datetime.utcnow(),
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    from services.executor import execute_workflow_async
    import asyncio

    asyncio.create_task(execute_workflow_async(execution.id, workflow.graph, data.inputs, db))

    return {"execution_id": execution.id, "status": "pending"}


@router.post("/workflows/{workflow_id}/executions/{execution_id}/stop")
async def stop_execution(workflow_id: str, execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Execution).where(Execution.id == execution_id, Execution.workflow_id == workflow_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")

    execution.status = ExecutionStatus.CANCELLED
    execution.finished_at = datetime.utcnow()
    await db.commit()
    return {"message": "已停止"}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
from datetime import datetime

from core.database import get_db
from models import Workflow, WorkflowVersion, WorkflowStatus
from schemas import WorkflowSchema, WorkflowCreate, WorkflowUpdate, WorkflowGraph, WorkflowVersionSchema

router = APIRouter()


@router.get("/workflows", response_model=List[WorkflowSchema])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).order_by(Workflow.updated_at.desc()))
    workflows = result.scalars().all()
    return [
        WorkflowSchema(
            id=w.id,
            name=w.name,
            description=w.description,
            graph=w.graph,
            version=w.version,
            status=w.status.value,
            max_concurrent_tasks=w.max_concurrent_tasks,
            created_at=w.created_at,
            updated_at=w.updated_at,
        )
        for w in workflows
    ]


@router.get("/workflows/{workflow_id}", response_model=WorkflowSchema)
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")
    return WorkflowSchema(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        graph=workflow.graph,
        version=workflow.version,
        status=workflow.status.value,
        max_concurrent_tasks=workflow.max_concurrent_tasks,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


@router.post("/workflows", response_model=WorkflowSchema)
async def create_workflow(data: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    workflow = Workflow(
        id=f"wf_{uuid.uuid4().hex[:12]}",
        name=data.name,
        description=data.description,
        graph=data.graph.model_dump() if data.graph else {"nodes": [], "edges": []},
        version=1,
        status=WorkflowStatus.DRAFT,
        created_at=now,
        updated_at=now,
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return WorkflowSchema(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        graph=workflow.graph,
        version=workflow.version,
        status=workflow.status.value,
        max_concurrent_tasks=workflow.max_concurrent_tasks,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


@router.put("/workflows/{workflow_id}", response_model=WorkflowSchema)
async def update_workflow(workflow_id: str, data: WorkflowUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")

    if data.name is not None:
        workflow.name = data.name
    if data.description is not None:
        workflow.description = data.description
    if data.graph is not None:
        workflow.graph = data.graph.model_dump()
        workflow.version += 1
    workflow.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(workflow)
    return WorkflowSchema(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        graph=workflow.graph,
        version=workflow.version,
        status=workflow.status.value,
        max_concurrent_tasks=workflow.max_concurrent_tasks,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")
    await db.delete(workflow)
    await db.commit()
    return {"message": "删除成功"}


@router.post("/workflows/{workflow_id}/publish")
async def publish_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")

    version = WorkflowVersion(
        id=f"wv_{uuid.uuid4().hex[:12]}",
        workflow_id=workflow.id,
        version=workflow.version,
        graph=workflow.graph,
        created_at=datetime.utcnow(),
    )
    db.add(version)

    workflow.status = WorkflowStatus.PUBLISHED
    workflow.updated_at = datetime.utcnow()

    await db.commit()
    return {"message": "发布成功", "version": workflow.version}


@router.get("/workflows/{workflow_id}/versions", response_model=List[WorkflowVersionSchema])
async def list_workflow_versions(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.version.desc())
    )
    versions = result.scalars().all()
    return [
        WorkflowVersionSchema(
            id=v.id,
            workflow_id=v.workflow_id,
            version=v.version,
            graph=v.graph,
            change_note=v.change_note,
            created_at=v.created_at,
        )
        for v in versions
    ]


@router.post("/workflows/{workflow_id}/versions/{version_id}/restore")
async def restore_workflow_version(workflow_id: str, version_id: str, db: AsyncSession = Depends(get_db)):
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = wf_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")

    v_result = await db.execute(select(WorkflowVersion).where(WorkflowVersion.id == version_id))
    version = v_result.scalar_one_or_none()
    if not version or version.workflow_id != workflow_id:
        raise HTTPException(status_code=404, detail="版本不存在")

    workflow.graph = version.graph
    workflow.version += 1
    workflow.updated_at = datetime.utcnow()

    await db.commit()
    return {"message": "恢复成功", "version": workflow.version}

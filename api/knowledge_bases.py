import os
import uuid
import logging
import shutil
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models import KnowledgeBaseModel
from schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeBaseSchema,
    KnowledgeBaseSearchRequest,
    KnowledgeBaseSearchResult,
    KnowledgeBaseAddTextsRequest,
)
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["knowledge_bases"])

KB_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "kb_data")
os.makedirs(KB_DATA_DIR, exist_ok=True)


def get_kb_config_from_model(kb_model: KnowledgeBaseModel) -> dict:
    from flux_agent.rag import KnowledgeBaseConfig, KnowledgeChunkConfig, KnowledgeEmbeddingConfig

    return KnowledgeBaseConfig(
        name=kb_model.name,
        persist_directory=kb_model.persist_directory,
        vector_store_type=kb_model.vector_store_type,
        embedding_config=KnowledgeEmbeddingConfig(
            model=kb_model.embedding_model,
            api_key=kb_model.embedding_api_key,
            base_url=kb_model.embedding_base_url,
        ),
        chunk_config=KnowledgeChunkConfig(
            chunk_size=kb_model.chunk_size,
            chunk_overlap=kb_model.chunk_overlap,
        ),
    )


@router.get("/knowledge_bases", response_model=List[KnowledgeBaseSchema])
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).order_by(KnowledgeBaseModel.created_at.desc()))
    kbs = result.scalars().all()
    return kbs


@router.get("/knowledge_bases/{kb_id}", response_model=KnowledgeBaseSchema)
async def get_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return kb


@router.post("/knowledge_bases", response_model=KnowledgeBaseSchema)
async def create_knowledge_base(data: KnowledgeBaseCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.name == data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="知识库名称已存在")

    kb_id = f"kb_{uuid.uuid4().hex[:16]}"
    persist_directory = os.path.join(KB_DATA_DIR, data.name)

    kb = KnowledgeBaseModel(
        id=kb_id,
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        persist_directory=persist_directory,
        vector_store_type="chroma",
        embedding_model=data.embedding_model,
        embedding_api_key=data.embedding_api_key,
        embedding_base_url=data.embedding_base_url,
        chunk_size=data.chunk_size,
        chunk_overlap=data.chunk_overlap,
        document_count=0,
    )

    db.add(kb)
    await db.commit()
    await db.refresh(kb)

    return kb


@router.put("/knowledge_bases/{kb_id}", response_model=KnowledgeBaseSchema)
async def update_knowledge_base(kb_id: str, data: KnowledgeBaseUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    if data.display_name is not None:
        kb.display_name = data.display_name
    if data.description is not None:
        kb.description = data.description
    if data.embedding_api_key is not None:
        kb.embedding_api_key = data.embedding_api_key
    if data.embedding_base_url is not None:
        kb.embedding_base_url = data.embedding_base_url

    await db.commit()
    await db.refresh(kb)
    return kb


@router.delete("/knowledge_bases/{kb_id}")
async def delete_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    if os.path.exists(kb.persist_directory):
        shutil.rmtree(kb.persist_directory)

    await db.delete(kb)
    await db.commit()
    return {"message": "删除成功"}


@router.post("/knowledge_bases/{kb_id}/documents")
async def add_documents(
    kb_id: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb_model = result.scalar_one_or_none()
    if not kb_model:
        raise HTTPException(status_code=404, detail="知识库不存在")

    try:
        from flux_agent.rag import KnowledgeBase
    except ImportError:
        raise HTTPException(status_code=500, detail="RAG 模块未安装，请执行: pip install flux-agent[rag]")

    config = get_kb_config_from_model(kb_model)

    upload_dir = os.path.join(kb_model.persist_directory, "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    saved_files = []
    for file in files:
        if file.filename:
            file_path = os.path.join(upload_dir, file.filename)
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            saved_files.append(file_path)

    if not saved_files:
        raise HTTPException(status_code=400, detail="没有有效的文件上传")

    try:
        if os.path.exists(os.path.join(kb_model.persist_directory, "chroma.sqlite3")):
            kb = KnowledgeBase.load(kb_model.name, config)
        else:
            kb = KnowledgeBase.create(kb_model.name, config)

        kb.add_documents(saved_files)
        kb.generate()

        stats = kb.get_stats()
        kb_model.document_count = stats.get("document_count", 0)
        await db.commit()

        return {"message": f"成功添加 {len(saved_files)} 个文档", "document_count": kb_model.document_count}
    except Exception as e:
        logger.error(f"添加文档失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加文档失败: {str(e)}")


@router.post("/knowledge_bases/{kb_id}/texts")
async def add_texts(kb_id: str, data: KnowledgeBaseAddTextsRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb_model = result.scalar_one_or_none()
    if not kb_model:
        raise HTTPException(status_code=404, detail="知识库不存在")

    try:
        from flux_agent.rag import KnowledgeBase
    except ImportError:
        raise HTTPException(status_code=500, detail="RAG 模块未安装，请执行: pip install flux-agent[rag]")

    config = get_kb_config_from_model(kb_model)

    try:
        if os.path.exists(os.path.join(kb_model.persist_directory, "chroma.sqlite3")):
            kb = KnowledgeBase.load(kb_model.name, config)
        else:
            kb = KnowledgeBase.create(kb_model.name, config)

        kb.add_texts(data.texts, data.metadatas)
        kb.generate()

        stats = kb.get_stats()
        kb_model.document_count = stats.get("document_count", 0)
        await db.commit()

        return {"message": f"成功添加 {len(data.texts)} 条文本", "document_count": kb_model.document_count}
    except Exception as e:
        logger.error(f"添加文本失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加文本失败: {str(e)}")


@router.post("/knowledge_bases/{kb_id}/search", response_model=List[KnowledgeBaseSearchResult])
async def search_knowledge_base(kb_id: str, data: KnowledgeBaseSearchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb_model = result.scalar_one_or_none()
    if not kb_model:
        raise HTTPException(status_code=404, detail="知识库不存在")

    try:
        from flux_agent.rag import KnowledgeBase
    except ImportError:
        raise HTTPException(status_code=500, detail="RAG 模块未安装，请执行: pip install flux-agent[rag]")

    config = get_kb_config_from_model(kb_model)

    try:
        kb = KnowledgeBase.load(kb_model.name, config)

        if data.score_threshold > 0:
            docs_with_scores = kb.similarity_search_with_score(data.query, k=data.top_k)
            results = [
                KnowledgeBaseSearchResult(content=doc.page_content, metadata=doc.metadata, score=score)
                for doc, score in docs_with_scores
                if score >= data.score_threshold
            ]
        else:
            docs = kb.similarity_search(data.query, k=data.top_k)
            results = [KnowledgeBaseSearchResult(content=doc.page_content, metadata=doc.metadata) for doc in docs]

        return results
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="知识库尚未生成，请先添加文档")
    except Exception as e:
        logger.error(f"搜索失败: {e}")
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


@router.delete("/knowledge_bases/{kb_id}/documents")
async def clear_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb_model = result.scalar_one_or_none()
    if not kb_model:
        raise HTTPException(status_code=404, detail="知识库不存在")

    try:
        from flux_agent.rag import KnowledgeBase
    except ImportError:
        raise HTTPException(status_code=500, detail="RAG 模块未安装，请执行: pip install flux-agent[rag]")

    config = get_kb_config_from_model(kb_model)

    try:
        kb = KnowledgeBase.load(kb_model.name, config)
        kb.clear()

        kb_model.document_count = 0
        await db.commit()

        return {"message": "知识库已清空"}
    except Exception as e:
        logger.error(f"清空知识库失败: {e}")
        raise HTTPException(status_code=500, detail=f"清空知识库失败: {str(e)}")

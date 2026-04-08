from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float, Enum
from sqlalchemy.orm import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class WorkflowStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    OFFLINE = "offline"


class ExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    graph = Column(JSON, nullable=False, default={"nodes": [], "edges": []})
    version = Column(Integer, default=1)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.DRAFT)
    max_concurrent_tasks = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id = Column(String(64), primary_key=True)
    workflow_id = Column(String(64), nullable=False)
    version = Column(Integer, nullable=False)
    graph = Column(JSON, nullable=False)
    change_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Execution(Base):
    __tablename__ = "executions"

    id = Column(String(64), primary_key=True)
    workflow_id = Column(String(64), nullable=False)
    workflow_version = Column(Integer, nullable=False)
    status = Column(Enum(ExecutionStatus), default=ExecutionStatus.PENDING)
    inputs = Column(JSON, default={})
    outputs = Column(JSON, default={})
    total_tokens = Column(Integer, default=0)
    total_cost = Column(Float, default=0.0)
    duration_ms = Column(Float, nullable=True)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TraceNode(Base):
    __tablename__ = "trace_nodes"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), nullable=False)
    node_id = Column(String(255), nullable=False)
    node_name = Column(String(255), nullable=True)
    node_type = Column(String(64), nullable=False)
    status = Column(String(32), default="pending")
    input_data = Column(JSON, default={})
    output_data = Column(JSON, default={})
    error = Column(Text, nullable=True)
    tokens = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    duration_ms = Column(Float, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)


class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    provider_type = Column(String(64), nullable=False)
    api_base_url = Column(String(512), nullable=True)
    api_key = Column(String(512), nullable=True)
    models = Column(JSON, default=[])
    is_default = Column(Integer, default=0)
    extra_config = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CustomTool(Base):
    __tablename__ = "custom_tools"

    id = Column(String(64), primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    code = Column(Text, nullable=False)
    parameters = Column(JSON, default={})
    return_type = Column(String(64), default="str")
    is_builtin = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeBaseModel(Base):
    __tablename__ = "knowledge_bases"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    persist_directory = Column(String(512), nullable=False)
    vector_store_type = Column(String(32), default="chroma")
    embedding_model = Column(String(128), default="text-embedding-3-small")
    embedding_api_key = Column(String(512), nullable=True)
    embedding_base_url = Column(String(512), nullable=True)
    chunk_size = Column(Integer, default=1000)
    chunk_overlap = Column(Integer, default=200)
    document_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    mode = Column(String(32), default="react")
    model_name = Column(String(128), default="gpt-4.1")
    base_url = Column(String(512), nullable=True)
    api_key = Column(String(512), nullable=True)
    system_prompt = Column(Text, nullable=True)
    tools = Column(JSON, default=[])
    max_steps = Column(Integer, default=10)
    verbose = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

from pydantic import BaseModel, Field
from typing import Optional, Any, List
from datetime import datetime


class Position(BaseModel):
    x: float
    y: float


class WorkflowNodeData(BaseModel):
    label: str
    type: str
    config: dict = {}


class WorkflowNode(BaseModel):
    id: str
    type: str
    position: Position
    data: WorkflowNodeData


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class WorkflowGraph(BaseModel):
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []


class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None


class WorkflowCreate(WorkflowBase):
    graph: Optional[WorkflowGraph] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    graph: Optional[WorkflowGraph] = None


class WorkflowVersionSchema(BaseModel):
    id: str
    workflow_id: str
    version: int
    graph: WorkflowGraph
    change_note: Optional[str] = None
    created_at: datetime


class WorkflowSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    graph: WorkflowGraph
    version: int
    status: str
    max_concurrent_tasks: int
    created_at: datetime
    updated_at: datetime


class ExecutionCreate(BaseModel):
    inputs: dict = {}


class TraceNodeSchema(BaseModel):
    id: str
    node_id: str
    node_name: Optional[str] = None
    node_type: str
    status: str
    input_data: dict = {}
    output_data: dict = {}
    error: Optional[str] = None
    tokens: int = 0
    cost: float = 0.0
    duration_ms: Optional[float] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class ExecutionSchema(BaseModel):
    id: str
    workflow_id: str
    workflow_version: int
    status: str
    inputs: dict
    outputs: dict
    total_tokens: int = 0
    total_cost: float = 0.0
    duration_ms: Optional[float] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime


class NodeInfo(BaseModel):
    type: str
    available: bool = True


class LLMProviderCreate(BaseModel):
    name: str
    provider_type: str
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    models: List[str] = []
    is_default: bool = False
    extra_config: dict = {}


class LLMProviderSchema(BaseModel):
    id: str
    name: str
    provider_type: str
    api_base_url: Optional[str] = None
    models: List[str] = []
    is_default: bool
    extra_config: dict = {}
    created_at: datetime
    updated_at: datetime


class ToolParameter(BaseModel):
    type: str = "string"
    description: str = ""
    default: Optional[Any] = None
    required: bool = True


class ToolCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    code: str
    parameters: dict = {}
    return_type: str = "str"


class ToolUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    code: Optional[str] = None
    parameters: Optional[dict] = None
    return_type: Optional[str] = None


class ToolSchema(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    code: str
    parameters: dict = {}
    return_type: str = "str"
    is_builtin: bool
    created_at: datetime
    updated_at: datetime


class ToolTestRequest(BaseModel):
    args: Any = {}


class ToolTestResponse(BaseModel):
    result: Any = None
    error: Optional[str] = None
    execution_time: float = 0.0


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., pattern=r"^[a-z][a-z0-9_]*$", description="知识库名称，只能包含小写字母、数字和下划线")
    display_name: str
    description: Optional[str] = None
    embedding_model: str = "text-embedding-3-small"
    embedding_api_key: Optional[str] = None
    embedding_base_url: Optional[str] = None
    chunk_size: int = 1000
    chunk_overlap: int = 200


class KnowledgeBaseUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    embedding_api_key: Optional[str] = None
    embedding_base_url: Optional[str] = None


class KnowledgeBaseSchema(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    persist_directory: str
    vector_store_type: str
    embedding_model: str
    document_count: int
    created_at: datetime
    updated_at: datetime


class KnowledgeBaseSearchRequest(BaseModel):
    query: str
    top_k: int = 4
    score_threshold: float = 0.0


class KnowledgeBaseAddTextsRequest(BaseModel):
    texts: List[str]
    metadatas: Optional[List[dict]] = None


class KnowledgeBaseSearchResult(BaseModel):
    content: str
    metadata: dict = {}
    score: Optional[float] = None


class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    mode: str = "react"
    model_name: str = "gpt-4.1"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    tools: List[str] = []
    max_steps: int = 10
    verbose: bool = False


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    model_name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    max_steps: Optional[int] = None
    verbose: Optional[bool] = None


class AgentSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    mode: str
    model_name: str
    base_url: Optional[str] = None
    system_prompt: Optional[str] = None
    tools: List[str] = []
    max_steps: int
    verbose: bool
    created_at: datetime
    updated_at: datetime


class AgentChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None
    session_id: Optional[str] = None


class AgentChatResponse(BaseModel):
    answer: str
    status: str
    steps: List[dict] = []
    total_steps: int = 0
    elapsed_time: float = 0.0
    error: Optional[str] = None
    session_id: Optional[str] = None

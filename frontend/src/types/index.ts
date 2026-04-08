export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNodeData {
  [key: string]: any;
  label: string;
  type: string;
  config: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: Position;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, any>;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  graph: WorkflowGraph;
  version: number;
  status: 'draft' | 'published' | 'offline';
  max_concurrent_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  graph: WorkflowGraph;
  change_note?: string;
  created_at: string;
}

export interface Execution {
  id: string;
  workflow_id: string;
  workflow_version: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  total_tokens: number;
  total_cost: number;
  duration_ms?: number;
  error?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface TraceNode {
  id: string;
  node_id: string;
  node_name?: string;
  node_type: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  error?: string;
  tokens: number;
  cost: number;
  duration_ms?: number;
  started_at?: string;
  finished_at?: string;
}

export interface TraceLog {
  id: string;
  node_id?: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  data: Record<string, any>;
  created_at: string;
}

export interface TraceData {
  nodes: TraceNode[];
  logs: TraceLog[];
}

export interface LLMProvider {
  id: string;
  name: string;
  provider_type: string;
  api_base_url?: string;
  models: string[];
  is_default: boolean;
  extra_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NodeInfo {
  type: string;
  available: boolean;
}
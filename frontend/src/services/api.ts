import axios from 'axios';
import type { Workflow, WorkflowGraph, Execution, TraceData, LLMProvider, WorkflowVersion, NodeInfo } from '../types';
import type { CustomTool, ToolCreate, ToolUpdate, ToolTestResponse } from '../types/tools';
import type { 
  KnowledgeBase, 
  KnowledgeBaseCreate, 
  KnowledgeBaseUpdate, 
  KnowledgeBaseSearchResult,
  KnowledgeBaseAddTextsRequest,
} from '../types/knowledgeBase';
import type { Agent, AgentCreate, AgentUpdate, AgentChatResponse } from '../types/agents';

const api = axios.create({
  baseURL: '/flux-workflow/api',
});

export const workflowApi = {
  list: () => api.get<Workflow[]>('/workflows').then(r => r.data),
  get: (id: string) => api.get<Workflow>(`/workflows/${id}`).then(r => r.data),
  create: (data: { name: string; description?: string; graph?: WorkflowGraph }) =>
    api.post<Workflow>('/workflows', data).then(r => r.data),
  update: (id: string, data: Partial<Workflow>) =>
    api.put<Workflow>(`/workflows/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  publish: (id: string) => api.post(`/workflows/${id}/publish`),
  execute: (id: string, inputs: Record<string, any>) =>
    api.post<{ execution_id: string; status: string }>(`/workflows/${id}/execute`, { inputs }).then(r => r.data),
  stopExecution: (workflowId: string, executionId: string) =>
    api.post(`/workflows/${workflowId}/executions/${executionId}/stop`).then(r => r.data),
  listExecutions: (id: string) =>
    api.get<Execution[]>(`/workflows/${id}/executions`).then(r => r.data),
  listVersions: (id: string) =>
    api.get<WorkflowVersion[]>(`/workflows/${id}/versions`).then(r => r.data),
  restoreVersion: (workflowId: string, versionId: string) =>
    api.post(`/workflows/${workflowId}/versions/${versionId}/restore`),
};

export const executionApi = {
  get: (id: string) => api.get<Execution>(`/executions/${id}`).then(r => r.data),
  getTrace: (id: string) => api.get<TraceData>(`/executions/${id}/trace`).then(r => r.data),
  getDetail: (id: string) => api.get<any>(`/executions/${id}/detail`).then(r => r.data),
};

export const modelApi = {
  list: () => api.get<LLMProvider[]>('/models').then(r => r.data),
  create: (data: Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<LLMProvider>('/models', data).then(r => r.data),
  update: (id: string, data: Partial<LLMProvider>) =>
    api.put<LLMProvider>(`/models/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/models/${id}`),
};

export const nodesApi = {
  list: () => api.get<NodeInfo[]>('/nodes').then(r => r.data),
};

export const toolsApi = {
  list: () => api.get<CustomTool[]>('/tools').then(r => r.data),
  get: (id: string) => api.get<CustomTool>(`/tools/${id}`).then(r => r.data),
  create: (data: ToolCreate) => api.post<CustomTool>('/tools', data).then(r => r.data),
  update: (id: string, data: ToolUpdate) => api.put<CustomTool>(`/tools/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/tools/${id}`),
  test: (id: string, args: any) =>
    api.post<ToolTestResponse>(`/tools/${id}/test`, { args }).then(r => r.data),
};

export const knowledgeBaseApi = {
  list: () => api.get<KnowledgeBase[]>('/knowledge_bases').then(r => r.data),
  get: (id: string) => api.get<KnowledgeBase>(`/knowledge_bases/${id}`).then(r => r.data),
  create: (data: KnowledgeBaseCreate) => api.post<KnowledgeBase>('/knowledge_bases', data).then(r => r.data),
  update: (id: string, data: KnowledgeBaseUpdate) => api.put<KnowledgeBase>(`/knowledge_bases/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/knowledge_bases/${id}`),
  addDocuments: (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post<{ message: string; document_count: number }>(`/knowledge_bases/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  addTexts: (id: string, data: KnowledgeBaseAddTextsRequest) =>
    api.post<{ message: string; document_count: number }>(`/knowledge_bases/${id}/texts`, data).then(r => r.data),
  search: (id: string, query: string, topK = 4, scoreThreshold = 0) =>
    api.post<KnowledgeBaseSearchResult[]>(`/knowledge_bases/${id}/search`, {
      query,
      top_k: topK,
      score_threshold: scoreThreshold,
    }).then(r => r.data),
  clear: (id: string) => api.delete<{ message: string }>(`/knowledge_bases/${id}/documents`).then(r => r.data),
};

export const agentsApi = {
  list: () => api.get<Agent[]>('/agents').then(r => r.data),
  get: (id: string) => api.get<Agent>(`/agents/${id}`).then(r => r.data),
  create: (data: AgentCreate) => api.post<Agent>('/agents', data).then(r => r.data),
  update: (id: string, data: AgentUpdate) => api.put<Agent>(`/agents/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  chat: (id: string, message: string, context?: Record<string, any>, sessionId?: string) =>
    api.post<AgentChatResponse>(`/agents/${id}/chat`, { message, context, session_id: sessionId }).then(r => r.data),
};

export default api;
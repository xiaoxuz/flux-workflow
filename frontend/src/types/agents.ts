export interface Agent {
  id: string;
  name: string;
  description?: string;
  mode: string;
  model_name: string;
  base_url?: string;
  api_key?: string;
  system_prompt?: string;
  tools: string[];
  max_steps: number;
  verbose: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentCreate {
  name: string;
  description?: string;
  mode?: string;
  model_name?: string;
  base_url?: string;
  api_key?: string;
  system_prompt?: string;
  tools?: string[];
  max_steps?: number;
  verbose?: boolean;
}

export interface AgentUpdate {
  name?: string;
  description?: string;
  mode?: string;
  model_name?: string;
  base_url?: string;
  api_key?: string;
  system_prompt?: string;
  tools?: string[];
  max_steps?: number;
  verbose?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  stepType?: 'thought' | 'action' | 'observation' | 'final_answer';
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: string;
}

export interface AgentChatRequest {
  message: string;
  context?: Record<string, any>;
}

export interface AgentChatResponse {
  answer: string;
  status: string;
  steps: Array<{
    content: string;
    type: string;
    tool_name?: string;
    tool_input?: Record<string, any>;
    tool_output?: string;
  }>;
  total_steps: number;
  elapsed_time: number;
  error?: string;
  session_id?: string;
}
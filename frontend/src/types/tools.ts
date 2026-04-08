export interface ToolParameter {
  type: string;
  description: string;
  default?: any;
  required: boolean;
}

export interface CustomTool {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  code: string;
  parameters: Record<string, ToolParameter>;
  return_type: string;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolCreate {
  name: string;
  display_name: string;
  description?: string;
  code: string;
  parameters: Record<string, ToolParameter>;
  return_type: string;
}

export interface ToolUpdate {
  display_name?: string;
  description?: string;
  code?: string;
  parameters?: Record<string, ToolParameter>;
  return_type?: string;
}

export interface ToolTestRequest {
  args: any;
}

export interface ToolTestResponse {
  result: any;
  error?: string;
  execution_time: number;
}
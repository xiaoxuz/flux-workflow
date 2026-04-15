export interface SkillSummary {
  name: string;
  description: string;
  disable_model_invocation: boolean;
  user_invocable: boolean;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SkillDetail extends SkillSummary {
  content: string;
  allowed_tools: string[];
  argument_hint: string;
  scripts: string[];
  references: string[];
  assets: string[];
}

export interface SkillCreateRequest {
  name: string;
  description: string;
  content: string;
  disable_model_invocation?: boolean;
  user_invocable?: boolean;
  allowed_tools?: string[];
  argument_hint?: string;
  scripts?: Record<string, string>;
  references?: Record<string, string>;
  assets?: Record<string, string>;
}

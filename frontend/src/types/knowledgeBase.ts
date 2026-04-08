export interface KnowledgeBase {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  persist_directory: string;
  vector_store_type: string;
  embedding_model: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseCreate {
  name: string;
  display_name: string;
  description?: string;
  embedding_model?: string;
  embedding_api_key?: string;
  embedding_base_url?: string;
  chunk_size?: number;
  chunk_overlap?: number;
}

export interface KnowledgeBaseUpdate {
  display_name?: string;
  description?: string;
  embedding_api_key?: string;
  embedding_base_url?: string;
}

export interface KnowledgeBaseSearchResult {
  content: string;
  metadata: Record<string, any>;
  score?: number;
}

export interface KnowledgeBaseAddTextsRequest {
  texts: string[];
  metadatas?: Record<string, any>[];
}

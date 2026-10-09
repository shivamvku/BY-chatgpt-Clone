export type Appearance = 'light' | 'dark' | 'system';
export type Contrast = 'standard' | 'high';
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  active: boolean;
  appearance: Appearance;
  contrast: Contrast;
  created_at: number;
}
export interface AuthState {
  user: User | null;
  csrf: string;
}
export interface Conversation {
  id: string;
  title: string;
  archived: boolean;
  created_at: number;
  updated_at: number;
}
export interface Message {
  id: string;
  parent_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'failed' | 'stopped' | 'stopping';
  model: string;
  created_at: number;
  updated_at: number;
}
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}
export interface ModelInfo {
  configured: boolean;
  models: { id: string; name: string }[];
  capabilities: { images: string; tools: boolean };
}
export interface Usage {
  day: string;
  requests: number;
  reserved_tokens: number;
  request_limit: number;
  token_limit: number;
}

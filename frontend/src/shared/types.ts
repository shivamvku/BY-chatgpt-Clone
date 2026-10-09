export type Appearance = 'light' | 'dark' | 'system';
export type Contrast = 'standard' | 'high';
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  active: boolean;
  verified_user: boolean;
  bio: string;
  timezone: string;
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
export interface ModelChoice {
  id: string;
  name: string;
  available: boolean;
}
export interface ModelInfo {
  configured: boolean;
  models: ModelChoice[];
  capabilities: { images: string; tools: boolean };
}
export interface AdminUser extends User {
  plan: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_owner: boolean;
}
export interface Usage {
  day: string;
  requests: number;
  reserved_tokens: number;
  request_limit: number;
  token_limit: number;
}
export interface Subscription {
  id: string;
  plan: string;
  plan_name: string;
  status: string;
  expires_at: number | null;
  owner: boolean;
  seats: number;
  members: number;
  retention_days: number | null;
  storage_bytes: number;
  daily_requests: number;
  daily_tokens: number;
  billing_mode: string;
  payment_collection_enabled: boolean;
}

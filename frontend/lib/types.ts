export type Role = "customer" | "agent" | "manager";
export type TicketStatus = "open" | "resolved";
export type Category =
  | "billing"
  | "login"
  | "bug"
  | "general"
  | "refund"
  | "account"
  | "integration"
  | "feature_request"
  | "cancellation";
export type Urgency = "low" | "medium" | "high";
export type Sentiment = "calm" | "confused" | "angry";
export type TriageStatus = "pending" | "done" | "failed";
export type Direction = "inbound" | "outbound";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Attachment {
  id: number;
  filename: string;
  content_type: string;
  size: number;
}

// Customer-facing
export interface TicketCreated {
  id: number;
  subject: string;
  status: TicketStatus;
  created_at: string;
}

export interface TicketListItem {
  id: number;
  subject: string;
  status: TicketStatus;
  created_at: string;
  last_activity_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface CustomerMessage {
  id: number;
  direction: Direction;
  body_text: string;
  created_at: string;
  attachments: Attachment[];
}

export interface TicketDetail {
  id: number;
  subject: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
  messages: CustomerMessage[];
}

// Agent / manager
export interface Person {
  id: number;
  name: string;
  email: string;
}

export interface AgentTicketItem {
  id: number;
  subject: string;
  customer_name: string;
  status: TicketStatus;
  category: Category | null;
  urgency: Urgency | null;
  sentiment: Sentiment | null;
  summary: string | null;
  triage_status: TriageStatus;
  assignee: Person | null;
  created_at: string;
  first_response_at: string | null;
  due_at: string;
  is_overdue: boolean;
}

export interface StaffMessage {
  id: number;
  direction: Direction;
  sender: string;
  body_text: string;
  created_at: string;
  attachments: Attachment[];
}

export interface Draft {
  id: number;
  body: string;
  created_at: string;
}

export interface AgentTicketDetail extends AgentTicketItem {
  customer: Person;
  resolved_at: string | null;
  messages: StaffMessage[];
  draft: Draft | null;
}

export interface AgentTicketFilters {
  scope?: "mine" | "unassigned" | "all";
  status?: TicketStatus;
  category?: Category;
  urgency?: Urgency;
  triage_status?: TriageStatus;
  overdue?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface Agent {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  max_open_tickets: number;
  skills: Category[];
  open_tickets: number;
  created_at: string;
}

export interface AgentFilters {
  search?: string;
  skill?: Category;
  status?: "active" | "inactive";
  limit?: number;
  offset?: number;
}

export interface AgentCreate {
  name: string;
  email: string;
  password: string;
  skills: Category[];
  max_open_tickets: number;
}

export interface AgentUpdate {
  name?: string;
  skills?: Category[];
  max_open_tickets?: number;
  is_active?: boolean;
  password?: string;
}

export interface LabelCount {
  category: string;
  count: number;
}

export interface AgentWorkload {
  agent_id: number;
  name: string;
  is_active: boolean;
  max_open_tickets: number;
  open_tickets: number;
  overdue_tickets: number;
  resolved_in_period: number;
}

export interface Dashboard {
  period_days: number;
  sla_hours: number;
  open_tickets: number;
  unassigned_open: number;
  overdue_open: number;
  triage_failed_open: number;
  created_in_period: number;
  resolved_in_period: number;
  avg_first_response_hours: number | null;
  median_first_response_hours: number | null;
  sla_compliance_pct: number | null;
  by_category: LabelCount[];
  by_urgency: LabelCount[];
  agents: AgentWorkload[];
}

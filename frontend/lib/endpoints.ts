import { request } from "./api";
import type {
  Agent,
  AgentCreate,
  AgentFilters,
  AgentTicketDetail,
  AgentTicketFilters,
  AgentTicketItem,
  AgentUpdate,
  Dashboard,
  LoginResponse,
  Paginated,
  TicketCreated,
  TicketDetail,
  TicketListItem,
  TicketStatus,
  User,
} from "./types";

export const authApi = {
  me: () => request<User>("/auth/me"),
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", json: { email, password } }),
  register: (data: { name: string; email: string; password: string; website: string }) =>
    request<LoginResponse>("/auth/register", { method: "POST", json: data }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

function ticketForm(fields: Record<string, string>, files: File[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const file of files) form.append("attachments", file);
  return form;
}

export const customerApi = {
  list: (query: { status?: TicketStatus; limit?: number; offset?: number } = {}) =>
    request<Paginated<TicketListItem>>("/tickets", { query }),
  get: (id: number) => request<TicketDetail>(`/tickets/${id}`),
  create: (subject: string, description: string, files: File[]) =>
    request<TicketCreated>("/tickets", {
      method: "POST",
      form: ticketForm({ subject, description }, files),
    }),
  reply: (id: number, body: string, files: File[]) =>
    request<TicketDetail>(`/tickets/${id}/messages`, {
      method: "POST",
      form: ticketForm({ body }, files),
    }),
};

export const agentApi = {
  list: (filters: AgentTicketFilters = {}) =>
    request<Paginated<AgentTicketItem>>("/agent/tickets", { query: { ...filters } }),
  get: (id: number) => request<AgentTicketDetail>(`/agent/tickets/${id}`),
  claim: (id: number) =>
    request<AgentTicketDetail>(`/agent/tickets/${id}/claim`, { method: "POST" }),
  saveDraft: (id: number, body: string) =>
    request<AgentTicketDetail>(`/agent/tickets/${id}/draft`, { method: "PUT", json: { body } }),
  reply: (id: number, body: string) =>
    request<AgentTicketDetail>(`/agent/tickets/${id}/reply`, { method: "POST", json: { body } }),
  resolve: (id: number) =>
    request<AgentTicketDetail>(`/agent/tickets/${id}/resolve`, { method: "POST" }),
  retriage: (id: number) =>
    request<AgentTicketDetail>(`/agent/tickets/${id}/retriage`, { method: "POST" }),
};

export const managerApi = {
  agents: (filters: AgentFilters = {}) =>
    request<Paginated<Agent>>("/manager/agents", { query: { ...filters } }),
  createAgent: (data: AgentCreate) =>
    request<Agent>("/manager/agents", { method: "POST", json: data }),
  updateAgent: (id: number, data: AgentUpdate) =>
    request<Agent>(`/manager/agents/${id}`, { method: "PATCH", json: data }),
  deleteAgent: (id: number) => request<void>(`/manager/agents/${id}`, { method: "DELETE" }),
  assign: (ticketId: number, agentId: number) =>
    request<void>(`/manager/tickets/${ticketId}/assign`, {
      method: "POST",
      json: { agent_id: agentId },
    }),
  dashboard: (days: number) => request<Dashboard>("/manager/dashboard", { query: { days } }),
};

import { api, json } from './client';
import type { Call, Lead, Notification, Pagination, Tokens, User } from '@/types/models';

export const endpoints = {
  login: (email: string, password: string) => api<{ user: User; tokens: Tokens }>('/api/auth/login', { method: 'POST', body: json({ email, password }) }, false),
  leads: (page: number, search = '') => api<Lead[]>(`/api/leads?page=${page}&limit=20&search=${encodeURIComponent(search)}`),
  lead: (id: string) => api<Lead>(`/api/leads/${id}`),
  updateLead: (id: string, changes: Partial<Lead>) => api<Lead>(`/api/leads/${id}`, { method: 'PUT', body: json(changes) }),
  addNote: (id: string, text: string) => api(`/api/leads/${id}/notes`, { method: 'POST', body: json({ text }) }),
  assign: (id: string, assignedTo: string) => api<Lead>(`/api/leads/${id}/assign`, { method: 'PUT', body: json({ assignedTo }) }),
  users: () => api<User[]>('/api/users?page=1&limit=100&isActive=true'),
  notifications: (page = 1) => api<Notification[]>(`/api/notifications?page=${page}&limit=30`),
  readNotifications: (ids: string[]) => api('/api/notifications/read', { method: 'PUT', body: json({ ids }) }),
  registerDevice: (body: object) => api('/api/notifications/devices', { method: 'POST', body: json(body) }),
  unregisterDevice: (id: string) => api(`/api/notifications/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  calls: (page = 1) => api<Call[]>(`/api/calls/logs?page=${page}&limit=30`),
  callStats: () => api<Record<string, number>>('/api/calls/stats'),
  leadStats: () => api<Record<string, number>>('/api/leads/stats'),
  initiateCall: (toNumber: string, leadId: string) => api('/api/calls/initiate', { method: 'POST', body: json({ toNumber, leadId }) }),
  syncCalls: (deviceId: string, calls: object[]) => api<{ created: number; duplicates: number; errors: unknown[] }>('/api/calls/mobile/sync', { method: 'POST', body: json({ deviceId, calls }) }),
};
export type PaginatedEnvelope<T> = { success: boolean; data: T; message?: string; pagination?: Pagination };

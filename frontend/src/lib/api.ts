/**
 * API client — wraps fetch with auth headers and base URL.
 * Every store action will call through here instead of using mock data.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

// ── helpers ──────────────────────────────────────────────────────────

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("dfa_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Auto-logout on 401 — stale token / re-seeded DB
    if (res.status === 401 && getToken()) {
      try {
        localStorage.removeItem("dfa_auth");
        localStorage.removeItem("dfa_user");
      } catch { /* ignore */ }
      window.location.href = "/login";
    }
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  email: string;
  approved_contributions: number;
  total_contributions: number;
  annotations: number;
  reviews: number;
  rank: number;
  badge: string;
  joined_at: string;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiSignup(name: string, email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function apiGetMe(): Promise<UserProfile> {
  return request<UserProfile>("/auth/me");
}

// ── Missions ─────────────────────────────────────────────────────────

export interface MissionListResponse {
  missions: MissionResponse[];
  total: number;
}

export interface MissionResponse {
  id: string;
  title: string;
  description: string;
  reason: string;
  how_to_contribute: string;
  category: string;
  model_type: string;
  data_type: string;
  status: string;
  owner_id: string | null;
  owner_name: string;
  accepted_types: string[] | null;
  target_contributions: number;
  current_contributions: number;
  model_available: boolean;
  configured_tasks: unknown;
  datasets: DatasetResponse[];
  contributors: ContributorResponse[];
  created_at: string;
  updated_at: string | null;
}

export interface DatasetResponse {
  id: string;
  name: string;
  description: string;
  file_count: number;
  total_size_mb: number;
  accepted_types: string[] | null;
  created_at: string;
}

export interface ContributorResponse {
  user_id: string;
  user_name: string;
  role: string;
  approved_count: number;
  total_count: number;
}

export async function apiGetMissions(params?: {
  status?: string;
  category?: string;
  skip?: number;
  limit?: number;
}): Promise<MissionListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.category) qs.set("category", params.category);
  if (params?.skip) qs.set("skip", String(params.skip));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return request<MissionListResponse>(`/missions${q ? "?" + q : ""}`);
}

export async function apiGetMission(id: string): Promise<MissionResponse> {
  return request<MissionResponse>(`/missions/${id}`);
}

export async function apiCreateMission(data: {
  title: string;
  description: string;
  reason?: string;
  how_to_contribute?: string;
  category?: string;
  model_type?: string;
  goal_count?: number;
  accepted_types?: string[];
  configured_tasks?: unknown;
  datasets?: { name: string; description?: string }[];
}): Promise<MissionResponse> {
  return request<MissionResponse>("/missions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateMission(
  id: string,
  data: Record<string, unknown>,
): Promise<MissionResponse> {
  return request<MissionResponse>(`/missions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteMission(id: string): Promise<void> {
  return request<void>(`/missions/${id}`, { method: "DELETE" });
}

export async function apiJoinMission(id: string, role = "contributor"): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/missions/${id}/join?role=${role}`, {
    method: "POST",
  });
}

export async function apiGetMyMissions(): Promise<MissionListResponse> {
  return request<MissionListResponse>("/missions/user/me");
}

export async function apiUpdateMissionTasks(id: string, tasks: unknown[]): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/missions/${id}/tasks`, {
    method: "PUT",
    body: JSON.stringify(tasks),
  });
}

// ── Files ────────────────────────────────────────────────────────────

export interface DataFileResponse {
  id: string;
  filename: string;
  size_kb: number;
  type: string;
  status: string;
  contributor_id: string | null;
  contributor_name: string;
  uploaded_at: string;
  annotations: AnnotationResponse[];
}

export interface AnnotationResponse {
  id: string;
  annotator_id: string | null;
  annotator_name: string;
  label: string;
  notes: string;
  created_at: string;
}

export async function apiUploadFiles(
  missionId: string,
  datasetId: string,
  files: File[],
): Promise<{ uploaded: number; files: { id: string; filename: string; size_kb: number; status: string }[] }> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${API_BASE}/missions/${missionId}/datasets/${datasetId}/files`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && getToken()) {
      try {
        localStorage.removeItem("dfa_auth");
        localStorage.removeItem("dfa_user");
      } catch { /* ignore */ }
      window.location.href = "/login";
    }
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}

export async function apiGetFiles(
  missionId: string,
  datasetId: string,
  status?: string,
): Promise<{ files: DataFileResponse[] }> {
  const qs = status ? `?status=${status}` : "";
  return request<{ files: DataFileResponse[] }>(
    `/missions/${missionId}/datasets/${datasetId}/files${qs}`,
  );
}

export async function apiReviewFile(
  missionId: string,
  fileId: string,
  action: "approve" | "reject",
): Promise<{ status: string }> {
  return request<{ status: string }>(
    `/missions/${missionId}/files/${fileId}/review?action=${action}`,
    { method: "POST" },
  );
}

export async function apiAnnotateFile(
  missionId: string,
  fileId: string,
  label: string,
  notes = "",
): Promise<{ ok: boolean; status: string }> {
  return request<{ ok: boolean; status: string }>(
    `/missions/${missionId}/files/${fileId}/annotate?label=${encodeURIComponent(label)}&notes=${encodeURIComponent(notes)}`,
    { method: "POST" },
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────

export interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  approved_contributions: number;
  annotations: number;
  reviews: number;
  score: number;
  rank: number;
  badge: string;
}

export async function apiGetLeaderboard(limit = 50): Promise<{
  entries: LeaderboardEntry[];
  total: number;
}> {
  return request<{ entries: LeaderboardEntry[]; total: number }>(
    `/leaderboard?limit=${limit}`,
  );
}

// ── AI Models ────────────────────────────────────────────────────────

export interface AIModelResponse {
  id: string;
  mission_id: string;
  name: string;
  status: string;
  accuracy: number | null;
  epochs_completed: number;
  total_epochs: number;
  created_at: string;
  updated_at: string;
}

export async function apiGetModels(missionId?: string): Promise<{
  models: AIModelResponse[];
  total: number;
}> {
  const qs = missionId ? `?mission_id=${missionId}` : "";
  return request<{ models: AIModelResponse[]; total: number }>(`/ai/models${qs}`);
}

/**
 * Build a direct URL to fetch file content for preview.
 * Returns undefined for files that likely have no stored content (seed data).
 */
export function getFilePreviewUrl(fileId: string): string {
  return `${API_BASE}/missions/files/${fileId}/content`;
}

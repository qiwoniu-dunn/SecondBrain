import type { DigestData, DailyReport, HeartbeatStatus, DashboardMetrics, HeartbeatResponse } from '@/types';

const API_BASE = import.meta.env.BASE_URL + 'api';
const AUTH_KEY = 'sb_auth';
const TOKEN_KEY = 'sb_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearAuth(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });

      if (res.status === 401) {
        clearAuth();
        window.location.reload();
        throw new Error('Unauthorized');
      }

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on auth errors
      if (lastError.message === 'Unauthorized') throw lastError;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

export { AUTH_KEY, TOKEN_KEY, getToken, clearAuth };

export async function verifyPassword(password: string): Promise<{ success: boolean; token?: string }> {
  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (data.ok && data.token) {
    localStorage.setItem(TOKEN_KEY, data.token);
    return { success: true, token: data.token };
  }
  return { success: false };
}

export async function getAvailableDates(): Promise<string[]> {
  const res = await request<{ dates: string[] }>('/dates');
  return res.dates.filter(d => d !== 'undated');
}

export async function getDigest(date: string): Promise<DigestData> {
  const res = await request<{
    date: string;
    total: number;
    articles: Array<{
      id: string;
      title: string;
      source: string;
      density: string;
      summary: string;
      media_type: string;
      skip_ingest: boolean;
      ingested: boolean;
    }>;
  }>(`/digest/${date}`);

  const articles = res.articles.map(a => ({
    id: a.id,
    title: a.title,
    source: a.source,
    density: (['high', 'medium', 'low'].includes(a.density) ? a.density : 'low') as 'high' | 'medium' | 'low',
    summary: a.summary,
    media_type: a.media_type,
    skip_ingest: a.skip_ingest,
    ingested: a.ingested,
  }));

  return {
    total: res.total,
    skipped: articles.filter(a => a.skip_ingest).length,
    ingested: articles.filter(a => a.ingested).length,
    articles,
  };
}

export async function markArticle(date: string, articleId: string, skip: boolean): Promise<void> {
  await request(`/digest/${date}/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_id: articleId, skip }),
  });
}

export async function getDailyReport(date: string): Promise<DailyReport> {
  const res = await request<{
    date: string;
    body_markdown: string;
    available: boolean;
  }>(`/sbdaily/${date}`);

  return {
    date: res.date,
    exists: res.available,
    content: res.body_markdown,
  };
}

export async function getHeartbeat(): Promise<HeartbeatStatus> {
  try {
    const res = await request<HeartbeatResponse>('/heartbeat');
    const machines = res.machines || [];

    const macMini = machines.find(m => m.machine_type === 'mac_mini');
    const macBook = machines.find(m => m.machine_type === 'macbook');
    const primary = macMini || macBook || machines[0];

    return {
      online: primary?.online ?? false,
      last_seen_minutes: Math.floor((primary?.age_seconds ?? 999) / 60),
      machine_type: primary?.machine_type,
      hostname: primary?.hostname,
      machines,
    } as HeartbeatStatus & { machines: typeof machines };
  } catch {
    return { online: false, last_seen_minutes: 999 };
  }
}

export async function triggerIngest(): Promise<{ success: boolean }> {
  const res = await request<{ ok?: boolean; success?: boolean }>('/trigger-ingest', { method: 'POST' });
  return { success: res.ok ?? res.success ?? true };
}

export async function getIngestStatus(): Promise<{ done: boolean }> {
  return request('/ingest-status');
}

export async function getLastIngest(): Promise<{ last_ingest: string }> {
  return request('/last-ingest');
}

export async function getClientIp(): Promise<{ ip: string }> {
  return request('/ip');
}

export async function getReadme(): Promise<{ body_markdown: string; meta?: Record<string, unknown> }> {
  return request('/readme');
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return request<DashboardMetrics>('/metrics');
}

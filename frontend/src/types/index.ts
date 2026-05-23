export interface Article {
  id: string;
  title: string;
  source: string;
  density: 'high' | 'medium' | 'low';
  summary: string;
  media_type: string;
  skip_ingest: boolean;
  ingested?: boolean;
}

export interface DigestData {
  articles: Article[];
  total: number;
  skipped: number;
  ingested: number;
}

export interface DailyReport {
  content: string;
  date: string;
  exists: boolean;
}

export interface HeartbeatStatus {
  online: boolean;
  last_seen_minutes: number;
  last_ingest_time?: string;
  machine_type?: 'mac_mini' | 'macbook' | 'unknown' | null;
  hostname?: string | null;
  machines?: MachineHeartbeat[];
}

export interface MachineHeartbeat {
  hostname: string;
  machine_type: 'mac_mini' | 'macbook' | 'unknown';
  machine_label?: string;
  machine_id?: string;
  online: boolean;
  last_seen: string;
  age_seconds: number;
}

export interface HeartbeatResponse {
  machines: MachineHeartbeat[];
}

export interface AppState {
  isUnlocked: boolean;
  activeTab: 'input' | 'report' | 'dashboard';
  currentDate: string;
  availableDates: string[];
  digestData: DigestData | null;
  dailyReport: DailyReport | null;
  heartbeat: HeartbeatStatus | null;
  dashboardMetrics: DashboardMetrics | null;
  dashboardMetricsError: boolean;
  isLoading: boolean;
  toast: { message: string; visible: boolean };
}

export interface DashboardMetrics {
  wiki: {
    total: number;
    concepts: number;
    domains: number;
    insights: number;
    people: number;
    projects: number;
    reflections: number;
  };
  raw: {
    articles: number;
    videos: number;
    ingested: number;
    pending: number;
  };
  pipeline: {
    last_ingest: string;
    last_sync: string;
    daily_count: number;
  };
  metrics_source?: 'mac_mini' | 'macbook' | 'fallback' | string;
  metrics_collected_at?: string | null;
  metrics_age_seconds?: number | null;
  milestones: MilestoneGroup[];
  logs: LogEntry[];
  ecs_health?: {
    online: boolean;
    uptime?: string;
    cpu?: number;
    memory?: number;
    disk?: number;
    last_check?: string;
  };
  tag_stats?: TagStats | null;
  graph_stats?: GraphStats | null;
}

export interface MilestoneGroup {
  id: string;
  title: string;
  completed: boolean;
  items: MilestoneItem[];
}

export interface MilestoneItem {
  label: string;
  done: boolean;
}

export interface LogEntry {
  time: string;
  type: 'ingest' | 'sync' | 'lint' | 'error';
  message: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface TagStats {
  top_tags: TagCount[];
  category_tags: {
    concepts: TagCount[];
    domains: TagCount[];
    insights: TagCount[];
    people: TagCount[];
    projects: TagCount[];
    reflections: TagCount[];
  };
  total_unique_tags: number;
  total_tag_occurrences: number;
}

export interface GraphNode {
  name: string;
  cat: string;
  out: number;
  in: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  count: number;
}

export interface GraphHub {
  name: string;
  cat: string;
  links: number;
}

export interface GraphStats {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hubs: GraphHub[];
  orphans: string[];
  total_links: number;
  internal_links: number;
}

export type DensityColor = {
  high: string;
  medium: string;
  low: string;
};

export const DENSITY_COLORS: DensityColor = {
  high: '#FF2D55',
  medium: '#FF9500',
  low: '#8E8E93',
};

export const DENSITY_LABELS: Record<string, string> = {
  high: '高价值',
  medium: '中价值',
  low: '一般',
};

/** 信息来源配色标准 —— 字体颜色，不用色块 */
export const SOURCE_COLORS: Record<string, string> = {
  '微信公众号': '#07C160',   // 微信绿
  'Bilibili':    '#FB7299',   // B站粉
  'Flomo':       '#2B6CB0',   // 深蓝
  'GPT':         '#10A37F',   // OpenAI绿
  'YouTube':     '#FF0000',   // YouTube红
  'WebClipper':  '#FF9500',   // 橙色
  'RSS':         '#8B5CF6',   // 紫色
  '本地文档':     '#A0522D',   // 棕色
};

export function getSourceColor(source: string): string {
  for (const [prefix, color] of Object.entries(SOURCE_COLORS)) {
    if (source.startsWith(prefix)) return color;
  }
  return 'rgba(255,255,255,0.45)'; // 默认灰色
}

/** 密度排序权重 */
export const DENSITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

import { useState, useCallback } from 'react';
import { triggerIngest } from '@/lib/api';
import type { DashboardMetrics, HeartbeatStatus, MilestoneGroup, TagStats, GraphStats } from '@/types';

interface Props {
  metrics: DashboardMetrics | null;
  metricsError: boolean;
  heartbeat: HeartbeatStatus | null;
  onToast: (msg: string) => void;
}

const CAT_META: Record<string, { label: string; color: string }> = {
  concepts: { label: '概念', color: '#3B82F6' },
  domains: { label: '领域', color: '#8B5CF6' },
  insights: { label: '洞察', color: '#F59E0B' },
  people: { label: '人物', color: '#EC4899' },
  projects: { label: '项目', color: '#10B981' },
  reflections: { label: '思考', color: '#6366F1' },
};

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="liquid-glass rounded-[14px] p-3.5 flex-1 min-w-[80px]">
      <p className="text-xl font-semibold" style={{ color }}>{value}</p>
      <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{sub}</p>}
    </div>
  );
}

function formatAge(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '未知';
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function LogIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ingest: '#00FF88',
    sync: '#3B82F6',
    lint: '#FF9500',
    error: '#FF2D55',
    ecs: '#FB7299',
  };
  const c = colors[type] || '#8E8E93';
  return (
    <div
      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
      style={{ background: c, boxShadow: `0 0 4px ${c}40` }}
    />
  );
}

/** Milestone group with expand/collapse */
function MilestoneSection({ group }: { group: MilestoneGroup }) {
  const [expanded, setExpanded] = useState(!group.completed);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 py-1.5"
      >
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: group.completed ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${group.completed ? '#00FF88' : 'rgba(255,255,255,0.12)'}`,
          }}
        >
          {group.completed ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </div>
        <span
          className="text-xs flex-1 text-left"
          style={{
            color: group.completed ? 'rgba(0,255,136,0.7)' : 'rgba(255,255,255,0.5)',
            textDecoration: group.completed ? 'line-through' : 'none',
          }}
        >
          {group.title}
        </span>
        {group.items.length > 0 && (
          <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {group.items.filter(i => i.done).length}/{group.items.length}
          </span>
        )}
      </button>

      {expanded && group.items.length > 0 && (
        <div className="ml-6 border-l" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {group.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-1 pl-3">
              <div
                className="w-2.5 h-2.5 rounded-sm flex items-center justify-center shrink-0"
                style={{
                  background: item.done ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${item.done ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {item.done && (
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className="text-[11px]" style={{ color: item.done ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.35)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 知识全景 — 合并 M10.4 + M10.5 + M10.6
 * 环形图展示分类占比，点击分类切换标签列表，默认显示全局标签云
 */
function KnowledgeOverview({ tagStats, wiki }: { tagStats: TagStats | null; wiki: DashboardMetrics['wiki'] }) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const total = wiki.total || 1;
  const categories = Object.keys(CAT_META);

  // Ring chart data
  const items = categories.map(cat => ({
    cat,
    label: CAT_META[cat].label,
    color: CAT_META[cat].color,
    count: (wiki as Record<string, number>)[cat] ?? 0,
  }));

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  // Tag content: either global cloud or category detail
  const renderTags = () => {
    if (!tagStats) return null;

    if (selectedCat) {
      // Category detail view
      const catTags = tagStats.category_tags[selectedCat as keyof typeof tagStats.category_tags] || [];
      const maxCount = catTags[0]?.count ?? 1;
      const color = CAT_META[selectedCat]?.color ?? '#8E8E93';
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px]" style={{ color }}>
              {CAT_META[selectedCat]?.label}标签
            </span>
            <button
              onClick={() => setSelectedCat(null)}
              className="text-[10px]"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              全部
            </button>
          </div>
          <div className="space-y-1">
            {catTags.map(t => {
              const barWidth = Math.max(30, (t.count / maxCount) * 100);
              return (
                <div key={t.tag} className="flex items-center gap-2">
                  <div
                    className="h-4 rounded-full flex items-center px-2"
                    style={{
                      width: `${barWidth}%`,
                      background: `${color}15`,
                      border: `1px solid ${color}30`,
                      minWidth: '40px',
                    }}
                  >
                    <span className="text-[10px] truncate" style={{ color: `${color}CC` }}>{t.tag}</span>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Global tag cloud
    const topTags = tagStats.top_tags;
    if (!topTags.length) return null;
    const maxCount = topTags[0].count;
    const minCount = topTags[topTags.length - 1].count;
    const range = maxCount - minCount || 1;

    return (
      <div className="flex flex-wrap gap-1.5">
        {topTags.slice(0, 30).map((t) => {
          const ratio = (t.count - minCount) / range;
          const fontSize = 10 + ratio * 4;
          const opacity = 0.35 + ratio * 0.5;
          const r = Math.round(59 * (1 - ratio) + 0 * ratio);
          const g = Math.round(130 * (1 - ratio) + 255 * ratio);
          const b = Math.round(246 * (1 - ratio) + 136 * ratio);
          return (
            <span
              key={t.tag}
              className="rounded-full px-2 py-0.5"
              style={{
                fontSize,
                opacity,
                color: `rgb(${r},${g},${b})`,
                background: `rgba(${r},${g},${b},0.08)`,
                border: `1px solid rgba(${r},${g},${b},0.12)`,
              }}
            >
              {t.tag}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xs font-medium mb-3 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>知识全景</h2>
      <div className="liquid-glass rounded-[16px] p-4">
        {/* Top: Ring chart + Legend */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
            <svg viewBox="0 0 100 100" width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
              {items.map(item => {
                const pct = item.count / total;
                const dashLen = pct * circumference;
                const gapLen = circumference - dashLen;
                const offset = accumulated * circumference;
                accumulated += pct;
                return (
                  <circle
                    key={item.cat}
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="14"
                    strokeDasharray={`${dashLen} ${gapLen}`}
                    strokeDashoffset={-offset}
                    style={{
                      transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedCat(selectedCat === item.cat ? null : item.cat)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-semibold" style={{ color: '#F0F0F0' }}>{total}</span>
            </div>
          </div>

          <div className="flex-1 space-y-1">
            {items.map(item => (
              <button
                key={item.cat}
                onClick={() => setSelectedCat(selectedCat === item.cat ? null : item.cat)}
                className="w-full flex items-center justify-between py-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-[11px]" style={{ color: selectedCat === item.cat ? item.color : `${item.color}CC` }}>
                    {item.label}
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider + Tags */}
        {tagStats && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {renderTags()}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 知识网络 — M10.3 wikilink relationships
 * 气泡图展示枢纽页（大小=连接数，颜色=分类）
 */
function KnowledgeNetwork({ graphStats }: { graphStats: GraphStats }) {
  const hubs = graphStats.hubs;

  return (
    <div>
      <h2 className="text-xs font-medium mb-3 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>知识网络</h2>
      <div className="liquid-glass rounded-[16px] p-4">
        <p className="text-[10px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {graphStats.nodes.length} 页面 · {graphStats.internal_links} 条内部链接
          {graphStats.orphans.length > 0 && ` · ${graphStats.orphans.length} 个孤立页`}
        </p>

        {/* Bubble layout — circles sized by link count */}
        <div className="flex flex-wrap items-end justify-center gap-2 py-2">
          {hubs.slice(0, 12).map((hub) => {
            const maxLinks = hubs[0]?.links ?? 1;
            const ratio = hub.links / maxLinks;
            const size = 32 + ratio * 36; // 32px ~ 68px
            const color = CAT_META[hub.cat as keyof typeof CAT_META]?.color ?? '#8E8E93';
            return (
              <div
                key={hub.name}
                className="rounded-full flex items-center justify-center text-center"
                style={{
                  width: size,
                  height: size,
                  background: `${color}18`,
                  border: `1.5px solid ${color}40`,
                  boxShadow: `0 0 ${4 + ratio * 8}px ${color}20`,
                }}
                title={`${hub.name} (${hub.links} 条链接)`}
              >
                <span
                  className="leading-tight px-1"
                  style={{
                    fontSize: ratio > 0.5 ? 9 : 8,
                    color: `${color}DD`,
                    maxWidth: size - 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hub.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="mt-3 pt-3 flex gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-1 text-center">
            <p className="text-sm font-medium" style={{ color: '#00FF88' }}>{graphStats.internal_links}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>内部链接</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-medium" style={{ color: '#3B82F6' }}>{graphStats.nodes.length}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>页面</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm font-medium" style={{ color: graphStats.orphans.length > 0 ? '#FF9500' : '#8E8E93' }}>
              {graphStats.orphans.length}
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>孤立页</p>
          </div>
        </div>

        {graphStats.orphans.length > 0 && (
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,149,0,0.6)' }}>
            孤立页: {graphStats.orphans.slice(0, 5).join('、')}{graphStats.orphans.length > 5 ? '...' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ metrics, metricsError, heartbeat, onToast }: Props) {
  const [triggering, setTriggering] = useState(false);

  const handleTriggerIngest = useCallback(async () => {
    if (triggering) return;
    setTriggering(true);
    try {
      await triggerIngest();
      onToast('已触发 ingest，请等待...');
    } catch {
      onToast('触发失败');
    } finally {
      setTimeout(() => setTriggering(false), 3000);
    }
  }, [triggering, onToast]);

  const handleReadme = useCallback(() => {
    window.open(import.meta.env.BASE_URL + 'readme', '_blank');
  }, []);

  if (!metrics) {
    return (
      <div className="px-4 pb-28 flex flex-col items-center justify-center animate-fade-in-up" style={{ minHeight: '50vh' }}>
        <p className="text-sm" style={{ color: metricsError ? '#FF2D55' : 'rgba(255,255,255,0.3)' }}>
          {metricsError ? '数据加载失败，请稍后刷新重试' : '加载中...'}
        </p>
      </div>
    );
  }

  const { wiki, raw, pipeline, milestones, logs } = metrics;
  const machines = heartbeat?.machines ?? [];
  const metricsAge = metrics.metrics_age_seconds;
  const metricsFresh = metrics.metrics_source !== 'fallback' && metricsAge !== undefined && metricsAge !== null && metricsAge < 900;
  const metricsColor = metrics.metrics_source === 'fallback' || !metricsFresh ? '#FF9500' : '#00FF88';

  const MACHINE_LABELS: Record<string, string> = {
    mac_mini: 'Mac Mini',
    macbook: 'MacBook',
    unknown: 'Unknown',
  };
  const MACHINE_COLORS: Record<string, { on: string; off: string }> = {
    mac_mini: { on: '#00FF88', off: '#FF2D55' },
    macbook: { on: '#00FF88', off: '#FF2D55' },
    unknown: { on: '#8E8E93', off: '#FF2D55' },
  };

  const ecsInfo = metrics.ecs_health;

  return (
    <div className="px-4 pb-28 space-y-4 animate-fade-in-up">
      {/* ── 总览 ── */}
      <div>
        <h2 className="text-xs font-medium mb-3 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>总览</h2>
        <div className="flex gap-3">
          <StatCard label="Wiki 页面" value={wiki.total} color="#00FF88" sub={`${wiki.concepts}概念 · ${wiki.domains}领域 · ${wiki.reflections}思考`} />
          <StatCard label="Raw 文章" value={raw.articles} color="#3B82F6" sub={`${raw.ingested}已消化 · ${raw.videos}视频`} />
          <StatCard label="待消化" value={raw.pending} color={raw.pending > 0 ? '#FF9500' : '#8E8E93'} />
        </div>
      </div>

      {/* ── 知识全景（M10.4+5+6 合并）── */}
      <KnowledgeOverview tagStats={metrics.tag_stats ?? null} wiki={wiki} />

      {/* ── 知识网络（M10.3）── */}
      {metrics.graph_stats && metrics.graph_stats.nodes.length > 0 && (
        <KnowledgeNetwork graphStats={metrics.graph_stats} />
      )}

      {/* ── 建设进度 ── */}
      <div>
        <h2 className="text-xs font-medium mb-3 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>建设进度</h2>
        <div className="liquid-glass rounded-[16px] p-4 space-y-2">
          {milestones.map(m => (
            <MilestoneSection key={m.id} group={m} />
          ))}
        </div>
      </div>

      {/* ── 系统健康 ── */}
      <div>
        <h2 className="text-xs font-medium mb-3 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>系统健康</h2>
        <div className="liquid-glass rounded-[16px] p-4 space-y-3">
          {machines.length > 0 ? machines.map((m, i) => {
            const colors = MACHINE_COLORS[m.machine_type] || MACHINE_COLORS.unknown;
            const label = m.machine_label || MACHINE_LABELS[m.machine_type] || m.hostname;
            const color = m.online ? colors.on : colors.off;
            const ageMin = Math.floor(m.age_seconds / 60);
            const timeText = ageMin < 1 ? '刚刚' : `${ageMin}分钟前`;
            return (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: color,
                      boxShadow: `0 0 6px ${color}80`,
                    }}
                  />
                  <span className="text-xs" style={{ color: `${color}CC` }}>
                    {label} {m.online ? '在线' : '离线'}
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {timeText}
                </span>
              </div>
            );
          }) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#FF2D55' }} />
              <span className="text-xs" style={{ color: 'rgba(255,45,85,0.8)' }}>无心跳数据</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: ecsInfo?.online !== false ? '#3B82F6' : '#FF2D55',
                  boxShadow: ecsInfo?.online !== false ? '0 0 6px rgba(59,130,246,0.5)' : '0 0 6px rgba(255,45,85,0.5)',
                }}
              />
              <span className="text-xs" style={{ color: ecsInfo?.online !== false ? 'rgba(59,130,246,0.8)' : 'rgba(255,45,85,0.8)' }}>
                ECS 服务器
              </span>
            </div>
            {ecsInfo?.uptime && (
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                运行 {ecsInfo.uptime}
              </span>
            )}
          </div>

          {ecsInfo?.cpu !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>ECS CPU</span>
              <span className="text-[11px]" style={{ color: ecsInfo.cpu > 80 ? '#FF2D55' : 'rgba(255,255,255,0.5)' }}>
                {ecsInfo.cpu}%
              </span>
            </div>
          )}
          {ecsInfo?.memory !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>ECS 内存</span>
              <span className="text-[11px]" style={{ color: ecsInfo.memory > 85 ? '#FF2D55' : 'rgba(255,255,255,0.5)' }}>
                {ecsInfo.memory}%
              </span>
            </div>
          )}
          {ecsInfo?.disk !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>ECS 磁盘</span>
              <span className="text-[11px]" style={{ color: ecsInfo.disk > 85 ? '#FF2D55' : 'rgba(255,255,255,0.5)' }}>
                {ecsInfo.disk}%
              </span>
            </div>
          )}

          {metrics.metrics_source && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>采集数据</span>
              <span className="text-[11px]" style={{ color: metricsColor }}>
                {metrics.metrics_source === 'fallback' ? '备用数据' : formatAge(metricsAge)}
              </span>
            </div>
          )}

          {pipeline.last_ingest && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>最近 Ingest</span>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{pipeline.last_ingest}</span>
            </div>
          )}
          {pipeline.last_sync && (
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>最近 Sync</span>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{pipeline.last_sync}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 最近日志 ── */}
      <div>
        <h2 className="text-xs font-medium mb-3 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>最近日志</h2>
        <div className="liquid-glass rounded-[16px] p-4 space-y-2.5">
          {logs.length > 0 ? (
            logs.slice(0, 10).map((log, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <LogIcon type={log.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{log.message}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>{log.time}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>暂无日志</p>
          )}
        </div>
      </div>

      {/* ── 快捷操作 ── */}
      <div>
        <h2 className="text-xs font-medium mb-3 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>快捷操作</h2>
        <div className="flex gap-3">
          <button
            onClick={handleTriggerIngest}
            disabled={triggering}
            className="flex-1 liquid-glass rounded-[14px] py-3 text-xs font-medium transition-all duration-200 active:scale-[0.97]"
            style={{
              color: triggering ? 'rgba(255,255,255,0.25)' : '#00FF88',
              cursor: triggering ? 'not-allowed' : 'pointer',
            }}
          >
            {triggering ? '触发中...' : '触发 Ingest'}
          </button>
          <button
            onClick={handleReadme}
            className="flex-1 liquid-glass rounded-[14px] py-3 text-xs font-medium transition-all duration-200 active:scale-[0.97]"
            style={{
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
            }}
          >
            README
          </button>
        </div>
      </div>
    </div>
  );
}

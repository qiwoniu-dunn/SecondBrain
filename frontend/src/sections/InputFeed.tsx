import { useState, useCallback, useMemo, useRef } from 'react';
import { markArticle } from '@/lib/api';
import type { Article } from '@/types';
import { DENSITY_COLORS, getSourceColor, DENSITY_ORDER } from '@/types';

type SortMode = 'time' | 'density';

interface Props {
  date: string;
  articles: Article[];
  total: number;
  skipped: number;
  ingested: number;
  onUpdate: (articleId: string, skip: boolean) => void;
  onToast: (msg: string) => void;
}

/** Collapsed card height — shows ~2 title lines + source row + ~3 summary lines */
const COLLAPSED_H = 160;

export default function InputFeed({ date, articles, total, skipped, ingested, onUpdate, onToast }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const heightsRef = useRef<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<SortMode>('time');

  const handleCardToggle = useCallback((articleId: string) => {
    if (expandedId === articleId) {
      setExpandedId(null);
      return;
    }
    // Measure full content height before expanding for smooth animation
    const el = cardRefs.current[articleId];
    if (el) {
      heightsRef.current[articleId] = el.scrollHeight;
    }
    setExpandedId(articleId);
  }, [expandedId]);

  const handleToggleSkip = useCallback(async (article: Article) => {
    if (article.ingested) {
      onToast('已消化的文章无法取消');
      return;
    }
    const newSkip = !article.skip_ingest;
    onUpdate(article.id, newSkip);
    try {
      await markArticle(date, article.id, newSkip);
    } catch {
      onToast('同步失败');
      onUpdate(article.id, !newSkip);
    }
  }, [date, onUpdate, onToast]);

  const sortedArticles = useMemo(() => {
    if (sortMode === 'density') {
      return [...articles].sort((a, b) => {
        // density: high → medium → low, skip items at the end
        if (a.skip_ingest !== b.skip_ingest) return a.skip_ingest ? 1 : -1;
        return (DENSITY_ORDER[a.density] ?? 9) - (DENSITY_ORDER[b.density] ?? 9);
      });
    }
    // default: time order (original order from API = insertion order)
    return articles;
  }, [articles, sortMode]);

  const toggleSort = useCallback(() => {
    setSortMode(prev => prev === 'time' ? 'density' : 'time');
  }, []);

  // Format date as "M月D日"
  const formattedDate = (() => {
    const parts = date.split('-');
    if (parts.length === 3) return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
    return date;
  })();

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ minHeight: '50vh' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          当日无输入记录
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-28">
      {/* Date Title */}
      <h2
        className="text-lg font-semibold mb-4 px-1 animate-fade-in-up"
        style={{
          fontFamily: "'DingTalk JinBuTi', -apple-system, sans-serif",
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        输入清单·{formattedDate}
      </h2>

      {/* Stats Panel */}
      <div className="liquid-glass rounded-[20px] p-5 mb-4 flex items-center justify-around animate-fade-in-up">
        <div className="text-center">
          <p className="text-2xl font-semibold" style={{ color: '#3B82F6' }}>
            {total}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>今日输入</p>
        </div>
        <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="text-center">
          <p className="text-2xl font-semibold" style={{ color: '#00FF88' }}>
            {ingested}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>已消化</p>
        </div>
        <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="text-center">
          <p className="text-2xl font-semibold" style={{ color: '#FF2D55' }}>
            {skipped}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>已跳过</p>
        </div>
      </div>

      {/* Sort Toggle */}
      <div className="flex justify-end mb-3 px-1">
        <button
          onClick={toggleSort}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {sortMode === 'time' ? (
            /* Clock icon - sort by time */
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            /* Bar chart icon - sort by density */
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          )}
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {sortMode === 'time' ? '按时间' : '按密度'}
          </span>
        </button>
      </div>

      {/* Article Cards */}
      <div className="space-y-4">
        {sortedArticles.map((article, index) => {
          const isExpanded = expandedId === article.id;
          const densityColor = DENSITY_COLORS[article.density];
          const sourceColor = getSourceColor(article.source);
          const statusLabel = article.ingested ? '已消化' : article.skip_ingest ? '已跳过' : '待处理';
          const statusColor = article.ingested ? '#00FF88' : article.skip_ingest ? '#8E8E93' : '#3B82F6';

          return (
            <div
              key={article.id}
              ref={el => { cardRefs.current[article.id] = el; }}
              className="liquid-glass rounded-[16px] overflow-hidden animate-fade-in-up relative"
              style={{
                maxHeight: isExpanded ? (heightsRef.current[article.id] ?? 500) : COLLAPSED_H,
                transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: article.skip_ingest ? 0.35 : 1,
                animationDelay: `${index * 0.06}s`,
                willChange: 'max-height',
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 density-bar"
                style={{
                  background: article.skip_ingest
                    ? 'linear-gradient(to bottom, #555, #666)'
                    : `linear-gradient(to bottom, ${densityColor}, ${densityColor}88)`,
                }}
              />

              <div className="py-2.5 px-3.5 pl-4">
                  <button
                    onClick={() => handleCardToggle(article.id)}
                    className="w-full text-left"
                  >
                    <h3
                      className="text-sm font-medium leading-snug mb-0.5 pr-2"
                      style={{
                        color: '#F0F0F0',
                      }}
                    >
                      {article.title}
                    </h3>
                  </button>

                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: sourceColor }}>
                      {article.source}
                    </span>
                    <span className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ color: statusColor, background: `${statusColor}15` }}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {article.summary && (
                    <button
                      onClick={() => handleCardToggle(article.id)}
                      className="w-full text-left"
                    >
                      <p
                        className="text-xs leading-snug"
                        style={{
                          color: 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {article.summary}
                      </p>
                    </button>
                  )}

                  {!article.ingested && (
                    <div className="flex items-center justify-between mt-1">
                      <button
                        onClick={() => handleToggleSkip(article)}
                        className="flex items-center gap-1.5"
                      >
                        <div className={`toggle-switch ${article.skip_ingest ? 'active' : ''}`} />
                        <span
                          className="text-xs"
                          style={{
                            color: article.skip_ingest ? '#FF2D55' : 'rgba(255,255,255,0.35)',
                            transition: 'color 0.3s ease',
                          }}
                        >
                          跳过 ingest
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
          );
        })}
      </div>
    </div>
  );
}

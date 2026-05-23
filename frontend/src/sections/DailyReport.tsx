import { useState, useCallback, useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { triggerIngest, getIngestStatus, getLastIngest } from '@/lib/api';
import type { DailyReport } from '@/types';

interface Props {
  date: string;
  report: DailyReport | null;
  onRefresh: () => void;
  onToast: (msg: string) => void;
}

export default function DailyReport({ date, report, onRefresh, onToast }: Props) {
  const [generating, setGenerating] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [lastUpdateText, setLastUpdateText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const htmlContent = report?.content ? DOMPurify.sanitize(marked(report.content) as string, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','a','ul','ol','li','blockquote','code','pre','strong','em','del','table','thead','tbody','tr','th','td','img','hr','br','sup','sub','span','div'],
    ALLOWED_ATTR: ['href','target','rel','src','alt','title','class','id'],
  }) : '';

  // Cooldown timer
  useEffect(() => {
    if (cooldownLeft > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setCooldownLeft(prev => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 60000);
    }
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldownLeft]);

  // Update "last update" text — show exact HH:MM:SS
  useEffect(() => {
    async function fetchLastUpdate() {
      try {
        const result = await getLastIngest();
        if (result.time) {
          const t = new Date(result.time);
          const hh = String(t.getHours()).padStart(2, '0');
          const mm = String(t.getMinutes()).padStart(2, '0');
          const ss = String(t.getSeconds()).padStart(2, '0');
          setLastUpdateText(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')} ${hh}:${mm}:${ss}`);
        }
      } catch {
        setLastUpdateText('未知');
      }
    }
    fetchLastUpdate();
    const timer = setInterval(fetchLastUpdate, 30000);
    return () => clearInterval(timer);
  }, [date]);

  const handleGenerate = useCallback(async () => {
    if (generating || cooldownLeft > 0) return;
    setGenerating(true);
    try {
      await triggerIngest();
      onToast('已触发生成，请等待...');

      let attempts = 0;
      const MAX_ATTEMPTS = 20; // 20 * 30s = 10min max
      setPollAttempts(0);
      intervalRef.current = setInterval(async () => {
        attempts++;
        setPollAttempts(attempts);
        try {
          const status = await getIngestStatus();
          if (status.done) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setGenerating(false);
            setPollAttempts(0);
            setCooldownLeft(30);
            onRefresh();
            onToast('日报已生成');
          }
        } catch { /* ignore */ }
        if (attempts >= MAX_ATTEMPTS) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setGenerating(false);
          setPollAttempts(0);
          onToast('生成超时，请稍后刷新');
        }
      }, 30000);
    } catch {
      onToast('触发失败');
      setGenerating(false);
    }
  }, [generating, cooldownLeft, onRefresh, onToast]);

  const formatCooldown = () => `${cooldownLeft}分钟后可重新生成`;

  if (!report?.exists) {
    return (
      <div className="px-4 pb-28 flex flex-col items-center justify-center animate-fade-in-up" style={{ minHeight: '50vh' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
          当日无日报
        </p>

        <button
          onClick={handleGenerate}
          disabled={generating || cooldownLeft > 0}
          className={`px-8 py-3.5 rounded-[14px] text-sm font-medium transition-all duration-300 active:scale-[0.97] ${generating ? 'animate-pulse-glow' : ''}`}
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            background: generating || cooldownLeft > 0
              ? 'rgba(255,255,255,0.04)'
              : 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.08))',
            color: generating || cooldownLeft > 0 ? 'rgba(255,255,255,0.35)' : '#F0F0F0',
            border: `1px solid ${generating || cooldownLeft > 0 ? 'rgba(255,255,255,0.06)' : 'rgba(59,130,246,0.3)'}`,
            boxShadow: generating || cooldownLeft > 0 ? 'none' : '0 0 24px rgba(59,130,246,0.15)',
            cursor: generating || cooldownLeft > 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? `生成中... (${pollAttempts}/20)` : cooldownLeft > 0 ? `冷却中 (${formatCooldown()})` : '生成日报'}
        </button>

        {cooldownLeft > 0 && (
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
            最近更新：{lastUpdateText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pb-32 animate-fade-in-up">
      <div
        className="liquid-glass rounded-[20px] p-5 markdown-body"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      <div className="mt-6 flex flex-col items-center">
        <button
          onClick={handleGenerate}
          disabled={generating || cooldownLeft > 0}
          className={`px-8 py-3 rounded-[14px] text-sm font-medium transition-all duration-300 active:scale-[0.97] ${generating ? 'animate-pulse-glow-green' : ''}`}
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            background: generating || cooldownLeft > 0
              ? 'rgba(255,255,255,0.04)'
              : 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.05))',
            color: generating || cooldownLeft > 0 ? 'rgba(255,255,255,0.35)' : '#00FF88',
            border: `1px solid ${generating || cooldownLeft > 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,255,136,0.2)'}`,
            boxShadow: generating || cooldownLeft > 0 ? 'none' : '0 0 20px rgba(0,255,136,0.08)',
            cursor: generating || cooldownLeft > 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? `更新中... (${pollAttempts}/20)` : cooldownLeft > 0 ? `冷却中 (${formatCooldown()})` : '更新日报'}
        </button>

        <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
          最近更新：{lastUpdateText}
        </p>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getReadme } from '@/lib/api';

interface Props {
  onBack?: () => void;
}

export default function ReadmePage({ onBack }: Props) {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReadme() {
      try {
        const res = await getReadme();
        if (!cancelled) {
          setMarkdown(res.body_markdown || '');
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReadme();
    return () => { cancelled = true; };
  }, []);

  const htmlContent = useMemo(() => (
    markdown ? DOMPurify.sanitize(marked(markdown) as string, {
      ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','a','ul','ol','li','blockquote','code','pre','strong','em','del','table','thead','tbody','tr','th','td','img','hr','br','sup','sub','span','div'],
      ALLOWED_ATTR: ['href','target','rel','src','alt','title','class','id'],
    }) : ''
  ), [markdown]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    window.location.href = import.meta.env.BASE_URL;
  }, [onBack]);

  return (
    <div className="px-4 pb-12 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={handleBack}
          className="text-xs rounded-full px-3 py-1.5 transition-all duration-200 active:scale-[0.97]"
          style={{
            color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          返回看板
        </button>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
          使用说明
        </span>
      </div>

      {loading ? (
        <div className="liquid-glass rounded-[20px] p-5">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>加载中...</p>
        </div>
      ) : error ? (
        <div className="liquid-glass rounded-[20px] p-5">
          <p className="text-sm" style={{ color: '#FF2D55' }}>README 加载失败，请稍后刷新重试。</p>
        </div>
      ) : (
        <div
          className="liquid-glass rounded-[20px] p-5 markdown-body"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}
    </div>
  );
}

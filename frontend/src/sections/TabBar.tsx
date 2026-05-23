import { useRef, useEffect } from 'react';
import gsap from 'gsap';

type TabType = 'input' | 'report' | 'dashboard';

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: { key: TabType; label: string }[] = [
  { key: 'input', label: '输入清单' },
  { key: 'report', label: '二脑日报' },
  { key: 'dashboard', label: '管理看板' },
];

export default function TabBar({ activeTab, onTabChange }: Props) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const idx = TABS.findIndex(t => t.key === activeTab);
    const target = btnRefs.current[idx];
    if (target && indicatorRef.current) {
      gsap.to(indicatorRef.current, {
        x: target.offsetLeft,
        width: target.offsetWidth,
        duration: 0.35,
        ease: 'power3.out',
      });
    }
  }, [activeTab]);

  return (
    <div role="tablist" aria-label="主导航" className="liquid-glass fixed bottom-6 left-1/2 z-40 flex items-center rounded-full p-1" style={{ transform: 'translateX(-50%)' }}>
      <div
        ref={indicatorRef}
        className="absolute top-1 h-[calc(100%-8px)] rounded-full"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.08))',
          boxShadow: '0 0 16px rgba(59,130,246,0.15), inset 0 1px 1px rgba(255,255,255,0.1)',
        }}
      />

      {TABS.map((tab, i) => (
        <button
          key={tab.key}
          ref={el => { btnRefs.current[i] = el; }}
          role="tab"
          aria-selected={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
          className="relative z-10 px-4 py-2.5 text-xs font-medium rounded-full transition-colors duration-200 whitespace-nowrap"
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            color: activeTab === tab.key ? '#F0F0F0' : 'rgba(255,255,255,0.35)',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

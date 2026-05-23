import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  currentDate: string;
  availableDates: string[];
  onSelect: (date: string) => void;
  onClose: () => void;
}

export default function CalendarPicker({ currentDate, availableDates, onSelect, onClose }: Props) {
  const [displayMonth, setDisplayMonth] = useState(() => {
    const d = new Date(currentDate + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      gsap.fromTo(panelRef.current,
        { opacity: 0, y: 40, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power3.out' }
      );
    }
    if (overlayRef.current) {
      gsap.fromTo(overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3 }
      );
    }
  }, []);

  const handleClose = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        opacity: 0, y: 30, scale: 0.95, duration: 0.3, ease: 'power2.in',
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  };

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setDisplayMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setDisplayMonth(new Date(year, month + 1, 1));

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const cells: { date: string | null; day: number | null }[] = [];

  for (let i = 0; i < adjustedFirstDay; i++) {
    cells.push({ date: null, day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, day: d });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="liquid-glass-strong relative z-10 w-full mx-4 mb-6 rounded-[24px] p-5"
        style={{ maxWidth: '400px', opacity: 0 }}
      >
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-medium" style={{ color: '#F0F0F0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
            {year}年{monthNames[month]}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Week Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs py-1" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell.day) {
              return <div key={`empty-${i}`} className="h-9" />;
            }

            const isAvailable = cell.date && availableDates.includes(cell.date);
            const isSelected = cell.date === currentDate;
            const isToday = cell.date === todayStr;

            return (
              <button
                key={cell.date}
                onClick={() => cell.date && isAvailable && onSelect(cell.date)}
                disabled={!isAvailable}
                className="h-9 w-9 mx-auto rounded-full flex items-center justify-center text-sm transition-all duration-200 relative"
                style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
                  color: isSelected ? '#FFFFFF' : isAvailable ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                  background: isSelected
                    ? 'rgba(59,130,246,0.6)'
                    : isAvailable
                      ? 'rgba(59,130,246,0.08)'
                      : 'transparent',
                  cursor: isAvailable ? 'pointer' : 'default',
                  boxShadow: isSelected ? '0 0 12px rgba(59,130,246,0.3)' : 'none',
                }}
              >
                {cell.day}
                {isToday && !isSelected && (
                  <div className="absolute inset-0 rounded-full border border-solid" style={{ borderColor: 'rgba(59,130,246,0.4)' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Close hint */}
        <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          点击空白处关闭
        </p>
      </div>
    </div>
  );
}

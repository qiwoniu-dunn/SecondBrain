import { useState, useCallback } from 'react';
import CalendarPicker from './CalendarPicker';

interface Props {
  currentDate: string;
  availableDates: string[];
  onDateChange: (date: string) => void;
  onRefresh: () => void;
}

export default function Header({ currentDate, availableDates, onDateChange, onRefresh }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [spinRefresh, setSpinRefresh] = useState(false);

  const handlePrevDate = useCallback(() => {
    if (availableDates.length === 0) return;
    const idx = availableDates.indexOf(currentDate);
    if (idx > 0) onDateChange(availableDates[idx - 1]);
  }, [availableDates, currentDate, onDateChange]);

  const handleNextDate = useCallback(() => {
    if (availableDates.length === 0) return;
    const idx = availableDates.indexOf(currentDate);
    if (idx < availableDates.length - 1) onDateChange(availableDates[idx + 1]);
  }, [availableDates, currentDate, onDateChange]);

  const handleRefresh = useCallback(() => {
    setSpinRefresh(true);
    onRefresh();
    setTimeout(() => setSpinRefresh(false), 500);
  }, [onRefresh]);

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const isToday = currentDate === todayStr;

  const formatDate = (d: string) => {
    const [_y, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  };

  return (
    <>
      <div
        className="liquid-glass sticky top-0 z-30 mx-4 mt-4 rounded-[20px] px-5 py-4 animate-fade-in-down"
      >
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-semibold tracking-wide"
            style={{
              fontFamily: "'DingTalk JinBuTi', sans-serif",
              backgroundImage: 'linear-gradient(135deg, #00f0ff, #ff0066)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            SecondBrain
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDate}
              aria-label="前一天"
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              onClick={() => isToday ? setShowCalendar(true) : onDateChange(todayStr)}
              className="text-sm font-medium px-2.5 py-1 rounded-lg transition-all duration-200"
              style={{
                color: isToday ? '#F0F0F0' : 'rgba(59,130,246,0.8)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              {isToday ? formatDate(currentDate) : '回今天'}
            </button>

            <button
              onClick={handleNextDate}
              aria-label="后一天"
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              onClick={handleRefresh}
              aria-label="刷新数据"
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${spinRefresh ? 'animate-spin-once' : ''}`}
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showCalendar && (
        <CalendarPicker
          currentDate={currentDate}
          availableDates={availableDates}
          onSelect={date => { onDateChange(date); setShowCalendar(false); }}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </>
  );
}

import { useState, useCallback } from 'react';
import type { AppState, DigestData, DailyReport, HeartbeatStatus, DashboardMetrics } from '@/types';

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TAB_KEY = 'sb_active_tab';

function getInitialTab(): 'input' | 'report' | 'dashboard' {
  const saved = localStorage.getItem(TAB_KEY);
  if (saved === 'report') return 'report';
  if (saved === 'dashboard') return 'dashboard';
  return 'input';
}

export function useAppStore() {
  const [state, setState] = useState<AppState>({
    isUnlocked: false,
    activeTab: getInitialTab(),
    currentDate: getTodayStr(),
    availableDates: [],
    digestData: null,
    dailyReport: null,
    heartbeat: null,
    dashboardMetrics: null,
    dashboardMetricsError: false,
    isLoading: false,
    toast: { message: '', visible: false },
  });

  const setUnlocked = useCallback((val: boolean) => {
    setState(s => ({ ...s, isUnlocked: val }));
  }, []);

  const setActiveTab = useCallback((tab: 'input' | 'report' | 'dashboard') => {
    localStorage.setItem(TAB_KEY, tab);
    setState(s => ({ ...s, activeTab: tab }));
  }, []);

  const setCurrentDate = useCallback((date: string) => {
    setState(s => ({ ...s, currentDate: date }));
  }, []);

  const setAvailableDates = useCallback((dates: string[]) => {
    setState(s => ({ ...s, availableDates: dates }));
  }, []);

  const setDigestData = useCallback((data: DigestData | null) => {
    setState(s => ({ ...s, digestData: data }));
  }, []);

  const setDailyReport = useCallback((report: DailyReport | null) => {
    setState(s => ({ ...s, dailyReport: report }));
  }, []);

  const setHeartbeat = useCallback((hb: HeartbeatStatus | null) => {
    setState(s => ({ ...s, heartbeat: hb }));
  }, []);

  const setDashboardMetrics = useCallback((data: DashboardMetrics | null, error?: boolean) => {
    setState(s => ({ ...s, dashboardMetrics: data, dashboardMetricsError: !!error }));
  }, []);

  const setLoading = useCallback((val: boolean) => {
    setState(s => ({ ...s, isLoading: val }));
  }, []);

  const showToast = useCallback((message: string) => {
    setState(s => ({ ...s, toast: { message, visible: true } }));
    setTimeout(() => {
      setState(s => ({ ...s, toast: { message: '', visible: false } }));
    }, 2000);
  }, []);

  const updateArticleSkip = useCallback((articleId: string, skip: boolean) => {
    setState(s => {
      if (!s.digestData) return s;
      const articles = s.digestData.articles.map(a =>
        a.id === articleId ? { ...a, skip_ingest: skip } : a
      );
      const skipped = articles.filter(a => a.skip_ingest).length;
      return {
        ...s,
        digestData: { ...s.digestData, articles, skipped },
      };
    });
  }, []);

  return {
    state,
    setUnlocked,
    setActiveTab,
    setCurrentDate,
    setAvailableDates,
    setDigestData,
    setDailyReport,
    setHeartbeat,
    setDashboardMetrics,
    setLoading,
    showToast,
    updateArticleSkip,
  };
}

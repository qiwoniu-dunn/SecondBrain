import { useEffect, useCallback, useRef } from 'react';
import './App.css';
import { useAppStore } from '@/hooks/useAppStore';
import {
  getAvailableDates,
  getDigest,
  getDailyReport,
  getHeartbeat,
  getDashboardMetrics,
} from '@/lib/api';
import GooeyBackground from '@/sections/GooeyBackground';
import LockScreen from '@/sections/LockScreen';
import Header from '@/sections/Header';
import TabBar from '@/sections/TabBar';
import InputFeed from '@/sections/InputFeed';
import DailyReport from '@/sections/DailyReport';
import Dashboard from '@/sections/Dashboard';
import ReadmePage from '@/sections/ReadmePage';
import Toast from '@/sections/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { DigestData as DigestDataType, DailyReport as DailyReportType } from '@/types';

function App() {
  const {
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
  } = useAppStore();

  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dashboardTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataFetched = useRef(false);
  const dataFetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all data for current date
  const fetchData = useCallback(async (date: string) => {
    if (dataFetched.current) return;
    dataFetched.current = true;

    setLoading(true);
    try {
      const [dates, digest, report] = await Promise.all([
        getAvailableDates().catch(() => []),
        getDigest(date).catch(() => null),
        getDailyReport(date).catch(() => null),
      ]);

      setAvailableDates(dates as string[]);
      setDigestData(digest as DigestDataType | null);
      setDailyReport(report as DailyReportType | null);
    } catch (err) {
      showToast('数据加载失败');
      console.error(err);
    } finally {
      setLoading(false);
      dataFetchTimeout.current = setTimeout(() => { dataFetched.current = false; }, 500);
    }
  }, [setLoading, setAvailableDates, setDigestData, setDailyReport, showToast]);

  // Fetch heartbeat
  const fetchHeartbeat = useCallback(async () => {
    try {
      const hb = await getHeartbeat();
      setHeartbeat(hb);
    } catch {
      setHeartbeat({ online: false, last_seen_minutes: 999 });
    }
  }, [setHeartbeat]);

  // Fetch dashboard metrics
  const fetchDashboard = useCallback(async () => {
    try {
      const metrics = await getDashboardMetrics();
      setDashboardMetrics(metrics);
    } catch {
      setDashboardMetrics(null, true);
    }
  }, [setDashboardMetrics]);

  // Initial data load after unlock
  useEffect(() => {
    if (state.isUnlocked) {
      fetchData(state.currentDate);
      fetchHeartbeat();
      fetchDashboard();

      heartbeatTimer.current = setInterval(fetchHeartbeat, 60000);
      return () => {
        if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      };
    }
  }, [state.isUnlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh dashboard while visible
  useEffect(() => {
    if (state.isUnlocked && state.activeTab === 'dashboard') {
      fetchDashboard();
      dashboardTimer.current = setInterval(fetchDashboard, 60000);
      return () => {
        if (dashboardTimer.current) clearInterval(dashboardTimer.current);
      };
    }
  }, [state.isUnlocked, state.activeTab, fetchDashboard]);

  // Reload data when date changes
  useEffect(() => {
    if (state.isUnlocked) {
      if (dataFetchTimeout.current) clearTimeout(dataFetchTimeout.current);
      dataFetched.current = false;
      fetchData(state.currentDate);
    }
  }, [state.currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    if (state.activeTab === 'dashboard') {
      fetchHeartbeat();
      fetchDashboard();
      showToast('已刷新');
      return;
    }

    dataFetched.current = false;
    fetchData(state.currentDate);
    showToast('已刷新');
  }, [state.activeTab, state.currentDate, fetchData, fetchHeartbeat, fetchDashboard, showToast]);

  const handleDateChange = useCallback((date: string) => {
    setCurrentDate(date);
  }, [setCurrentDate]);

  const handleTabChange = useCallback((tab: 'input' | 'report' | 'dashboard') => {
    setActiveTab(tab);
    if (tab === 'dashboard') fetchDashboard();
  }, [setActiveTab, fetchDashboard]);

  const handleArticleUpdate = useCallback((id: string, skip: boolean) => {
    updateArticleSkip(id, skip);
  }, [updateArticleSkip]);

  const handleToast = useCallback((msg: string) => {
    showToast(msg);
  }, [showToast]);

  const isReadmePage = window.location.pathname.replace(/\/+$/, '').endsWith('/readme');

  const handleBackFromReadme = useCallback(() => {
    window.location.href = import.meta.env.BASE_URL;
  }, []);

  // Lock screen
  if (!state.isUnlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: '#08080f',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      }}
    >
      {/* Ambient Background */}
      <GooeyBackground opacity={0.45} />

      {/* Content */}
      <div className="relative z-10 max-w-[480px] mx-auto pb-8">
        <ErrorBoundary>
        {isReadmePage ? (
          <main className="pt-6">
            <ReadmePage onBack={handleBackFromReadme} />
          </main>
        ) : (
          <>
            {/* Header */}
            <Header
              currentDate={state.currentDate}
              availableDates={state.availableDates}
              onDateChange={handleDateChange}
              onRefresh={handleRefresh}
            />

            {/* Main Content */}
            <main className="mt-6">
              {state.activeTab === 'input' ? (
                <InputFeed
                  date={state.currentDate}
                  articles={state.digestData?.articles ?? []}
                  total={state.digestData?.total ?? 0}
                  skipped={state.digestData?.skipped ?? 0}
                  ingested={state.digestData?.ingested ?? 0}
                  onUpdate={handleArticleUpdate}
                  onToast={handleToast}
                />
              ) : state.activeTab === 'report' ? (
                <DailyReport
                  date={state.currentDate}
                  report={state.dailyReport}
                  onRefresh={handleRefresh}
                  onToast={handleToast}
                />
              ) : (
                <Dashboard
                  metrics={state.dashboardMetrics}
                  metricsError={state.dashboardMetricsError}
                  heartbeat={state.heartbeat}
                  onToast={handleToast}
                />
              )}
            </main>

            {/* Tab Bar */}
            <TabBar activeTab={state.activeTab} onTabChange={handleTabChange} />
          </>
        )}
        </ErrorBoundary>

        {/* Toast */}
        <Toast message={state.toast.message} visible={state.toast.visible} />

        {/* Loading overlay */}
        {state.isLoading && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center animate-fade-in"
            style={{ background: 'rgba(3,3,3,0.5)', backdropFilter: 'blur(2px)' }}
          >
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(59,130,246,0.3)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

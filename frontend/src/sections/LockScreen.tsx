import { useState, useCallback, useRef, useEffect } from 'react';
import { verifyPassword, getClientIp, AUTH_KEY } from '@/lib/api';
import GooeyBackground from './GooeyBackground';
import gsap from 'gsap';

interface Props {
  onUnlock: () => void;
}

const AUTH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getStoredAuth(): { ts: number; ip: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function LockScreen({ onUnlock }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-unlock if 7-day auth is valid
  useEffect(() => {
    async function checkAutoUnlock() {
      const stored = getStoredAuth();
      if (!stored) return;

      const now = Date.now();
      if (now - stored.ts > AUTH_TTL) {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem('sb_token');
        return;
      }

      // Also check that token exists
      const token = localStorage.getItem('sb_token');
      if (!token) return;

      try {
        const { ip } = await getClientIp();
        if (ip === stored.ip) {
          onUnlock();
        }
      } catch {
        // IP check failed, require password
      }
    }
    checkAutoUnlock();
  }, [onUnlock]);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(cardRef.current,
        { opacity: 0, y: 20, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!password.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const result = await verifyPassword(password);
      if (result.success) {
        // Store auth with IP and timestamp
        try {
          const { ip } = await getClientIp();
          localStorage.setItem(AUTH_KEY, JSON.stringify({ ts: Date.now(), ip }));
        } catch {
          localStorage.setItem(AUTH_KEY, JSON.stringify({ ts: Date.now(), ip: '' }));
        }

        if (cardRef.current) {
          gsap.to(cardRef.current, {
            opacity: 0,
            y: -20,
            scale: 0.95,
            duration: 0.4,
            ease: 'power2.in',
            onComplete: onUnlock,
          });
        } else {
          onUnlock();
        }
      } else {
        setError('密码错误');
        if (inputRef.current) {
          gsap.fromTo(inputRef.current, { x: -8 }, { x: 0, duration: 0.4, keyframes: [{ x: -8 }, { x: 8 }, { x: -6 }, { x: 6 }, { x: -3 }, { x: 3 }, { x: 0 }] });
        }
      }
    } catch {
      setError('连接失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [password, isSubmitting, onUnlock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#08080f' }}>
      <GooeyBackground opacity={1} />

      <div
        ref={cardRef}
        className="liquid-glass-strong relative z-10 w-[320px] rounded-[24px] p-8 flex flex-col items-center"
        style={{ opacity: 0 }}
      >
        {/* Neuron Icon */}
        <img
          src={import.meta.env.BASE_URL + 'neuron-icon.png'}
          alt=""
          className="w-12 h-12 mb-4 opacity-60"
          style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.3))' }}
        />

        {/* Title */}
        <h1
          className="text-2xl font-semibold tracking-wider mb-1"
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
        <p className="text-xs mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Daily
        </p>

        {/* Password Input */}
        <div className="w-full mb-6">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="输入密码"
            className="w-full bg-transparent text-center text-base pb-2 outline-none transition-colors duration-300"
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              color: '#F0F0F0',
              caretColor: '#F0F0F0',
              WebkitTextSecurity: 'disc',
              borderBottom: `1.5px solid ${error ? 'rgba(255,45,85,0.6)' : password ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.15)'}`,
            }}
          />
          {error && (
            <p className="text-center text-xs mt-2" style={{ color: '#FF2D55' }}>
              {error}
            </p>
          )}
        </div>

        {/* Enter Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3 rounded-[14px] text-sm font-medium transition-all duration-300 active:scale-[0.97]"
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            background: password
              ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(59,130,246,0.1))'
              : 'rgba(255,255,255,0.04)',
            color: password ? '#F0F0F0' : 'rgba(255,255,255,0.35)',
            border: `1px solid ${password ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {isSubmitting ? '验证中...' : '进入'}
        </button>
      </div>
    </div>
  );
}

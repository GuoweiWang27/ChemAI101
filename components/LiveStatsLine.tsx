import React, { useEffect, useRef, useState } from 'react';
import { fetchUsageStats } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * 实时统计行：进页数字滚动到位（count-up），之后每 15s 轮询真实数据，
 * 总数增长时变化位数字琥珀色弹跳——只播报真实变化，不造假数据。
 */

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

export const LiveStatsLine: React.FC = () => {
  const { t } = useLanguage();
  const [display, setDisplay] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const targetRef = useRef<number | null>(null);
  const prevStringRef = useRef('');
  const rafRef = useRef(0);
  const reduced = useRef(
    typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );

  const animateTo = (to: number, dur: number) => {
    const from = targetRef.current ?? Math.max(0, to - 24);
    targetRef.current = to;
    cancelAnimationFrame(rafRef.current);
    if (reduced.current) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setDisplay(Math.round(from + (to - from) * easeOutCubic(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const s = await fetchUsageStats();
        if (stopped) return;
        if (targetRef.current === null) {
          animateTo(s.total, 1400);
          setFlashKey((k) => k + 1);
        } else if (s.total > targetRef.current) {
          animateTo(s.total, 900);
          setFlashKey((k) => k + 1);
        } else if (s.total < targetRef.current) {
          // 数据修正（如基数调整）：直接对齐
          targetRef.current = s.total;
          setDisplay(s.total);
        }
      } catch {
        /* 统计不可用时不打扰 */
      }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      stopped = true;
      clearInterval(id);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const str = display === null ? '…' : display.toLocaleString('en-US');

  useEffect(() => {
    prevStringRef.current = str;
  }, [str]);

  const template = t('homeStatsLine', { count: '#' });
  const hashIdx = template.indexOf('#');
  const prefix = hashIdx >= 0 ? template.slice(0, hashIdx) : template;
  const suffix = hashIdx >= 0 ? template.slice(hashIdx + 1) : '';

  const prev = prevStringRef.current;

  return (
    <p className="text-xs font-mono text-[#8a8171] flex items-center gap-2">
      {/* 呼吸活点 */}
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
      </span>
      <span>
        {prefix}
        <span className="text-amber-600 font-semibold">
          {str.split('').map((ch, i) => {
            const changed = prev !== '' && prev[i] !== ch;
            return (
              <span
                key={`${flashKey}-${i}`}
                className={`inline-block ${changed && !reduced.current ? 'stat-digit' : ''}`}
              >
                {ch}
              </span>
            );
          })}
        </span>
        {suffix}
      </span>
      <style>{`@keyframes stat-pop{0%{transform:translateY(0.3em);color:#f59e0b;opacity:0}100%{transform:translateY(0);opacity:1}}.stat-digit{animation:stat-pop 0.35s ease}`}</style>
    </p>
  );
};

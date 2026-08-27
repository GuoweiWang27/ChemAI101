import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export type FlameMotionStage = 'flash' | 'color' | 'readout';

export const getFlameMotionStage = (elapsedMs: number, reduced: boolean): FlameMotionStage => {
  if (reduced) return 'readout';
  if (elapsedMs < 200) return 'flash';
  if (elapsedMs < 800) return 'color';
  return 'readout';
};

export const shouldAdvanceFlameCycle = (
  hasInteracted: boolean,
  motionAvailable: boolean,
  reduced: boolean,
) => !hasInteracted && motionAvailable && !reduced;

export const getCanvasBackingSize = (
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
) => {
  const dpr = Math.min(1.5, Math.max(1, devicePixelRatio || 1));
  const renderScale = 0.9;
  return {
    width: Math.max(1, Math.round(cssWidth * dpr * renderScale)),
    height: Math.max(1, Math.round(cssHeight * dpr * renderScale)),
  };
};

/** 元素之火：短闪 → 稳定变色 → 代表谱线解读。 */

export interface FlameElement {
  key: string;
  symbol: string;
  name: { zh: string; en: string };
  color: string;
  hot: string;
  observation: { zh: string; en: string };
  /** 特征发射谱线波长（nm） */
  line: number;
}

export const FLAME_ELEMENTS: FlameElement[] = [
  { key: 'na', symbol: 'Na', name: { zh: '钠', en: 'Sodium' }, color: '#ffb43a', hot: '#fff6cf', observation: { zh: '明亮黄色火焰', en: 'bright yellow flame' }, line: 589 },
  { key: 'cu', symbol: 'Cu', name: { zh: '铜', en: 'Copper' }, color: '#2ee6d6', hot: '#d8fffa', observation: { zh: '蓝绿色火焰', en: 'blue-green flame' }, line: 515 },
  { key: 'sr', symbol: 'Sr', name: { zh: '锶', en: 'Strontium' }, color: '#ff4d78', hot: '#ffd9e2', observation: { zh: '绯红色火焰', en: 'crimson flame' }, line: 606 },
  { key: 'k', symbol: 'K', name: { zh: '钾', en: 'Potassium' }, color: '#b57bff', hot: '#f0e4ff', observation: { zh: '淡紫色火焰', en: 'pale violet flame' }, line: 766 },
  { key: 'li', symbol: 'Li', name: { zh: '锂', en: 'Lithium' }, color: '#ff5560', hot: '#ffdcd0', observation: { zh: '胭脂红火焰', en: 'carmine flame' }, line: 671 },
  { key: 'ca', symbol: 'Ca', name: { zh: '钙', en: 'Calcium' }, color: '#ff7a45', hot: '#ffd9b8', observation: { zh: '砖红色火焰', en: 'brick-red flame' }, line: 622 },
  { key: 'ba', symbol: 'Ba', name: { zh: '钡', en: 'Barium' }, color: '#b0ea55', hot: '#f2ffcf', observation: { zh: '黄绿色火焰', en: 'yellow-green flame' }, line: 554 },
];

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

interface Palette {
  hot: RGB;
  main: RGB;
}

const paletteOf = (el: FlameElement): Palette => ({ hot: hexToRgb(el.hot), main: hexToRgb(el.color) });

const lerpPalette = (a: Palette, b: Palette, k: number): Palette => ({
  hot: {
    r: a.hot.r + (b.hot.r - a.hot.r) * k,
    g: a.hot.g + (b.hot.g - a.hot.g) * k,
    b: a.hot.b + (b.hot.b - a.hot.b) * k,
  },
  main: {
    r: a.main.r + (b.main.r - a.main.r) * k,
    g: a.main.g + (b.main.g - a.main.g) * k,
    b: a.main.b + (b.main.b - a.main.b) * k,
  },
});

const rgba = (c: RGB, alpha: number) => `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha})`;

const CYCLE_MS = 6000;
const STRIPS = 12;
const FRAME_MS = 1000 / 30;

const drawStaticFlame = (ctx: CanvasRenderingContext2D, width: number, height: number, pal: Palette) => {
  const baseX = width * 0.58;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0d0705';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';

  const outer = ctx.createRadialGradient(baseX, height * 0.9, 0, baseX, height * 0.9, height * 0.48);
  outer.addColorStop(0, rgba(pal.hot, 0.92));
  outer.addColorStop(0.28, rgba(pal.main, 0.72));
  outer.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = outer;
  ctx.fillRect(0, height * 0.38, width, height * 0.62);

  const plume = ctx.createLinearGradient(0, height, 0, height * 0.2);
  plume.addColorStop(0, rgba(pal.hot, 0.92));
  plume.addColorStop(0.42, rgba(pal.main, 0.66));
  plume.addColorStop(1, rgba(pal.main, 0));
  ctx.fillStyle = plume;
  ctx.beginPath();
  ctx.moveTo(baseX - height * 0.14, height);
  ctx.bezierCurveTo(
    baseX - height * 0.2,
    height * 0.78,
    baseX - height * 0.08,
    height * 0.52,
    baseX - height * 0.015,
    height * 0.22,
  );
  ctx.bezierCurveTo(
    baseX + height * 0.1,
    height * 0.5,
    baseX + height * 0.22,
    height * 0.76,
    baseX + height * 0.14,
    height,
  );
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo(baseX - height * 0.07, height);
  ctx.bezierCurveTo(baseX - height * 0.11, height * 0.82, baseX, height * 0.64, baseX + height * 0.035, height * 0.43);
  ctx.bezierCurveTo(baseX + height * 0.11, height * 0.68, baseX + height * 0.12, height * 0.84, baseX + height * 0.07, height);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  const inner = ctx.createRadialGradient(baseX, height * 0.97, 0, baseX, height * 0.97, height * 0.2);
  inner.addColorStop(0, 'rgba(220,238,255,0.95)');
  inner.addColorStop(0.35, 'rgba(64,120,255,0.58)');
  inner.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = inner;
  ctx.fillRect(baseX - height * 0.25, height * 0.55, height * 0.5, height * 0.45);
};

export const FlameHeroCanvas: React.FC = () => {
  const { language } = useLanguage();
  const [index, setIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [stage, setStage] = useState<FlameMotionStage>('flash');
  const [reduced, setReduced] = useState(() => Boolean(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  ));
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  );
  const [userPaused, setUserPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef<Palette>(paletteOf(FLAME_ELEMENTS[0]));
  const targetRef = useRef<Palette>(paletteOf(FLAME_ELEMENTS[0]));
  const burstRef = useRef(0);
  const leanRef = useRef(0);
  const leanTargetRef = useRef(0);
  const fanRef = useRef(0);
  const fanTargetRef = useRef(0);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    if (!surface || !canvas || typeof ResizeObserver === 'undefined') return;
    const resize = () => {
      const rect = surface.getBoundingClientRect();
      const size = getCanvasBackingSize(rect.width, rect.height, window.devicePixelRatio);
      if (canvas.width === size.width && canvas.height === size.height) return;
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (ctx) drawStaticFlame(ctx, size.width, size.height, paletteRef.current);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    targetRef.current = paletteOf(FLAME_ELEMENTS[index]);
    burstRef.current = reduced ? 0 : 1;
    setStage(getFlameMotionStage(0, reduced));
    if (reduced) return;
    const colorTimer = window.setTimeout(() => setStage(getFlameMotionStage(200, false)), 200);
    const readoutTimer = window.setTimeout(() => setStage(getFlameMotionStage(800, false)), 800);
    return () => {
      window.clearTimeout(colorTimer);
      window.clearTimeout(readoutTimer);
    };
  }, [index, reduced]);

  useEffect(() => {
    const id = setInterval(() => {
      const motionAvailable = inView && pageVisible && !userPaused;
      if (shouldAdvanceFlameCycle(hasInteracted, motionAvailable, reduced)) {
        setIndex((i) => (i + 1) % FLAME_ELEMENTS.length);
      }
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [hasInteracted, inView, pageVisible, reduced, userPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const motionEnabled = inView && pageVisible && !reduced && !userPaused;
    if (!motionEnabled) {
      if (reduced || userPaused) drawStaticFlame(ctx, canvas.width, canvas.height, targetRef.current);
      return;
    }

    drawStaticFlame(ctx, canvas.width, canvas.height, paletteRef.current);

    interface Spark {
      x: number;
      y: number;
      vy: number;
      vx: number;
      size: number;
      life: number;
      seed: number;
    }
    const sparks: Spark[] = [];
    let raf = 0;
    let last = performance.now();
    let t = 0;

    const spawnSparks = (n: number, fan: number, width: number, height: number, flameX: number) => {
      for (let i = 0; i < n; i++) {
        sparks.push({
          x: flameX + (Math.random() - 0.5) * width * 0.3,
          y: height * (0.4 + Math.random() * 0.35),
          vy: height * (0.09 + Math.random() * 0.13 + fan * 0.16),
          vx: (Math.random() - 0.5) * width * 0.035,
          size: height * (0.005 + Math.random() * 0.01),
          life: 1,
          seed: Math.random() * 40,
        });
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const width = canvas.width;
      const height = canvas.height;
      const flameX = width * 0.58;
      const stripWidth = width / STRIPS;

      paletteRef.current = lerpPalette(paletteRef.current, targetRef.current, 1 - Math.exp(-dt * 6));
      const pal = paletteRef.current;
      burstRef.current *= Math.exp(-dt * 5.2);
      const burst = burstRef.current;
      leanRef.current += (leanTargetRef.current - leanRef.current) * (1 - Math.exp(-dt * 5));
      const lean = leanRef.current;
      fanRef.current += (fanTargetRef.current - fanRef.current) * (1 - Math.exp(-dt * 4));
      const fan = fanRef.current;
      const flick = 0.78 + 0.22 * Math.sin(t * 11.3) * Math.sin(t * 4.7 + 1.3);
      const inten = (1 + fan * 0.62 + burst * 0.75) * flick;

      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < STRIPS; i++) {
        const sx = i * stripWidth;
        const mid = (i + 0.5) / STRIPS;
        const converge = (0.58 - mid) * width * 0.026;
        const sway =
          Math.sin(t * 5.2 + i * 1.9) * width * 0.008 +
          Math.sin(t * 9.1 + i * 3.7) * width * 0.004;
        const dx = converge + sway * (0.8 + fan * 0.7) + lean * width * 0.035;
        const dy = -height * (0.022 + Math.sin(t * 6.3 + i * 2.6) * 0.006 + fan * 0.009 + burst * 0.004);
        ctx.drawImage(canvas, sx, 0, stripWidth + 1, height, sx + dx, dy, stripWidth + 1, height);
      }

      ctx.fillStyle = `rgba(10,4,2,${0.105 + 0.018 * Math.sin(t * 3.1) - fan * 0.02})`;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'lighter';
      const baseX = flameX + lean * width * 0.04;

      {
        const r = height * (0.11 + fan * 0.025);
        const g = ctx.createRadialGradient(baseX, height - 1, 0, baseX, height - 1, r);
        g.addColorStop(0, `rgba(72,124,255,${0.34 * inten})`);
        g.addColorStop(0.5, `rgba(58,96,220,${0.16 * inten})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(baseX, height - 1, r, 0, Math.PI * 2);
        ctx.fill();
      }

      {
        const wMix = Math.min(0.72, burst);
        const core: RGB = {
          r: pal.hot.r + (255 - pal.hot.r) * wMix,
          g: pal.hot.g + (255 - pal.hot.g) * wMix,
          b: pal.hot.b + (255 - pal.hot.b) * wMix,
        };
        const r = height * (0.064 + fan * 0.018 + burst * 0.025);
        const g = ctx.createRadialGradient(baseX, height - 3, 0, baseX, height - 3, r);
        g.addColorStop(0, rgba(core, Math.min(1, 0.82 * inten)));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(baseX, height - 3, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const blobN = 4 + (fan > 0.4 ? 1 : 0);
      for (let i = 0; i < blobN; i++) {
        const x = baseX + (Math.random() - 0.5) * width * 0.34;
        const y = height - 4 - Math.random() * height * 0.065;
        const r = height * (0.07 + Math.random() * 0.1) * (0.9 + 0.18 * inten);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(pal.hot, Math.min(1, 0.72 * inten)));
        g.addColorStop(0.42, rgba(pal.main, Math.min(1, 0.62 * inten)));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const spawnP = 0.18 + fan * 0.38 + burst * 0.9;
      if (Math.random() < spawnP) spawnSparks(burst > 0.3 ? 2 : 1, fan, width, height, flameX);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.y -= s.vy * dt;
        s.x += (s.vx + lean * 10) * dt + Math.sin(s.y * 0.15 + s.seed) * 0.4;
        s.life -= dt * (1.2 + fan * 0.4);
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const tw = 0.7 + 0.3 * Math.sin(t * 30 + s.seed);
        ctx.fillStyle = rgba(pal.hot, 0.25 * s.life * tw);
        ctx.fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size * 2, s.size * 2);
        ctx.fillStyle = rgba(pal.hot, 0.85 * s.life * tw);
        ctx.fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size, s.size);
      }

      if (burst > 0.02) {
        const r = height * (0.12 + 0.2 * burst);
        const g = ctx.createRadialGradient(baseX, height - height * 0.05, 0, baseX, height - height * 0.05, r);
        g.addColorStop(0, `rgba(255,255,255,${0.22 * burst})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(baseX, height - height * 0.05, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inView, pageVisible, reduced, userPaused]);

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    leanTargetRef.current = Math.max(-1, Math.min(1, (rx - 0.58) * 1.8));
    setHasInteracted(true);
  };

  const current = FLAME_ELEMENTS[index];
  const isZh = language === 'zh';
  const stageText = stage === 'flash'
    ? (isZh ? '样品入焰' : 'sample enters flame')
    : stage === 'color'
      ? (isZh ? '焰色稳定中' : 'color stabilizing')
      : `${isZh ? current.observation.zh : current.observation.en} · ${isZh ? '代表谱线' : 'representative line'} ${current.line} nm`;
  const motionPaused = reduced || userPaused;

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col">
      <div
        ref={surfaceRef}
        className="relative min-h-0 flex-1 cursor-crosshair touch-pan-y overflow-hidden"
        onPointerMove={handlePointer}
        onPointerDown={(e) => {
          handlePointer(e);
          fanTargetRef.current = 1;
        }}
        onPointerUp={() => {
          fanTargetRef.current = 0;
        }}
        onPointerCancel={() => {
          fanTargetRef.current = 0;
          leanTargetRef.current = 0;
        }}
        onPointerLeave={() => {
          fanTargetRef.current = 0;
          leanTargetRef.current = 0;
        }}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="flame-canvas absolute inset-0 h-full w-full" />

        <button
          type="button"
          aria-pressed={motionPaused}
          aria-label={reduced
            ? (isZh ? '系统已减弱火焰动画' : 'Flame animation reduced by system setting')
            : motionPaused
              ? (isZh ? '播放火焰动画' : 'Play flame animation')
              : (isZh ? '暂停火焰动画' : 'Pause flame animation')}
          disabled={reduced}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setHasInteracted(true);
            setUserPaused((paused) => !paused);
          }}
          className="absolute right-2 top-2 z-20 grid min-h-11 min-w-11 place-items-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition hover:border-white/45 hover:text-white disabled:cursor-default disabled:opacity-45 sm:min-h-8 sm:min-w-8"
        >
          {motionPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <div
          className={`pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-3.5rem)] rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-sm transition-opacity duration-500 ${
            hasInteracted ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {reduced ? (
            isZh ? '已按系统设置减弱动态效果' : 'Motion reduced by system setting'
          ) : (
            <>
              <span className="sm:hidden">{isZh ? '拖动火焰 · 长按增强' : 'Drag · hold to stoke'}</span>
              <span className="hidden sm:inline">{isZh ? '移动鼠标扇风 · 按住加氧' : 'Move to fan · hold to stoke'}</span>
            </>
          )}
        </div>

        <div
          key={`${index}-${stage}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flame-readout pointer-events-none absolute bottom-2 left-1/2 z-10 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-center backdrop-blur-sm"
        >
          <span className="font-mono text-sm font-bold" style={{ color: current.color, textShadow: `0 0 8px ${current.color}` }}>
            {current.symbol}
          </span>
          <span className="truncate text-[11px] text-white/90">{stageText}</span>
        </div>
      </div>

      <div
        role="group"
        aria-label={isZh ? '选择焰色反应元素' : 'Choose a flame-test element'}
        className="relative z-20 flex h-[58px] shrink-0 items-center gap-2 overflow-x-auto border-t border-white/10 bg-black/35 px-2 py-1.5 backdrop-blur-sm sm:absolute sm:left-2 sm:top-1/2 sm:h-auto sm:-translate-y-1/2 sm:flex-col sm:items-start sm:gap-1 sm:overflow-visible sm:border-0 sm:bg-transparent sm:p-0"
      >
        {FLAME_ELEMENTS.map((el, i) => (
          <button
            type="button"
            key={el.key}
            aria-pressed={i === index}
            aria-label={`${isZh ? el.name.zh : el.name.en}, ${isZh ? '代表谱线' : 'representative line'} ${el.line} nm`}
            onClick={() => {
              setHasInteracted(true);
              setIndex(i);
            }}
            className={`flex min-h-11 min-w-[58px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur-sm transition-all sm:min-h-7 sm:min-w-0 sm:justify-start sm:rounded-full sm:px-2 sm:py-1 sm:text-[10px] ${
              i === index
                ? 'scale-[1.02] border-white/60 bg-white/20 text-white'
                : 'border-white/15 bg-black/25 text-white/65 hover:border-white/40 hover:text-white'
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: el.color, boxShadow: `0 0 5px ${el.color}` }}
            />
            <span className="font-mono">{el.symbol}</span>
            {isZh && <span>{el.name.zh}</span>}
            {i === index && <span className="hidden font-mono text-white/75 sm:inline">{el.line}nm</span>}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes flame-readout-in {
          from { opacity: 0; transform: translate(-50%, 6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .flame-canvas {
          filter: blur(2px) saturate(1.35) contrast(1.12) brightness(1.03);
          transform: scale(1.035);
        }
        .flame-readout { animation: flame-readout-in 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
        @media (min-width: 640px) {
          .flame-canvas { filter: blur(3px) saturate(1.35) contrast(1.12) brightness(1.03); }
        }
        @media (prefers-reduced-motion: reduce) {
          .flame-readout { animation: none; }
        }
      `}</style>
    </div>
  );
};

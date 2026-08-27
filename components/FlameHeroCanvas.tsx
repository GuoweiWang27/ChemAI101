import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * 元素之火 · Canvas 2D 版（增强）：
 * 经典反馈缓冲火焰算法——低分辨率离屏帧逐帧上移、向黑衰减，再经模糊放大合成柔软火苗。
 * 增强点：
 *  - 湍流：整帧上移改为 12 竖条各自带相位偏移，火舌会舔动、分裂，不再是一团上飘的果冻
 *  - 三层温度结构：本生灯蓝色内焰 + 白热核心 + 元素色外层（真实焰色反应里底焰保持微蓝）
 *  - 交互：鼠标移动 = 风力（火焰倾斜），按住 = 扇风加氧（火势变旺、火星爆发）
 *  - 换元素 = 「蘸盐入焰」：先白热闪光 + 火花飞溅，再渐变为新焰色
 *  - 读数：展示当前元素特征发射谱线（真实物理数据）
 */

export interface FlameElement {
  key: string;
  symbol: string;
  name: { zh: string; en: string };
  color: string;
  hot: string;
  /** 特征发射谱线波长（nm） */
  line: number;
}

export const FLAME_ELEMENTS: FlameElement[] = [
  { key: 'na', symbol: 'Na', name: { zh: '钠', en: 'Sodium' }, color: '#ffb43a', hot: '#fff6cf', line: 589 },
  { key: 'cu', symbol: 'Cu', name: { zh: '铜', en: 'Copper' }, color: '#2ee6d6', hot: '#d8fffa', line: 515 },
  { key: 'sr', symbol: 'Sr', name: { zh: '锶', en: 'Strontium' }, color: '#ff4d78', hot: '#ffd9e2', line: 606 },
  { key: 'k', symbol: 'K', name: { zh: '钾', en: 'Potassium' }, color: '#b57bff', hot: '#f0e4ff', line: 766 },
  { key: 'li', symbol: 'Li', name: { zh: '锂', en: 'Lithium' }, color: '#ff5560', hot: '#ffdcd0', line: 671 },
  { key: 'ca', symbol: 'Ca', name: { zh: '钙', en: 'Calcium' }, color: '#ff7a45', hot: '#ffd9b8', line: 622 },
  { key: 'ba', symbol: 'Ba', name: { zh: '钡', en: 'Barium' }, color: '#b0ea55', hot: '#f2ffcf', line: 554 },
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
/** 手动选择后闲置这么久恢复自动轮播 */
const RESUME_MS = 15000;
// 离屏缓冲分辨率（低分辨率 + 模糊 = 柔软火舌）；横幅比例匹配窗口
const W = 170;
const H = 140;
// 焰心水平位置（右侧让位给元素按钮）
const FLAME_CX = W * 0.6;
// 湍流竖条数
const STRIPS = 12;
const STRIP_W = W / STRIPS;

export const FlameHeroCanvas: React.FC = () => {
  const { language } = useLanguage();
  const [index, setIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const lastTouchAt = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef<Palette>(paletteOf(FLAME_ELEMENTS[0]));
  const targetRef = useRef<Palette>(paletteOf(FLAME_ELEMENTS[0]));
  // 交互物理量（ref 驱动，不进 React 渲染循环）
  const burstRef = useRef(0); // 换元素时的白热爆发 0..1
  const leanRef = useRef(0); // 当前倾斜（风）-1..1
  const leanTargetRef = useRef(0);
  const fanRef = useRef(0); // 扇风加氧强度 0..1
  const fanTargetRef = useRef(0);

  useEffect(() => {
    targetRef.current = paletteOf(FLAME_ELEMENTS[index]);
    // 「蘸盐入焰」：换元素瞬间白热爆发
    burstRef.current = 1;
  }, [index]);

  useEffect(() => {
    const id = setInterval(() => {
      const idle = performance.now() - lastTouchAt.current;
      if (idle > RESUME_MS) setIndex((i) => (i + 1) % FLAME_ELEMENTS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

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

    const spawnSparks = (n: number, fan: number) => {
      for (let i = 0; i < n; i++) {
        sparks.push({
          x: FLAME_CX + (Math.random() - 0.5) * W * 0.3,
          y: H * (0.4 + Math.random() * 0.35),
          vy: 12 + Math.random() * 18 + fan * 22,
          vx: (Math.random() - 0.5) * 6,
          size: 0.7 + Math.random() * 1.4,
          life: 1,
          seed: Math.random() * 40,
        });
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      // ---- 物理量更新 ----
      paletteRef.current = lerpPalette(paletteRef.current, targetRef.current, 1 - Math.exp(-dt * 6));
      const pal = paletteRef.current;
      burstRef.current *= Math.exp(-dt * 2.4);
      const burst = burstRef.current;
      leanRef.current += (leanTargetRef.current - leanRef.current) * (1 - Math.exp(-dt * 5));
      const lean = leanRef.current;
      fanRef.current += (fanTargetRef.current - fanRef.current) * (1 - Math.exp(-dt * 4));
      const fan = fanRef.current;
      // 强度脉动（两列正弦相乘，接近真实火焰的闪烁节奏）
      const flick = 0.78 + 0.22 * Math.sin(t * 11.3) * Math.sin(t * 4.7 + 1.3);
      const inten = (1 + fan * 0.9 + burst * 1.8) * flick;

      // ---- 1) 反馈：分竖条上移，各带相位偏移 → 火舌舔动 ----
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < STRIPS; i++) {
        const sx = i * STRIP_W;
        const mid = (i + 0.5) / STRIPS;
        const converge = (0.6 - mid) * 4.2; // 向焰心收缩，烧出锥形
        const sway =
          Math.sin(t * 5.2 + i * 1.9) * 1.4 +
          Math.sin(t * 9.1 + i * 3.7) * 0.7;
        const dx = converge + sway * (0.8 + fan * 0.8) + lean * 6;
        const dy = -(3.1 + Math.sin(t * 6.3 + i * 2.6) * 0.9 + fan * 1.3 + burst * 0.8);
        ctx.drawImage(canvas, sx, 0, STRIP_W + 0.6, H, sx + dx, dy, STRIP_W + 0.6, H);
      }

      // ---- 2) 向黑衰减（火苗冷却），衰减量轻微呼吸 ----
      ctx.fillStyle = `rgba(10,4,2,${0.105 + 0.018 * Math.sin(t * 3.1) - fan * 0.02})`;
      ctx.fillRect(0, 0, W, H);

      // ---- 3) 底部生成新火团（加色混合）----
      ctx.globalCompositeOperation = 'lighter';
      const baseX = FLAME_CX + lean * 7;

      // 3a) 本生灯蓝色内焰（真实焰色反应里底焰保持微蓝）
      {
        const r = 15 + fan * 4;
        const g = ctx.createRadialGradient(baseX, H - 1, 0, baseX, H - 1, r);
        g.addColorStop(0, `rgba(72,124,255,${0.34 * inten})`);
        g.addColorStop(0.5, `rgba(58,96,220,${0.16 * inten})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(baseX, H - 1, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 3b) 白热核心（爆发时趋近纯白）
      {
        const wMix = Math.min(1, burst * 1.5);
        const core: RGB = {
          r: pal.hot.r + (255 - pal.hot.r) * wMix,
          g: pal.hot.g + (255 - pal.hot.g) * wMix,
          b: pal.hot.b + (255 - pal.hot.b) * wMix,
        };
        const r = 9 + fan * 3 + burst * 6;
        const g = ctx.createRadialGradient(baseX, H - 3, 0, baseX, H - 3, r);
        g.addColorStop(0, rgba(core, Math.min(1, 0.9 * inten)));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(baseX, H - 3, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 3c) 元素色主火团
      const blobN = 4 + (fan > 0.4 ? 1 : 0);
      for (let i = 0; i < blobN; i++) {
        const x = baseX + (Math.random() - 0.5) * W * 0.36;
        const y = H - 4 - Math.random() * 9;
        const r = (10 + Math.random() * 14) * (0.9 + 0.25 * inten);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(pal.hot, 0.8 * inten));
        g.addColorStop(0.45, rgba(pal.main, 0.5 * inten));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- 4) 火星（爆发/扇风时大量飞溅，带光晕、随风漂移）----
      const spawnP = 0.26 + fan * 0.5 + burst * 2.2;
      if (Math.random() < spawnP) spawnSparks(burst > 0.3 ? 2 : 1, fan);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.y -= s.vy * dt;
        s.x += (s.vx + lean * 10) * dt + Math.sin(s.y * 0.15 + s.seed) * 0.4;
        s.life -= dt * (1.2 + fan * 0.4);
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        // 闪烁
        const tw = 0.7 + 0.3 * Math.sin(t * 30 + s.seed);
        ctx.fillStyle = rgba(pal.hot, 0.25 * s.life * tw);
        ctx.fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size * 2, s.size * 2);
        ctx.fillStyle = rgba(pal.hot, 0.85 * s.life * tw);
        ctx.fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size, s.size);
      }

      // ---- 5) 爆发白闪（蘸盐入焰的高光瞬间）----
      if (burst > 0.02) {
        const r = W * 0.45 * burst + 20;
        const g = ctx.createRadialGradient(baseX, H - 10, 0, baseX, H - 10, r);
        g.addColorStop(0, `rgba(255,255,255,${0.4 * burst})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(baseX, H - 10, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** 指针位置 → 风力目标 */
  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    leanTargetRef.current = Math.max(-1, Math.min(1, (rx - 0.6) * 1.8));
    if (!interacted) setInteracted(true);
  };

  const current = FLAME_ELEMENTS[index];
  const isZh = language === 'zh';

  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerMove={handlePointer}
      onPointerDown={(e) => {
        handlePointer(e);
        fanTargetRef.current = 1;
      }}
      onPointerUp={() => {
        fanTargetRef.current = 0;
      }}
      onPointerLeave={() => {
        fanTargetRef.current = 0;
        leanTargetRef.current = 0;
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ filter: 'blur(6px) saturate(1.4) contrast(1.15) brightness(1.05)', transform: 'scale(1.07)' }}
      />

      {/* 元素切换 */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-start gap-1">
        {FLAME_ELEMENTS.map((el, i) => (
          <button
            key={el.key}
            onClick={() => {
              lastTouchAt.current = performance.now();
              setIndex(i);
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm border whitespace-nowrap transition-all ${
              i === index
                ? 'bg-white/20 border-white/60 text-white scale-105'
                : 'bg-black/20 border-white/15 text-white/55 hover:text-white/90 hover:border-white/40 hover:scale-105'
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: el.color, boxShadow: `0 0 5px ${el.color}` }}
            />
            <span className="font-mono">{el.symbol}</span>
            {isZh && <span>{el.name.zh}</span>}
            {i === index && <span className="font-mono text-white/70">{el.line}nm</span>}
          </button>
        ))}
      </div>

      {/* 底部读数：元素 + 特征谱线（随切换做入场动画） */}
      <div
        key={index}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-baseline gap-1.5 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-sm border border-white/15 whitespace-nowrap pointer-events-none flame-readout"
      >
        <span className="font-mono font-bold text-sm" style={{ color: current.color, textShadow: `0 0 8px ${current.color}` }}>
          {current.symbol}
        </span>
        <span className="text-[11px] text-white/85">{isZh ? current.name.zh : current.name.en}</span>
        <span className="font-mono text-[10px] text-white/50">λ {current.line} nm</span>
      </div>

      {/* 操作提示（首次交互后淡出） */}
      <div
        className={`absolute top-2 right-2 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 text-[10px] text-white/60 pointer-events-none transition-opacity duration-700 ${
          interacted ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {isZh ? '移动鼠标扇风 · 按住加氧' : 'Move to fan · Hold to stoke'}
      </div>

      <style>{`
        @keyframes flame-readout-in {
          from { opacity: 0; transform: translate(-50%, 6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .flame-readout { animation: flame-readout-in 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
      `}</style>
    </div>
  );
};

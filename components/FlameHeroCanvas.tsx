import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * 元素之火 · Canvas 2D 版：
 * 经典火焰算法——底部生成渐变火团、整帧上移、逐帧向黑衰减，再经模糊放大合成，
 * 得到柔软真实的火苗。焰色由调色板驱动，点元素即换色（6s 自动轮播，手动后停止）。
 */

export interface FlameElement {
  key: string;
  symbol: string;
  name: { zh: string; en: string };
  color: string;
  hot: string;
}

export const FLAME_ELEMENTS: FlameElement[] = [
  { key: 'na', symbol: 'Na', name: { zh: '钠', en: 'Sodium' }, color: '#ffb43a', hot: '#fff6cf' },
  { key: 'cu', symbol: 'Cu', name: { zh: '铜', en: 'Copper' }, color: '#2ee6d6', hot: '#d8fffa' },
  { key: 'sr', symbol: 'Sr', name: { zh: '锶', en: 'Strontium' }, color: '#ff4d78', hot: '#ffd9e2' },
  { key: 'k', symbol: 'K', name: { zh: '钾', en: 'Potassium' }, color: '#b57bff', hot: '#f0e4ff' },
  { key: 'li', symbol: 'Li', name: { zh: '锂', en: 'Lithium' }, color: '#ff5560', hot: '#ffdcd0' },
  { key: 'ca', symbol: 'Ca', name: { zh: '钙', en: 'Calcium' }, color: '#ff7a45', hot: '#ffd9b8' },
  { key: 'ba', symbol: 'Ba', name: { zh: '钡', en: 'Barium' }, color: '#b0ea55', hot: '#f2ffcf' },
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
// 离屏缓冲分辨率（低分辨率 + 模糊 = 柔软火舌）；横幅比例匹配窗口
const W = 170;
const H = 140;

export const FlameHeroCanvas: React.FC = () => {
  const { language } = useLanguage();
  const [index, setIndex] = useState(0);
  const userTouched = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef<Palette>(paletteOf(FLAME_ELEMENTS[0]));
  const targetRef = useRef<Palette>(paletteOf(FLAME_ELEMENTS[0]));

  useEffect(() => {
    targetRef.current = paletteOf(FLAME_ELEMENTS[index]);
  }, [index]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!userTouched.current) setIndex((i) => (i + 1) % FLAME_ELEMENTS.length);
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
      life: number;
    }
    const sparks: Spark[] = [];
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // 调色板渐变
      paletteRef.current = lerpPalette(paletteRef.current, targetRef.current, 1 - Math.exp(-dt * 6));
      const pal = paletteRef.current;

      // 1) 整帧上移（火上升）
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(canvas, 0, -3.4);
      // 2) 向黑衰减（火苗冷却）
      ctx.fillStyle = 'rgba(8,3,1,0.115)';
      ctx.fillRect(0, 0, W, H);
      // 3) 底部生成新火团（加色混合）
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = W * 0.5 + (Math.random() - 0.5) * W * 0.44;
        const y = H - 4 - Math.random() * 8;
        const r = 10 + Math.random() * 14;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(pal.hot, 0.85));
        g.addColorStop(0.45, rgba(pal.main, 0.55));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 4) 火星
      if (Math.random() < 0.3) {
        sparks.push({
          x: W * 0.5 + (Math.random() - 0.5) * W * 0.3,
          y: H * (0.35 + Math.random() * 0.3),
          vy: 14 + Math.random() * 16,
          life: 1,
        });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.y -= s.vy * dt;
        s.x += Math.sin(s.y * 0.15) * 0.4;
        s.life -= dt * 1.4;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.fillStyle = rgba(pal.hot, 0.8 * s.life);
        ctx.fillRect(s.x, s.y, 1.6, 1.6);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isZh = language === 'zh';

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ filter: 'blur(5px) saturate(1.35) contrast(1.2)', transform: 'scale(1.08)' }}
      />
      {/* 元素切换 */}
      <div
        className="absolute bottom-2 inset-x-0 flex justify-center gap-1 flex-nowrap px-1.5 overflow-hidden"
        style={{ pointerEvents: 'auto' }}
      >
        {FLAME_ELEMENTS.map((el, i) => (
          <button
            key={el.key}
            onClick={() => {
              userTouched.current = true;
              setIndex(i);
            }}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm border whitespace-nowrap transition-all ${
              i === index
                ? 'bg-white/20 border-white/60 text-white scale-105'
                : 'bg-black/20 border-white/15 text-white/55 hover:text-white/90 hover:border-white/40'
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: el.color, boxShadow: `0 0 5px ${el.color}` }}
            />
            <span className="font-mono">{el.symbol}</span>
            {isZh && <span>{el.name.zh}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

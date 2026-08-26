import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * 元素之火：焰色反应粒子火焰。
 * 数千颗加色混合粒子按「白热核心 → 元素焰色 → 暗红余烬」的色温爬升燃烧，
 * 底部元素按钮切换焰色（6s 自动轮播，手动选择后停止）。
 */

export interface FlameElement {
  key: string;
  symbol: string;
  name: { zh: string; en: string };
  /** 主焰色 */
  color: string;
  /** 白热核心色 */
  hot: string;
  /** 余烬色 */
  ember: string;
}

export const FLAME_ELEMENTS: FlameElement[] = [
  { key: 'na', symbol: 'Na', name: { zh: '钠', en: 'Sodium' }, color: '#ffb020', hot: '#fff3c4', ember: '#c4580a' },
  { key: 'cu', symbol: 'Cu', name: { zh: '铜', en: 'Copper' }, color: '#20d5c8', hot: '#c8fff4', ember: '#0a7a6e' },
  { key: 'sr', symbol: 'Sr', name: { zh: '锶', en: 'Strontium' }, color: '#ff3d6e', hot: '#ffd3de', ember: '#a3123c' },
  { key: 'k', symbol: 'K', name: { zh: '钾', en: 'Potassium' }, color: '#b070ff', hot: '#efe2ff', ember: '#5b2ea8' },
  { key: 'li', symbol: 'Li', name: { zh: '锂', en: 'Lithium' }, color: '#f04352', hot: '#ffd9c0', ember: '#8f1420' },
  { key: 'ca', symbol: 'Ca', name: { zh: '钙', en: 'Calcium' }, color: '#ff6a3d', hot: '#ffd2ae', ember: '#a02c10' },
  { key: 'ba', symbol: 'Ba', name: { zh: '钡', en: 'Barium' }, color: '#a8e04a', hot: '#eeffc8', ember: '#5a8a14' },
];

const COUNT = 1700;
const CYCLE_MS = 6000;

// 每颗粒子的 CPU 状态
interface PState {
  life: number;
  maxLife: number;
  y: number;
  velY: number;
  theta: number;
  seed: number;
  alive: boolean;
}

const flameVert = `
attribute float aSize;
attribute vec3 aColor;
attribute float aOpacity;
varying vec3 vColor;
varying float vOpacity;
void main() {
  vColor = aColor;
  vOpacity = aOpacity;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (320.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const flameFrag = `
varying vec3 vColor;
varying float vOpacity;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vColor, a * vOpacity);
}`;

function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const FlameSystem: React.FC<{ element: FlameElement }> = ({ element }) => {
  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const pointsRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const state = useRef<PState[]>(
    Array.from({ length: COUNT }, () => ({
      life: Math.random() * 2,
      maxLife: 1,
      y: 0,
      velY: 0,
      theta: 0,
      seed: Math.random(),
      alive: false,
    })),
  );

  const buffers = useMemo(() => {
    return {
      positions: new Float32Array(COUNT * 3),
      colors: new Float32Array(COUNT * 3),
      sizes: new Float32Array(COUNT),
      opacities: new Float32Array(COUNT),
    };
  }, []);

  const colorState = useRef({
    main: new THREE.Color(FLAME_ELEMENTS[0].color),
    hot: new THREE.Color(FLAME_ELEMENTS[0].hot),
    ember: new THREE.Color(FLAME_ELEMENTS[0].ember),
  });
  const colorTarget = useRef({
    main: new THREE.Color(element.color),
    hot: new THREE.Color(element.hot),
    ember: new THREE.Color(element.ember),
  });

  useEffect(() => {
    colorTarget.current.main.set(element.color);
    colorTarget.current.hot.set(element.hot);
    colorTarget.current.ember.set(element.ember);
  }, [element]);

  const spawnAcc = useRef(0);
  const tmpColor = useRef(new THREE.Color());

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const time = clock.elapsedTime;
    const cs = colorState.current;
    const ct = colorTarget.current;
    const lerpK = 1 - Math.exp(-dt * 4);
    cs.main.lerp(ct.main, lerpK);
    cs.hot.lerp(ct.hot, lerpK);
    cs.ember.lerp(ct.ember, lerpK);

    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).color.copy(cs.main);
    }

    // 发射
    spawnAcc.current += dt * 950;
    const states = state.current;
    while (spawnAcc.current >= 1) {
      spawnAcc.current -= 1;
      const slot = states.findIndex((p) => !p.alive);
      const idx = slot >= 0 ? slot : Math.floor(Math.random() * COUNT);
      const p = states[idx];
      p.alive = true;
      p.life = 0;
      p.maxLife = 0.9 + Math.random() * 0.8;
      p.y = 0;
      p.velY = 1.3 + Math.random() * 1.1;
      p.theta = Math.random() * Math.PI * 2;
      p.seed = Math.random();
    }

    // 模拟 + 写缓冲
    const pos = buffers.positions;
    const col = buffers.colors;
    const siz = buffers.sizes;
    const opa = buffers.opacities;
    for (let i = 0; i < COUNT; i++) {
      const p = states[i];
      const i3 = i * 3;
      if (!p.alive) {
        opa[i] = 0;
        continue;
      }
      p.life += dt;
      const age = p.life / p.maxLife;
      if (age >= 1) {
        p.alive = false;
        opa[i] = 0;
        continue;
      }
      p.y += p.velY * dt * (1 - age * 0.55);
      // 火苗泪滴形：半径随年龄外扩 + 摇曳
      const r = 0.1 + age * 0.62 + Math.sin(time * 3 + p.seed * 20) * 0.04;
      const sway = Math.sin(time * 5.5 + p.seed * 30 + p.y * 1.4) * (0.06 + age * 0.3);
      pos[i3] = Math.sin(p.theta) * r + sway;
      pos[i3 + 1] = p.y;
      pos[i3 + 2] = Math.cos(p.theta) * r * 0.62;

      // 色温爬升：白热 → 元素色 → 余烬
      const ageC = Math.min(1, age * (0.85 + p.seed * 0.3));
      if (ageC < 0.28) {
        tmpColor.current.copy(cs.hot).lerp(cs.main, ageC / 0.28);
      } else if (ageC < 0.72) {
        tmpColor.current.copy(cs.main);
      } else {
        tmpColor.current.copy(cs.main).lerp(cs.ember, (ageC - 0.72) / 0.28);
      }
      col[i3] = tmpColor.current.r;
      col[i3 + 1] = tmpColor.current.g;
      col[i3 + 2] = tmpColor.current.b;
      siz[i] = (0.55 + p.seed * 0.5) * (0.5 + Math.sin(Math.PI * Math.min(1, age * 1.15)) * 0.9);
      opa[i] = 0.85 * (1 - Math.pow(age, 1.6)) * (0.7 + p.seed * 0.3);
    }

    const geo = pointsRef.current?.geometry;
    if (geo) {
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  const uniforms = useMemo(() => ({}), []);

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[buffers.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
          <bufferAttribute attach="attributes-aOpacity" args={[buffers.opacities, 1]} />
          <shaderMaterial
            args={[
              {
                uniforms,
                vertexShader: flameVert,
                fragmentShader: flameFrag,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
              },
            ]}
          />
        </bufferGeometry>
      </points>
      {/* 底部辉光 */}
      <mesh ref={glowRef} position={[0, 0.05, -0.4]}>
        <planeGeometry args={[5.2, 2.6]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};


export interface FlameHeroCanvasProps {
  /** 受控元素；不传则内部自动轮播 */
  autoCycle?: boolean;
}

export const FlameHeroCanvas: React.FC<FlameHeroCanvasProps> = ({ autoCycle = true }) => {
  const { language } = useLanguage();
  const [index, setIndex] = useState(0);
  const userTouched = useRef(false);

  useEffect(() => {
    if (!autoCycle) return;
    const id = setInterval(() => {
      if (!userTouched.current) setIndex((i) => (i + 1) % FLAME_ELEMENTS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [autoCycle]);

  const element = FLAME_ELEMENTS[index];
  const isZh = language === 'zh';

  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 1.1, 4.6], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <FlameSystem element={element} />
      </Canvas>
      {/* 元素切换按钮 */}
      <div
        className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 sm:gap-2 flex-wrap px-3"
        style={{ pointerEvents: 'auto' }}
      >
        {FLAME_ELEMENTS.map((el, i) => (
          <button
            key={el.key}
            onClick={() => {
              userTouched.current = true;
              setIndex(i);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border transition-all ${
              i === index
                ? 'bg-white/20 border-white/50 text-white scale-105 shadow-lg'
                : 'bg-white/5 border-white/15 text-white/60 hover:text-white/90 hover:border-white/35'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: el.color, boxShadow: `0 0 6px ${el.color}` }} />
            <span className="font-mono">{el.symbol}</span>
            <span>{isZh ? el.name.zh : el.name.en}</span>
          </button>
        ))}
      </div>
    </div>
  );
};


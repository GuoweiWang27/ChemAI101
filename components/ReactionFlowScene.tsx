import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeStructure, ELEMENT_COLORS, ELEMENT_RADII } from '../types';
import type {
  ReactionAnimationActor,
  ReactionAnimationEventV2,
  ReactionAnimationScene,
  ReactionAnimationSceneV2,
} from '../src/data/reactions/schema';
import {
  getActiveAnimationEvents,
  getAnimationSnapshot,
  isStageActiveAt,
} from '../utils/reactionAnimation';
import {
  buildReactionVisualDirectives,
  canRenderAtomConservation,
  type ReactionVisualDirective,
} from '../utils/reactionAnimationVisuals';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * 全程反应动画 · 电影版：
 * 反应物飞入（镜头特写）→ 激发抖动 → 化学键绷紧崩断（SNAP）→ 映射原子沿贝塞尔弧线
 * 带拖尾逐颗飞向产物位（镜头跟随）→ 产物键双端到达后生长 → 脉冲（镜头推近）→ 定格。
 * 时间轴为纯函数（t → 状态），playKey 自增即重播。
 */

// 时间轴（秒）
const ENTER_DUR = 1.6;
const EXCITE_START = 2.0;
const EXCITE_END = 3.0;
const SNAP_START = 3.0;
const SNAP_END = 3.6;
const BOND_GONE = 3.9;
const LAUNCH_START = 3.6;
const LAUNCH_STAGGER = 0.22;
const LAUNCH_DUR = 1.7;
const UNMAP_FADE_START = 3.6;
const UNMAP_FADE_DUR = 1.2;
const BOND_GROW_DUR = 0.4;
const PULSE_START = 11.6;
const PULSE_END = 12.4;
const CONTROLS_AT = 13.8;

const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

const smoothstep = (x: number) => x * x * (3 - 2 * x);

function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

interface FlowAtom {
  key: string;
  productId: number | null;
  element: string;
  color: string;
  radius: number;
  reactantIdx: number;
  from: THREE.Vector3;
  ctrl: THREE.Vector3; // 贝塞尔控制点（飞行弧线）
  to: THREE.Vector3;
  launchStart: number;
}

interface ReactantBond {
  ri: number;
  aKey: string;
  bKey: string;
}

interface ProductBond {
  pa: number;
  pb: number;
  baseLen: number;
  arriveAt: number;
}

interface SceneProps {
  structure: MoleculeStructure;
  flow: NonNullable<import('../src/data/reactions/schema').CuratedReaction['reactionFlow']>;
  playKey: number;
  time?: number;
  animation?: ReactionAnimationScene;
  reduced: boolean;
  selectedAtomId: number | null;
  onAtomSelect?: (id: number | null) => void;
}

const BASE_BOND = new THREE.Color('#6f685d');
const SNAP_COLOR = new THREE.Color('#ff5a3c');
const STRESS = new THREE.Color('#f59e0b');

/** 镜头编舞：关键帧插值机位与注视点 */
const CAMERA_KEYS: Array<{ t: number; pos: [number, number, number]; look: [number, number, number] }> = [
  { t: 0.0, pos: [2.8, 0.7, 4.6], look: [-2.3, 0.1, 0] },
  { t: 2.2, pos: [2.8, 0.7, 4.6], look: [-2.3, 0.1, 0] },
  { t: 4.4, pos: [0.2, 0.2, 8.6], look: [-0.6, 0.2, 0] },
  { t: 8.8, pos: [0.5, 0.3, 7.4], look: [0.1, 0, 0] },
  { t: 11.9, pos: [0, 0.1, 5.9], look: [0, 0, 0] },
  { t: 13.6, pos: [0.3, 0.2, 7.3], look: [0, 0, 0] },
];

const CameraRig: React.FC<{
  startRef: React.MutableRefObject<number | null>;
  reduced: boolean;
  onRelease: () => void;
}> = ({ startRef, reduced, onRelease }) => {
  const { camera } = useThree();
  const released = useRef(false);
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    if (reduced) return;
    if (startRef.current === null) return;
    const t = clock.elapsedTime - startRef.current;

    if (t >= CONTROLS_AT) {
      if (!released.current) {
        released.current = true;
        onRelease();
      }
      return; // 交还控制后不再干预机位
    }
    released.current = false;

    const keys = CAMERA_KEYS;
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const k0 = keys[i];
    const k1 = keys[i + 1];
    const p = smoothstep(Math.min(1, Math.max(0, (t - k0.t) / (k1.t - k0.t))));
    pos.current.set(...k0.pos).lerp(new THREE.Vector3(...k1.pos), p);
    look.current.set(...k0.look).lerp(new THREE.Vector3(...k1.look), p);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });
  return null;
};

interface SceneContentProps extends SceneProps {
  onControlsReady: (enabled: boolean) => void;
}

const numberParam = (directive: ReactionVisualDirective, name: string, fallback: number) => {
  const value = directive.params[name];
  return typeof value === 'number' ? value : fallback;
};

const stringParam = (directive: ReactionVisualDirective, name: string, fallback: string) => {
  const value = directive.params[name];
  return typeof value === 'string' ? value : fallback;
};

/** 反应族 1：燃烧 / 热反应。颜色与强度都来自 effect.params。 */
const HeatReactionRenderer: React.FC<{ directives: ReactionVisualDirective[] }> = ({ directives }) => (
  <>
    {directives.filter((directive) => directive.renderer === 'heat').map((directive) => {
      const color = stringParam(directive, 'color', '#ffae47');
      const intensity = numberParam(directive, 'intensity', 1);
      return (
        <group key={directive.id} position={[0, -0.85, -0.35]}>
          <pointLight color={color} intensity={(0.35 + directive.progress) * intensity} distance={5} />
          <mesh scale={[0.7 + directive.progress * 0.35, 0.75 + directive.progress * 0.7, 0.7]}>
            <coneGeometry args={[0.52, 1.35, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.12 + directive.progress * 0.24} />
          </mesh>
        </group>
      );
    })}
  </>
);

/** 反应族 2：放气；气泡与烟粒子是两种可叠加 effect。 */
const GasEvolutionRenderer: React.FC<{ directives: ReactionVisualDirective[]; time: number }> = ({ directives, time }) => (
  <>
    {directives.filter((directive) => directive.renderer === 'bubbles' || directive.renderer === 'smoke').map((directive) => {
      const isSmoke = directive.renderer === 'smoke';
      const count = Math.min(28, Math.max(3, Math.round(numberParam(directive, 'count', 10))));
      const color = stringParam(directive, 'color', isSmoke ? '#f1eee5' : '#9ae8ed');
      return (
        <group key={directive.id}>
          {Array.from({ length: count }, (_, index) => {
            const cycle = (time * (isSmoke ? 0.08 : 0.18) + index * 0.137) % 1;
            const x = ((index * 0.73) % 3.6) - 1.8;
            const y = -1.25 + cycle * 3.2;
            const radius = (isSmoke ? 0.11 : 0.055) + (index % 4) * 0.018;
            return (
              <mesh key={index} position={[x, y, -0.4 + (index % 3) * 0.16]}>
                <sphereGeometry args={[radius, 10, 10]} />
                <meshBasicMaterial color={color} transparent opacity={(0.12 + directive.progress * 0.28) * (1 - cycle * 0.45)} />
              </mesh>
            );
          })}
        </group>
      );
    })}
  </>
);

/** 反应族 3：沉淀 / 变色。两类 effect 可独立或同时出现。 */
const PrecipitationColorRenderer: React.FC<{ directives: ReactionVisualDirective[] }> = ({ directives }) => (
  <>
    {directives.filter((directive) => directive.renderer === 'solution-color').map((directive) => (
      <mesh key={directive.id} position={[0, -0.9, -0.65]} scale={[2.4, 0.72, 1.05]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial
          color={stringParam(directive, directive.progress < 0.5 ? 'from' : 'to', '#8ac7cf')}
          transparent
          opacity={0.1 + directive.progress * 0.18}
          roughness={0.25}
        />
      </mesh>
    ))}
    {directives.filter((directive) => directive.renderer === 'precipitate').map((directive) => {
      const count = Math.min(30, Math.max(4, Math.round(numberParam(directive, 'count', 16))));
      const color = stringParam(directive, 'color', '#d79068');
      return (
        <group key={directive.id}>
          {Array.from({ length: count }, (_, index) => (
            <mesh key={index} position={[
              ((index * 0.61) % 3.6) - 1.8,
              -1.35 + ((index * 0.19) % 0.6) * directive.progress,
              -0.35 + (index % 4) * 0.12,
            ]}>
              <dodecahedronGeometry args={[0.045 + (index % 3) * 0.012, 0]} />
              <meshStandardMaterial color={color} roughness={0.8} transparent opacity={0.25 + directive.progress * 0.65} />
            </mesh>
          ))}
        </group>
      );
    })}
  </>
);

/** 反应族 4：离子 / 电子。环场与电子路径均由声明式 effect 驱动。 */
const IonicElectronRenderer: React.FC<{ directives: ReactionVisualDirective[] }> = ({ directives }) => (
  <>
    {directives.filter((directive) => directive.renderer === 'ion-field').map((directive) => (
      <group key={directive.id}>
        {[-1, 1].map((x) => (
          <mesh key={x} rotation={[Math.PI / 2, 0, 0]} position={[x, 0, -0.55]}>
            <torusGeometry args={[0.62 + directive.progress * 0.16, 0.026, 8, 40]} />
            <meshBasicMaterial color={stringParam(directive, 'color', '#9fe6df')} transparent opacity={0.12 + directive.progress * 0.35} />
          </mesh>
        ))}
      </group>
    ))}
    {directives.filter((directive) => directive.renderer === 'electron-path').map((directive) => (
      <group key={directive.id}>
        <Line points={[[-1.9, 0.7, 0], [0, 1.15, 0.2], [1.9, 0.55, 0]]} color={stringParam(directive, 'color', '#f4c95d')} transparent opacity={0.3 + directive.progress * 0.5} dashed dashSize={0.12} gapSize={0.08} />
        <mesh position={[-1.9 + directive.progress * 3.8, 0.7 + Math.sin(directive.progress * Math.PI) * 0.45, 0.12]}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <meshBasicMaterial color={stringParam(directive, 'color', '#f4c95d')} />
        </mesh>
      </group>
    ))}
  </>
);

/** 反应族 5：有机成键。新键数量和颜色来自 effect.params。 */
const OrganicBondRenderer: React.FC<{ directives: ReactionVisualDirective[] }> = ({ directives }) => (
  <>
    {directives.filter((directive) => directive.renderer === 'bond-rewire').map((directive) => {
      const count = Math.min(4, Math.max(1, Math.round(numberParam(directive, 'bonds', 1))));
      const color = stringParam(directive, 'color', '#b6d58a');
      return (
        <group key={directive.id}>
          {Array.from({ length: count }, (_, index) => {
            const y = (index - (count - 1) / 2) * 0.34;
            return <Line key={index} points={[[-1.25, y, 0], [0, y + 0.18, 0.12], [1.25, y, 0]]} color={color} transparent opacity={0.18 + directive.progress * 0.72} lineWidth={1.6 + directive.progress * 1.4} />;
          })}
        </group>
      );
    })}
  </>
);

const DeclarativeEffectDispatcher: React.FC<{
  animation: ReactionAnimationSceneV2;
  time: number;
}> = ({ animation, time }) => {
  const directives = useMemo(() => buildReactionVisualDirectives(animation, time), [animation, time]);
  return (
    <>
      <HeatReactionRenderer directives={directives} />
      <GasEvolutionRenderer directives={directives} time={time} />
      <PrecipitationColorRenderer directives={directives} />
      <IonicElectronRenderer directives={directives} />
      <OrganicBondRenderer directives={directives} />
    </>
  );
};

const SceneContent: React.FC<SceneContentProps> = ({
  structure,
  flow,
  playKey,
  time,
  animation,
  reduced,
  selectedAtomId,
  onAtomSelect,
  onControlsReady,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const atomMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const reactantBondRefs = useRef<Array<THREE.Group | null>>([]);
  const reactantBondMats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const productBondRefs = useRef<Array<THREE.Group | null>>([]);
  const productBondMats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const sparksRef = useRef<Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; born: number }>>([]);
  const ghostsRef = useRef<Array<{ mesh: THREE.Mesh; born: number }>>([]);
  const ghostGroupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);
  const arrivedRef = useRef<Set<string>>(new Set());
  const trailClock = useRef(0);
  const tmp = useRef(new THREE.Vector3());

  const atoms = useMemo(() => {
    const result: FlowAtom[] = [];
    const launchOrder: FlowAtom[] = [];
    flow.reactants.forEach((reactant, ri) => {
      reactant.structure.atoms.forEach((atom) => {
        const localBase = new THREE.Vector3(atom.x / 2, atom.y / 2, atom.z / 2);
        const mapping = flow.atomMap.find((m) => m.reactant === ri && m.atom === atom.id);
        const fa: FlowAtom = {
          key: `${ri}:${atom.id}`,
          productId: mapping ? mapping.to : null,
          element: atom.element,
          color: atom.color || ELEMENT_COLORS[atom.element] || '#cccccc',
          radius: ELEMENT_RADII[atom.element] || ELEMENT_RADII.default,
          reactantIdx: ri,
          from: new THREE.Vector3(...reactant.position).add(localBase),
          ctrl: new THREE.Vector3(),
          to: new THREE.Vector3(),
          launchStart: Number.POSITIVE_INFINITY,
        };
        if (mapping) launchOrder.push(fa);
        result.push(fa);
      });
    });
    launchOrder.sort((a, b) => a.from.x - b.from.x || seededRand(a.from.y * 100) - seededRand(b.from.y * 100));
    launchOrder.forEach((fa, idx) => {
      fa.launchStart = LAUNCH_START + idx * LAUNCH_STAGGER;
      const pa = structure.atoms.find((p) => p.id === fa.productId)!;
      fa.to.set(pa.x / 2, pa.y / 2, pa.z / 2);
      // 弧线控制点：中点上方抬高 + 随机侧偏
      fa.ctrl.copy(fa.from).lerp(fa.to, 0.5);
      fa.ctrl.y += 1.1 + seededRand(idx * 7) * 0.7;
      fa.ctrl.x += (seededRand(idx * 13) - 0.5) * 1.0;
      fa.ctrl.z += (seededRand(idx * 17) - 0.5) * 0.8;
    });
    return result;
  }, [structure, flow]);

  const atomByKey = useMemo(() => new Map(atoms.map((a) => [a.key, a])), [atoms]);

  const reactantBonds = useMemo<ReactantBond[]>(
    () =>
      flow.reactants.flatMap((reactant, ri) =>
        reactant.structure.bonds.map((b) => ({
          ri,
          aKey: `${ri}:${b.source}`,
          bKey: `${ri}:${b.target}`,
        })),
      ),
    [flow],
  );

  const productBonds = useMemo<ProductBond[]>(() => {
    return structure.bonds.map((b) => {
      const fa = atoms.find((x) => x.productId === b.source)!;
      const fb = atoms.find((x) => x.productId === b.target)!;
      const sa = structure.atoms.find((p) => p.id === b.source)!;
      const sb = structure.atoms.find((p) => p.id === b.target)!;
      return {
        pa: b.source,
        pb: b.target,
        baseLen: Math.max(0.0001, Math.hypot(sa.x - sb.x, sa.y - sb.y, sa.z - sb.z)),
        arriveAt: Math.max(fa.launchStart + LAUNCH_DUR, fb.launchStart + LAUNCH_DUR),
      };
    });
  }, [structure, atoms]);

  /** 二次贝塞尔飞行轨迹 */
  const flightPos = (a: FlowAtom, p: number, out: THREE.Vector3): THREE.Vector3 => {
    const q1 = tmp.current.copy(a.from).lerp(a.ctrl, p);
    const q2 = a.ctrl.clone().lerp(a.to, p);
    return out.copy(q1).lerp(q2, p);
  };

  const atomState = (a: FlowAtom, t: number): { pos: THREE.Vector3; opacity: number } => {
    const enterP = easeInOutCubic(Math.min(1, t / ENTER_DUR));
    const base = tmp.current.copy(a.from).add(new THREE.Vector3(-6.5 * (1 - enterP), 0, 0));

    const excited = t > EXCITE_START && t < EXCITE_END;
    if (excited) base.x += Math.sin(t * 46 + a.reactantIdx * 3.1) * 0.06;

    if (!Number.isFinite(a.launchStart)) {
      const fade = t <= UNMAP_FADE_START ? 0 : Math.min(1, (t - UNMAP_FADE_START) / UNMAP_FADE_DUR);
      return { pos: base.clone(), opacity: enterP * (1 - fade) };
    }
    if (t < a.launchStart) {
      return { pos: base.clone(), opacity: enterP };
    }
    const p = easeInOutCubic(Math.min(1, (t - a.launchStart) / LAUNCH_DUR));
    return { pos: flightPos(a, p, new THREE.Vector3()), opacity: 1 };
  };

  // 重播重置
  useEffect(() => {
    startRef.current = null;
    arrivedRef.current = new Set();
    [sparksRef.current, ghostsRef.current].forEach((pool) => {
      pool.forEach((s) => {
        s.mesh.parent?.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
      });
      pool.length = 0;
    });
    if (!reduced && time === undefined) onControlsReady(false);
  }, [playKey, reduced, onControlsReady]);

  const spawnBurst = (at: THREE.Vector3, now: number, count: number, speed: number) => {
    if (!sparkGroupRef.current) return;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.95 }),
      );
      mesh.position.copy(at);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      sparksRef.current.push({ mesh, vel: dir.multiplyScalar(speed), born: now });
      sparkGroupRef.current.add(mesh);
    }
  };

  const updateBondTransform = (
    g: THREE.Group,
    sa: THREE.Vector3,
    sb: THREE.Vector3,
    stretch: number,
  ) => {
    const dir = sb.clone().sub(sa);
    const len = Math.max(0.0001, dir.length() * stretch);
    g.position.copy(sa).addScaledVector(dir, 0.5);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.scale.set(1, len, 1);
  };

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (time === undefined && startRef.current === null) startRef.current = clock.elapsedTime;
    const t = time ?? (clock.elapsedTime - (startRef.current ?? clock.elapsedTime));
    const now = performance.now();

    // 原子
    atoms.forEach((a) => {
      const mesh = atomMeshes.current.get(a.key);
      if (!mesh) return;
      const { pos, opacity } = atomState(a, t);
      mesh.position.copy(pos);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity = reduced ? 1 : opacity;

      // 飞行拖尾
      if (
        !reduced &&
        Number.isFinite(a.launchStart) &&
        t > a.launchStart &&
        t < a.launchStart + LAUNCH_DUR
      ) {
        trailClock.current += dt;
        if (trailClock.current > 0.07) {
          trailClock.current = 0;
          const ghost = new THREE.Mesh(
            new THREE.SphereGeometry(a.radius * 0.22, 8, 8),
            new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0.35 }),
          );
          ghost.position.copy(pos);
          ghostsRef.current.push({ mesh: ghost, born: now });
          ghostGroupRef.current?.add(ghost);
        }
      }

      // 到达迸花
      if (
        !reduced &&
        a.productId !== null &&
        t >= a.launchStart + LAUNCH_DUR &&
        !arrivedRef.current.has(a.key)
      ) {
        arrivedRef.current.add(a.key);
        spawnBurst(a.to, now, 6, 2.4);
      }

      // 定格脉冲
      if (a.productId !== null && t >= PULSE_START && t <= PULSE_END && !reduced) {
        const k = Math.sin(((t - PULSE_START) / (PULSE_END - PULSE_START)) * Math.PI);
        material.emissiveIntensity = 0.12 + k * 0.85;
      } else {
        material.emissiveIntensity = 0.12;
      }
    });

    // 反应物键：激发绷紧 → SNAP 崩断（拉伸 + 变红）→ 消失
    reactantBonds.forEach((bond, j) => {
      const g = reactantBondRefs.current[j];
      const mat = reactantBondMats.current[j];
      if (!g || !mat) return;
      const A = atomByKey.get(bond.aKey)!;
      const B = atomByKey.get(bond.bKey)!;
      const sa = atomState(A, t).pos;
      const sb = atomState(B, t).pos;
      const departed =
        (Number.isFinite(A.launchStart) && t >= A.launchStart) ||
        (Number.isFinite(B.launchStart) && t >= B.launchStart) ||
        (A.productId === null && t >= UNMAP_FADE_START) ||
        (B.productId === null && t >= UNMAP_FADE_START);

      if (t > BOND_GONE || departed) {
        mat.opacity += (0 - mat.opacity) * Math.min(1, dt * 14);
        mat.color.copy(BASE_BOND);
      } else if (t >= SNAP_START) {
        // 崩断瞬间：拉伸 + 红闪
        const k = Math.min(1, (t - SNAP_START) / (SNAP_END - SNAP_START));
        mat.color.copy(BASE_BOND).lerp(SNAP_COLOR, k);
        mat.opacity = 0.95;
        updateBondTransform(g, sa, sb, 1 + k * 0.4);
        g.visible = true;
        return;
      } else {
        const excited = t > EXCITE_START && t < EXCITE_END;
        mat.color.copy(excited ? STRESS : BASE_BOND);
        mat.opacity += (0.85 - mat.opacity) * Math.min(1, dt * 10);
      }
      g.visible = mat.opacity > 0.02;
      if (g.visible) updateBondTransform(g, sa, sb, 1);
    });

    // 产物键：双端到达后生长
    productBonds.forEach((bond, j) => {
      const g = productBondRefs.current[j];
      const mat = productBondMats.current[j];
      if (!g || !mat) return;
      const grow = reduced ? 1 : easeInOutCubic(Math.min(1, Math.max(0, (t - bond.arriveAt) / BOND_GROW_DUR)));
      g.visible = grow > 0.001;
      mat.opacity = 0.85 * grow + 0.15;
      if (g.visible) {
        const fa = atoms.find((x) => x.productId === bond.pa)!;
        const fb = atoms.find((x) => x.productId === bond.pb)!;
        updateBondTransform(g, atomState(fa, t).pos, atomState(fb, t).pos, grow);
      }
    });

    // 火花 / 拖尾生命周期
    sparksRef.current = sparksRef.current.filter((spark) => {
      const age = (now - spark.born) / 600;
      if (age >= 1) {
        sparkGroupRef.current?.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        (spark.mesh.material as THREE.Material).dispose();
        return false;
      }
      spark.mesh.position.addScaledVector(spark.vel, dt);
      (spark.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - age);
      return true;
    });
    ghostsRef.current = ghostsRef.current.filter((ghost) => {
      const age = (now - ghost.born) / 500;
      if (age >= 1) {
        ghostGroupRef.current?.remove(ghost.mesh);
        ghost.mesh.geometry.dispose();
        (ghost.mesh.material as THREE.Material).dispose();
        return false;
      }
      (ghost.mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - age);
      ghost.mesh.scale.setScalar(1 - age * 0.7);
      return true;
    });
  });

  return (
    <group ref={groupRef}>
      {animation?.version === 2 && <DeclarativeEffectDispatcher animation={animation} time={time ?? 0} />}
      {atoms.map((a) => (
        <mesh
          key={a.key}
          ref={(m) => {
            if (m) atomMeshes.current.set(a.key, m);
            else atomMeshes.current.delete(a.key);
          }}
          onClick={
            onAtomSelect && a.productId !== null
              ? (e: any) => {
                  e.stopPropagation();
                  onAtomSelect(selectedAtomId === a.productId ? null : a.productId);
                }
              : undefined
          }
        >
          <sphereGeometry args={[a.radius * 0.42, 24, 24]} />
          <meshStandardMaterial
            color={a.color}
            roughness={0.25}
            metalness={0.12}
            emissive={a.color}
            emissiveIntensity={0.12}
            transparent
            opacity={reduced ? 1 : 0}
          />
          {selectedAtomId !== null && selectedAtomId === a.productId && (
            <mesh scale={1.22}>
              <sphereGeometry args={[a.radius * 0.42, 18, 18]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={THREE.BackSide} />
            </mesh>
          )}
        </mesh>
      ))}
      {reactantBonds.map((_, j) => (
        <group
          key={`rb${j}`}
          ref={(g) => {
            reactantBondRefs.current[j] = g;
          }}
        >
          <mesh>
            <cylinderGeometry args={[0.075, 0.075, 1, 10]} />
            <meshStandardMaterial
              ref={(m) => {
                reactantBondMats.current[j] = m;
              }}
              color="#6f685d"
              roughness={0.45}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      ))}
      {productBonds.map((_, j) => (
        <group
          key={`pb${j}`}
          ref={(g) => {
            productBondRefs.current[j] = g;
          }}
        >
          <mesh>
            <cylinderGeometry args={[0.075, 0.075, 1, 10]} />
            <meshStandardMaterial
              ref={(m) => {
                productBondMats.current[j] = m;
              }}
              color="#9aa89b"
              roughness={0.4}
              metalness={0.1}
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      ))}
      <group ref={sparkGroupRef} />
      <group ref={ghostGroupRef} />
      {time === undefined && (
        <CameraRig startRef={startRef} reduced={reduced} onRelease={() => onControlsReady(true)} />
      )}
    </group>
  );
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function stageProgress(animation: ReactionAnimationScene, stageId: string, time: number): number {
  const stage = animation.stages.find((candidate) => candidate.id === stageId);
  if (!stage) return 0;
  return clamp01((time - stage.start) / Math.max(0.001, stage.end - stage.start));
}

function actorPoint(actor: ReactionAnimationActor, progress: number): [number, number, number] {
  const target = actor.target ?? actor.position;
  return [
    actor.position[0] + (target[0] - actor.position[0]) * progress,
    actor.position[1] + (target[1] - actor.position[1]) * progress,
    actor.position[2] + (target[2] - actor.position[2]) * progress,
  ];
}

const ActorLabel: React.FC<{
  actor: ReactionAnimationActor;
  position: [number, number, number];
  opacity?: number;
}> = ({ actor, position, opacity = 1 }) => {
  const { language } = useLanguage();
  return (
    <Html position={position} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
      <span
        className="whitespace-nowrap rounded-full border border-white/20 bg-[#101820]/85 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white shadow-lg backdrop-blur-sm"
        style={{ opacity }}
      >
        {actor.label[language]}
      </span>
    </Html>
  );
};

const IonNode: React.FC<{
  actor: ReactionAnimationActor;
  position: [number, number, number];
  opacity: number;
}> = ({ actor, position, opacity }) => {
  const radius = actor.radius ?? 0.32;
  const color = actor.color ?? ELEMENT_COLORS[actor.element ?? ''] ?? '#d8d2c5';
  const isHydroxide = actor.formula === 'OH';
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.1} transparent opacity={opacity} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      {isHydroxide && (
        <>
          <mesh position={[radius * 0.8, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, radius * 1.15, 10]} />
            <meshStandardMaterial color="#bfb7a7" transparent opacity={opacity * 0.9} />
          </mesh>
          <mesh position={[radius * 1.45, 0.08, 0]}>
            <sphereGeometry args={[radius * 0.55, 16, 16]} />
            <meshStandardMaterial color={ELEMENT_COLORS.H} roughness={0.3} transparent opacity={opacity} />
          </mesh>
        </>
      )}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 1.2, 0.018, 8, 28]} />
        <meshBasicMaterial color={actor.charge && actor.charge > 0 ? '#d8a8ff' : '#ff8f83'} transparent opacity={opacity * 0.75} />
      </mesh>
      <ActorLabel actor={actor} position={[0, radius + 0.23, 0]} opacity={opacity} />
    </group>
  );
};

const SodiumWaterSceneContent: React.FC<{
  animation: ReactionAnimationScene;
  time: number;
}> = ({ animation, time }) => {
  const actorById = useMemo(
    () => new Map(animation.actors.map((actor) => [actor.id, actor])),
    [animation.actors],
  );
  const snapshot = getAnimationSnapshot(animation, time);
  const water = actorById.get('water');
  const sodium = actorById.get('sodium-bead');
  const naOne = actorById.get('na-plus-1');
  const naTwo = actorById.get('na-plus-2');
  const ohOne = actorById.get('oh-minus-1');
  const ohTwo = actorById.get('oh-minus-2');
  const h2 = actorById.get('h2-gas');
  const indicator = actorById.get('phenolphthalein');
  const electronOne = actorById.get('electron-1');
  const electronTwo = actorById.get('electron-2');

  const meltP = stageProgress(animation, 'melt', time);
  const electronP = stageProgress(animation, 'electron', time);
  const ionP = stageProgress(animation, 'ions', time);
  const hydrogenP = stageProgress(animation, 'hydrogen', time);
  const ionsStart = animation.stages.find((stage) => stage.id === 'ions')?.start ?? 9.5;
  const electronStart = animation.stages.find((stage) => stage.id === 'electron')?.start ?? 6.1;
  const electronVisible = isStageActiveAt(animation, 'electron', time);
  const sodiumFade = 1 - clamp01((time - ionsStart) / 1.1);
  const hydrogenVisible = clamp01((time - (electronStart + 0.7)) / 1.2);
  const heatVisible = snapshot.stage.id === 'melt';
  const ionVisible = clamp01((time - (ionsStart - 0.55)) / 1.15);

  const sodiumPosition = sodium
    ? actorPoint(sodium, meltP)
    : [0, -0.55, 0.2] as [number, number, number];
  const ionPosition = (actor: ReactionAnimationActor | undefined) =>
    actor ? actorPoint(actor, ionP) : [0, -1, 0] as [number, number, number];
  const h2Position = h2
    ? actorPoint(h2, clamp01((time - electronStart) / Math.max(0.001, (animation.duration - electronStart))))
    : [0, 0, 0] as [number, number, number];

  const bubblePoints = useMemo(
    () => Array.from({ length: 13 }, (_, index) => ({
      x: -2.1 + ((index * 0.71) % 4.2),
      y: 0.18 + ((index * 0.19) % 0.5),
      z: 0.35 + ((index % 3) * 0.12),
      radius: 0.045 + (index % 4) * 0.014,
      phase: (index * 0.17) % 1,
    })),
    [],
  );

  return (
    <group>
      {/* 实验情境：水槽/水面始终存在，粒子解释层在其上展开。 */}
      <mesh position={[0, -1.08, 0]}>
        <boxGeometry args={[5.35, 1.25, 1.25]} />
        <meshStandardMaterial color={water?.color ?? '#2d9fc4'} transparent opacity={0.67} roughness={0.18} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.46, 0.02]}>
        <planeGeometry args={[5.25, 1.15]} />
        <meshStandardMaterial color="#6dd6e7" transparent opacity={0.18} emissive="#257d99" emissiveIntensity={0.2} />
      </mesh>
      <group>
        <mesh position={[-2.68, -1.08, 0]}><boxGeometry args={[0.06, 1.45, 1.35]} /><meshBasicMaterial color="#dce9e7" transparent opacity={0.46} /></mesh>
        <mesh position={[2.68, -1.08, 0]}><boxGeometry args={[0.06, 1.45, 1.35]} /><meshBasicMaterial color="#dce9e7" transparent opacity={0.46} /></mesh>
        <mesh position={[0, -1.72, 0]}><boxGeometry args={[5.4, 0.06, 1.35]} /><meshBasicMaterial color="#dce9e7" transparent opacity={0.46} /></mesh>
      </group>
      {water && <ActorLabel actor={water} position={[-2.0, -0.25, 0.6]} />}

      {/* 钠浮起、熔化、变小；结束后由 Na⁺ 取代而不是凭空消失。 */}
      {sodium && sodiumFade > 0.01 && (
        <group position={sodiumPosition} scale={[1.08 + meltP * 0.08, 1 - meltP * 0.22, 1.08 + meltP * 0.08]}>
          <mesh>
            <sphereGeometry args={[sodium.radius ?? 0.58, 28, 22]} />
            <meshStandardMaterial color={sodium.color ?? '#b47be8'} roughness={0.16} metalness={0.56} transparent opacity={sodiumFade} emissive="#8c4cc1" emissiveIntensity={0.22 + meltP * 0.26} />
          </mesh>
          <ActorLabel actor={sodium} position={[0, (sodium.radius ?? 0.58) + 0.25, 0]} opacity={sodiumFade} />
        </group>
      )}
      {heatVisible && (
        <group position={sodiumPosition}>
          <pointLight color="#ff9d3f" intensity={1.4} distance={3.2} />
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.82 + meltP * 0.14, 0.025, 8, 36]} />
            <meshBasicMaterial color="#ffae47" transparent opacity={0.68} />
          </mesh>
          <Html position={[0, 0.93, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
            <span className="rounded-full bg-[#f59e0b]/90 px-2 py-0.5 text-[10px] font-bold text-[#2b1a0a] shadow-lg">放热 · exothermic</span>
          </Html>
        </group>
      )}

      {/* 电子迁移路径：用显式 e⁻ 粒子表示，不把还原氢淡出。 */}
      {electronOne && electronTwo && electronVisible && (
        <>
          <Line points={[electronOne.position, [0, -0.15, 0.4], electronOne.target ?? electronOne.position]} color="#f4c95d" transparent opacity={0.55} lineWidth={1.6} dashed dashSize={0.08} gapSize={0.08} />
          <Line points={[electronTwo.position, [0.28, -0.12, 0.44], electronTwo.target ?? electronTwo.position]} color="#f4c95d" transparent opacity={0.55} lineWidth={1.6} dashed dashSize={0.08} gapSize={0.08} />
          {[electronOne, electronTwo].map((actor, index) => {
            const p = actorPoint(actor, electronP);
            p[0] += Math.sin(electronP * Math.PI + index) * 0.16;
            p[1] += Math.sin(electronP * Math.PI) * 0.13;
            return (
              <group key={actor.id} position={p}>
                <mesh>
                  <sphereGeometry args={[actor.radius ?? 0.11, 16, 16]} />
                  <meshBasicMaterial color={actor.color ?? '#f4c95d'} transparent opacity={0.98} />
                </mesh>
                <ActorLabel actor={actor} position={[0, 0.2, 0]} />
              </group>
            );
          })}
        </>
      )}

      {/* 溶液中的离子有各自的标签和环，不用 Na--O 球棍连接。 */}
      {naOne && <IonNode actor={naOne} position={ionPosition(naOne)} opacity={ionVisible} />}
      {naTwo && <IonNode actor={naTwo} position={ionPosition(naTwo)} opacity={ionVisible} />}
      {ohOne && <IonNode actor={ohOne} position={ionPosition(ohOne)} opacity={ionVisible} />}
      {ohTwo && <IonNode actor={ohTwo} position={ionPosition(ohTwo)} opacity={ionVisible} />}

      {/* H₂ 先由氢原子聚合，再作为气泡上升；最终状态仍保留完整分子。 */}
      {h2 && hydrogenVisible > 0 && (
        <group position={h2Position} scale={0.94 + hydrogenP * 0.08}>
          <mesh position={[-0.18, 0, 0]}>
            <sphereGeometry args={[h2.radius ?? 0.2, 20, 20]} />
            <meshStandardMaterial color={h2.color ?? '#f4f1ea'} roughness={0.24} transparent opacity={0.98} emissive="#ffffff" emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0.18, 0, 0]}>
            <sphereGeometry args={[h2.radius ?? 0.2, 20, 20]} />
            <meshStandardMaterial color={h2.color ?? '#f4f1ea'} roughness={0.24} transparent opacity={0.98} emissive="#ffffff" emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.36, 10]} />
            <meshStandardMaterial color="#c9c0b2" transparent opacity={0.92} />
          </mesh>
          <ActorLabel actor={h2} position={[0, 0.45, 0]} />
        </group>
      )}
      {bubblePoints.map((bubble) => {
        const cycle = (time * 0.28 + bubble.phase) % 1;
        const visible = time >= electronStart + 0.4;
        return (
          <mesh key={`${bubble.x}-${bubble.phase}`} position={[bubble.x, bubble.y + cycle * 1.65, bubble.z]} visible={visible}>
            <sphereGeometry args={[bubble.radius, 12, 12]} />
            <meshBasicMaterial color="#a5eff5" transparent opacity={visible ? 0.34 : 0} />
          </mesh>
        );
      })}

      {indicator && (
        <group position={indicator.position}>
          <mesh>
            <sphereGeometry args={[indicator.radius ?? 0.22, 18, 18]} />
            <meshStandardMaterial color={time >= ionsStart ? '#ff597b' : '#f1d5d8'} transparent opacity={0.95} emissive="#ff597b" emissiveIntensity={time >= ionsStart ? 0.25 : 0.03} />
          </mesh>
          <ActorLabel actor={indicator} position={[0, 0.4, 0]} />
        </group>
      )}

      {time >= animation.duration && (
        <Html position={[0, 2.45, 0.2]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-xl border border-[#8fe8dc]/35 bg-[#0d2526]/90 px-3 py-1.5 text-xs font-semibold text-[#d6fff4] shadow-xl">
            2Na⁺ + 2OH⁻ + H₂↑
          </div>
        </Html>
      )}
    </group>
  );
};

const SodiumWaterScene: React.FC<{
  animation: ReactionAnimationScene;
  time: number;
}> = ({ animation, time }) => (
  <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.1, 7.3], fov: 42 }} gl={{ antialias: true }}>
    <color attach="background" args={['#111b20']} />
    <ambientLight intensity={0.68} />
    <spotLight position={[5, 7, 7]} angle={0.34} penumbra={1} intensity={1.2} />
    <pointLight position={[-5, -3, 4]} color="#66c9df" intensity={0.55} />
    <SodiumWaterSceneContent animation={animation} time={time} />
    <OrbitControls enablePan={false} minDistance={5.4} maxDistance={9.5} />
    <Environment preset="city" />
  </Canvas>
);

const IllustrativeReactionSceneContent: React.FC<{
  animation: ReactionAnimationSceneV2;
  flow: NonNullable<import('../src/data/reactions/schema').CuratedReaction['reactionFlow']>;
  time: number;
}> = ({ animation, flow, time }) => {
  const { language } = useLanguage();
  const activeEvents = getActiveAnimationEvents(animation, time);
  const activeEvent = activeEvents[0] as ReactionAnimationEventV2 | undefined;
  const actorById = useMemo(
    () => new Map(animation.actors.map((actor) => [actor.id, actor])),
    [animation.actors],
  );
  const activeActorIds = useMemo(
    () => new Set(activeEvents.flatMap((event) => [
      ...(event.actorIds ?? []),
      event.fromActorId,
      event.toActorId,
    ].filter((actorId): actorId is string => typeof actorId === 'string'))),
    [activeEvents],
  );
  const productActorsActive = animation.actors.some(
    (actor) => actor.id.startsWith('product-atom-') && activeActorIds.has(actor.id),
  );
  const phenomena = activeEvent?.params.phenomena;
  const phenomenon = Array.isArray(phenomena) ? phenomena[0] : undefined;
  const pulse = activeEvent ? 1 + Math.sin((time - activeEvent.at) * 3.2) * 0.045 : 1;
  const productLabel = animation.productGraphs?.map((graph) => graph.label[language]).join(' + ')
    || (language === 'zh' ? '产物图待签核' : 'Product graph pending');

  return (
    <group>
      <DeclarativeEffectDispatcher animation={animation} time={time} />
      <group position={[-2.15, 0.25, 0]} scale={pulse}>
        {flow.reactants.slice(0, 4).map((reactant, index) => {
          const y = (index - (Math.min(flow.reactants.length, 4) - 1) / 2) * 0.72;
          const actor = actorById.get(`reactant-${index}`);
          const actorActive = actor ? activeActorIds.has(actor.id) : false;
          const position = actor?.position ?? [0, y, 0] as [number, number, number];
          return (
            <group key={`${reactant.label}-${index}`} position={actor ? [position[0] - (-2.15), position[1] - 0.25, position[2]] : [0, y, 0]} scale={actorActive ? 1.08 : 1}>
              <mesh>
                <sphereGeometry args={[0.28 + Math.min(0.18, reactant.structure.atoms.length * 0.018), 20, 20]} />
                <meshStandardMaterial color="#d7b56d" roughness={0.3} metalness={0.08} emissive="#8c6f38" emissiveIntensity={actorActive ? 0.42 : 0.18} />
              </mesh>
              <Html position={[0, 0.5, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
                <span className="whitespace-nowrap rounded-full border border-[#d7b56d]/35 bg-[#171f24]/90 px-2 py-0.5 text-[10px] font-semibold text-[#ffe0a5]">{reactant.label}</span>
              </Html>
            </group>
          );
        })}
      </group>
      <Line points={[[-1.15, 0, 0], [0, 0.25, 0.15], [1.05, 0, 0]]} color="#8fe8dc" transparent opacity={0.3 + Math.min(0.5, time / animation.duration)} lineWidth={2} dashed dashSize={0.18} gapSize={0.1} />
      <group
        position={[2.0, 0.05, 0]}
        scale={pulse * (productActorsActive ? 1.06 : 1)}
      >
        <mesh>
          <icosahedronGeometry args={[0.68, 2]} />
          <meshStandardMaterial color="#8fe8dc" roughness={0.26} metalness={0.12} emissive="#3c918a" emissiveIntensity={productActorsActive ? 0.36 : 0.18} transparent opacity={0.82} />
        </mesh>
        <Html position={[0, 1.0, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap rounded-full border border-[#8fe8dc]/35 bg-[#101820]/90 px-2.5 py-1 text-[11px] font-semibold text-[#d6fff4]">{productLabel}</span>
        </Html>
      </group>
      {activeEvent && (
        <Html position={[0, 2.05, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <div className="w-max min-w-[160px] max-w-[280px] rounded-xl border border-white/15 bg-[#0d151b]/90 px-3 py-2 text-center text-[11px] text-white/80 shadow-xl">
            <div className="whitespace-nowrap font-semibold text-[#ffe0a5]">{activeEvent.label[language]}</div>
            {typeof phenomenon === 'string' && <div className="mt-0.5 whitespace-nowrap text-white/55">{phenomenon}</div>}
          </div>
        </Html>
      )}
    </group>
  );
};

const IllustrativeReactionScene: React.FC<{
  animation: ReactionAnimationSceneV2;
  flow: NonNullable<import('../src/data/reactions/schema').CuratedReaction['reactionFlow']>;
  time: number;
}> = ({ animation, flow, time }) => (
  <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.15, 7.4], fov: 42 }} gl={{ antialias: true }}>
    <color attach="background" args={['#111b20']} />
    <ambientLight intensity={0.65} />
    <spotLight position={[5, 7, 7]} angle={0.34} penumbra={1} intensity={1.1} />
    <IllustrativeReactionSceneContent animation={animation} flow={flow} time={time} />
    <OrbitControls enablePan={false} minDistance={5.8} maxDistance={9.5} />
    <Environment preset="city" />
  </Canvas>
);

export interface ReactionFlowSceneProps {
  structure: MoleculeStructure;
  flow: NonNullable<import('../src/data/reactions/schema').CuratedReaction['reactionFlow']>;
  playKey?: number;
  /** 由外部播放器控制的时间（秒）；未传入时兼容旧版 Canvas 自己播放。 */
  time?: number;
  animation?: ReactionAnimationScene;
  selectedAtomId?: number | null;
  onAtomSelect?: (id: number | null) => void;
}

export const ReactionFlowScene: React.FC<ReactionFlowSceneProps> = ({
  structure,
  flow,
  playKey = 0,
  time,
  animation,
  selectedAtomId = null,
  onAtomSelect,
}) => {
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    [],
  );
  const [controlsEnabled, setControlsEnabled] = useState(reduced || time !== undefined);

  if (animation?.version === 1 && animation.environment === 'water-beaker') {
    return <SodiumWaterScene animation={animation} time={time ?? 0} />;
  }

  if (animation?.version === 2 && !canRenderAtomConservation(animation)) {
    return <IllustrativeReactionScene animation={animation} flow={flow} time={time ?? 0} />;
  }

  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [2.8, 0.7, 4.6], fov: 42 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.55} />
      <spotLight position={[8, 9, 8]} angle={0.3} penumbra={1} intensity={1.1} />
      <pointLight position={[-7, -6, -6]} intensity={0.45} />
      <SceneContent
        structure={structure}
        flow={flow}
        playKey={playKey}
        time={time}
        animation={animation}
        reduced={reduced}
        selectedAtomId={selectedAtomId}
        onAtomSelect={onAtomSelect}
        onControlsReady={setControlsEnabled}
      />
      {controlsEnabled && <OrbitControls makeDefault />}
      <Environment preset="city" />
    </Canvas>
  );
};

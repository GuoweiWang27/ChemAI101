import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeStructure, ELEMENT_COLORS, ELEMENT_RADII } from '../types';

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

const SceneContent: React.FC<SceneContentProps> = ({
  structure,
  flow,
  playKey,
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
    if (!reduced) onControlsReady(false);
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
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const t = clock.elapsedTime - startRef.current;
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
      <CameraRig startRef={startRef} reduced={reduced} onRelease={() => onControlsReady(true)} />
    </group>
  );
};

export interface ReactionFlowSceneProps {
  structure: MoleculeStructure;
  flow: NonNullable<import('../src/data/reactions/schema').CuratedReaction['reactionFlow']>;
  playKey: number;
  selectedAtomId?: number | null;
  onAtomSelect?: (id: number | null) => void;
}

export const ReactionFlowScene: React.FC<ReactionFlowSceneProps> = ({
  structure,
  flow,
  playKey,
  selectedAtomId = null,
  onAtomSelect,
}) => {
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    [],
  );
  const [controlsEnabled, setControlsEnabled] = useState(reduced);

  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [2.8, 0.7, 4.6], fov: 42 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.55} />
      <spotLight position={[8, 9, 8]} angle={0.3} penumbra={1} intensity={1.1} />
      <pointLight position={[-7, -6, -6]} intensity={0.45} />
      <SceneContent
        structure={structure}
        flow={flow}
        playKey={playKey}
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

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeStructure, ELEMENT_COLORS, ELEMENT_RADII } from '../types';

/**
 * 全程反应动画：反应物分子飞入 → 激发抖动 → 映射原子逐颗发射飞向产物位 →
 * 产物键双端到达后生长 → 脉冲定格。未映射的反应物原子按副产物淡出。
 * 时间轴为纯函数（t → 状态），playKey 自增即重播。
 */

// 时间轴常量（秒）
const ENTER_DUR = 1.2;
const EXCITE_START = 1.4;
const EXCITE_END = 2.2;
const LAUNCH_START = 2.4;
const LAUNCH_STAGGER = 0.12;
const LAUNCH_DUR = 1.1;
const UNMAP_FADE_START = 3.0;
const UNMAP_FADE_DUR = 1.2;
const BOND_GROW_DUR = 0.35;
const PULSE_START = 7.2;
const PULSE_END = 7.8;

const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

interface FlowAtom {
  key: string;
  productId: number | null; // null = 副产物（未映射）
  element: string;
  color: string;
  radius: number;
  reactantIdx: number;
  from: THREE.Vector3; // 反应物内最终停靠点（世界坐标）
  to: THREE.Vector3; // 产物目标位
  launchStart: number;
}

interface FlowBond {
  ri: number;
  aKey: string;
  bKey: string;
  baseLen: number;
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

const SceneContent: React.FC<SceneProps> = ({
  structure,
  flow,
  playKey,
  reduced,
  selectedAtomId,
  onAtomSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const atomMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const reactantBondRefs = useRef<Array<THREE.Group | null>>([]);
  const reactantBondMats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const productBondRefs = useRef<Array<THREE.Group | null>>([]);
  const productBondMats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const sparksRef = useRef<Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; born: number }>>([]);
  const startRef = useRef<number | null>(null);
  const arrivedRef = useRef<Set<string>>(new Set());
  const tmp = useRef(new THREE.Vector3());

  // 展平所有原子（映射产物原子 + 未映射副产物）
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
          to: new THREE.Vector3(),
          launchStart: Number.POSITIVE_INFINITY,
        };
        if (mapping) launchOrder.push(fa);
        result.push(fa);
      });
    });
    // 发射顺序稳定：先按发射批次排序再赋时刻
    launchOrder.sort(
      (a, b) =>
        a.from.x - b.from.x ||
        seededRand(a.from.y * 100) - seededRand(b.from.y * 100),
    );
    launchOrder.forEach((fa, idx) => {
      fa.launchStart = LAUNCH_START + idx * LAUNCH_STAGGER;
      const pa = structure.atoms.find((p) => p.id === fa.productId)!;
      fa.to.set(pa.x / 2, pa.y / 2, pa.z / 2);
    });
    return result;
  }, [structure, flow]);

  const atomByKey = useMemo(() => new Map(atoms.map((a) => [a.key, a])), [atoms]);

  const reactantBonds = useMemo<FlowBond[]>(
    () =>
      flow.reactants.flatMap((reactant, ri) =>
        reactant.structure.bonds.map((b) => ({
          ri,
          aKey: `${ri}:${b.source}`,
          bKey: `${ri}:${b.target}`,
          baseLen: 0, // 运行时算，几何用单位长度
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
      const baseLen = Math.max(0.0001, Math.hypot(sa.x - sb.x, sa.y - sb.y, sa.z - sb.z));
      return {
        pa: b.source,
        pb: b.target,
        baseLen,
        arriveAt: Math.max(fa.launchStart + LAUNCH_DUR, fb.launchStart + LAUNCH_DUR),
      };
    });
  }, [structure, atoms]);

  /** 原子在 t 时刻的世界坐标与不透明度 */
  const atomState = (a: FlowAtom, t: number): { pos: THREE.Vector3; opacity: number } => {
    const enterP = easeInOutCubic(Math.min(1, t / ENTER_DUR));
    const enterOffset = tmp.current.set(-6 * (1 - enterP), 0, 0);
    const base = tmp.current.copy(a.from).add(enterOffset);

    if (!Number.isFinite(a.launchStart)) {
      // 副产物：激发后淡出
      const fade =
        t <= UNMAP_FADE_START ? 0 : Math.min(1, (t - UNMAP_FADE_START) / UNMAP_FADE_DUR);
      let op = enterP;
      if (t > EXCITE_START && t < EXCITE_END) {
        base.x += Math.sin(t * 42 + a.reactantIdx * 3) * 0.05;
      }
      op *= 1 - fade;
      return { pos: base.clone(), opacity: op };
    }

    if (t < a.launchStart) {
      let op = enterP;
      if (t > EXCITE_START && t < EXCITE_END) {
        base.x += Math.sin(t * 42 + a.reactantIdx * 3) * 0.05;
      }
      return { pos: base.clone(), opacity: op };
    }

    const p = easeInOutCubic(Math.min(1, (t - a.launchStart) / LAUNCH_DUR));
    const pos = base.copy(a.from).lerp(a.to, p);
    return { pos: pos.clone(), opacity: 1 };
  };

  // 重播重置
  useEffect(() => {
    startRef.current = null;
    arrivedRef.current = new Set();
    sparksRef.current.forEach((s) => {
      sparkGroupRef.current?.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    });
    sparksRef.current = [];
  }, [playKey]);

  const spawnSpark = (at: THREE.Vector3, now: number, count = 4) => {
    if (!sparkGroupRef.current) return;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.95 }),
      );
      mesh.position.copy(at);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      sparksRef.current.push({ mesh, vel: dir.multiplyScalar(1.8), born: now });
      sparkGroupRef.current.add(mesh);
    }
  };

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const t = clock.elapsedTime - startRef.current;
    const now = performance.now();

    atoms.forEach((a) => {
      const mesh = atomMeshes.current.get(a.key);
      if (!mesh) return;
      const { pos, opacity } = atomState(a, t);
      mesh.position.copy(pos);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity = reduced ? 1 : opacity;
      // 到达火花 + 定格脉冲
      if (
        !reduced &&
        a.productId !== null &&
        Number.isFinite(a.launchStart) &&
        t >= a.launchStart + LAUNCH_DUR &&
        !arrivedRef.current.has(a.key)
      ) {
        arrivedRef.current.add(a.key);
        spawnSpark(a.to, now);
      }
      if (a.productId !== null && t >= PULSE_START && t <= PULSE_END && !reduced) {
        const k = Math.sin(((t - PULSE_START) / (PULSE_END - PULSE_START)) * Math.PI);
        material.emissiveIntensity = 0.12 + k * 0.7;
      } else {
        material.emissiveIntensity = 0.12;
      }
    });

    // 反应物键：端点离开即淡出；激发期琥珀色
    reactantBonds.forEach((bond, j) => {
      const g = reactantBondRefs.current[j];
      const mat = reactantBondMats.current[j];
      if (!g || !mat) return;
      const A = atomByKey.get(bond.aKey)!;
      const B = atomByKey.get(bond.bKey)!;
      const departed =
        (Number.isFinite(A.launchStart) && t >= A.launchStart) ||
        (Number.isFinite(B.launchStart) && t >= B.launchStart) ||
        (A.productId === null && t >= UNMAP_FADE_START) ||
        (B.productId === null && t >= UNMAP_FADE_START);
      const fadeTarget = departed ? 0 : 1;
      mat.opacity += (fadeTarget * 0.85 - mat.opacity) * Math.min(1, dt * 10);
      const excited = t > EXCITE_START && t < EXCITE_END;
      mat.color.copy(excited ? STRESS : BASE_BOND);
      g.visible = mat.opacity > 0.02;
      if (g.visible) {
        updateBondTransform(g, atomByKey.get(bond.aKey)!, atomByKey.get(bond.bKey)!, t, 1);
      }
    });

    // 产物键：双端到达后生长
    productBonds.forEach((bond, j) => {
      const g = productBondRefs.current[j];
      const mat = productBondMats.current[j];
      if (!g || !mat) return;
      const grow = reduced
        ? 1
        : easeInOutCubic(Math.min(1, Math.max(0, (t - bond.arriveAt) / BOND_GROW_DUR)));
      g.visible = grow > 0.001;
      mat.opacity = 0.85 * grow + 0.15;
      if (g.visible) {
        const A = atomByKey.get(atoms.find((x) => x.productId === bond.pa)!.key)!;
        const B = atomByKey.get(atoms.find((x) => x.productId === bond.pb)!.key)!;
        updateBondTransform(g, A, B, t, grow);
      }
    });

    // 火花生命周期
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
  });

  const updateBondTransform = (
    g: THREE.Group,
    A: FlowAtom,
    B: FlowAtom,
    t: number,
    growScale: number,
  ) => {
    const sa = atomState(A, t).pos;
    const sb = atomState(B, t).pos;
    const dir = sb.clone().sub(sa);
    const len = Math.max(0.0001, dir.length() * growScale);
    g.position.copy(sa).addScaledVector(dir, 0.5 * growScale);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.scale.set(1, len, 1);
  };

  const highlightSet = useMemo(() => {
    // 全程动画里不做步骤高亮，保持纯净叙事
    return new Set<string>();
  }, []);

  void highlightSet;

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
    </group>
  );
};

const BASE_BOND = new THREE.Color('#6f685d');
const STRESS = new THREE.Color('#f59e0b');

export interface ReactionFlowSceneProps {
  structure: MoleculeStructure;
  flow: NonNullable<import('../src/data/reactions/schema').CuratedReaction['reactionFlow']>;
  /** 自增触发重播 */
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

  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 8], fov: 42 }} gl={{ antialias: true }}>
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
      />
      <OrbitControls makeDefault />
      <Environment preset="city" />
    </Canvas>
  );
};

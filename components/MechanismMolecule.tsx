import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeStructure, ELEMENT_COLORS, ELEMENT_RADII } from '../types';

/**
 * 机理编舞场景：切换机制步骤时，该步涉及的原子以弹簧物理位移/回弹，
 * 化学键实时跟随伸缩并在受力时向琥珀色渐变（过渡态暗示），切换瞬间迸火花。
 * 数据零依赖——只消费现有 productStructure + stepAtomIds。
 */

const STIFFNESS = 42;
const DAMPING = 9.5;
const SETTLE_MS = 850;
const SETTLE_FACTOR = 0.35;
const STRESS_THRESHOLD = 0.12;
const STRESS_COLOR = new THREE.Color('#f59e0b');
const BOND_BASE_COLOR = new THREE.Color('#9aa89b');

interface SpringState {
  cur: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
}

/** 以 (stepIndex, atomId) 为种子的确定性伪随机，保证同一步的编舞稳定可复现 */
function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function computeDisplacement(
  base: THREE.Vector3,
  centroid: THREE.Vector3,
  stepIndex: number,
  atomId: number,
): THREE.Vector3 {
  const outward = base.clone().sub(centroid);
  if (outward.lengthSq() < 1e-6) outward.set(0, 1, 0);
  outward.normalize();
  const jitter = new THREE.Vector3(
    seededRand(stepIndex * 31 + atomId * 13) - 0.5,
    seededRand(stepIndex * 17 + atomId * 29) - 0.5,
    seededRand(stepIndex * 43 + atomId * 7) - 0.5,
  ).multiplyScalar(0.9);
  return outward.add(jitter).normalize().multiplyScalar(0.55 + seededRand(stepIndex * 11 + atomId) * 0.4);
}

interface AtomNode {
  id: number;
  element: string;
  color: string;
  radius: number;
  base: THREE.Vector3;
}

interface BondNode {
  source: number;
  target: number;
  baseLen: number;
  baseMid: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  born: number;
}

const SceneContent: React.FC<{
  structure: MoleculeStructure;
  stepAtomIds?: number[][];
  stepIndex: number;
  reduced: boolean;
  selectedAtomId: number | null;
  onAtomSelect?: (id: number | null) => void;
}> = ({ structure, stepAtomIds, stepIndex, reduced, selectedAtomId, onAtomSelect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const atomMeshes = useRef<Array<THREE.Mesh | null>>([]);
  const bondRefs = useRef<Array<THREE.Group | null>>([]);
  const bondMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const sparksRef = useRef<Spark[]>([]);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atoms = useMemo<AtomNode[]>(
    () =>
      structure.atoms.map((a) => ({
        id: a.id,
        element: a.element,
        color: a.color || ELEMENT_COLORS[a.element] || '#cccccc',
        radius: ELEMENT_RADII[a.element] || ELEMENT_RADII.default,
        base: new THREE.Vector3(a.x / 2, a.y / 2, a.z / 2),
      })),
    [structure],
  );

  const centroid = useMemo(() => {
    const c = new THREE.Vector3();
    atoms.forEach((a) => c.add(a.base));
    return c.divideScalar(Math.max(1, atoms.length));
  }, [atoms]);

  const bonds = useMemo<BondNode[]>(() => {
    const byId = new Map(atoms.map((a) => [a.id, a]));
    return structure.bonds.flatMap((b) => {
      const s = byId.get(b.source);
      const e = byId.get(b.target);
      if (!s || !e) return [];
      return [
        {
          source: b.source,
          target: b.target,
          baseLen: s.base.distanceTo(e.base),
          baseMid: s.base.clone().add(e.base).multiplyScalar(0.5),
          quaternion: new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            e.base.clone().sub(s.base).normalize(),
          ),
        },
      ];
    });
  }, [atoms, structure]);

  const springs = useRef(new Map<number, SpringState>());
  if (springs.current.size === 0) {
    for (const a of atoms) {
      springs.current.set(a.id, {
        cur: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        target: new THREE.Vector3(),
      });
    }
  }

  const activeGroupKey = `${stepIndex}:${JSON.stringify(stepAtomIds?.[stepIndex] ?? [])}`;

  // 步骤切换 → 设定位移目标 + 迸火花
  useEffect(() => {
    if (reduced) return;
    const group = stepAtomIds?.[stepIndex] ?? [];
    const groupSet = new Set(group);

    if (settleTimer.current) clearTimeout(settleTimer.current);
    // 所有原子先归位目标
    for (const a of atoms) {
      const sp = springs.current.get(a.id)!;
      sp.target.set(0, 0, 0);
    }
    if (groupSet.size === 0) return;

    const sparkBase = new THREE.Vector3();
    for (const id of group) {
      const atom = atoms.find((x) => x.id === id);
      const sp = springs.current.get(id);
      if (!atom || !sp) continue;
      const disp = computeDisplacement(atom.base, centroid, stepIndex, id);
      sp.target.copy(disp);
      sparkBase.add(atom.base);
    }
    sparkBase.divideScalar(Math.max(1, group.length));

    // 定格：850ms 后目标衰减到 35%，保持「激活态」
    settleTimer.current = setTimeout(() => {
      for (const id of group) {
        const sp = springs.current.get(id);
        if (sp) sp.target.multiplyScalar(SETTLE_FACTOR);
      }
    }, SETTLE_MS);

    // 火花
    if (sparkGroupRef.current) {
      const now = performance.now();
      for (let i = 0; i < 10; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.95 }),
        );
        mesh.position.copy(sparkBase);
        const dir = new THREE.Vector3(
          seededRand(stepIndex * 91 + i) - 0.5,
          seededRand(stepIndex * 57 + i * 3) - 0.5,
          seededRand(stepIndex * 23 + i * 7) - 0.5,
        ).normalize();
        sparksRef.current.push({ mesh, vel: dir.multiplyScalar(2.2 + Math.random() * 1.2), born: now });
        sparkGroupRef.current.add(mesh);
      }
    }
  }, [activeGroupKey, reduced, atoms, centroid, stepAtomIds, stepIndex]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());

  useFrame(({ clock }, dt) => {
    const d = Math.min(dt, 0.05);
    // 弹簧积分
    if (!reduced) {
      for (const a of atoms) {
        const sp = springs.current.get(a.id)!;
        tmpA.current.copy(sp.target).sub(sp.cur).multiplyScalar(STIFFNESS * d);
        sp.vel.add(tmpA.current);
        sp.vel.multiplyScalar(1 / (1 + DAMPING * d));
        sp.cur.add(sp.vel.clone().multiplyScalar(d));
      }
      // 原子落位
      atoms.forEach((a, i) => {
        const mesh = atomMeshes.current[i];
        if (!mesh) return;
        const sp = springs.current.get(a.id)!;
        mesh.position.copy(a.base).add(sp.cur);
      });
      // 键实时跟随 + 应力变色
      bonds.forEach((bond, j) => {
        const g = bondRefs.current[j];
        const mat = bondMaterials.current[j];
        if (!g || !mat) return;
        const s = springs.current.get(bond.source)!;
        const e = springs.current.get(bond.target)!;
        const sa = atoms.find((x) => x.id === bond.source)!;
        const ea = atoms.find((x) => x.id === bond.target)!;
        tmpA.current.copy(sa.base).add(s.cur);
        tmpB.current.copy(ea.base).add(e.cur);
        const dir = tmpB.current.clone().sub(tmpA.current);
        const len = Math.max(0.0001, dir.length());
        g.position.copy(tmpA.current).addScaledVector(dir, 0.5);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        g.scale.set(1, len / bond.baseLen, 1);
        const strain = Math.max(0, (len - bond.baseLen) / bond.baseLen);
        const k = Math.min(1, strain / 0.5);
        mat.color.copy(BOND_BASE_COLOR).lerp(STRESS_COLOR, k);
      });
    }
    // 火花生命周期
    const now = performance.now();
    sparksRef.current = sparksRef.current.filter((spark) => {
      const age = (now - spark.born) / 600;
      if (age >= 1) {
        sparkGroupRef.current?.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        (spark.mesh.material as THREE.Material).dispose();
        return false;
      }
      spark.mesh.position.addScaledVector(spark.vel, d);
      (spark.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - age);
      spark.mesh.scale.setScalar(1 - age * 0.6);
      return true;
    });
  });

  const highlightSet = useMemo(
    () => new Set(stepAtomIds?.[stepIndex] ?? []),
    [stepAtomIds, stepIndex],
  );

  return (
    <group ref={groupRef}>
      {atoms.map((a, i) => {
        const highlighted = highlightSet.has(a.id);
        const selected = selectedAtomId === a.id;
        return (
          <mesh
            key={a.id}
            ref={(m) => {
              atomMeshes.current[i] = m;
            }}
            scale={highlighted ? 1.3 : selected ? 1.22 : 1}
            onPointerOver={
              onAtomSelect
                ? (e: any) => {
                    e.stopPropagation();
                  }
                : undefined
            }
            onClick={
              onAtomSelect
                ? (e: any) => {
                    e.stopPropagation();
                    onAtomSelect(selectedAtomId === a.id ? null : a.id);
                  }
                : undefined
            }
          >
            <sphereGeometry args={[a.radius * 0.42, 28, 28]} />
            <meshStandardMaterial
              color={a.color}
              roughness={0.25}
              metalness={0.12}
              emissive={highlighted ? '#FFC53D' : '#000000'}
              emissiveIntensity={highlighted ? 0.8 : 0}
            />
            {selected && (
              <mesh scale={1.22}>
                <sphereGeometry args={[a.radius * 0.42, 20, 20]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={THREE.BackSide} />
              </mesh>
            )}
          </mesh>
        );
      })}
      {bonds.map((bond, j) => (
        <group
          key={`b${j}`}
          ref={(g) => {
            bondRefs.current[j] = g;
          }}
        >
          <mesh>
            <cylinderGeometry args={[0.075, 0.075, bond.baseLen, 10]} />
            <meshStandardMaterial
              ref={(m) => {
                bondMaterials.current[j] = m;
              }}
              color="#9aa89b"
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
        </group>
      ))}
      <group ref={sparkGroupRef} />
    </group>
  );
};

export interface MechanismMoleculeProps {
  structure: MoleculeStructure;
  stepAtomIds?: number[][];
  stepIndex: number;
  selectedAtomId?: number | null;
  onAtomSelect?: (id: number | null) => void;
}

export const MechanismMolecule: React.FC<MechanismMoleculeProps> = ({
  structure,
  stepAtomIds,
  stepIndex,
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
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7.5], fov: 42 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.55} />
      <spotLight position={[8, 9, 8]} angle={0.3} penumbra={1} intensity={1.1} />
      <pointLight position={[-7, -6, -6]} intensity={0.45} />
      <SceneContent
        structure={structure}
        stepAtomIds={stepAtomIds}
        stepIndex={stepIndex}
        reduced={reduced}
        selectedAtomId={selectedAtomId}
        onAtomSelect={onAtomSelect}
      />
      <OrbitControls makeDefault />
      <Environment preset="city" />
    </Canvas>
  );
};

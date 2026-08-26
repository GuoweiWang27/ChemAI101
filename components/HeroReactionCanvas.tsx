import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { ALL_REACTIONS } from '../src/data/reactions';
import { ELEMENT_COLORS, ELEMENT_RADII, MoleculeStructure } from '../types';

/** 开盘动画：原子漂移→成键→汇聚成乙酸乙酯→脉冲→消散，循环讲述「化学反应之美」。 */

// 循环时间轴（秒）
const PERIOD = 12;
const SCATTER_DUR = 2.2;
const BOND_START = 1.9;
const BOND_DUR = 1.3;
const PULSE_START = 3.2;
const PULSE_END = 4.0;
const HOLD_END = 9.2;
const DISSOLVE_DUR = 1.4;

interface AtomAnim {
  id: number;
  element: string;
  color: string;
  radius: number;
  target: THREE.Vector3;
  start: THREE.Vector3;
  exit: THREE.Vector3;
  delay: number;
}

const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function pickTargetStructure(): MoleculeStructure | null {
  // 乙酸乙酯：链状舒展、含羰基双键，构图最上镜；缺失时退化为第一条有结构的反应
  const preferred =
    ALL_REACTIONS.find((r) => r.id === 'esterification') ??
    ALL_REACTIONS.find((r) => r.productStructure);
  return preferred?.productStructure ?? null;
}

function randomSpherePoint(min: number, max: number): THREE.Vector3 {
  const dir = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
  ).normalize();
  return dir.multiplyScalar(min + Math.random() * (max - min));
}

const SceneContent: React.FC<{ structure: MoleculeStructure; reduced: boolean }> = ({
  structure,
  reduced,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const atomRefs = useRef<Array<THREE.Mesh | null>>([]);
  const bondRefs = useRef<Array<THREE.Group | null>>([]);

  const atoms = useMemo<AtomAnim[]>(() => {
    const center = new THREE.Vector3();
    structure.atoms.forEach((a) => center.add(new THREE.Vector3(a.x / 2, a.y / 2, a.z / 2)));
    center.divideScalar(structure.atoms.length);
    return structure.atoms.map((atom) => ({
      id: atom.id,
      element: atom.element,
      color: atom.color || ELEMENT_COLORS[atom.element] || '#cccccc',
      radius: ELEMENT_RADII[atom.element] || ELEMENT_RADII.default,
      target: new THREE.Vector3(atom.x / 2, atom.y / 2, atom.z / 2),
      start: randomSpherePoint(4.5, 7.5).add(center.clone()),
      exit: randomSpherePoint(5, 8).add(center.clone()),
      delay: Math.random() * 0.7,
    }));
  }, [structure]);

  const bonds = useMemo(() => {
    const byId = new Map(structure.atoms.map((a) => [a.id, a]));
    return structure.bonds.flatMap((bond, idx) => {
      const s = byId.get(bond.source);
      const e = byId.get(bond.target);
      if (!s || !e) return [];
      const start = new THREE.Vector3(s.x / 2, s.y / 2, s.z / 2);
      const end = new THREE.Vector3(e.x / 2, e.y / 2, e.z / 2);
      const direction = new THREE.Vector3().subVectors(end, start);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      );
      return [{ idx, start, length: direction.length(), quaternion, order: bond.order }];
    });
  }, [structure]);

  const tmp = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const dt = clock.getDelta();
    if (reduced) {
      // 静帧：直接呈现组装完成态
      groupRef.current.rotation.y = -0.45;
      return;
    }
    groupRef.current.rotation.y += dt * 0.14;
    const t = clock.getElapsedTime() % PERIOD;
    const dissolving = t > HOLD_END;
    const dissolveT = dissolving ? Math.min(1, (t - HOLD_END) / DISSOLVE_DUR) : 0;

    // 原子：漂入→就位→消散
    atoms.forEach((atom, i) => {
      const mesh = atomRefs.current[i];
      if (!mesh) return;
      const p = easeInOutCubic(Math.min(1, Math.max(0, (t - atom.delay) / SCATTER_DUR)));
      if (dissolving) {
        tmp.current.lerpVectors(atom.target, atom.exit, easeInOutCubic(dissolveT));
      } else {
        tmp.current.lerpVectors(atom.start, atom.target, p);
      }
      mesh.position.copy(tmp.current);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity = dissolving ? 1 - dissolveT : Math.min(1, p * 2.5);
      // 组装完成的呼吸脉冲
      const isAssembled = !dissolving && t > PULSE_START;
      if (isAssembled && t < PULSE_END) {
        const k = Math.sin(((t - PULSE_START) / (PULSE_END - PULSE_START)) * Math.PI);
        material.emissiveIntensity = 0.12 + k * 0.4;
        mesh.scale.setScalar(1 + k * 0.05);
      } else {
        material.emissiveIntensity = 0.12;
        mesh.scale.setScalar(1);
      }
    });

    // 化学键：依次生长/收回
    bonds.forEach((bond, j) => {
      const group = bondRefs.current[j];
      if (!group) return;
      let grow = Math.min(
        1,
        Math.max(0, (t - BOND_START - j * 0.055) / BOND_DUR),
      );
      if (dissolving) grow = 1 - dissolveT;
      const eased = easeInOutCubic(grow);
      const halfLen = (bond.length * eased) / 2;
      // 沿键轴从起点向两端生长：位置 = start + axis * (len*eased)/2
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(bond.quaternion);
      group.position.copy(bond.start).addScaledVector(axis, halfLen);
      group.quaternion.copy(bond.quaternion);
      group.scale.set(1, Math.max(0.0001, eased), 1);
      group.visible = eased > 0.001;
    });
  });

  return (
    <Float speed={1} rotationIntensity={0.25} floatIntensity={0.4}>
      <group ref={groupRef}>
        {atoms.map((atom, i) => (
          <mesh
            key={atom.id}
            ref={(m) => {
              atomRefs.current[i] = m;
            }}
          >
            <sphereGeometry args={[atom.radius * 0.42, 28, 28]} />
            <meshStandardMaterial
              color={atom.color}
              roughness={0.25}
              metalness={0.15}
              emissive={atom.color}
              emissiveIntensity={0.12}
              transparent
              opacity={0}
            />
          </mesh>
        ))}
        {bonds.map((bond, j) => (
          <group
            key={`b${j}`}
            visible={false}
            ref={(g) => {
              bondRefs.current[j] = g;
            }}
          >
            <mesh>
              <cylinderGeometry args={[0.075, 0.075, bond.length, 10]} />
              <meshStandardMaterial color="#6f685d" roughness={0.45} metalness={0.08} transparent opacity={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </Float>
  );
};

/** 尘埃微粒：营造实验室暗场空气感 */
const DustField: React.FC = () => {
  const positions = useMemo(() => {
    const arr = new Float32Array(42 * 3);
    for (let i = 0; i < 42; i++) {
      const v = randomSpherePoint(3.5, 8);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#b99455" transparent opacity={0.38} sizeAttenuation />
    </points>
  );
};

export const HeroReactionCanvas: React.FC = () => {
  const structure = useMemo(pickTargetStructure, []);
  const [running, setRunning] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  );

  useEffect(() => {
    const onVis = () => setRunning(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    [],
  );

  if (!structure) return null;

  return (
    <Canvas
      frameloop={running && !reduced ? 'always' : 'demand'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 9], fov: 42 }}
      gl={{ antialias: true }}
    >
      <fog attach="fog" args={['#f6f1e7', 9, 17]} />
      <ambientLight intensity={0.9} />
      <spotLight position={[8, 9, 8]} angle={0.3} penumbra={1} intensity={1.25} />
      <pointLight position={[-7, -6, -6]} intensity={0.4} color="#d9b36a" />
      <SceneContent structure={structure} reduced={reduced} />
      <DustField />
      <Environment preset="city" />
    </Canvas>
  );
};

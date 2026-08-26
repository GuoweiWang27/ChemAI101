import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeStructure, ELEMENT_RADII, ELEMENT_COLORS, ELEMENT_NAMES } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

// Augment JSX.IntrinsicElements to include Three.js elements to fix type errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      sphereGeometry: any;
      meshStandardMaterial: any;
      cylinderGeometry: any;
      group: any;
      ambientLight: any;
      spotLight: any;
      pointLight: any;
    }
  }
}

/** 悬停标签的屏幕坐标（相对容器） */
export interface HoverLabel {
  atomId: number;
  x: number;
  y: number;
}

interface Molecule3DViewerProps {
  structure: MoleculeStructure;
  /** 需要高亮的原子 id 列表（演示模式 / 步骤联动，琥珀发光） */
  highlightAtomIds?: number[];
  /** 点选态原子（白色描边），与高亮三态分离 */
  selectedAtomId?: number | null;
  /** 提供才启用点选交互；null 表示取消选择 */
  onAtomSelect?: (atomId: number | null) => void;
}

const AtomMesh: React.FC<{
  position: [number, number, number];
  color: string;
  element: string;
  atomId: number;
  highlighted?: boolean;
  selected?: boolean;
  hovered?: boolean;
  interactive: boolean;
  onHover: (atomId: number | null, ev?: React.PointerEvent) => void;
  onSelect: (atomId: number) => void;
}> = ({ position, color, element, atomId, highlighted, selected, hovered, interactive, onHover, onSelect }) => {
  const radius = ELEMENT_RADII[element] || ELEMENT_RADII.default;
  const scale = highlighted ? 1.35 : selected ? 1.25 : hovered ? 1.15 : 1;
  return (
    <mesh
      position={position}
      scale={scale}
      onPointerOver={interactive ? (e: any) => { e.stopPropagation(); onHover(atomId, e.nativeEvent); } : undefined}
      onPointerOut={interactive ? (e: any) => { e.stopPropagation(); onHover(null); } : undefined}
      onClick={interactive ? (e: any) => { e.stopPropagation(); onSelect(atomId); } : undefined}
    >
      <sphereGeometry args={[radius * 0.4, 32, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={0.2}
        metalness={0.1}
        emissive={highlighted ? '#FFC53D' : '#000000'}
        emissiveIntensity={highlighted ? 0.85 : 0}
      />
      {/* 选中描边：略大的反面壳 */}
      {selected && (
        <mesh scale={1.22}>
          <sphereGeometry args={[radius * 0.4, 24, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={THREE.BackSide} />
        </mesh>
      )}
    </mesh>
  );
};

const BondMesh: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  order: number;
}> = ({ start, end, order }) => {
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const length = direction.length();

  // Calculate orientation
  const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

  // Render multiple cylinders for double/triple bonds
  const bondRadius = 0.08;
  const separation = 0.15;

  const bonds = [];
  if (order === 1) {
    bonds.push(<mesh key="single" position={midPoint.toArray()} quaternion={quaternion}>
      <cylinderGeometry args={[bondRadius, bondRadius, length, 12]} />
      <meshStandardMaterial color="#cccccc" />
    </mesh>);
  } else if (order === 2) {
    bonds.push(
      <mesh key="d1" position={midPoint.clone().add(new THREE.Vector3(separation, 0, 0).applyQuaternion(quaternion)).toArray()} quaternion={quaternion}>
        <cylinderGeometry args={[bondRadius, bondRadius, length, 12]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    );
    bonds.push(
      <mesh key="d2" position={midPoint.clone().add(new THREE.Vector3(-separation, 0, 0).applyQuaternion(quaternion)).toArray()} quaternion={quaternion}>
        <cylinderGeometry args={[bondRadius, bondRadius, length, 12]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    );
  } else {
    // Triple (simplified center + 2 sides)
    bonds.push(<mesh key="t1" position={midPoint.toArray()} quaternion={quaternion}>
      <cylinderGeometry args={[bondRadius, bondRadius, length, 12]} />
      <meshStandardMaterial color="#cccccc" />
    </mesh>);
    bonds.push(
      <mesh key="t2" position={midPoint.clone().add(new THREE.Vector3(separation, 0, 0).applyQuaternion(quaternion)).toArray()} quaternion={quaternion}>
        <cylinderGeometry args={[bondRadius, bondRadius, length, 12]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    );
     bonds.push(
      <mesh key="t3" position={midPoint.clone().add(new THREE.Vector3(-separation, 0, 0).applyQuaternion(quaternion)).toArray()} quaternion={quaternion}>
        <cylinderGeometry args={[bondRadius, bondRadius, length, 12]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    );
  }

  return <>{bonds}</>;
};

/** 挂在 Canvas 内：resetSignal 自增时把相机恢复到初始位 */
const ControlsResetter: React.FC<{ resetSignal: number }> = ({ resetSignal }) => {
  const controls = useThree((s: any) => s.controls) as { reset?: () => void } | null;
  useEffect(() => {
    if (resetSignal > 0) controls?.reset?.();
  }, [resetSignal, controls]);
  return null;
};

const SceneContent: React.FC<{
  structure: MoleculeStructure;
  highlightSet: Set<number>;
  selectedAtomId: number | null;
  hoveredId: number | null;
  interactive: boolean;
  pausedRef: React.MutableRefObject<boolean>;
  onHover: (atomId: number | null, ev?: React.PointerEvent) => void;
  onSelect: (atomId: number) => void;
}> = ({ structure, highlightSet, selectedAtomId, hoveredId, interactive, pausedRef, onHover, onSelect }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && !pausedRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <group ref={groupRef}>
        {structure.atoms.map((atom) => (
          <AtomMesh
            key={atom.id}
            atomId={atom.id}
            position={[atom.x, atom.y, atom.z]}
            element={atom.element}
            color={atom.color || ELEMENT_COLORS[atom.element] || '#cccccc'}
            highlighted={highlightSet.has(atom.id)}
            selected={selectedAtomId === atom.id}
            hovered={hoveredId === atom.id}
            interactive={interactive}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
        {structure.bonds.map((bond, idx) => {
          const source = structure.atoms.find(a => a.id === bond.source);
          const target = structure.atoms.find(a => a.id === bond.target);
          if (!source || !target) return null;
          return (
            <BondMesh
              key={idx}
              start={[source.x, source.y, source.z]}
              end={[target.x, target.y, target.z]}
              order={bond.order}
            />
          );
        })}
      </group>
    </Float>
  );
};

export const Molecule3DViewer: React.FC<Molecule3DViewerProps> = ({
  structure,
  highlightAtomIds,
  selectedAtomId = null,
  onAtomSelect,
}) => {
  const { t, language } = useLanguage();
  const highlightSet = useMemo(() => new Set(highlightAtomIds ?? []), [highlightAtomIds]);
  const interactive = Boolean(onAtomSelect);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverLabel, setHoverLabel] = useState<HoverLabel | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const pausedRef = useRef(false);
  pausedRef.current = hoverLabel !== null || selectedAtomId !== null;

  const handleHover = useCallback(
    (atomId: number | null, ev?: React.PointerEvent) => {
      if (atomId === null || !ev || !containerRef.current) {
        setHoverLabel(null);
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      setHoverLabel({ atomId, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    },
    [],
  );

  const handleSelect = useCallback(
    (atomId: number) => {
      onAtomSelect?.(selectedAtomId === atomId ? null : atomId);
    },
    [onAtomSelect, selectedAtomId],
  );

  const hoveredAtom = hoverLabel
    ? structure.atoms.find((a) => a.id === hoverLabel.atomId)
    : undefined;
  const hoveredName = hoveredAtom
    ? ELEMENT_NAMES[hoveredAtom.element] ?? ELEMENT_NAMES.default
    : null;

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] bg-[#1a1a1a] rounded-lg overflow-hidden relative shadow-inner">
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
        {t('interactive3D')}
      </div>
      {interactive && (
        <button
          onClick={() => setResetSignal((n) => n + 1)}
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white text-xs px-2.5 py-1 rounded backdrop-blur-sm transition-colors"
        >
          {t('resetViewBtn')}
        </button>
      )}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        onPointerMissed={() => onAtomSelect?.(null)}
      >
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <SceneContent
          structure={structure}
          highlightSet={highlightSet}
          selectedAtomId={selectedAtomId}
          hoveredId={hoverLabel?.atomId ?? null}
          interactive={interactive}
          pausedRef={pausedRef}
          onHover={handleHover}
          onSelect={handleSelect}
        />
        <OrbitControls makeDefault />
        <ControlsResetter resetSignal={resetSignal} />
        <Environment preset="city" />
      </Canvas>
      {hoverLabel && hoveredName && (
        <div
          className="pointer-events-none absolute z-20 bg-black/75 text-white text-xs px-2 py-1 rounded backdrop-blur-sm whitespace-nowrap"
          style={{ left: hoverLabel.x + 12, top: hoverLabel.y - 28 }}
        >
          <span className="font-semibold">{language === 'en' ? hoveredName.en : hoveredName.zh}</span>
          <span className="ml-1 text-white/60">{hoveredAtom!.element}</span>
        </div>
      )}
    </div>
  );
};


import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeStructure, ELEMENT_RADII, ELEMENT_COLORS } from '../types';
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

interface Molecule3DViewerProps {
  structure: MoleculeStructure;
}

const AtomMesh: React.FC<{
  position: [number, number, number];
  color: string;
  element: string;
}> = ({ position, color, element }) => {
  const radius = ELEMENT_RADII[element] || ELEMENT_RADII.default;
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius * 0.4, 32, 32]} />
      <meshStandardMaterial color={color} roughness={0.2} metalness={0.1} />
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

const SceneContent: React.FC<{ structure: MoleculeStructure }> = ({ structure }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <group ref={groupRef}>
        {structure.atoms.map((atom) => (
          <AtomMesh
            key={atom.id}
            position={[atom.x, atom.y, atom.z]}
            element={atom.element}
            color={atom.color || ELEMENT_COLORS[atom.element] || '#cccccc'}
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

export const Molecule3DViewer: React.FC<Molecule3DViewerProps> = ({ structure }) => {
  const { t } = useLanguage();
  return (
    <div className="w-full h-full min-h-[400px] bg-slate-900 rounded-lg overflow-hidden relative shadow-inner">
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
        {t('interactive3D')}
      </div>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <SceneContent structure={structure} />
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

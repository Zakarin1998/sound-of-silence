import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type NoiseMeshProps = {
  active: boolean;
};

const NODE_COUNT = 72;
const CONNECTION_DISTANCE = 2.35;

export function NoiseMesh({ active }: NoiseMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.InstancedMesh>(null);

  const { nodeMatrices, linesGeometry } = useMemo(() => {
    const positions: THREE.Vector3[] = Array.from({ length: NODE_COUNT }, () => {
      return new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 4,
      );
    });

    const matrix = new THREE.Matrix4();
    const matrices = positions.map((position, index) => {
      const pulse = 0.055 + (index % 5) * 0.01;
      return matrix.clone().compose(
        position,
        new THREE.Quaternion(),
        new THREE.Vector3(pulse, pulse, pulse),
      );
    });

    const linePositions: number[] = [];
    positions.forEach((start, i) => {
      positions.slice(i + 1).forEach((end) => {
        if (start.distanceTo(end) < CONNECTION_DISTANCE) {
          linePositions.push(...start.toArray(), ...end.toArray());
        }
      });
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    return { nodeMatrices: matrices, linesGeometry: geometry };
  }, []);

  useEffect(() => {
    if (!nodesRef.current) {
      return;
    }

    nodeMatrices.forEach((nodeMatrix, index) => {
      nodesRef.current?.setMatrixAt(index, nodeMatrix);
    });
    nodesRef.current.instanceMatrix.needsUpdate = true;
  }, [nodeMatrices]);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    const speed = active ? 0.15 : 0.012;
    groupRef.current.rotation.y += delta * speed;
    groupRef.current.rotation.x += delta * speed * 0.45;

    if (nodesRef.current) {
      const breath = active ? Math.sin(state.clock.elapsedTime * 1.6) * 0.08 + 1 : 0.72;
      nodesRef.current.scale.setScalar(breath);
    }
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial color="#a0aec0" transparent opacity={active ? 0.34 : 0.055} />
      </lineSegments>
      <instancedMesh ref={nodesRef} args={[undefined, undefined, NODE_COUNT]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#d9e2ef" transparent opacity={active ? 0.72 : 0.18} />
      </instancedMesh>
    </group>
  );
}

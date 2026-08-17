import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type NoiseMeshProps = {
  active: boolean;
};

const NODE_COUNT = 132;
const DUST_COUNT = 520;
const CONNECTION_DISTANCE = 2.15;
const RING_POINTS = 82;

function organicRingPoint(index: number) {
  const angle = (index / RING_POINTS) * Math.PI * 2;
  const ripple = Math.sin(angle * 3.1) * 0.45 + Math.cos(angle * 7.3) * 0.22;
  const radius = 2.55 + ripple;

  return new THREE.Vector3(
    Math.cos(angle) * radius * 1.48 + Math.sin(angle * 2.4) * 0.28,
    Math.sin(angle) * radius * 0.78 + Math.cos(angle * 5.1) * 0.2,
    Math.sin(angle * 4.6) * 0.46,
  );
}

export function NoiseMesh({ active }: NoiseMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const dustRef = useRef<THREE.Points>(null);
  const filamentsRef = useRef<THREE.LineSegments>(null);
  const auroraRef = useRef<THREE.Mesh>(null);

  const { nodeMatrices, linesGeometry, dustGeometry, ribbonGeometry } = useMemo(() => {
    const ring = Array.from({ length: RING_POINTS }, (_, index) => organicRingPoint(index));
    const positions: THREE.Vector3[] = Array.from({ length: NODE_COUNT }, (_, index) => {
      const anchor = ring[index % ring.length];
      const scatter = index < RING_POINTS ? 0.22 : 0.72;

      return anchor.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * scatter,
        (Math.random() - 0.5) * scatter,
        (Math.random() - 0.5) * scatter * 1.4,
      ));
    });

    const matrix = new THREE.Matrix4();
    const matrices = positions.map((position, index) => {
      const pulse = 0.035 + (index % 7) * 0.006;
      return matrix.clone().compose(position, new THREE.Quaternion(), new THREE.Vector3(pulse, pulse, pulse));
    });

    const linePositions: number[] = [];
    positions.forEach((start, i) => {
      positions.slice(i + 1).forEach((end) => {
        if (start.distanceTo(end) < CONNECTION_DISTANCE) {
          linePositions.push(...start.toArray(), ...end.toArray());
        }
      });
    });

    ring.forEach((start, index) => {
      const next = ring[(index + 1) % ring.length];
      const skip = ring[(index + 5) % ring.length];
      linePositions.push(...start.toArray(), ...next.toArray(), ...start.toArray(), ...skip.toArray());
    });

    const filamentGeometry = new THREE.BufferGeometry();
    filamentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    const dustPositions = Array.from({ length: DUST_COUNT * 3 }, (_, index) => {
      const axis = index % 3;
      const spread = axis === 0 ? 9.8 : axis === 1 ? 5.8 : 3.8;
      return (Math.random() - 0.5) * spread;
    });
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));

    const ribbonShape = new THREE.Shape(ring.map((point) => new THREE.Vector2(point.x, point.y)));
    const glowGeometry = new THREE.ShapeGeometry(ribbonShape, 48);

    return {
      nodeMatrices: matrices,
      linesGeometry: filamentGeometry,
      dustGeometry: starGeometry,
      ribbonGeometry: glowGeometry,
    };
  }, []);

  useEffect(() => {
    if (!nodesRef.current) return;

    nodeMatrices.forEach((nodeMatrix, index) => {
      nodesRef.current?.setMatrixAt(index, nodeMatrix);
    });
    nodesRef.current.instanceMatrix.needsUpdate = true;
  }, [nodeMatrices]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const speed = active ? 0.12 : 0.01;
    const elapsed = state.clock.elapsedTime;
    groupRef.current.rotation.y += delta * speed;
    groupRef.current.rotation.x = Math.sin(elapsed * 0.11) * 0.11;

    if (nodesRef.current) {
      const breath = active ? Math.sin(elapsed * 1.55) * 0.065 + 1 : 0.72;
      nodesRef.current.scale.setScalar(breath);
    }

    if (dustRef.current) {
      dustRef.current.rotation.z -= delta * (active ? 0.018 : 0.004);
    }

    if (filamentsRef.current) {
      filamentsRef.current.scale.setScalar(active ? 1 + Math.sin(elapsed * 0.7) * 0.018 : 0.92);
    }

    if (auroraRef.current) {
      auroraRef.current.rotation.z = Math.sin(elapsed * 0.18) * 0.035;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={auroraRef} geometry={ribbonGeometry} position={[0, 0, -0.28]}>
        <meshBasicMaterial color="#8fb8d8" transparent opacity={active ? 0.055 : 0.015} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments ref={filamentsRef} geometry={linesGeometry}>
        <lineBasicMaterial color="#d5e4f3" transparent opacity={active ? 0.42 : 0.06} />
      </lineSegments>
      <instancedMesh ref={nodesRef} args={[undefined, undefined, NODE_COUNT]}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshBasicMaterial color="#f4f9ff" transparent opacity={active ? 0.86 : 0.18} />
      </instancedMesh>
      <points ref={dustRef} geometry={dustGeometry} position={[0, 0, -1.1]}>
        <pointsMaterial color="#cfe8ff" size={0.012} transparent opacity={active ? 0.36 : 0.08} depthWrite={false} />
      </points>
    </group>
  );
}

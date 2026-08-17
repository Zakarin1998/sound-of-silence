import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type NoiseMeshProps = {
  active: boolean;
};

type NetworkGeometry = {
  geometry: THREE.BufferGeometry;
  count: number;
};

const OUTER_COUNT = 96;
const INNER_COUNT = 24;
const OUTER_X = 4.55;
const OUTER_Y = 2.72;

const seedRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pushSegment = (target: number[], a: THREE.Vector3, b: THREE.Vector3) => {
  target.push(a.x, a.y, a.z, b.x, b.y, b.z);
};

const makeGeometry = (segments: number[]): NetworkGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  return { geometry, count: segments.length / 6 };
};

export function NoiseMesh({ active }: NoiseMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.Points>(null);

  const { points, primary, secondary, ghost } = useMemo(() => {
    const random = seedRandom(1337);
    const outer: THREE.Vector3[] = [];
    const inner: THREE.Vector3[] = [];

    for (let index = 0; index < OUTER_COUNT; index += 1) {
      const t = (index / OUTER_COUNT) * Math.PI * 2;
      const organic =
        1 +
        Math.sin(t * 3 + 0.8) * 0.055 +
        Math.sin(t * 7 - 0.35) * 0.035 +
        (random() - 0.5) * 0.09;
      const upperWave = 1 + Math.sin(t * 2 - 0.9) * 0.055;
      const x = Math.cos(t) * OUTER_X * organic;
      const y = Math.sin(t) * OUTER_Y * organic * upperWave;
      const z = Math.sin(t * 4.2) * 0.32 + (random() - 0.5) * 0.28;

      outer.push(new THREE.Vector3(x, y, z));
    }

    for (let index = 0; index < INNER_COUNT; index += 1) {
      const t = (index / INNER_COUNT) * Math.PI * 2 + 0.18;
      const radius = 0.58 + random() * 0.25;
      const x = Math.cos(t) * OUTER_X * radius;
      const y = Math.sin(t) * OUTER_Y * radius * (0.9 + random() * 0.1);
      const z = Math.sin(t * 3.1 + 0.4) * 0.46 + (random() - 0.5) * 0.18;

      inner.push(new THREE.Vector3(x, y, z));
    }

    const all = [...outer, ...inner];
    const primarySegments: number[] = [];
    const secondarySegments: number[] = [];
    const ghostSegments: number[] = [];

    // The outer rim establishes the recognizable silhouette first.
    for (let index = 0; index < OUTER_COUNT; index += 1) {
      pushSegment(primarySegments, outer[index], outer[(index + 1) % OUTER_COUNT]);
    }

    // Local cross-links create irregular triangular cells without filling the center.
    for (let index = 0; index < OUTER_COUNT; index += 1) {
      const source = outer[index];
      for (let offset = 2; offset <= 7; offset += 1) {
        const targetIndex = (index + offset) % OUTER_COUNT;
        const target = outer[targetIndex];
        const distance = source.distanceTo(target);
        if (distance < 2.15 && random() < 0.44) {
          pushSegment(secondarySegments, source, target);
        }
      }
    }

    // Inner nodes stitch the rim together while preserving a quiet hollow center.
    inner.forEach((node, index) => {
      const nearestOuter = [...outer]
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex, distance: node.distanceTo(candidate) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      nearestOuter.forEach(({ candidate }) => {
        pushSegment(primarySegments, node, candidate);
      });

      const next = inner[(index + 1) % INNER_COUNT];
      pushSegment(secondarySegments, node, next);

      if (random() > 0.28) {
        pushSegment(secondarySegments, node, inner[(index + 4) % INNER_COUNT]);
      }
    });

    // Sparse long chords provide the fine, almost accidental wireframe texture.
    for (let index = 0; index < 28; index += 1) {
      const a = outer[Math.floor(random() * OUTER_COUNT)];
      const b = outer[Math.floor(random() * OUTER_COUNT)];
      if (a !== b && a.distanceTo(b) > 3.2) {
        pushSegment(ghostSegments, a, b);
      }
    }

    return {
      points: all,
      primary: makeGeometry(primarySegments),
      secondary: makeGeometry(secondarySegments),
      ghost: makeGeometry(ghostSegments),
    };
  }, []);

  const pointPositions = useMemo(() => {
    const values = new Float32Array(points.length * 3);
    points.forEach((point, index) => point.toArray(values, index * 3));
    return values;
  }, [points]);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    const targetRotationY = state.pointer.x * 0.035;
    const targetRotationX = -state.pointer.y * 0.018;
    const speed = active ? 1 : 0.55;

    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      targetRotationY,
      2.4 * speed,
      delta,
    );
    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      targetRotationX,
      2.4 * speed,
      delta,
    );

    const drift = active ? Math.sin(state.clock.elapsedTime * 0.72) * 0.018 : 0;
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, drift, 1.2, delta);

    if (nodesRef.current) {
      const pulse = active ? 1 + Math.sin(state.clock.elapsedTime * 1.15) * 0.06 : 0.72;
      nodesRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={ghost.geometry}>
        <lineBasicMaterial color="#71808c" transparent opacity={active ? 0.045 : 0.008} />
      </lineSegments>

      <lineSegments geometry={secondary.geometry}>
        <lineBasicMaterial color="#9eabb5" transparent opacity={active ? 0.12 : 0.018} />
      </lineSegments>

      <lineSegments geometry={primary.geometry}>
        <lineBasicMaterial color="#d7dee3" transparent opacity={active ? 0.30 : 0.045} />
      </lineSegments>

      <lineSegments geometry={primary.geometry} scale={[1.003, 1.003, 1.003]}>
        <lineBasicMaterial color="#c8d1d7" transparent opacity={active ? 0.055 : 0.008} />
      </lineSegments>

      <points ref={nodesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={pointPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#e4e9ec"
          size={0.035}
          sizeAttenuation
          transparent
          opacity={active ? 0.36 : 0.05}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

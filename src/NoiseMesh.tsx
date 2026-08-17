import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type NoiseMeshProps = {
  active: boolean;
};

type NetworkGeometry = {
  geometry: THREE.BufferGeometry;
};

const OUTER_COUNT = 88;
const SHELL_COUNT = 58;
const OUTER_X = 3.72;
const OUTER_Y = 2.22;
const SHELL_MIN_RADIUS = 0.62;
const SHELL_MAX_RADIUS = 0.84;

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

const organicRadius = (t: number) =>
  1 +
  Math.sin(t * 3 + 0.8) * 0.16 +
  Math.sin(t * 5 - 1.3) * 0.11 +
  Math.sin(t * 9 + 0.4) * 0.07 +
  Math.sin(t * 13 - 0.7) * 0.035;

const pushSegment = (target: number[], a: THREE.Vector3, b: THREE.Vector3) => {
  target.push(a.x, a.y, a.z, b.x, b.y, b.z);
};

const makeGeometry = (segments: number[]): NetworkGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  return { geometry };
};

export function NoiseMesh({ active }: NoiseMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.Points>(null);

  const { points, primary, secondary, ghost } = useMemo(() => {
    const random = seedRandom(9173);
    const outer: THREE.Vector3[] = [];
    const shell: THREE.Vector3[] = [];

    // The silhouette is deliberately asymmetric and lumpy rather than elliptical.
    // A small angular jitter prevents the perimeter from reading as a regular polygon.
    for (let index = 0; index < OUTER_COUNT; index += 1) {
      const baseT = (index / OUTER_COUNT) * Math.PI * 2;
      const t = baseT + (random() - 0.5) * 0.035;
      const radius = organicRadius(t) * (0.96 + random() * 0.08);
      const x = Math.cos(t) * OUTER_X * radius;
      const y = Math.sin(t) * OUTER_Y * radius;
      const z = Math.sin(t * 5.1 + 0.7) * 0.26 + (random() - 0.5) * 0.34;

      outer.push(new THREE.Vector3(x, y, z));
    }

    // A second, irregular shell supplies the local triangulation visible in the reference.
    // It never reaches the center, so the composition retains a large quiet negative space.
    for (let index = 0; index < SHELL_COUNT; index += 1) {
      const baseT = (index / SHELL_COUNT) * Math.PI * 2 + 0.07;
      const t = baseT + (random() - 0.5) * 0.08;
      const radius = SHELL_MIN_RADIUS + random() * (SHELL_MAX_RADIUS - SHELL_MIN_RADIUS);
      const contour = 0.94 + organicRadius(t) * 0.08;
      const x = Math.cos(t) * OUTER_X * radius * contour;
      const y = Math.sin(t) * OUTER_Y * radius * contour;
      const z = Math.sin(t * 4.4 - 0.3) * 0.34 + (random() - 0.5) * 0.26;

      shell.push(new THREE.Vector3(x, y, z));
    }

    const all = [...outer, ...shell];
    const primarySegments: number[] = [];
    const secondarySegments: number[] = [];
    const ghostSegments: number[] = [];

    // Keep the silhouette readable, but introduce a handful of hairline breaks so it
    // feels assembled from signal traces rather than drawn as a closed geometric loop.
    for (let index = 0; index < OUTER_COUNT; index += 1) {
      const nextIndex = (index + 1) % OUTER_COUNT;
      const breakChance = random();
      if (breakChance > 0.13) {
        pushSegment(primarySegments, outer[index], outer[nextIndex]);
      } else {
        pushSegment(ghostSegments, outer[index], outer[nextIndex]);
      }
    }

    // Local perimeter chords create the dense, irregular triangular texture.
    for (let index = 0; index < OUTER_COUNT; index += 1) {
      const source = outer[index];
      const maxOffset = 8;
      for (let offset = 2; offset <= maxOffset; offset += 1) {
        const target = outer[(index + offset) % OUTER_COUNT];
        if (source.distanceTo(target) < 1.72 && random() < 0.38) {
          pushSegment(secondarySegments, source, target);
        }
      }
    }

    // Connect each shell node to only nearby perimeter nodes. This creates short spokes
    // and triangles while avoiding the large straight lines that previously crossed the void.
    shell.forEach((node, index) => {
      const angularIndex = (index / SHELL_COUNT) * OUTER_COUNT;
      const candidates = [
        Math.floor(angularIndex - 2),
        Math.floor(angularIndex),
        Math.floor(angularIndex + 2),
        Math.floor(angularIndex + 4),
      ].map((candidateIndex) => (candidateIndex + OUTER_COUNT) % OUTER_COUNT);

      const uniqueCandidates = [...new Set(candidates)]
        .map((candidateIndex) => ({
          candidate: outer[candidateIndex],
          distance: node.distanceTo(outer[candidateIndex]),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, random() > 0.35 ? 3 : 2);

      uniqueCandidates.forEach(({ candidate }) => {
        pushSegment(primarySegments, node, candidate);
      });

      const next = shell[(index + 1) % SHELL_COUNT];
      if (random() > 0.16) {
        pushSegment(secondarySegments, node, next);
      }

      if (random() > 0.62) {
        pushSegment(secondarySegments, node, shell[(index + 3) % SHELL_COUNT]);
      }
    });

    // A small number of oblique, short-range chords add the accidental wireframe quality
    // of the reference without filling its negative space.
    for (let index = 0; index < 46; index += 1) {
      const aIndex = Math.floor(random() * all.length);
      const bIndex = (aIndex + 4 + Math.floor(random() * 13)) % all.length;
      const a = all[aIndex];
      const b = all[bIndex];
      if (a.distanceTo(b) > 0.9 && a.distanceTo(b) < 2.7) {
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

  const pointGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const values = new Float32Array(points.length * 3);
    points.forEach((point, index) => point.toArray(values, index * 3));
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    return geometry;
  }, [points]);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    const targetRotationY = state.pointer.x * 0.028;
    const targetRotationX = -state.pointer.y * 0.014;
    const speed = active ? 1 : 0.5;

    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      targetRotationY,
      2.2 * speed,
      delta,
    );
    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      targetRotationX,
      2.2 * speed,
      delta,
    );

    const drift = active ? Math.sin(state.clock.elapsedTime * 0.58) * 0.014 : 0;
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, drift, 1.1, delta);

    if (nodesRef.current) {
      const pulse = active ? 1 + Math.sin(state.clock.elapsedTime * 1.05) * 0.045 : 0.72;
      nodesRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={ghost.geometry}>
        <lineBasicMaterial color="#6f7d88" transparent opacity={active ? 0.035 : 0.006} />
      </lineSegments>

      <lineSegments geometry={secondary.geometry}>
        <lineBasicMaterial color="#9daab4" transparent opacity={active ? 0.095 : 0.014} />
      </lineSegments>

      <lineSegments geometry={primary.geometry}>
        <lineBasicMaterial color="#d0d8de" transparent opacity={active ? 0.22 : 0.032} />
      </lineSegments>

      <lineSegments geometry={primary.geometry} scale={[1.002, 1.002, 1.002]}>
        <lineBasicMaterial color="#c3cdd4" transparent opacity={active ? 0.035 : 0.005} />
      </lineSegments>

      <points ref={nodesRef} geometry={pointGeometry}>
        <pointsMaterial
          color="#dce4e8"
          size={0.026}
          sizeAttenuation
          transparent
          opacity={active ? 0.24 : 0.035}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ─── FIRE PARTICLE SYSTEM ──────────────────────────────────────────────────
function FireParticles({ position = [0, 0, 0], count = 60, spread = 0.3, speed = 1.5, color1 = '#FF4500', color2 = '#FFD700' }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => Array.from({ length: count }, () => ({
    offset: Math.random() * Math.PI * 2,
    speed: 0.8 + Math.random() * speed,
    sx: (Math.random() - 0.5) * spread,
    sz: (Math.random() - 0.5) * spread,
    life: Math.random(),
    size: 0.05 + Math.random() * 0.12,
  })), [count, spread, speed]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    particles.forEach((p, i) => {
      const life = ((t * p.speed * 0.6 + p.offset) % 1);
      const y = life * 1.8;
      const fade = 1 - life;
      dummy.position.set(
        position[0] + p.sx * (1 + life * 0.5),
        position[1] + y,
        position[2] + p.sz * (1 + life * 0.5)
      );
      const s = p.size * fade * 1.5;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color={color1} emissive={color2} emissiveIntensity={3} transparent opacity={0.85} />
    </instancedMesh>
  );
}

// ─── SMOKE PARTICLES ───────────────────────────────────────────────────────
function SmokeParticles({ position = [0, 0, 0], count = 20 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    offset: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.4,
    sx: (Math.random() - 0.5) * 0.5,
    sz: (Math.random() - 0.5) * 0.5,
  })), [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    particles.forEach((p, i) => {
      const life = ((t * p.speed * 0.4 + p.offset) % 1);
      dummy.position.set(position[0] + p.sx * life * 2, position[1] + 1.8 + life * 2, position[2] + p.sz * life * 2);
      const s = 0.1 + life * 0.5;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#888" transparent opacity={0.15} />
    </instancedMesh>
  );
}

// ─── DRAGON WING ──────────────────────────────────────────────────────────
function DragonWing({ side = 1 }) {
  const wing = useRef();
  useFrame(({ clock }) => {
    if (!wing.current) return;
    const t = clock.elapsedTime;
    wing.current.rotation.z = side * (0.3 + Math.sin(t * 3) * 0.5);
    wing.current.rotation.x = Math.sin(t * 3 + 0.5) * 0.15;
  });
  return (
    <group ref={wing} position={[side * 0.6, 0.3, 0]}>
      {/* Main wing membrane */}
      <mesh rotation={[0.1, side * -0.3, 0]}>
        <boxGeometry args={[1.8, 0.04, 1.1]} />
        <meshStandardMaterial color="#3a0a0a" side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      {/* Wing bone 1 */}
      <mesh position={[side * 0.5, 0, 0]} rotation={[0, 0, side * 0.3]}>
        <cylinderGeometry args={[0.03, 0.02, 1.4, 6]} />
        <meshStandardMaterial color="#1a0505" />
      </mesh>
      {/* Wing bone 2 */}
      <mesh position={[side * 0.3, 0.1, 0.4]} rotation={[0.3, 0, side * 0.2]}>
        <cylinderGeometry args={[0.02, 0.015, 1.0, 6]} />
        <meshStandardMaterial color="#1a0505" />
      </mesh>
      {/* Wing tip claw */}
      <mesh position={[side * 0.9, -0.1, 0]}>
        <coneGeometry args={[0.04, 0.25, 4]} />
        <meshStandardMaterial color="#0d0303" />
      </mesh>
    </group>
  );
}

// ─── FLYING DRAGON SCENE ──────────────────────────────────────────────────
function FlyingDragon() {
  const dragonRef = useRef();
  const neckRef = useRef();
  const headRef = useRef();
  const tailRef = useRef();
  const jawRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (dragonRef.current) {
      // Fly up and down
      dragonRef.current.position.y = Math.sin(t * 1.2) * 0.6;
      dragonRef.current.position.x = Math.sin(t * 0.5) * 0.3;
      dragonRef.current.rotation.z = Math.sin(t * 1.2) * 0.08;
    }
    if (neckRef.current) {
      neckRef.current.rotation.x = Math.sin(t * 0.8) * 0.15;
    }
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(t * 0.9 + 0.5) * 0.2;
    }
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(t * 2) * 0.3;
      tailRef.current.rotation.x = Math.cos(t * 1.5) * 0.15;
    }
    if (jawRef.current) {
      // Jaw opens and closes for breathing fire
      jawRef.current.rotation.x = Math.max(0, Math.sin(t * 2) * 0.4);
    }
  });

  // Fire breath position tracks head
  const firePos = [2.8, 0.1, 0];

  return (
    <group>
      {/* Atmospheric lighting */}
      <pointLight position={[3, 1, 0]} intensity={4} color="#FF4500" distance={6} decay={2} />
      <pointLight position={[-3, 2, 0]} intensity={1.5} color="#4466ff" distance={10} />

      <group ref={dragonRef}>
        {/* ── BODY ── */}
        <mesh position={[0, 0, 0]}>
          <capsuleGeometry args={[0.55, 1.8, 8, 16]} />
          <meshStandardMaterial color="#1a3a0f" roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Belly scales */}
        <mesh position={[0, -0.4, 0.5]}>
          <capsuleGeometry args={[0.38, 1.4, 6, 12]} />
          <meshStandardMaterial color="#2d5a1f" roughness={0.8} />
        </mesh>
        {/* Body spines */}
        {[0, 0.4, 0.8, 1.2].map((y, i) => (
          <mesh key={i} position={[0, y - 0.3, -0.5]} rotation={[0.3, 0, 0]}>
            <coneGeometry args={[0.05, 0.35, 4]} />
            <meshStandardMaterial color="#0d1f08" />
          </mesh>
        ))}

        {/* ── WINGS ── */}
        <DragonWing side={1} />
        <DragonWing side={-1} />

        {/* ── NECK ── */}
        <group ref={neckRef} position={[0.9, 0.4, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.28, 0.8, 6, 12]} />
            <meshStandardMaterial color="#1a3a0f" roughness={0.6} />
          </mesh>

          {/* ── HEAD ── */}
          <group ref={headRef} position={[0.8, 0.1, 0]}>
            <mesh>
              <boxGeometry args={[0.7, 0.4, 0.45]} />
              <meshStandardMaterial color="#1a3a0f" roughness={0.5} metalness={0.15} />
            </mesh>
            {/* Snout */}
            <mesh position={[0.45, -0.05, 0]}>
              <boxGeometry args={[0.5, 0.28, 0.35]} />
              <meshStandardMaterial color="#1a3a0f" roughness={0.5} />
            </mesh>
            {/* Jaw (animated open/close) */}
            <group ref={jawRef} position={[0.2, -0.18, 0]}>
              <mesh position={[0.2, 0, 0]}>
                <boxGeometry args={[0.5, 0.12, 0.3]} />
                <meshStandardMaterial color="#112a0a" roughness={0.6} />
              </mesh>
              {/* Teeth */}
              {[-0.1, 0.1, 0.3].map((x, i) => (
                <mesh key={i} position={[x + 0.05, 0.08, 0.1]}>
                  <coneGeometry args={[0.02, 0.1, 4]} />
                  <meshStandardMaterial color="#eee" />
                </mesh>
              ))}
            </group>
            {/* Eyes */}
            <mesh position={[0.2, 0.1, 0.2]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={2} />
            </mesh>
            <mesh position={[0.2, 0.1, -0.2]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={2} />
            </mesh>
            {/* Horns */}
            <mesh position={[0, 0.3, 0.15]} rotation={[0.4, 0.3, 0]}>
              <coneGeometry args={[0.04, 0.4, 5]} />
              <meshStandardMaterial color="#0d1f08" />
            </mesh>
            <mesh position={[0, 0.3, -0.15]} rotation={[0.4, -0.3, 0]}>
              <coneGeometry args={[0.04, 0.4, 5]} />
              <meshStandardMaterial color="#0d1f08" />
            </mesh>
          </group>
        </group>

        {/* ── TAIL ── */}
        <group ref={tailRef} position={[-1.1, -0.2, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.22, 1.0, 6, 10]} />
            <meshStandardMaterial color="#1a3a0f" roughness={0.6} />
          </mesh>
          <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.12, 0.7, 5, 8]} />
            <meshStandardMaterial color="#1a3a0f" roughness={0.6} />
          </mesh>
          {/* Tail spike */}
          <mesh position={[-1.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.08, 0.4, 4]} />
            <meshStandardMaterial color="#0d1f08" />
          </mesh>
        </group>

        {/* ── LEGS ── */}
        {[[0.3, -0.6, 0.4], [0.3, -0.6, -0.4], [-0.3, -0.6, 0.4], [-0.3, -0.6, -0.4]].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh rotation={[z > 0 ? 0.4 : -0.4, 0, 0]}>
              <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
              <meshStandardMaterial color="#1a3a0f" />
            </mesh>
            {/* Claws */}
            {[-0.05, 0, 0.05].map((cx, ci) => (
              <mesh key={ci} position={[0, -0.35, cx]} rotation={[0.8, 0, 0]}>
                <coneGeometry args={[0.025, 0.15, 4]} />
                <meshStandardMaterial color="#0d1f08" />
              </mesh>
            ))}
          </group>
        ))}

        {/* ── FIRE BREATH ── */}
        <FireParticles position={firePos} count={80} spread={0.25} speed={2} color1="#FF4500" color2="#FFD700" />
        <SmokeParticles position={firePos} count={25} />
        {/* Fire glow */}
        <pointLight position={firePos} intensity={3} color="#FF6600" distance={4} decay={2} />
      </group>
    </group>
  );
}

// ─── GALAXY SCENE ─────────────────────────────────────────────────────────
function GalaxyScene() {
  const galaxyRef = useRef();
  const count = 8000;

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 4 + 0.1;
      const arms = 3;
      const armAngle = ((i % arms) / arms) * Math.PI * 2;
      const spin = r * 0.8;
      const angle = armAngle + spin + Math.random() * 0.6;
      const spread = Math.random() * 0.4;
      positions[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * spread;
      const t = r / 4;
      color.setHSL(0.6 - t * 0.3, 1.0, 0.5 + Math.random() * 0.4);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    return { positions, colors };
  }, []);

  useFrame(({ clock }) => {
    if (galaxyRef.current) galaxyRef.current.rotation.y = clock.elapsedTime * 0.08;
  });

  return (
    <group ref={galaxyRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.025} vertexColors sizeAttenuation />
      </points>
      {/* Core */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffff88" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={5} color="#ffffaa" distance={8} />
    </group>
  );
}

// ─── PHOENIX SCENE ────────────────────────────────────────────────────────
function PhoenixScene() {
  const birdRef = useRef();
  const wingLRef = useRef();
  const wingRRef = useRef();
  const tailGroupRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (birdRef.current) {
      birdRef.current.position.y = Math.sin(t * 1.5) * 0.5;
      birdRef.current.rotation.z = Math.sin(t * 1.5) * 0.07;
    }
    if (wingLRef.current) wingLRef.current.rotation.z = 0.3 + Math.sin(t * 4) * 0.6;
    if (wingRRef.current) wingRRef.current.rotation.z = -(0.3 + Math.sin(t * 4) * 0.6);
    if (tailGroupRef.current) tailGroupRef.current.rotation.z = Math.sin(t * 2) * 0.2;
  });

  return (
    <group ref={birdRef}>
      <pointLight position={[0, 0, 1]} intensity={5} color="#FF6600" distance={5} decay={2} />
      {/* Body */}
      <mesh>
        <capsuleGeometry args={[0.3, 1.2, 8, 16]} />
        <meshStandardMaterial color="#cc3300" emissive="#ff4400" emissiveIntensity={0.5} roughness={0.5} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff6600" emissiveIntensity={0.8} />
      </mesh>
      {/* Beak */}
      <mesh position={[0.2, 0.9, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.05, 0.3, 6]} />
        <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={1} />
      </mesh>
      {/* Crest */}
      {[-0.1, 0, 0.1].map((z, i) => (
        <mesh key={i} position={[0, 1.25, z]} rotation={[z * 2, 0, 0]}>
          <coneGeometry args={[0.03, 0.3, 4]} />
          <meshStandardMaterial color="#ff9900" emissive="#ffcc00" emissiveIntensity={1} />
        </mesh>
      ))}
      {/* Wings */}
      <group ref={wingLRef} position={[0, 0.2, 0.35]}>
        <mesh rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.08, 1.8, 1.2]} />
          <meshStandardMaterial color="#cc2200" emissive="#ff5500" emissiveIntensity={0.6} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <FireParticles position={[0, -0.5, 0.5]} count={30} spread={0.3} speed={1.2} color1="#FF6600" color2="#FFDD00" />
      </group>
      <group ref={wingRRef} position={[0, 0.2, -0.35]}>
        <mesh rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.08, 1.8, 1.2]} />
          <meshStandardMaterial color="#cc2200" emissive="#ff5500" emissiveIntensity={0.6} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <FireParticles position={[0, -0.5, -0.5]} count={30} spread={0.3} speed={1.2} color1="#FF6600" color2="#FFDD00" />
      </group>
      {/* Tail feathers with fire */}
      <group ref={tailGroupRef} position={[0, -1, 0]}>
        {[-0.2, -0.1, 0, 0.1, 0.2].map((z, i) => (
          <mesh key={i} position={[0, -0.3 * Math.abs(z - 0.1), z * 1.5]} rotation={[Math.PI / 2, 0, z * 2]}>
            <coneGeometry args={[0.04, 0.8, 4]} />
            <meshStandardMaterial color="#ff6600" emissive="#ff9900" emissiveIntensity={1} />
          </mesh>
        ))}
        <FireParticles position={[0, -0.5, 0]} count={40} spread={0.5} speed={1.0} color1="#FF4500" color2="#FF9900" />
      </group>
    </group>
  );
}

// ─── ROCKET LAUNCH SCENE ──────────────────────────────────────────────────
function RocketScene() {
  const rocketRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (rocketRef.current) {
      rocketRef.current.position.y = Math.sin(t * 0.4) * 0.3;
      rocketRef.current.rotation.z = Math.sin(t * 0.8) * 0.04;
    }
  });

  return (
    <group ref={rocketRef}>
      <pointLight position={[0, -2, 0]} intensity={6} color="#FF6600" distance={6} decay={2} />
      {/* Main body */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 2.5, 16]} />
        <meshStandardMaterial color="#eeeeee" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 1.9, 0]}>
        <coneGeometry args={[0.4, 1.0, 16]} />
        <meshStandardMaterial color="#cc1111" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Windows */}
      {[0.8, 0.3].map((y, i) => (
        <mesh key={i} position={[0.41, y, 0]}>
          <circleGeometry args={[0.12, 12]} />
          <meshStandardMaterial color="#87CEEB" emissive="#4488ff" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* Fins */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} position={[Math.sin(i * Math.PI / 2) * 0.5, -0.7, Math.cos(i * Math.PI / 2) * 0.5]}
          rotation={[0, i * Math.PI / 2, 0]}>
          <boxGeometry args={[0.6, 0.8, 0.05]} />
          <meshStandardMaterial color="#cc1111" metalness={0.5} />
        </mesh>
      ))}
      {/* Engine nozzle */}
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.25, 0.38, 0.5, 12]} />
        <meshStandardMaterial color="#666" metalness={0.9} />
      </mesh>
      {/* Exhaust fire */}
      <FireParticles position={[0, -1.5, 0]} count={100} spread={0.3} speed={2.5} color1="#FF4500" color2="#FFD700" />
      <SmokeParticles position={[0, -1.5, 0]} count={30} />
      {/* Boosters */}
      {[[0.5, -0.8, 0], [-0.5, -0.8, 0]].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 1.2, 10]} />
            <meshStandardMaterial color="#aaaaaa" metalness={0.8} />
          </mesh>
          <FireParticles position={[0, -0.8, 0]} count={40} spread={0.15} speed={2} color1="#FF6600" color2="#FFCC00" />
        </group>
      ))}
    </group>
  );
}

// ─── TORNADO SCENE ────────────────────────────────────────────────────────
function TornadoScene() {
  const tornadoRef = useRef();
  const particleCount = 200;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => Array.from({ length: particleCount }, (_, i) => ({
    height: (i / particleCount) * 5 - 2.5,
    angle: (i / particleCount) * Math.PI * 12,
    radius: ((i / particleCount) * 2 + 0.1),
    speed: 1 + Math.random() * 2,
    size: 0.03 + Math.random() * 0.1,
    color: Math.random() > 0.5 ? '#9988aa' : '#776688',
  })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (tornadoRef.current) tornadoRef.current.rotation.y = t * 2;
    particles.forEach((p, i) => {
      const a = p.angle + t * p.speed;
      const normH = (p.height + 2.5) / 5;
      const r = p.radius * normH;
      dummy.position.set(Math.cos(a) * r, p.height, Math.sin(a) * r);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <group ref={tornadoRef}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <mesh key={i} position={[0, i * 0.8 - 2, 0]}>
            <torusGeometry args={[i * 0.25 + 0.1, 0.04, 6, 24]} />
            <meshStandardMaterial color="#9977bb" transparent opacity={0.4} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={mesh} args={[null, null, particleCount]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color="#aa99cc" transparent opacity={0.7} />
      </instancedMesh>
      {/* Ground */}
      <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#553322" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─── BLACK HOLE SCENE ─────────────────────────────────────────────────────
function BlackHoleScene() {
  const diskRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const particleCount = 3000;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => Array.from({ length: particleCount }, (_, i) => ({
    angle: Math.random() * Math.PI * 2,
    radius: 1.5 + Math.random() * 2.5,
    height: (Math.random() - 0.5) * 0.3,
    speed: 0.3 + Math.random() * 0.8,
    size: 0.01 + Math.random() * 0.03,
  })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (diskRef.current) diskRef.current.rotation.z = t * 0.3;
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.5;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.4;
    particles.forEach((p, i) => {
      const a = p.angle + t * p.speed * (1 / Math.max(p.radius - 1, 0.5));
      dummy.position.set(Math.cos(a) * p.radius, p.height, Math.sin(a) * p.radius);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Event horizon */}
      <mesh>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshStandardMaterial color="#000000" roughness={1} metalness={0} />
      </mesh>
      {/* Glow ring */}
      <mesh>
        <torusGeometry args={[1.05, 0.08, 8, 64]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff4400" emissiveIntensity={4} />
      </mesh>
      {/* Accretion disk */}
      <group ref={diskRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 4, 64]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={1.5} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={ring1Ref} rotation={[Math.PI / 2 + 0.3, 0, 0]}>
        <mesh>
          <torusGeometry args={[2.0, 0.06, 6, 64]} />
          <meshStandardMaterial color="#ffaa00" emissive="#ffcc00" emissiveIntensity={2} transparent opacity={0.7} />
        </mesh>
      </group>
      <group ref={ring2Ref} rotation={[Math.PI / 2 - 0.2, 0, 0]}>
        <mesh>
          <torusGeometry args={[2.8, 0.04, 6, 64]} />
          <meshStandardMaterial color="#ff5500" emissive="#ff2200" emissiveIntensity={2} transparent opacity={0.5} />
        </mesh>
      </group>
      {/* Orbiting particles */}
      <instancedMesh ref={mesh} args={[null, null, particleCount]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color="#ffaa44" emissive="#ff6600" emissiveIntensity={1} />
      </instancedMesh>
      <pointLight position={[0, 0, 0]} intensity={3} color="#ff6600" distance={8} />
    </group>
  );
}

// ─── MAIN ANIMATED SCENE WRAPPER ──────────────────────────────────────────
const SCENES = {
  dragon: { component: FlyingDragon, bg: '#050a02', camPos: [0, 1, 8], label: '🐉 Flying Dragon' },
  phoenix: { component: PhoenixScene, bg: '#0a0500', camPos: [0, 0, 7], label: '🔥 Phoenix' },
  galaxy: { component: GalaxyScene, bg: '#000008', camPos: [0, 3, 10], label: '🌌 Galaxy' },
  blackhole: { component: BlackHoleScene, bg: '#000000', camPos: [0, 3, 9], label: '🌑 Black Hole' },
  tornado: { component: TornadoScene, bg: '#1a1020', camPos: [0, 0, 10], label: '🌪️ Tornado' },
  rocket: { component: RocketScene, bg: '#000510', camPos: [0, 0, 9], label: '🚀 Rocket Launch' },
};

export default function AnimatedScene3D({ scene = 'dragon', label }) {
  const sceneKey = scene.toLowerCase();
  const config = SCENES[sceneKey] || SCENES.dragon;
  const SceneComponent = config.component;
  const displayLabel = label || config.label;

  return (
    <div style={{
      width: '100%', height: '480px',
      background: config.bg,
      border: '1px solid rgba(0,242,254,0.12)',
      borderRadius: '16px',
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 40px rgba(0,0,0,0.9), 0 8px 32px rgba(0,0,0,0.5)',
      margin: '20px 0',
    }}>
      {/* Label */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px', zIndex: 10,
        background: 'rgba(0,0,0,0.75)', padding: '5px 14px',
        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)',
        fontSize: '0.85rem', fontWeight: 'bold', color: '#fff',
        fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(8px)',
      }}>
        {displayLabel}
      </div>
      {/* Scene selector */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 10,
        display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end',
      }}>
        {Object.entries(SCENES).map(([key, s]) => (
          <a key={key} href={`?scene=${key}`} style={{
            background: key === sceneKey ? 'rgba(0,242,254,0.2)' : 'rgba(0,0,0,0.65)',
            padding: '3px 10px', borderRadius: '6px',
            border: `1px solid ${key === sceneKey ? '#00f2fe' : 'rgba(255,255,255,0.12)'}`,
            fontSize: '0.7rem', color: key === sceneKey ? '#00f2fe' : 'rgba(255,255,255,0.6)',
            textDecoration: 'none', fontFamily: 'Inter, sans-serif',
          }}>
            {s.label}
          </a>
        ))}
      </div>
      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: '12px', right: '15px',
        fontSize: '11px', color: 'rgba(255,255,255,0.4)',
        pointerEvents: 'none', fontFamily: 'Inter, sans-serif',
        background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '4px', zIndex: 10,
      }}>
        🖱️ Drag to rotate | Scroll to zoom
      </div>
      <Canvas camera={{ position: config.camPos, fov: 50 }}>
        <color attach="background" args={[config.bg]} />
        <ambientLight intensity={0.3} />
        <Stars radius={100} depth={50} count={3000} factor={4} fade />
        <SceneComponent />
        <OrbitControls enableZoom autoRotate={false} maxDistance={20} minDistance={3} />
      </Canvas>
    </div>
  );
}

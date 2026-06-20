import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ── ADVANCED COLOR-SHIFTING PARTICLE SYSTEM ──────────────────────────────
function FireParticles({ pos=[0,0,0], count=100, spread=0.25, speed=2, sizeScale=1 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cTemp = useMemo(() => new THREE.Color(), []);
  const pts = useMemo(() => Array.from({ length: count }, () => ({
    off: Math.random() * Math.PI * 2,
    spd: 0.8 + Math.random() * speed,
    sx: (Math.random() - 0.5) * spread,
    sz: (Math.random() - 0.5) * spread,
    size: (0.05 + Math.random() * 0.1) * sizeScale,
  })), [count, spread, speed, sizeScale]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    pts.forEach((p, i) => {
      const life = ((t * p.spd * 0.45 + p.off) % 1);
      // Particle rises and expands slightly, then shrinks to 0 at end of life
      dummy.position.set(pos[0] + p.sx * (1 + life * 1.5), pos[1] + life * 2.4, pos[2] + p.sz * (1 + life * 1.5));
      const s = p.size * (life < 0.2 ? life * 5 : (1 - life) * 1.25);
      dummy.scale.set(s,s,s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);

      // Color stage interpolation: White-hot -> Blue -> Yellow/Orange -> Red -> Grey Smoke
      if (life < 0.15) {
        cTemp.setHSL(0.55 + life * 0.2, 1.0, 0.85 - life * 0.5); // white-hot blue core
      } else if (life < 0.5) {
        const n = (life - 0.15) / 0.35;
        cTemp.setHSL(0.08 + (1 - n) * 0.08, 1.0, 0.6); // vivid orange/yellow
      } else if (life < 0.8) {
        const n = (life - 0.5) / 0.3;
        cTemp.setHSL(0.01, 1.0, 0.45 * (1 - n)); // cooling red
      } else {
        const n = (life - 0.8) / 0.2;
        cTemp.setHSL(0.0, 0.0, 0.25 * (1 - n)); // dark ash smoke
      }
      mesh.current.setColorAt(i, cTemp);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial transparent opacity={0.85} roughness={0.1} />
    </instancedMesh>
  );
}

// ── DRAGON WING (PHYSICAL SHADING WITH TRANSMISSION) ──────────────────────
function DragonWing({ side=1 }) {
  const root = useRef();
  const mem1 = useRef();
  const mem2 = useRef();
  const mem3 = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.rotation.z = side * (0.22 + Math.sin(t * 2.8) * 0.5);
      root.current.rotation.x = Math.sin(t * 2.8 + 0.3) * 0.1;
    }
    if (mem1.current) mem1.current.rotation.z = side * Math.sin(t * 2.8 + 0.25) * 0.12;
    if (mem2.current) mem2.current.rotation.z = side * Math.sin(t * 2.8 + 0.4) * 0.1;
    if (mem3.current) mem3.current.rotation.z = side * Math.sin(t * 2.8 + 0.55) * 0.08;
  });

  // Wet scaly texture feel for bones
  const boneMat = { color: '#11220a', roughness: 0.4, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.3 };
  // Translucent physical leather for wing membranes
  const memMat = {
    color: '#2a0909',
    roughness: 0.75,
    metalness: 0.1,
    transmission: 0.42, // allows light to pass through wings organically
    thickness: 0.5,
    side: THREE.DoubleSide
  };
  const s = side;

  return (
    <group ref={root} position={[s * 0.65, 0.25, 0]}>
      {/* Primary arm bone */}
      <mesh position={[s * 0.5, 0, 0]} rotation={[0, 0, s * 0.2]}>
        <cylinderGeometry args={[0.045, 0.03, 1.5, 8]} />
        <meshPhysicalMaterial {...boneMat} />
      </mesh>
      {/* Finger 1 */}
      <group ref={mem1} position={[s * 1.1, 0, 0.18]}>
        <mesh rotation={[0, 0, s * 0.3]}>
          <cylinderGeometry args={[0.025, 0.01, 1.2, 6]} />
          <meshPhysicalMaterial {...boneMat} />
        </mesh>
        <mesh position={[s * 0.5, 0, 0.3]}>
          <boxGeometry args={[0.06, 0.9, 0.7]} />
          <meshPhysicalMaterial {...memMat} />
        </mesh>
      </group>
      {/* Finger 2 */}
      <group ref={mem2} position={[s * 1.1, 0, 0]}>
        <mesh rotation={[0, 0, s * 0.15]}>
          <cylinderGeometry args={[0.025, 0.01, 1.3, 6]} />
          <meshPhysicalMaterial {...boneMat} />
        </mesh>
        <mesh position={[s * 0.3, 0, 0]}>
          <boxGeometry args={[0.06, 1.0, 0.65]} />
          <meshPhysicalMaterial {...memMat} />
        </mesh>
      </group>
      {/* Finger 3 */}
      <group ref={mem3} position={[s * 1.1, 0, -0.18]}>
        <mesh rotation={[0, 0, -s * 0.1]}>
          <cylinderGeometry args={[0.025, 0.01, 1.0, 6]} />
          <meshPhysicalMaterial {...boneMat} />
        </mesh>
        <mesh position={[s * 0.2, 0, -0.3]}>
          <boxGeometry args={[0.06, 0.85, 0.6]} />
          <meshPhysicalMaterial {...memMat} />
        </mesh>
      </group>
      {/* Main membrane base */}
      <mesh position={[s * 0.9, 0, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.5, 0.03, 1.1]} />
        <meshPhysicalMaterial {...memMat} />
      </mesh>
      {/* Wing claw tip */}
      <mesh position={[s * 1.75, 0.05, 0]} rotation={[0, 0, s * (-Math.PI / 2 + 0.3)]}>
        <coneGeometry args={[0.045, 0.28, 5]} />
        <meshPhysicalMaterial color="#080202" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

// ── DRAGON LEG ────────────────────────────────────────────────────────────
function DragonLeg({ pos=[0,0,0], side=1 }) {
  const legRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (legRef.current) {
      legRef.current.rotation.x = Math.sin(t * 1.4 + pos[2]) * 0.15;
      legRef.current.rotation.z = side * 0.08;
    }
  });

  const skinMat = { color: '#16330b', roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3 };
  return (
    <group position={pos}>
      <group ref={legRef}>
        <mesh rotation={[0.4, 0, side * 0.2]}>
          <cylinderGeometry args={[0.1, 0.07, 0.55, 8]} />
          <meshPhysicalMaterial {...skinMat} />
        </mesh>
        <group position={[0, -0.35, 0.15]}>
          <mesh rotation={[0.8, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.05, 0.45, 8]} />
            <meshPhysicalMaterial {...skinMat} />
          </mesh>
          {/* 3 claws */}
          {[-0.07, 0, 0.07].map((z, i) => (
            <mesh key={i} position={[z, -0.3, 0.15]} rotation={[0.7 + Math.abs(z) * 2, 0, z * 3]}>
              <coneGeometry args={[0.03, 0.22, 5]} />
              <meshPhysicalMaterial color="#061204" roughness={0.3} metalness={0.7} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

// ── DRAGON EYE (REALISTIC GLASSY LENS + IRIS) ─────────────────────────────
function DragonEye({ side=1 }) {
  const eyeRef = useRef();
  useFrame(({ clock }) => {
    if (eyeRef.current) {
      // Subtle organic twitching
      eyeRef.current.rotation.y = Math.sin(clock.elapsedTime * 2.2) * 0.06;
    }
  });
  return (
    <group position={[0.18, 0.12, side * 0.22]} ref={eyeRef}>
      {/* Outer glassy cornea */}
      <mesh>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.92} thickness={0.15} roughness={0.02} clearcoat={1.0} />
      </mesh>
      {/* Inner glowing orange/red Iris */}
      <mesh position={[0.015, 0, 0]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3.5} roughness={0.1} />
      </mesh>
      {/* Dark slit-like pupil (predator eye) */}
      <mesh position={[0.04, 0, 0]} scale={[1, 2.2, 0.35]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshStandardMaterial color="#000" roughness={0.2} />
      </mesh>
    </group>
  );
}

// ── FLYING DRAGON (ULTRA ADVANCED) ────────────────────────────────────────
function FlyingDragon() {
  const root = useRef();
  const head = useRef();
  const neck = useRef();
  const tail1 = useRef();
  const tail2 = useRef();
  const tail3 = useRef();
  const jaw = useRef();
  const tongue = useRef();
  const fireLight = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.1) * 0.65;
      root.current.position.x = Math.sin(t * 0.45) * 0.4;
      // Banking flight rotation
      root.current.rotation.z = Math.sin(t * 1.1) * 0.08;
      root.current.rotation.y = Math.cos(t * 0.45) * 0.05;
    }
    if (neck.current) {
      neck.current.rotation.x = Math.sin(t * 0.9) * 0.15;
      neck.current.rotation.y = Math.sin(t * 0.55) * 0.08;
    }
    if (head.current) {
      head.current.rotation.x = Math.sin(t * 1.0 + 0.4) * 0.18;
    }
    if (jaw.current) {
      jaw.current.rotation.x = Math.max(0, Math.sin(t * 2.2 - 0.5) * 0.4);
    }
    if (tongue.current) {
      tongue.current.rotation.x = Math.max(0, Math.sin(t * 2.2 - 0.7) * 0.25);
    }
    // Segmented tail waving
    if (tail1.current) {
      tail1.current.rotation.z = Math.sin(t * 1.8) * 0.28;
      tail1.current.rotation.x = Math.cos(t * 1.4) * 0.1;
    }
    if (tail2.current) tail2.current.rotation.z = Math.sin(t * 1.8 + 0.4) * 0.35;
    if (tail3.current) tail3.current.rotation.z = Math.sin(t * 1.8 + 0.8) * 0.4;
    // Breathes fire in dynamic bursts
    if (fireLight.current) {
      fireLight.current.intensity = 5 + Math.sin(t * 15) * 2;
    }
  });

  const bodyMat = { color: '#16330b', roughness: 0.55, metalness: 0.15, clearcoat: 0.65, clearcoatRoughness: 0.35 };
  const scaleMat = { color: '#091c04', roughness: 0.75, clearcoat: 0.2 };

  return (
    <group>
      {/* Dynamic ambient lights */}
      <pointLight position={[3, 1, 0]} intensity={4.5} color="#FF4500" distance={8} decay={2} />
      <pointLight position={[-4, 2, 0]} intensity={1.5} color="#4477ff" distance={12} />
      <spotLight position={[0, 8, 3]} intensity={2.5} angle={0.5} penumbra={0.5} color="#ff8844" />

      <group ref={root}>
        {/* Body trunk */}
        <mesh position={[0, 0, 0]}>
          <capsuleGeometry args={[0.58, 1.9, 10, 18]} />
          <meshPhysicalMaterial {...bodyMat} />
        </mesh>
        
        {/* Belly plates */}
        {[-0.7, -0.4, -0.1, 0.2, 0.5, 0.8].map((y, i) => (
          <mesh key={i} position={[0, y, 0.52]} rotation={[0.15, 0, 0]}>
            <capsuleGeometry args={[0.28 + i * 0.02, 0.3, 4, 8]} />
            <meshPhysicalMaterial color="#2d5a1f" roughness={0.8} clearcoat={0.3} />
          </mesh>
        ))}

        {/* Back Spine plates */}
        {[-0.8, -0.5, -0.2, 0.1, 0.4, 0.7, 1.0].map((y, i) => (
          <mesh key={i} position={[0, y, -0.55]} rotation={[-0.3, 0, 0]}>
            <coneGeometry args={[0.05, 0.3 + i * 0.03, 5]} />
            <meshPhysicalMaterial {...scaleMat} />
          </mesh>
        ))}

        {/* Scaly side bumps */}
        {[...Array(14)].map((_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          const r = 0.57;
          return (
            <mesh key={i} position={[Math.sin(angle) * r * 0.7, (i / 14) * 1.8 - 0.8, Math.cos(angle) * r]} rotation={[0, angle, 0]}>
              <coneGeometry args={[0.025, 0.1, 4]} />
              <meshPhysicalMaterial {...scaleMat} />
            </mesh>
          );
        })}

        {/* Wings */}
        <DragonWing side={1} />
        <DragonWing side={-1} />

        {/* Neck */}
        <group ref={neck} position={[0.95, 0.5, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.3, 0.7, 8, 14]} />
            <meshPhysicalMaterial {...bodyMat} />
          </mesh>
          {/* Neck spines */}
          {[0.1, 0.3, 0.5].map((x, i) => (
            <mesh key={i} position={[x, 0.3, -0.28]} rotation={[-0.4, 0, 0]}>
              <coneGeometry args={[0.04, 0.22, 5]} />
              <meshPhysicalMaterial {...scaleMat} />
            </mesh>
          ))}
          
          {/* Head */}
          <group ref={head} position={[0.85, 0.1, 0]}>
            <mesh>
              <boxGeometry args={[0.68, 0.42, 0.48]} />
              <meshPhysicalMaterial {...bodyMat} />
            </mesh>
            {/* Brow ridges */}
            <mesh position={[0.15, 0.22, 0.2]} rotation={[0, 0, -0.2]}>
              <capsuleGeometry args={[0.05, 0.35, 4, 6]} />
              <meshPhysicalMaterial {...scaleMat} />
            </mesh>
            <mesh position={[0.15, 0.22, -0.2]} rotation={[0, 0, -0.2]}>
              <capsuleGeometry args={[0.05, 0.35, 4, 6]} />
              <meshPhysicalMaterial {...scaleMat} />
            </mesh>
            {/* Snout */}
            <mesh position={[0.5, -0.04, 0]}>
              <boxGeometry args={[0.52, 0.3, 0.36]} />
              <meshPhysicalMaterial {...bodyMat} />
            </mesh>
            <mesh position={[0.72, -0.06, 0]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshPhysicalMaterial {...bodyMat} />
            </mesh>
            {/* Nostrils */}
            <mesh position={[0.72, 0, 0.08]}><sphereGeometry args={[0.03, 6, 6]} /><meshStandardMaterial color="#0a1a06" /></mesh>
            <mesh position={[0.72, 0, -0.08]}><sphereGeometry args={[0.03, 6, 6]} /><meshStandardMaterial color="#0a1a06" /></mesh>
            
            {/* Lower Jaw */}
            <group ref={jaw} position={[0.15, -0.2, 0]}>
              <mesh position={[0.2, 0, 0]}>
                <boxGeometry args={[0.55, 0.14, 0.32]} />
                <meshPhysicalMaterial {...bodyMat} />
              </mesh>
              {/* Lower teeth */}
              {[-0.08, -0.02, 0.04, 0.1, 0.16, 0.22].map((x, i) => (
                <mesh key={i} position={[x, 0.08, i % 2 === 0 ? 0.1 : -0.1]}>
                  <coneGeometry args={[0.025, 0.13, 5]} />
                  <meshPhysicalMaterial color="#ddd" roughness={0.3} metalness={0.3} />
                </mesh>
              ))}
              {/* Tongue */}
              <group ref={tongue} position={[0.1, -0.05, 0]}>
                <mesh><capsuleGeometry args={[0.025, 0.3, 4, 6]} /><meshStandardMaterial color="#cc2244" /></mesh>
                <mesh position={[0.2, 0, 0.05]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.02, 0.12, 4]} /><meshStandardMaterial color="#cc2244" /></mesh>
                <mesh position={[0.2, 0, -0.05]} rotation={[0, 0, -0.3]}><coneGeometry args={[0.02, 0.12, 4]} /><meshStandardMaterial color="#cc2244" /></mesh>
              </group>
            </group>
            {/* Upper teeth */}
            {[-0.08, -0.02, 0.04, 0.1, 0.16, 0.22].map((x, i) => (
              <mesh key={i} position={[x + 0.1, -0.19, i % 2 === 0 ? 0.09 : -0.09]}>
                <coneGeometry args={[0.028, 0.15, 5]} />
                <meshPhysicalMaterial color="#e0e0e0" roughness={0.3} metalness={0.3} />
              </mesh>
            ))}

            {/* Predator Eyes (Cornea + Iris + Slit Pupil) */}
            <DragonEye side={1} />
            <DragonEye side={-1} />

            {/* Horns */}
            {[[0.05, 0.3, 0.18], [0.05, 0.3, -0.18], [-0.1, 0.28, 0.12], [-0.1, 0.28, -0.12]].map(([x, y, z], i) => (
              <mesh key={i} position={[x, y, z]} rotation={[0.5 * Math.sign(z), Math.sign(z) * 0.3, 0]}>
                <coneGeometry args={[0.04, 0.4 + (i < 2 ? 0.1 : 0), 5]} />
                <meshPhysicalMaterial color="#080c05" roughness={0.3} metalness={0.6} />
              </mesh>
            ))}
          </group>
        </group>

        {/* Tail (segmented) */}
        <group ref={tail1} position={[-1.1, -0.25, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.26, 0.9, 8, 12]} />
            <meshPhysicalMaterial {...bodyMat} />
          </mesh>
          {[0.1, 0.4].map((x, i) => (
            <mesh key={i} position={[-x, 0.28, -0.24]} rotation={[-0.4, 0, 0]}><coneGeometry args={[0.04, 0.24, 5]} /><meshPhysicalMaterial {...scaleMat} /></mesh>
          ))}
          <group ref={tail2} position={[-0.7, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.17, 0.8, 6, 10]} />
              <meshPhysicalMaterial {...bodyMat} />
            </mesh>
            {[0.1, 0.35].map((x, i) => (
              <mesh key={i} position={[-x, 0.2, -0.18]} rotation={[-0.4, 0, 0]}><coneGeometry args={[0.03, 0.18, 5]} /><meshPhysicalMaterial {...scaleMat} /></mesh>
            ))}
            <group ref={tail3} position={[-0.6, 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <capsuleGeometry args={[0.1, 0.7, 5, 8]} />
                <meshPhysicalMaterial {...bodyMat} />
              </mesh>
              {/* Spiked Diamond tail tip */}
              <mesh position={[-0.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.15, 0.45, 4]} />
                <meshPhysicalMaterial color="#0b1b07" roughness={0.3} metalness={0.7} />
              </mesh>
            </group>
          </group>
        </group>

        {/* Legs */}
        <DragonLeg pos={[0.35, -0.65, 0.42]} side={1} />
        <DragonLeg pos={[0.35, -0.65, -0.42]} side={-1} />
        <DragonLeg pos={[-0.3, -0.65, 0.4]} side={1} />
        <DragonLeg pos={[-0.3, -0.65, -0.4]} side={-1} />

        {/* ── BURSTING FIRE BREATH WITH COLOR TRANSITIONS ── */}
        <FireParticles pos={[2.9, 0.05, 0]} count={70} spread={0.12} speed={3.2} sizeScale={0.7} />
        <FireParticles pos={[2.9, 0.05, 0]} count={100} spread={0.24} speed={2.5} sizeScale={1.1} />
        <FireParticles pos={[2.8, 0.1, 0]} count={60} spread={0.38} speed={1.8} sizeScale={1.5} />
        
        {/* Fire lights */}
        <pointLight ref={fireLight} position={[3, 0.5, 0]} intensity={6.5} color="#FF6600" distance={6} decay={2} />
        <pointLight position={[2.5, 0.2, 0]} intensity={3.5} color="#44AAFF" distance={3.5} decay={2} />
      </group>
    </group>
  );
}

// ── PHOENIX (VELVET SHEEN FEATHERS + SMOKE) ───────────────────────────────
function PhoenixScene() {
  const body = useRef();
  const wL = useRef();
  const wR = useRef();
  const tail = useRef();
  const head = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.4) * 0.5;
      body.current.rotation.z = Math.sin(t * 1.4) * 0.06;
    }
    if (wL.current) wL.current.rotation.z = 0.35 + Math.sin(t * 4.2) * 0.6;
    if (wR.current) wR.current.rotation.z = -(0.35 + Math.sin(t * 4.2) * 0.6);
    if (tail.current) {
      tail.current.rotation.z = Math.sin(t * 2) * 0.2;
      tail.current.rotation.x = Math.sin(t * 1.5) * 0.12;
    }
    if (head.current) head.current.rotation.x = Math.sin(t * 1.2) * 0.12;
  });

  // Soft glowing velvet physical feathers
  const bMat = {
    color: '#d62200',
    roughness: 0.8,
    sheen: 1.0,
    sheenColor: '#ff7700',
    sheenRoughness: 0.35,
    emissive: '#d62200',
    emissiveIntensity: 0.6
  };
  const fMat = {
    color: '#ff6600',
    roughness: 0.75,
    sheen: 0.9,
    sheenColor: '#ffbb00',
    emissive: '#ff5500',
    emissiveIntensity: 0.8
  };

  return (
    <group ref={body}>
      <pointLight intensity={7} color="#FF5500" distance={8} decay={2} />
      {/* Body */}
      <mesh>
        <capsuleGeometry args={[0.32, 1.3, 10, 16]} />
        <meshPhysicalMaterial {...bMat} />
      </mesh>
      {/* Breast feathers */}
      {[0, 0.25, 0.5].map((y, i) => (
        <mesh key={i} position={[0, y - 0.2, 0.28]} rotation={[-0.2, 0, 0]}>
          <capsuleGeometry args={[0.22 - i * 0.04, 0.2, 4, 8]} />
          <meshPhysicalMaterial {...fMat} />
        </mesh>
      ))}
      {/* Head */}
      <group ref={head} position={[0, 0.9, 0]}>
        <mesh>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshPhysicalMaterial {...bMat} />
        </mesh>
        <mesh position={[0.22, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.05, 0.32, 6]} />
          <meshPhysicalMaterial color="#ffcc00" metalness={0.7} roughness={0.1} emissive="#ffaa00" />
        </mesh>
        {/* Crest feathers */}
        {[-0.12, 0, 0.12].map((z, i) => (
          <mesh key={i} position={[0, 0.32, z]} rotation={[z * 2, 0, 0]}>
            <coneGeometry args={[0.03, 0.4, 4]} />
            <meshPhysicalMaterial {...fMat} />
          </mesh>
        ))}
        {/* Eyes (glassy) */}
        {[0.12, -0.12].map((z, i) => (
          <mesh key={i} position={[0.2, 0.08, z]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#ffff00" emissive="#ffee00" emissiveIntensity={2.5} />
          </mesh>
        ))}
      </group>
      {/* Wings */}
      <group ref={wL} position={[0, 0.2, 0.4]}>
        <mesh rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[0.08, 2.0, 1.3]} />
          <meshPhysicalMaterial {...fMat} transparent opacity={0.88} side={THREE.DoubleSide} />
        </mesh>
        {[0.5, 0.9, 1.3].map((z, i) => (
          <mesh key={i} position={[0, -0.5 - i * 0.15, z]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.05, 0.7 - i * 0.15, 0.3]} />
            <meshPhysicalMaterial {...fMat} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <FireParticles pos={[0, -0.8, 0.7]} count={60} spread={0.35} speed={1.6} sizeScale={0.8} />
      </group>
      <group ref={wR} position={[0, 0.2, -0.4]}>
        <mesh rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.08, 2.0, 1.3]} />
          <meshPhysicalMaterial {...fMat} transparent opacity={0.88} side={THREE.DoubleSide} />
        </mesh>
        {[0.5, 0.9, 1.3].map((z, i) => (
          <mesh key={i} position={[0, -0.5 - i * 0.15, -z]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[0.05, 0.7 - i * 0.15, 0.3]} />
            <meshPhysicalMaterial {...fMat} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <FireParticles pos={[0, -0.8, -0.7]} count={60} spread={0.35} speed={1.6} sizeScale={0.8} />
      </group>
      {/* Tail */}
      <group ref={tail} position={[0, -1.1, 0]}>
        {[-0.25, -0.12, 0, 0.12, 0.25].map((z, i) => (
          <mesh key={i} position={[0, -0.3 * Math.abs(z - 0.05), z * 2.2]} rotation={[Math.PI / 2, 0, z * 2]}>
            <coneGeometry args={[0.04, 1.0, 5]} />
            <meshPhysicalMaterial color={['#ff3300', '#ff5500', '#ff8800', '#ff5500', '#ff3300'][i]} sheen={0.8} emissive="#ffaa00" />
          </mesh>
        ))}
        <FireParticles pos={[0, -0.6, 0]} count={70} spread={0.5} speed={1.4} sizeScale={1.0} />
      </group>
    </group>
  );
}

// ── GALAXY (VOLUMETRIC COSMIC CLOUDS + 12K STARS) ─────────────────────────
function GalaxyScene() {
  const ref = useRef();
  const dustRef = useRef();
  const gasRef1 = useRef();
  const gasRef2 = useRef();
  const count = 12000;
  const dustCount = 3000;

  const { pos, col } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const arms = 4;
      const r = 0.3 + Math.random() * 4.5;
      const arm = (i % arms) / arms * Math.PI * 2;
      const spin = r * 0.9;
      const angle = arm + spin + Math.random() * 0.5;
      const spread = Math.pow(Math.random(), 2) * 0.5;
      pos[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
      pos[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * spread;
      const t = r / 4.5;
      c.setHSL(0.62 - t * 0.35, 1.0, 0.45 + Math.random() * 0.45);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { pos, col };
  }, []);

  const { dpos, dcol } = useMemo(() => {
    const dpos = new Float32Array(dustCount * 3);
    const dcol = new Float32Array(dustCount * 3);
    const c = new THREE.Color();
    for (let i = 0; i < dustCount; i++) {
      const r = Math.random() * 5;
      const a = Math.random() * Math.PI * 2;
      dpos[i * 3] = Math.cos(a) * r;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      dpos[i * 3 + 2] = Math.sin(a) * r;
      c.setHSL(0.7 + Math.random() * 0.2, 0.6, 0.6 + Math.random() * 0.3);
      dcol[i * 3] = c.r;
      dcol[i * 3 + 1] = c.g;
      dcol[i * 3 + 2] = c.b;
    }
    return { dpos, dcol };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) ref.current.rotation.y = t * 0.07;
    if (dustRef.current) dustRef.current.rotation.y = t * 0.05;
    if (gasRef1.current) gasRef1.current.rotation.y = t * 0.12;
    if (gasRef2.current) gasRef2.current.rotation.y = -t * 0.08;
  });

  return (
    <group>
      <group ref={ref}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pos, 3]} />
            <bufferAttribute attach="attributes-color" args={[col, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.024} vertexColors sizeAttenuation />
        </points>
      </group>
      <group ref={dustRef}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dpos, 3]} />
            <bufferAttribute attach="attributes-color" args={[dcol, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.012} vertexColors sizeAttenuation transparent opacity={0.45} />
        </points>
      </group>
      
      {/* Volumetric Galactic Gas Clouds */}
      <group ref={gasRef1}>
        <mesh position={[1.5, 0.1, 1.2]}>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshPhysicalMaterial color="#331166" transparent opacity={0.16} transmission={0.7} roughness={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[-1.2, -0.1, -1.5]}>
          <sphereGeometry args={[1.4, 16, 16]} />
          <meshPhysicalMaterial color="#114488" transparent opacity={0.14} transmission={0.8} roughness={0.9} depthWrite={false} />
        </mesh>
      </group>
      <group ref={gasRef2}>
        <mesh position={[-1.6, 0.05, 1.6]}>
          <sphereGeometry args={[1.1, 16, 16]} />
          <meshPhysicalMaterial color="#661133" transparent opacity={0.15} transmission={0.7} roughness={0.9} depthWrite={false} />
        </mesh>
      </group>

      {/* Galactic core */}
      <mesh><sphereGeometry args={[0.45, 24, 24]} /><meshStandardMaterial color="#FFFFEE" emissive="#FFFF77" emissiveIntensity={5} /></mesh>
      <mesh><sphereGeometry args={[0.72, 24, 24]} /><meshPhysicalMaterial color="#FFEEBB" transparent opacity={0.35} transmission={0.9} roughness={0.1} /></mesh>
      <pointLight intensity={8} color="#FFEEBB" distance={12} decay={2} />
    </group>
  );
}

// ── BLACK HOLE (GRAVITATIONAL LENS + JET PARTICLES) ───────────────────────
function BlackHoleScene() {
  const disk1 = useRef();
  const disk2 = useRef();
  const disk3 = useRef();
  const jetRef1 = useRef();
  const jetRef2 = useRef();
  const count = 5000;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => Array.from({ length: count }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 1.3 + Math.random() * 3.2,
    h: (Math.random() - 0.5) * 0.2,
    spd: 0.4 + Math.random() * 0.8,
    size: 0.008 + Math.random() * 0.025,
  })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (disk1.current) disk1.current.rotation.z = t * 0.35;
    if (disk2.current) disk2.current.rotation.z = -t * 0.28;
    if (disk3.current) disk3.current.rotation.z = t * 0.22;
    if (jetRef1.current) jetRef1.current.position.y = 2.0 + (t * 1.5 % 3.0);
    if (jetRef2.current) jetRef2.current.position.y = -2.0 - (t * 1.5 % 3.0);

    particles.forEach((p, i) => {
      // Swirling gravitational orbital speed
      const a = p.a + t * p.spd * (1.2 / Math.max(p.r - 0.75, 0.35));
      dummy.position.set(Math.cos(a) * p.r, p.h + Math.sin(t + p.r) * 0.05, Math.sin(a) * p.r);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Event horizon */}
      <mesh><sphereGeometry args={[1.05, 48, 48]} /><meshStandardMaterial color="#000" roughness={1.0} /></mesh>
      {/* Lensing glow lens */}
      <mesh>
        <sphereGeometry args={[1.12, 48, 48]} />
        <meshPhysicalMaterial color="#ff7700" emissive="#ff3300" emissiveIntensity={5} transparent opacity={0.3} transmission={0.9} thickness={0.1} />
      </mesh>
      {/* Accretion disk layers */}
      <group ref={disk1} rotation={[Math.PI / 2 + 0.15, 0, 0]}>
        <mesh><torusGeometry args={[1.5, 0.45, 16, 80]} /><meshPhysicalMaterial color="#ff5500" emissive="#ff2200" emissiveIntensity={3} transparent opacity={0.88} /></mesh>
      </group>
      <group ref={disk2} rotation={[Math.PI / 2 + 0.08, 0, 0]}>
        <mesh><torusGeometry args={[2.3, 0.3, 12, 80]} /><meshPhysicalMaterial color="#ffa200" emissive="#ff6a00" emissiveIntensity={2.2} transparent opacity={0.65} /></mesh>
      </group>
      <group ref={disk3} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
        <mesh><torusGeometry args={[3.2, 0.18, 8, 80]} /><meshPhysicalMaterial color="#ff3300" emissive="#ff1100" emissiveIntensity={1.5} transparent opacity={0.4} /></mesh>
      </group>
      
      {/* Relativistic jets */}
      <group ref={jetRef1} position={[0, 2, 0]}>
        <mesh><cylinderGeometry args={[0.01, 0.16, 2.5, 8]} /><meshPhysicalMaterial color="#88ccff" emissive="#3366ff" emissiveIntensity={5} transparent opacity={0.6} transmission={0.8} /></mesh>
        <Particles type="electric" position={[0, 0.5, 0]} count={20} scale={0.4} />
      </group>
      <group ref={jetRef2} position={[0, -2, 0]}>
        <mesh><cylinderGeometry args={[0.01, 0.16, 2.5, 8]} /><meshPhysicalMaterial color="#88ccff" emissive="#3366ff" emissiveIntensity={5} transparent opacity={0.6} transmission={0.8} /></mesh>
        <Particles type="electric" position={[0, -0.5, 0]} count={20} scale={0.4} />
      </group>

      <instancedMesh ref={mesh} args={[null, null, count]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color="#ffbb44" emissive="#ff7700" emissiveIntensity={2.5} />
      </instancedMesh>
      
      <pointLight intensity={5} color="#FF5500" distance={10} decay={2} />
      <pointLight position={[0, 5, 0]} intensity={3.5} color="#4466FF" distance={8} />
      <pointLight position={[0, -5, 0]} intensity={3.5} color="#4466FF" distance={8} />
    </group>
  );
}

// ── TORNADO (VOLUMETRIC CLOUDS + SWIRLING DEBRIS) ─────────────────────────
function TornadoScene() {
  const spinRef = useRef();
  const cloudsRef = useRef();
  const count = 400;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    h: (Math.random() - 0.5) * 5.5,
    ang: Math.random() * Math.PI * 2,
    spd: 1.2 + Math.random() * 2.8,
    size: 0.04 + Math.random() * 0.15,
  })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (spinRef.current) spinRef.current.rotation.y = t * 2.8;
    if (cloudsRef.current) cloudsRef.current.rotation.y = -t * 0.5;

    particles.forEach((p, i) => {
      const normH = (p.h + 2.75) / 5.5; // normalized 0 to 1
      const r = normH * 2.3 + 0.1;
      const a = p.ang + t * p.spd * (1.2 - normH * 0.4);
      dummy.position.set(Math.cos(a) * r, p.h, Math.sin(a) * r);
      dummy.scale.setScalar(p.size * (1 - normH * 0.3));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Tornado Core Rings */}
      <group ref={spinRef}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <mesh key={i} position={[0, i * 0.65 - 2.5, 0]}>
            <torusGeometry args={[i * 0.22 + 0.08, 0.04, 8, 40]} />
            <meshPhysicalMaterial color={`hsl(${265 + i * 6},50%,${35 + i * 4}%)`} transparent opacity={0.5} clearcoat={0.3} />
          </mesh>
        ))}
      </group>

      {/* Volumetric stormy gas around tornado */}
      <group ref={cloudsRef} position={[0, 0.5, 0]}>
        <mesh position={[1.8, 1, 0]}>
          <sphereGeometry args={[1.5, 12, 12]} />
          <meshPhysicalMaterial color="#554466" transparent opacity={0.15} transmission={0.8} roughness={0.9} depthWrite={false} />
        </mesh>
        <mesh position={[-1.8, -1, 0]}>
          <sphereGeometry args={[1.2, 12, 12]} />
          <meshPhysicalMaterial color="#445566" transparent opacity={0.15} transmission={0.8} roughness={0.9} depthWrite={false} />
        </mesh>
      </group>

      <instancedMesh ref={mesh} args={[null, null, count]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color="#b3a5cc" transparent opacity={0.75} roughness={0.8} />
      </instancedMesh>
      
      {/* Base ground circle */}
      <mesh position={[0, -2.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5, 40]} />
        <meshPhysicalMaterial color="#362920" roughness={0.95} />
      </mesh>
      
      {/* Debris particles at base */}
      <FireParticles pos={[0, -2.5, 0]} count={60} spread={1.6} speed={0.9} sizeScale={1.5} />
    </group>
  );
}

// ── ROCKET (METAL PANEL HULL + HIGH VELOCITY EXHAUST) ────────────────────
function RocketScene() {
  const rRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (rRef.current) {
      rRef.current.position.y = Math.sin(t * 0.5) * 0.35;
      rRef.current.rotation.z = Math.sin(t * 0.9) * 0.035;
    }
  });

  const bodyMat = { color: '#efefef', metalness: 0.9, roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.25 };
  const redMat = { color: '#cb1a1a', metalness: 0.65, roughness: 0.3, clearcoat: 0.5 };
  const engineMat = { color: '#444444', metalness: 0.95, roughness: 0.3 };

  return (
    <group ref={rRef}>
      <pointLight position={[0, -2, 0]} intensity={8} color="#FF5500" distance={8} decay={2} />
      <spotLight position={[0, 8, 3]} angle={0.4} intensity={2.5} color="#ffffff" />
      
      {/* Main body (metallic fuselage) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 2.7, 24]} />
        <meshPhysicalMaterial {...bodyMat} />
      </mesh>
      
      {/* Nose cone */}
      <mesh position={[0, 2.05, 0]}>
        <coneGeometry args={[0.42, 1.1, 24]} />
        <meshPhysicalMaterial {...redMat} />
      </mesh>
      
      {/* Stage separation ring */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.12, 24]} />
        <meshPhysicalMaterial color="#888888" metalness={0.95} roughness={0.1} />
      </mesh>
      
      {/* USA text plate banner */}
      <mesh position={[0.43, 0.5, 0]}>
        <boxGeometry args={[0.02, 0.8, 0.5]} />
        <meshPhysicalMaterial {...redMat} />
      </mesh>
      
      {/* Glass Windows */}
      {[1.0, 0.5, 0.05].map((y, i) => (
        <mesh key={i} position={[0.435, y, 0]}>
          <circleGeometry args={[0.1, 14]} />
          <meshPhysicalMaterial color="#88ddff" emissive="#3388ff" emissiveIntensity={1.2} transmission={0.9} roughness={0.05} />
        </mesh>
      ))}
      
      {/* Fins */}
      {[0, 1, 2, 3].map(i => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.55, -0.9, Math.cos(a) * 0.55]} rotation={[0, a + Math.PI / 4, 0]}>
            <boxGeometry args={[0.7, 1.0, 0.06]} />
            <meshPhysicalMaterial {...redMat} />
          </mesh>
        );
      })}
      
      {/* Engine nozzle */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.28, 0.42, 0.55, 18]} />
        <meshPhysicalMaterial {...engineMat} />
      </mesh>
      
      {/* Exhaust Plume */}
      <FireParticles pos={[0, -1.6, 0]} count={130} spread={0.3} speed={3.0} sizeScale={1.2} />
      <FireParticles pos={[0, -1.5, 0]} count={60} spread={0.15} speed={3.8} sizeScale={0.5} />
      
      {/* Side Boosters */}
      {[[0.65, -0.8, 0], [-0.65, -0.8, 0]].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <cylinderGeometry args={[0.16, 0.16, 1.3, 12]} />
            <meshPhysicalMaterial {...bodyMat} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 0.35, 10]} />
            <meshPhysicalMaterial {...engineMat} />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <coneGeometry args={[0.16, 0.4, 12]} />
            <meshPhysicalMaterial {...redMat} />
          </mesh>
          <FireParticles pos={[0, -0.9, 0]} count={50} spread={0.16} speed={2.6} sizeScale={0.7} />
        </group>
      ))}
    </group>
  );
}

// ── SCENE REGISTRY ────────────────────────────────────────────────────────
const SCENES = {
  dragon:   { C: FlyingDragon,  bg:'#030903', cam:[0,1,9],  label:'🐉 Dragon — Advanced Scale detailing' },
  phoenix:  { C: PhoenixScene,  bg:'#0a0200', cam:[0,0,8],  label:'🔥 Phoenix — Velvet Feathers & Fire'    },
  galaxy:   { C: GalaxyScene,   bg:'#000005', cam:[0,4,12], label:'🌌 Galaxy — 12K Stars & Gas Clouds'   },
  blackhole:{ C: BlackHoleScene,bg:'#000000', cam:[0,4,10], label:'🌑 Black Hole — Relativistic Jet'          },
  tornado:  { C: TornadoScene,  bg:'#12091c', cam:[0,0,11], label:'🌪️ Tornado — Volumetric Dust & Swirl'   },
  rocket:   { C: RocketScene,   bg:'#00020a', cam:[0,0,10], label:'🚀 Rocket Launch — Metal Hull & Plume'   },
};

export default function AnimatedScene3D({ scene='dragon', label }) {
  const key = scene.toLowerCase().replace(/[^a-z]/g,'');
  const cfg = SCENES[key] || SCENES.dragon;
  const Comp = cfg.C;
  return (
    <div style={{ width:'100%', height:'500px', background:cfg.bg, border:'1px solid rgba(0,242,254,0.12)', borderRadius:'16px', position:'relative', overflow:'hidden', boxShadow:'inset 0 0 60px rgba(0,0,0,0.9), 0 8px 32px rgba(0,0,0,0.5)', margin:'20px 0' }}>
      <div style={{ position:'absolute', top:'12px', left:'12px', zIndex:10, background:'rgba(0,0,0,0.75)', padding:'5px 14px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.15)', fontSize:'0.85rem', fontWeight:'bold', color:'#fff', fontFamily:'Inter,sans-serif', backdropFilter:'blur(8px)' }}>{label||cfg.label}</div>
      <div style={{ position:'absolute', bottom:'12px', right:'15px', fontSize:'11px', color:'rgba(255,255,255,0.5)', pointerEvents:'none', fontFamily:'Inter,sans-serif', background:'rgba(0,0,0,0.4)', padding:'2px 8px', borderRadius:'4px', zIndex:10 }}>🖱️ Drag to rotate · Scroll to zoom</div>
      <Canvas camera={{ position:cfg.cam, fov:48 }} shadows>
        <color attach="background" args={[cfg.bg]}/>
        <ambientLight intensity={0.3}/>
        <Stars radius={100} depth={50} count={4000} factor={4} fade/>
        <Comp/>
        <OrbitControls enableZoom maxDistance={22} minDistance={3} enableDamping dampingFactor={0.08}/>
      </Canvas>
    </div>
  );
}

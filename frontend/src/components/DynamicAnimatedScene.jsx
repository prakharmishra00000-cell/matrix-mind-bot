import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ── PROCEDURAL IRIS TEXTURE GENERATOR ─────────────────────────────────────
function useProceduralIris(irisColor1, irisColor2, pupilColor, isReptile = false) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Base gradient for iris
    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, irisColor1);
    grad.addColorStop(0.65, irisColor2);
    grad.addColorStop(0.9, '#000000'); // Limbal ring
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // 2. Draw organic stroma fibers (radial lines)
    const drawFibers = (count, color, minLen, maxLen, thickness) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
        const startRad = 35 + Math.random() * 20;
        const length = minLen + Math.random() * (maxLen - minLen);
        ctx.beginPath();
        ctx.moveTo(256 + Math.cos(angle) * startRad, 256 + Math.sin(angle) * startRad);
        ctx.lineTo(256 + Math.cos(angle) * length, 256 + Math.sin(angle) * length);
        ctx.stroke();
      }
    };

    // Draw dark radial lines
    drawFibers(250, 'rgba(0, 0, 0, 0.45)', 60, 240, 1.5);
    // Draw bright stroma fibers (light reflection)
    drawFibers(180, 'rgba(255, 255, 255, 0.25)', 45, 180, 1.0);
    // Draw iris-colored detailed threads
    drawFibers(300, irisColor1, 50, 220, 1.2);

    // 3. Draw a ring of spots/crypts (iris crypts)
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.1;
      const dist = 90 + Math.random() * 60;
      const size = 3 + Math.random() * 8;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(256 + Math.cos(angle) * dist, 256 + Math.sin(angle) * dist, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw outer limbal ring detail
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Draw pupil
    ctx.fillStyle = pupilColor;
    ctx.beginPath();
    if (isReptile) {
      ctx.ellipse(256, 256, 30, 120, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(256, 256, 50, 0, Math.PI * 2);
    }
    ctx.fill();

    // 6. Draw organic pupil border detail (collarette)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (isReptile) {
      ctx.ellipse(256, 256, 35, 125, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(256, 256, 55, 0, Math.PI * 2);
    }
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, [irisColor1, irisColor2, pupilColor, isReptile]);
}

// ── ADVANCED COLOR-SHIFTING PARTICLE SYSTEM ──────────────────────────────
function Particles({ type = 'fire', position = [0,0,0], count = 60, scale = 1 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cTemp = useMemo(() => new THREE.Color(), []);

  const configs = {
    fire:     { c1:'#FF4500', c2:'#FFD700', spread: 0.3*scale, rise: 2.3*scale, emit: 2.2 },
    smoke:    { c1:'#777777', c2:'#444444', spread: 0.8*scale, rise: 2.5*scale, emit: 0.5 },
    sparkle:  { c1:'#FFFFFF', c2:'#FFFF88', spread: 1.8*scale, rise: 0.8*scale, emit: 1.2 },
    bubbles:  { c1:'#88CCFF', c2:'#AADDFF', spread: 0.5*scale, rise: 2.5*scale, emit: 0.7 },
    rain:     { c1:'#88AACC', c2:'#6688AA', spread: 2.5*scale, rise: -3.5*scale, emit: 3.5 },
    snow:     { c1:'#FFFFFF', c2:'#EEEEFF', spread: 2.2*scale, rise: -1.5*scale, emit: 0.6 },
    lava:     { c1:'#FF2200', c2:'#FF8800', spread: 1.0*scale, rise: 1.8*scale, emit: 1.5 },
    magic:    { c1:'#AA44FF', c2:'#FF44CC', spread: 1.2*scale, rise: 1.8*scale, emit: 1.1 },
    electric: { c1:'#44FFFF', c2:'#FFFFFF', spread: 0.6*scale, rise: 2.2*scale, emit: 3.2 },
    water:    { c1:'#2266FF', c2:'#44AAFF', spread: 1.2*scale, rise: 1.0*scale, emit: 1.0 },
  };

  const cfg = configs[type] || configs.fire;

  const particles = useMemo(() => Array.from({ length: count }, () => ({
    offset: Math.random() * Math.PI * 2,
    speed: 0.7 + Math.random(),
    sx: (Math.random() - 0.5) * cfg.spread,
    sz: (Math.random() - 0.5) * cfg.spread,
    size: (0.04 + Math.random() * 0.1) * scale,
  })), [count, type, scale, cfg.spread]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    particles.forEach((p, i) => {
      const life = ((t * p.speed * cfg.emit * 0.5 + p.offset) % 1);
      const y = cfg.rise > 0 ? life * cfg.rise : (1 - life) * Math.abs(cfg.rise);
      dummy.position.set(
        position[0] + p.sx * (1 + life * 1.2),
        position[1] + y,
        position[2] + p.sz * (1 + life * 1.2)
      );
      // Fade out size smoothly towards end of life
      const s = p.size * (life < 0.1 ? life * 10 : (1 - life) * 1.2);
      dummy.scale.set(s,s,s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);

      // Color transitions
      if (type === 'fire') {
        if (life < 0.18) {
          cTemp.setHSL(0.55 + life * 0.2, 1.0, 0.85 - life * 0.5); // hot white-blue core
        } else if (life < 0.5) {
          const n = (life - 0.18) / 0.32;
          cTemp.setHSL(0.08 + (1 - n) * 0.08, 1.0, 0.6); // yellow-orange
        } else if (life < 0.8) {
          const n = (life - 0.5) / 0.3;
          cTemp.setHSL(0.01, 1.0, 0.45 * (1 - n)); // red
        } else {
          const n = (life - 0.8) / 0.2;
          cTemp.setHSL(0.0, 0.0, 0.25 * (1 - n)); // smoke
        }
      } else {
        // Linear fade to c2 configs
        cTemp.set(cfg.c1).lerp(new THREE.Color(cfg.c2), life);
      }
      mesh.current.setColorAt(i, cTemp);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshStandardMaterial transparent opacity={0.82} roughness={0.1} />
    </instancedMesh>
  );
}

// ── WAVE OCEAN FLOOR ──────────────────────────────────────────────────────
function OceanFloor() {
  const mesh = useRef();
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    mesh.current.rotation.x = -Math.PI / 2;
    const geo = mesh.current.geometry;
    const pos = geo.attributes.position;
    const t = clock.elapsedTime * 0.5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, Math.sin(x * 1.5 + t) * 0.15 + Math.sin(z * 1.5 + t * 0.7) * 0.1);
    }
    pos.needsUpdate = true;
  });
  return (
    <mesh ref={mesh} position={[0, -2, 0]}>
      <planeGeometry args={[20, 20, 30, 30]} />
      {/* Physical water floor with transmission and gloss */}
      <meshPhysicalMaterial color="#023b5c" roughness={0.25} metalness={0.1} transmission={0.5} thickness={1.2} transparent opacity={0.8} />
    </mesh>
  );
}

// ── SPECIFIC DETAILED OBJECT BUILDERS ─────────────────────────────────────

// ── SHARK EYE ─────────────────────────────────────────────────────────────
function SharkEye({ side=1 }) {
  const texture = useProceduralIris('#4b7a9e', '#071520', '#000000', false);
  return (
    <group position={[side * 0.15, 0.1, 1.0]}>
      {/* Glass cornea */}
      <mesh>
        <sphereGeometry args={[0.048, 20, 20]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.98} thickness={0.06} roughness={0.002} clearcoat={1.0} />
      </mesh>
      {/* Iris disk */}
      <mesh position={[0, 0, 0.008]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.042, 20]} />
        <meshStandardMaterial map={texture} roughness={0.05} />
      </mesh>
    </group>
  );
}

function Shark({ position = [0,0,0], scale = 1 }) {
  const ref = useRef();
  const tailRef = useRef();
  const tailFinRef = useRef();
  const pectoralL = useRef();
  const pectoralR = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      // S-shape swimming path
      ref.current.position.x = position[0] + Math.sin(t * 0.6) * 2.5;
      ref.current.position.y = position[1] + Math.sin(t * 0.4) * 0.4;
      ref.current.position.z = position[2] + Math.cos(t * 0.5) * 1.8;
      // Rotation tangent
      const dx = Math.cos(t * 0.6) * 0.6 * 2.5;
      const dz = -Math.sin(t * 0.5) * 0.5 * 1.8;
      ref.current.rotation.y = Math.atan2(dx, dz) + Math.PI;
      ref.current.rotation.z = Math.sin(t * 1.2) * 0.08;
    }
    // Caudal wave
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 3.5) * 0.35;
    if (tailFinRef.current) tailFinRef.current.rotation.y = Math.sin(t * 3.5 + 0.5) * 0.2;
    // Pectorals breathing
    if (pectoralL.current) pectoralL.current.rotation.z = -0.4 + Math.sin(t * 2) * 0.1;
    if (pectoralR.current) pectoralR.current.rotation.z = 0.4 - Math.sin(t * 2) * 0.1;
  });

  const s = scale;
  // Wet clearcoat shark skin
  const skinMat = { color: "#384a59", roughness: 0.4, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.15 };
  const bellyMat = { color: "#e3e9ed", roughness: 0.5, clearcoat: 0.8 };

  return (
    <group ref={ref} scale={[s,s,s]}>
      {/* Torso */}
      <mesh position={[0,0,0]}><capsuleGeometry args={[0.32,1.3,8,16]}/><meshPhysicalMaterial {...skinMat}/></mesh>
      {/* Underbelly (white) */}
      <mesh position={[0,-0.08,0.1]} scale={[0.9,0.9,0.9]}><capsuleGeometry args={[0.26,1.1,6,12]}/><meshPhysicalMaterial {...bellyMat}/></mesh>
      {/* Snout */}
      <mesh position={[0,0,0.85]} rotation={[0.15,0,0]}><coneGeometry args={[0.26,0.6,8]}/><meshPhysicalMaterial {...skinMat}/></mesh>
      
      {/* Predator Eyes (Glassy + Procedural) */}
      <SharkEye side={1} />
      <SharkEye side={-1} />

      {/* Gills */}
      {[0.4, 0.48, 0.56].map((z, i) => (
        <group key={i}>
          <mesh position={[0.28, 0, z]} rotation={[0,0.1,0.2]}><boxGeometry args={[0.01,0.2,0.02]}/><meshStandardMaterial color="#222" roughness={0.9}/></mesh>
          <mesh position={[-0.28, 0, z]} rotation={[0,-0.1,-0.2]}><boxGeometry args={[0.01,0.2,0.02]}/><meshStandardMaterial color="#222" roughness={0.9}/></mesh>
        </group>
      ))}
      {/* Dorsal Fin */}
      <mesh position={[0,0.45,-0.1]} rotation={[0.4,0,0]}><boxGeometry args={[0.06,0.5,0.32]}/><meshPhysicalMaterial {...skinMat}/></mesh>
      {/* Pectoral Fin Left */}
      <group ref={pectoralL} position={[0.26,-0.1,0.4]} rotation={[0,-0.4,-0.4]}>
        <mesh position={[0.25,0,0]}><boxGeometry args={[0.5,0.04,0.24]}/><meshPhysicalMaterial {...skinMat}/></mesh>
      </group>
      {/* Pectoral Fin Right */}
      <group ref={pectoralR} position={[-0.26,-0.1,0.4]} rotation={[0,0.4,0.4]}>
        <mesh position={[-0.25,0,0]}><boxGeometry args={[0.5,0.04,0.24]}/><meshPhysicalMaterial {...skinMat}/></mesh>
      </group>
      {/* Pelvic Fins */}
      <mesh position={[0.15,-0.2,-0.4]} rotation={[0,-0.2,-0.2]}><boxGeometry args={[0.15,0.03,0.15]}/><meshPhysicalMaterial {...skinMat}/></mesh>
      <mesh position={[-0.15,-0.2,-0.4]} rotation={[0,0.2,0.2]}><boxGeometry args={[0.15,0.03,0.15]}/><meshPhysicalMaterial {...skinMat}/></mesh>
      {/* Tail structure */}
      <group ref={tailRef} position={[0,0,-0.75]}>
        <mesh position={[0,0,-0.25]} rotation={[0,0,0]}><capsuleGeometry args={[0.18,0.5,6,12]}/><meshPhysicalMaterial {...skinMat}/></mesh>
        <group ref={tailFinRef} position={[0,0,-0.5]}>
          {/* Upper Caudal Lobe */}
          <mesh position={[0,0.38,-0.2]} rotation={[0.6,0,0]}><boxGeometry args={[0.04,0.7,0.22]}/><meshPhysicalMaterial {...skinMat}/></mesh>
          {/* Lower Caudal Lobe */}
          <mesh position={[0,-0.22,-0.1]} rotation={[-0.7,0,0]}><boxGeometry args={[0.04,0.45,0.18]}/><meshPhysicalMaterial {...skinMat}/></mesh>
        </group>
      </group>
    </group>
  );
}

function Butterfly({ position = [0,0,0], color = '#FF88CC', scale = 1 }) {
  const wingLRef = useRef();
  const wingRRef = useRef();
  const bodyRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (bodyRef.current) {
      bodyRef.current.position.x = position[0] + Math.sin(t * 0.9) * 2.0;
      bodyRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.6 + 0.6;
      bodyRef.current.position.z = position[2] + Math.cos(t * 0.75) * 1.2;
      const dx = Math.cos(t * 0.9) * 0.9 * 2.0;
      const dz = -Math.sin(t * 0.75) * 0.75 * 1.2;
      bodyRef.current.rotation.y = Math.atan2(dx, dz) + Math.PI;
      bodyRef.current.rotation.z = Math.sin(t * 8) * 0.08;
    }
    const flap = Math.sin(t * 12) * 0.75;
    if (wingLRef.current) wingLRef.current.rotation.y = 0.2 + flap;
    if (wingRRef.current) wingRRef.current.rotation.y = -0.2 - flap;
  });

  const s = scale;
  // Iridescent shimmery physical wings
  const wingMat = { color: color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 0.1, metalness: 0.6, clearcoat: 1.0, clearcoatRoughness: 0.1 };
  const patternMat = { color: "#111", transparent: true, opacity: 0.9, side: THREE.DoubleSide };

  return (
    <group ref={bodyRef} scale={[s,s,s]}>
      {/* Head */}
      <mesh position={[0,0.06,0.32]}><sphereGeometry args={[0.08,10,10]}/><meshPhysicalMaterial color="#2d1c07" roughness={0.8}/></mesh>
      {/* Thorax */}
      <mesh position={[0,0,0.1]}><capsuleGeometry args={[0.07,0.22,8,8]}/><meshPhysicalMaterial color="#40280f" roughness={0.8}/></mesh>
      {/* Abdomen */}
      <mesh position={[0,-0.04,-0.22]} rotation={[0.1,0,0]}><capsuleGeometry args={[0.05,0.4,6,8]}/><meshPhysicalMaterial color="#201002" roughness={0.9}/></mesh>
      {/* Antennae */}
      <mesh position={[0.03,0.15,0.42]} rotation={[0.4,0.1,0.2]}><cylinderGeometry args={[0.006,0.006,0.3,6]}/><meshStandardMaterial color="#111"/></mesh>
      <mesh position={[-0.03,0.15,0.42]} rotation={[0.4,-0.1,-0.2]}><cylinderGeometry args={[0.006,0.006,0.3,6]}/><meshStandardMaterial color="#111"/></mesh>
      {/* Left Wing Group */}
      <group ref={wingLRef} position={[0.06,0.05,0.1]}>
        <group position={[0.3,0.2,0.2]} rotation={[-0.1,0,-0.2]}>
          <mesh><boxGeometry args={[0.6,0.01,0.5]}/><meshPhysicalMaterial {...wingMat}/></mesh>
          <mesh position={[0,0,0]} scale={[0.9,1.1,0.9]}><boxGeometry args={[0.55,0.012,0.45]}/><meshPhysicalMaterial {...patternMat}/></mesh>
        </group>
        <group position={[0.22,-0.15,-0.12]} rotation={[0.1,0,-0.4]}>
          <mesh><boxGeometry args={[0.44,0.01,0.38]}/><meshPhysicalMaterial {...wingMat}/></mesh>
          <mesh position={[0,0,0]} scale={[0.88,1.1,0.88]}><boxGeometry args={[0.4,0.012,0.34]}/><meshPhysicalMaterial {...patternMat}/></mesh>
        </group>
      </group>
      {/* Right Wing Group */}
      <group ref={wingRRef} position={[-0.06,0.05,0.1]}>
        <group position={[-0.3,0.2,0.2]} rotation={[-0.1,0,0.2]}>
          <mesh><boxGeometry args={[0.6,0.01,0.5]}/><meshPhysicalMaterial {...wingMat}/></mesh>
          <mesh position={[0,0,0]} scale={[0.9,1.1,0.9]}><boxGeometry args={[0.55,0.012,0.45]}/><meshPhysicalMaterial {...patternMat}/></mesh>
        </group>
        <group position={[-0.22,-0.15,-0.12]} rotation={[0.1,0,0.4]}>
          <mesh><boxGeometry args={[0.44,0.01,0.38]}/><meshPhysicalMaterial {...wingMat}/></mesh>
          <mesh position={[0,0,0]} scale={[0.88,1.1,0.88]}><boxGeometry args={[0.4,0.012,0.34]}/><meshPhysicalMaterial {...patternMat}/></mesh>
        </group>
      </group>
    </group>
  );
}

function Volcano({ position = [0,0,0], scale = 1 }) {
  const s = scale;
  const lavaFlow1 = useRef();
  const lavaFlow2 = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lavaFlow1.current) lavaFlow1.current.position.y = -0.5 - (t * 0.15 % 0.8);
    if (lavaFlow2.current) lavaFlow2.current.position.y = -0.5 - ((t * 0.15 + 0.4) % 0.8);
  });

  return (
    <group position={position} scale={[s,s,s]}>
      {/* Volcano Outer Base */}
      <mesh position={[0,-0.6,0]}>
        <cylinderGeometry args={[0.8, 2.8, 2.2, 16, 4]}/>
        <meshPhysicalMaterial color="#362d26" roughness={0.9} />
      </mesh>
      {/* Inner Ash Caldera */}
      <mesh position={[0,0.5,0]}>
        <cylinderGeometry args={[0.78, 0.84, 0.2, 12]}/>
        <meshPhysicalMaterial color="#1f1a16" roughness={1.0}/>
      </mesh>
      {/* Glowing Crater Lava */}
      <mesh position={[0,0.51,0]} rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.74, 16]}/>
        <meshStandardMaterial color="#ff2200" emissive="#ff5500" emissiveIntensity={5} roughness={0.1}/>
      </mesh>
      
      {/* Flowing Lava Streams on Mountain Sides */}
      <group position={[0,0.5,0]}>
        <mesh ref={lavaFlow1} position={[0.65,-0.6,0.3]} rotation={[0.4, 0.4, -0.4]}>
          <cylinderGeometry args={[0.08, 0.12, 1.2, 6]}/>
          <meshStandardMaterial color="#ff2200" emissive="#ff6600" emissiveIntensity={4}/>
        </mesh>
        <mesh ref={lavaFlow2} position={[-0.6,-0.6,-0.4]} rotation={[-0.4, -0.4, 0.4]}>
          <cylinderGeometry args={[0.07, 0.1, 1.2, 6]}/>
          <meshStandardMaterial color="#ff2200" emissive="#ff6600" emissiveIntensity={4}/>
        </mesh>
      </group>

      <pointLight position={[0, 0.8, 0]} intensity={16} color="#ff4400" distance={10} decay={2}/>
      <Particles type="fire" position={[0, 0.6, 0]} count={100} scale={1.2}/>
      <Particles type="smoke" position={[0, 1.2, 0]} count={40} scale={1.8}/>
      <Particles type="lava" position={[0.2, 0.4, 0.2]} count={50} scale={0.7}/>
      <Particles type="lava" position={[-0.2, 0.4, -0.15]} count={50} scale={0.7}/>
    </group>
  );
}

// ── FISH EYE ──────────────────────────────────────────────────────────────
function FishEye({ side=1 }) {
  const texture = useProceduralIris('#ffea66', '#c46b08', '#000000', false);
  return (
    <group position={[side * 0.12, 0.08, 0.22]}>
      {/* Glass cornea */}
      <mesh>
        <sphereGeometry args={[0.038, 16, 16]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.98} thickness={0.04} roughness={0.002} clearcoat={1.0} />
      </mesh>
      {/* Iris disk */}
      <mesh position={[side * 0.006, 0, 0.006]} rotation={[0, side * Math.PI / 2.5, 0]}>
        <circleGeometry args={[0.032, 16]} />
        <meshStandardMaterial map={texture} roughness={0.05} />
      </mesh>
    </group>
  );
}

function Fish({ position = [0,0,0], color = '#FF8800', scale = 1 }) {
  const ref = useRef();
  const tailRef = useRef();
  const offset = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + offset.current;
    if (ref.current) {
      ref.current.position.x = position[0] + Math.sin(t * 0.8) * 1.8;
      ref.current.position.y = position[1] + Math.sin(t * 0.6) * 0.35;
      ref.current.position.z = position[2] + Math.cos(t * 0.5) * 1.3;
      const dx = Math.cos(t * 0.8) * 0.8 * 1.8;
      const dz = -Math.sin(t * 0.5) * 0.5 * 1.3;
      ref.current.rotation.y = Math.atan2(dx, dz) + Math.PI;
    }
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 4.5) * 0.45;
  });

  const s = scale;
  const fishMat = { color: color, roughness: 0.3, metalness: 0.1, clearcoat: 0.8 };
  const whiteMat = { color: '#ffffff' };

  return (
    <group ref={ref} scale={[s,s,s]}>
      {/* Body capsule */}
      <mesh><capsuleGeometry args={[0.18, 0.5, 8, 12]}/><meshPhysicalMaterial {...fishMat}/></mesh>
      {/* Stripes */}
      {[0.1, -0.1].map((z, i) => (
        <group key={i} position={[0,0,z]}>
          <mesh><torusGeometry args={[0.185, 0.02, 6, 16]}/><meshPhysicalMaterial {...whiteMat} clearcoat={0.5}/></mesh>
          <mesh position={[0,0,z > 0 ? 0.03 : -0.03]}><torusGeometry args={[0.187, 0.008, 6, 16]}/><meshStandardMaterial color="#000"/></mesh>
        </group>
      ))}
      {/* Tail fin */}
      <group ref={tailRef} position={[0, 0, -0.35]}>
        <mesh position={[0, 0, -0.15]} rotation={[0,0,0.5]}><boxGeometry args={[0.02, 0.35, 0.3]}/><meshPhysicalMaterial {...fishMat}/></mesh>
        <mesh position={[0, 0, -0.15]} rotation={[0,0,-0.5]}><boxGeometry args={[0.02, 0.35, 0.3]}/><meshPhysicalMaterial {...fishMat}/></mesh>
      </group>
      {/* Glassy + Procedural Eyes */}
      <FishEye side={1} />
      <FishEye side={-1} />
      {/* Fins */}
      <mesh position={[0, 0.22, -0.05]} rotation={[0.3, 0, 0]}><boxGeometry args={[0.02, 0.15, 0.22]}/><meshPhysicalMaterial {...fishMat}/></mesh>
      <mesh position={[0.15, -0.08, 0.05]} rotation={[0.3, 0, -0.4]}><boxGeometry args={[0.12, 0.02, 0.15]}/><meshPhysicalMaterial {...fishMat}/></mesh>
      <mesh position={[-0.15, -0.08, 0.05]} rotation={[0.3, 0, 0.4]}><boxGeometry args={[0.12, 0.02, 0.15]}/><meshPhysicalMaterial {...fishMat}/></mesh>
    </group>
  );
}

function Planet({ position = [0,0,0], color = '#4466FF', hasRings = false, hasAtmosphere = false, scale = 1, orbitRadius = 0, orbitSpeed = 1 }) {
  const orbitRef = useRef();
  const planetRef = useRef();
  const cloudsRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (orbitRef.current && orbitRadius > 0) {
      orbitRef.current.position.x = Math.sin(t * orbitSpeed) * orbitRadius;
      orbitRef.current.position.z = Math.cos(t * orbitSpeed) * orbitRadius;
    }
    if (planetRef.current) planetRef.current.rotation.y = t * 0.2;
    if (cloudsRef.current) cloudsRef.current.rotation.y = t * 0.28;
  });

  const s = scale;
  return (
    <group ref={orbitRef} position={position}>
      <group scale={[s,s,s]}>
        {/* Planet Core */}
        <mesh ref={planetRef}>
          <sphereGeometry args={[1, 32, 32]}/><meshPhysicalMaterial color={color} roughness={0.7} metalness={0.1} clearcoat={0.3}/>
        </mesh>
        {/* Cloud Layer */}
        {hasAtmosphere && (
          <mesh ref={cloudsRef}>
            <sphereGeometry args={[1.04, 24, 24]}/>
            <meshPhysicalMaterial color="#ffffff" transparent opacity={0.35} transmission={0.9} thickness={0.1} depthWrite={false}/>
          </mesh>
        )}
        {/* Atmosphere Glow */}
        {hasAtmosphere && (
          <mesh>
            <sphereGeometry args={[1.08, 24, 24]}/>
            <meshPhysicalMaterial color={color} transparent opacity={0.18} side={THREE.BackSide} transmission={0.9}/>
          </mesh>
        )}
        {/* Rings */}
        {hasRings && (
          <group rotation={[Math.PI/3.2, 0, 0.1]}>
            <mesh>
              <torusGeometry args={[1.6, 0.12, 2, 64]}/>
              <meshPhysicalMaterial color="#c2a078" transparent opacity={0.7} roughness={0.8} clearcoat={0.2}/>
            </mesh>
            <mesh>
              <torusGeometry args={[1.9, 0.08, 2, 64]}/>
              <meshPhysicalMaterial color="#ab8a60" transparent opacity={0.5} roughness={0.8} clearcoat={0.2}/>
            </mesh>
            <mesh>
              <torusGeometry args={[2.2, 0.05, 2, 64]}/>
              <meshPhysicalMaterial color="#8a6b43" transparent opacity={0.3} roughness={0.8} clearcoat={0.2}/>
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

// ── EAGLE EYE ─────────────────────────────────────────────────────────────
function EagleEye({ side=1 }) {
  const texture = useProceduralIris('#ffdd00', '#663a00', '#000000', false);
  return (
    <group position={[side * 0.09, 0.42, 0.16]}>
      {/* Glass cornea */}
      <mesh>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.98} thickness={0.03} roughness={0.002} clearcoat={1.0} />
      </mesh>
      {/* Iris disk */}
      <mesh position={[0, 0, 0.004]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.024, 16]} />
        <meshStandardMaterial map={texture} roughness={0.05} />
      </mesh>
    </group>
  );
}

function Eagle({ position = [0,0,0], color = '#614830', scale = 1 }) {
  const ref = useRef();
  const wingL = useRef();
  const wingR = useRef();
  const wingL2 = useRef();
  const wingR2 = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = position[0] + Math.sin(t * 0.5) * 3.2;
      ref.current.position.y = position[1] + Math.sin(t * 0.8) * 0.6 + 1.2;
      ref.current.position.z = position[2] + Math.cos(t * 0.45) * 2.2;
      const dx = Math.cos(t * 0.5) * 0.5 * 3.2;
      const dz = -Math.sin(t * 0.45) * 0.45 * 2.2;
      ref.current.rotation.y = Math.atan2(dx, dz) + Math.PI/2;
      ref.current.rotation.x = Math.sin(t * 0.8) * 0.05;
    }
    const flap = Math.sin(t * 5.5) * 0.45;
    if (wingL.current) wingL.current.rotation.z = 0.2 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.2 - flap;
    if (wingL2.current) wingL2.current.rotation.z = 0.15 + flap * 0.4;
    if (wingR2.current) wingR2.current.rotation.z = -0.15 - flap * 0.4;
  });

  const s = scale;
  // Soft physical eagle feathers with velvet sheen
  const feathersMat = { color: color, roughness: 0.8, sheen: 0.8, sheenColor: '#a18160' };
  const whiteMat = { color: "#e6e6e6", roughness: 0.8, sheen: 0.5 };
  const beakMat = { color: "#fca311", roughness: 0.4, clearcoat: 0.5 };

  return (
    <group ref={ref} scale={[s,s,s]}>
      {/* Body Torso */}
      <mesh><capsuleGeometry args={[0.16, 0.6, 6, 12]}/><meshPhysicalMaterial {...feathersMat}/></mesh>
      {/* Head */}
      <mesh position={[0,0.38,0.08]}><sphereGeometry args={[0.15,12,12]}/><meshPhysicalMaterial {...whiteMat}/></mesh>
      {/* Beak */}
      <group position={[0,0.38,0.22]} rotation={[0.3,0,0]}>
        <mesh><coneGeometry args={[0.05, 0.15, 6]}/><meshPhysicalMaterial {...beakMat}/></mesh>
        <mesh position={[0,-0.06,0.02]} rotation={[0.5,0,0]}><coneGeometry args={[0.03, 0.08, 6]}/><meshPhysicalMaterial {...beakMat}/></mesh>
      </group>
      {/* Yellow procedural eyes */}
      <EagleEye side={1} />
      <EagleEye side={-1} />
      {/* Wings - Left Wing */}
      <group ref={wingL} position={[0.14, 0.1, 0.05]}>
        <mesh position={[0.35, 0, 0]} rotation={[0,-0.1,0.1]}><boxGeometry args={[0.7, 0.03, 0.45]}/><meshPhysicalMaterial {...feathersMat} side={THREE.DoubleSide}/></mesh>
        <group ref={wingL2} position={[0.7, 0, 0]}>
          <mesh position={[0.25, 0, 0]} rotation={[0,-0.2,0.15]}><boxGeometry args={[0.5, 0.025, 0.35]}/><meshPhysicalMaterial {...feathersMat} side={THREE.DoubleSide}/></mesh>
        </group>
      </group>
      {/* Wings - Right Wing */}
      <group ref={wingR} position={[-0.14, 0.1, 0.05]}>
        <mesh position={[-0.35, 0, 0]} rotation={[0,0.1,-0.1]}><boxGeometry args={[0.7, 0.03, 0.45]}/><meshPhysicalMaterial {...feathersMat} side={THREE.DoubleSide}/></mesh>
        <group ref={wingR2} position={[-0.7, 0, 0]}>
          <mesh position={[-0.25, 0, 0]} rotation={[0,0.2,-0.15]}><boxGeometry args={[0.5, 0.025, 0.35]}/><meshPhysicalMaterial {...feathersMat} side={THREE.DoubleSide}/></mesh>
        </group>
      </group>
      {/* Tail Feathers */}
      <group position={[0, -0.34, -0.15]} rotation={[-0.4, 0, 0]}>
        {[-0.08, 0, 0.08].map((x, i) => (
          <mesh key={i} position={[x, -0.15, 0]} rotation={[0, 0, x*2]}>
            <boxGeometry args={[0.07, 0.35, 0.02]}/><meshPhysicalMaterial {...feathersMat}/>
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Comet({ position = [0,0,0], scale = 1 }) {
  const ref = useRef();
  const sparkGlow = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = position[0] + Math.sin(t * 0.3) * 4.5;
      ref.current.position.y = position[1] + Math.cos(t * 0.4) * 2.2;
      ref.current.position.z = position[2] + Math.sin(t * 0.25 + 0.8) * 4.5;

      const dx = Math.cos(t * 0.3) * 0.3 * 4.5;
      const dy = -Math.sin(t * 0.4) * 0.4 * 2.2;
      const dz = Math.cos(t * 0.25 + 0.8) * 0.25 * 4.5;

      ref.current.lookAt(
        ref.current.position.x + dx,
        ref.current.position.y + dy,
        ref.current.position.z + dz
      );
    }
  });

  const coreParts = useMemo(() => Array.from({length: 6}, () => ({
    pos: [(Math.random()-0.5)*0.15, (Math.random()-0.5)*0.15, (Math.random()-0.5)*0.15],
    s: 0.15 + Math.random()*0.15,
  })), []);

  return (
    <group ref={ref} position={position} scale={[scale, scale, scale]}>
      {/* Irregular Rocky Core */}
      <group>
        {coreParts.map((pt, i) => (
          <mesh key={i} position={pt.pos}>
            <sphereGeometry args={[pt.s, 4, 4]}/>
            <meshPhysicalMaterial color="#6a7d8c" roughness={0.95} metalness={0.5} clearcoat={0.15}/>
          </mesh>
        ))}
      </group>
      {/* Glowing Coma */}
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]}/>
        <meshPhysicalMaterial color="#88ccff" emissive="#3366ff" emissiveIntensity={3} transparent opacity={0.4} transmission={0.9}/>
      </mesh>
      <mesh ref={sparkGlow}>
        <sphereGeometry args={[0.5, 12, 12]}/>
        <meshPhysicalMaterial color="#cce6ff" transparent opacity={0.18} transmission={0.9} depthWrite={false}/>
      </mesh>
      {/* Comet Tail */}
      <Particles type="sparkle" position={[-0.4, 0, 0]} count={60} scale={0.7}/>
      <Particles type="water" position={[-0.6, 0, 0]} count={40} scale={0.5}/>
      <pointLight intensity={3} color="#44aaff" distance={6} decay={2}/>
    </group>
  );
}

function SolarSystem() {
  const asteroidRef = useRef();
  const sunGlow = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (asteroidRef.current) asteroidRef.current.rotation.y = t * 0.08;
    if (sunGlow.current) sunGlow.current.scale.setScalar(1.2 + Math.sin(t * 2) * 0.04);
  });

  const asteroids = useMemo(() => {
    const arr = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const r = 7.8 + Math.random() * 0.9;
      arr.push({
        x: Math.cos(angle) * r,
        y: (Math.random() - 0.5) * 0.18,
        z: Math.sin(angle) * r,
        s: 0.03 + Math.random() * 0.05,
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {/* Sun */}
      <mesh><sphereGeometry args={[1.2, 32, 32]}/><meshStandardMaterial color="#FFDD44" emissive="#FFAA00" emissiveIntensity={3.5}/></mesh>
      <mesh ref={sunGlow}><sphereGeometry args={[1.35, 24, 24]}/><meshPhysicalMaterial color="#FF8800" transparent opacity={0.25} transmission={0.9} depthWrite={false}/></mesh>
      <pointLight intensity={6} color="#FFEEAA" distance={25} decay={2}/>

      {/* Planets */}
      <Planet position={[0,0,0]} orbitRadius={2.3} orbitSpeed={1.2} color="#8c8c8c" scale={0.22}/>
      <Planet position={[0,0,0]} orbitRadius={3.5} orbitSpeed={0.8} color="#e3bb76" scale={0.34} hasAtmosphere/>
      <Planet position={[0,0,0]} orbitRadius={4.8} orbitSpeed={0.65} color="#2b82c9" scale={0.38} hasAtmosphere/>
      <Planet position={[0,0,0]} orbitRadius={6.2} orbitSpeed={0.5} color="#c1440e" scale={0.28}/>
      <Planet position={[0,0,0]} orbitRadius={9.8} orbitSpeed={0.28} color="#b07f35" scale={0.78} hasRings hasAtmosphere/>
      <Planet position={[0,0,0]} orbitRadius={12.5} orbitSpeed={0.18} color="#3584a3" scale={0.54} hasRings/>

      {/* Orbit Rings */}
      {[2.3, 3.5, 4.8, 6.2, 9.8, 12.5].map((r, i) => (
        <mesh key={i} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[r, 0.008, 2, 64]}/>
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} depthWrite={false}/>
        </mesh>
      ))}

      {/* Asteroid Belt */}
      <group ref={asteroidRef}>
        {asteroids.map((ast, i) => (
          <mesh key={i} position={[ast.x, ast.y, ast.z]}>
            <sphereGeometry args={[ast.s, 4, 3]}/>
            <meshPhysicalMaterial color="#6e5c4d" roughness={0.95}/>
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SeaweedStalk({ position = [0,-2,0], height = 1.8, segments = 5, color = '#1a5933' }) {
  const segRefs = useRef([]);
  segRefs.current = useMemo(() => Array.from({length: segments}, () => React.createRef()), [segments]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    segRefs.current.forEach((ref, idx) => {
      if (ref.current) {
        ref.current.rotation.z = Math.sin(t * 1.5 + idx * 0.4) * 0.12;
        ref.current.rotation.x = Math.cos(t * 1.2 + idx * 0.3) * 0.08;
      }
    });
  });

  const segLength = height / segments;
  const renderSegments = (idx) => {
    if (idx >= segments) return null;
    return (
      <group ref={segRefs.current[idx]} position={[0, idx === 0 ? 0 : segLength, 0]}>
        <mesh position={[0, segLength/2, 0]}>
          <cylinderGeometry args={[0.02 + (segments-idx)*0.015, 0.04 + (segments-idx)*0.015, segLength, 6]}/>
          <meshPhysicalMaterial color={color} roughness={0.8} clearcoat={0.1}/>
        </mesh>
        {renderSegments(idx + 1)}
      </group>
    );
  };

  return <group position={position}>{renderSegments(0)}</group>;
}

function Underwater() {
  const weeds = useMemo(() => [
    { pos: [-2.2,-2.1, 1.2], h: 1.6, segs: 5, col: '#1e663a' },
    { pos: [2.4,-2.1, -1.5], h: 2.2, segs: 6, col: '#165c32' },
    { pos: [0.8,-2.1, 2.5], h: 1.8, segs: 5, col: '#237341' },
    { pos: [-1.8,-2.1, -2.2], h: 1.4, segs: 4, col: '#2d8c52' },
    { pos: [-0.8,-2.1, -3.2], h: 2.0, segs: 6, col: '#1a5933' },
    { pos: [3.0,-2.1, 1.5], h: 1.7, segs: 5, col: '#1d6e3c' },
  ], []);

  return (
    <group>
      <ambientLight intensity={1.2} color="#0077dd"/>
      <directionalLight position={[0,8,0]} intensity={4.5} color="#33ddff"/>
      <OceanFloor/>
      
      {/* Main creatures */}
      <Shark position={[0, 0.2, 0]} scale={1.1}/>
      <Fish position={[1.5, -0.6, 1.2]} color="#ff6600" scale={0.7}/>
      <Fish position={[-2.0, 0.5, -1.5]} color="#ff4488" scale={0.65}/>
      <Fish position={[0.8, 0.8, -2.4]} color="#33ffbb" scale={0.55}/>
      <Fish position={[-1.2, -0.5, 2.0]} color="#ffee33" scale={0.6}/>
      <Fish position={[2.5, 0.2, -2.8]} color="#9944ff" scale={0.5}/>
      
      {/* Particles representing bubbles */}
      <Particles type="bubbles" position={[-1.5, -2, -1]} count={40} scale={0.9}/>
      <Particles type="bubbles" position={[1.8, -2, 1.5]} count={40} scale={0.9}/>
      
      {/* Animated seaweed */}
      {weeds.map((w, i) => (
        <SeaweedStalk key={i} position={w.pos} height={w.h} segments={w.segs} color={w.col}/>
      ))}

      {/* Decorative Corals */}
      {[[1.8,-2.1,-0.5, '#ff4466'], [-1.2,-2.1,1.0, '#ff9933'], [0.4,-2.1,-1.8, '#ff55cc'], [-2.5,-2.1,-0.5, '#ff4444']].map(([x,y,z,col], i) => (
        <group key={i} position={[x,y,z]}>
          <mesh position={[0,0.2,0]}><coneGeometry args={[0.06,0.4,5]}/><meshPhysicalMaterial color={col} roughness={0.8}/></mesh>
          <mesh position={[0.1,0.3,0.1]} rotation={[0.4,0,0.4]}><coneGeometry args={[0.04,0.3,5]}/><meshPhysicalMaterial color={col} roughness={0.8}/></mesh>
          <mesh position={[-0.1,0.25,-0.1]} rotation={[-0.4,0,-0.4]}><coneGeometry args={[0.04,0.3,5]}/><meshPhysicalMaterial color={col} roughness={0.8}/></mesh>
        </group>
      ))}
    </group>
  );
}

function ForestScene() {
  const trees = useMemo(() => Array.from({length: 9}, (_, i) => {
    const angle = (i / 9) * Math.PI * 2 + (Math.random()-0.5)*0.3;
    const r = 3.5 + Math.random()*2.2;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      h: 1.6 + Math.random()*1.4,
      r: 0.5 + Math.random()*0.4,
      c: ['#1c5e1c','#197019','#2d6621','#386638','#1b5c2a'][Math.floor(Math.random()*5)]
    };
  }), []);

  const fireflies = useMemo(() => Array.from({length: 15}, () => ({
    phase: Math.random() * Math.PI * 2,
    speed: 0.8 + Math.random() * 0.8,
    radius: 1.5 + Math.random() * 2,
    y: -1.2 + Math.random() * 1.5,
  })), []);

  const fflyRefs = useRef([]);
  fflyRefs.current = useMemo(() => Array.from({length: 15}, () => React.createRef()), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    fireflies.forEach((ff, idx) => {
      if (fflyRefs.current[idx].current) {
        const theta = t * ff.speed * 0.4 + ff.phase;
        const x = Math.cos(theta) * ff.radius + Math.sin(t*0.5)*0.2;
        const z = Math.sin(theta) * ff.radius + Math.cos(t*0.6)*0.2;
        const y = ff.y + Math.sin(t * 1.5 + ff.phase) * 0.25;
        fflyRefs.current[idx].current.position.set(x, y, z);
      }
    });
  });

  return (
    <group>
      <ambientLight intensity={1.0} color="#b0d0ff"/>
      <directionalLight position={[5,8,3]} intensity={3.5} color="#ffeed0"/>

      {/* Ground Meadow */}
      <mesh position={[0,-2.1,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[20,20]}/>
        <meshPhysicalMaterial color="#326622" roughness={0.95}/>
      </mesh>

      {/* Trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, -2.1, t.z]}>
          <mesh position={[0, t.h * 0.35, 0]}>
            <cylinderGeometry args={[0.08, 0.14, t.h * 0.7, 6]}/>
            <meshPhysicalMaterial color="#4f331b" roughness={0.9}/>
          </mesh>
          <mesh position={[0, t.h * 0.9, 0]}>
            <coneGeometry args={[t.r, t.h * 0.9, 6]}/>
            <meshPhysicalMaterial color={t.c} roughness={0.9} sheen={0.3}/>
          </mesh>
          <mesh position={[0, t.h * 1.3, 0]}>
            <coneGeometry args={[t.r * 0.8, t.h * 0.7, 6]}/>
            <meshPhysicalMaterial color={t.c} roughness={0.9} sheen={0.3}/>
          </mesh>
        </group>
      ))}

      {/* Campfire (Cozy forest center) */}
      <group position={[0, -2.0, 0]}>
        {[-0.2, 0, 0.2].map((x, i) => (
          <mesh key={i} position={[x, 0.05, (i%2===0?0.1:-0.1)]} rotation={[0, i*0.8, Math.PI/2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 6]}/>
            <meshPhysicalMaterial color="#2b1c10" roughness={0.95}/>
          </mesh>
        ))}
        {/* Fire Glow / Emitters */}
        <Particles type="fire" position={[0, 0.1, 0]} count={40} scale={0.7}/>
        <pointLight position={[0, 0.3, 0]} intensity={12.0} color="#ff6600" distance={5} decay={2}/>
      </group>

      {/* Fireflies */}
      {fireflies.map((ff, i) => (
        <group key={i} ref={fflyRefs.current[i]}>
          <mesh>
            <sphereGeometry args={[0.035, 6, 6]}/>
            <meshPhysicalMaterial color="#ddff66" emissive="#bbff33" emissiveIntensity={3} transmission={0.9}/>
          </mesh>
          <pointLight intensity={1.2} color="#ccff55" distance={1.2}/>
        </group>
      ))}

      {/* Fauna */}
      <Eagle position={[0, 1.2, 0]} scale={0.75}/>
      <Butterfly position={[1.2, -0.6, 0.8]} color="#ff55cc" scale={0.55}/>
      <Butterfly position={[-1.5, -0.3, -0.8]} color="#55ffcc" scale={0.5}/>
      <Butterfly position={[0.5, -0.5, -1.8]} color="#ffee44" scale={0.45}/>
    </group>
  );
}

function SpaceFighter({ position = [0,0,0], team = 'red', scale = 1 }) {
  const ref = useRef();
  const laserRef = useRef();
  const side = team === 'red' ? 1 : -1;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      const angle = t * 0.4 * side + (side * Math.PI / 2);
      ref.current.position.set(
        position[0] + Math.cos(angle) * 3.5,
        position[1] + Math.sin(t * 0.8) * 0.7,
        position[2] + Math.sin(angle) * 2.5
      );
      const tangentX = -Math.sin(angle) * 3.5 * side;
      const tangentZ = Math.cos(angle) * 2.5 * side;
      ref.current.rotation.y = Math.atan2(tangentX, tangentZ);
      ref.current.rotation.z = Math.sin(t * 1.5) * 0.25 * side;
    }
    if (laserRef.current) {
      const pulse = (t * 3.5) % 1.0;
      laserRef.current.position.z = 0.5 + pulse * 4.0;
      laserRef.current.scale.setScalar(pulse < 0.85 ? 1.0 : 0.0);
    }
  });

  const bodyCol = team === 'red' ? '#cf2e2e' : '#326ecf';
  const laserCol = team === 'red' ? '#ff3333' : '#33ff33';
  const detailCol = '#a1a8b5';

  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      {/* Ship Hull */}
      <mesh><boxGeometry args={[0.18, 0.08, 0.65]}/><meshPhysicalMaterial color={bodyCol} metalness={0.8} roughness={0.2} clearcoat={0.6}/></mesh>
      {/* Cockpit Canopy */}
      <mesh position={[0, 0.06, 0.12]}><boxGeometry args={[0.08, 0.06, 0.18]}/><meshPhysicalMaterial color="#88ccff" transparent opacity={0.6} transmission={0.9} thickness={0.1}/></mesh>
      {/* Left Wing */}
      <mesh position={[0.2, -0.02, -0.05]} rotation={[0,0.1,-0.2]}><boxGeometry args={[0.3, 0.02, 0.28]}/><meshPhysicalMaterial color={bodyCol} metalness={0.8} roughness={0.2}/></mesh>
      {/* Right Wing */}
      <mesh position={[-0.2, -0.02, -0.05]} rotation={[0,-0.1,0.2]}><boxGeometry args={[0.3, 0.02, 0.28]}/><meshPhysicalMaterial color={bodyCol} metalness={0.8} roughness={0.2}/></mesh>
      {/* Tail Fin */}
      <mesh position={[0, 0.08, -0.22]} rotation={[-0.2,0,0]}><boxGeometry args={[0.02, 0.16, 0.15]}/><meshPhysicalMaterial color={bodyCol}/></mesh>
      {/* Thruster exhaust flame */}
      <mesh position={[0,0,-0.36]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[0.06, 0.22, 6]}/><meshStandardMaterial color="#ffa834" emissive="#ff6600" emissiveIntensity={3.5}/></mesh>
      
      {/* Laser barrels */}
      <mesh position={[0.08, -0.03, 0.28]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.015, 0.015, 0.2, 5]}/><meshPhysicalMaterial color={detailCol} metalness={0.9} roughness={0.1}/></mesh>
      <mesh position={[-0.08, -0.03, 0.28]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.015, 0.015, 0.2, 5]}/><meshPhysicalMaterial color={detailCol} metalness={0.9} roughness={0.1}/></mesh>

      {/* Laser beams */}
      <group ref={laserRef}>
        <mesh position={[0.08, -0.03, 0]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.6, 4]}/>
          <meshStandardMaterial color={laserCol} emissive={laserCol} emissiveIntensity={6}/>
        </mesh>
        <mesh position={[-0.08, -0.03, 0]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.6, 4]}/>
          <meshStandardMaterial color={laserCol} emissive={laserCol} emissiveIntensity={6}/>
        </mesh>
      </group>
    </group>
  );
}

function SpaceBattle() {
  const stationRef = useRef();
  useFrame(({ clock }) => {
    if (stationRef.current) stationRef.current.rotation.y = clock.elapsedTime * 0.04;
  });

  return (
    <group>
      <ambientLight intensity={0.9}/>
      <pointLight position={[6,4,0]} intensity={14.0} color="#ff33aa" distance={15} decay={2}/>
      <pointLight position={[-6,-4,0]} intensity={14.0} color="#33aaff" distance={15} decay={2}/>

      {/* Space Station / Base */}
      <group ref={stationRef} position={[0,0,-1]}>
        <mesh><cylinderGeometry args={[0.65, 0.65, 1.8, 16]}/><meshPhysicalMaterial color="#adbcc7" metalness={0.9} roughness={0.15} clearcoat={0.6}/></mesh>
        {/* Solar Panels */}
        {[-0.6, 0, 0.6].map((y, i) => (
          <group key={i} position={[0, y, 0]}>
            <mesh position={[1.4, 0, 0]}><boxGeometry args={[1.5, 0.02, 0.35]}/><meshPhysicalMaterial color="#0055bb" metalness={0.9} roughness={0.1}/></mesh>
            <mesh position={[-1.4, 0, 0]}><boxGeometry args={[1.5, 0.02, 0.35]}/><meshPhysicalMaterial color="#0055bb" metalness={0.9} roughness={0.1}/></mesh>
            <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.04, 0.04, 3.2, 8]}/><meshPhysicalMaterial color="#555" metalness={0.9} roughness={0.1}/></mesh>
          </group>
        ))}
        {/* Docking ring */}
        <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.1, 0.07, 6, 24]}/><meshPhysicalMaterial color="#7a8c99" metalness={0.8} roughness={0.2}/></mesh>
      </group>

      <SpaceFighter position={[0, 0.5, 0]} team="red" scale={1.0}/>
      <SpaceFighter position={[0.5, -0.5, -0.5]} team="blue" scale={0.95}/>

      <Comet position={[-3, 2, -2]} scale={0.6}/>
      <Particles type="electric" position={[1.5,1,1.5]} count={40} scale={0.6}/>
      <Particles type="smoke" position={[-2,-1,-2]} count={30} scale={0.7}/>
    </group>
  );
}

function Snowstorm() {
  const streetLampRef = useRef();
  useFrame(({ clock }) => {
    if (streetLampRef.current) streetLampRef.current.intensity = 5.0 + Math.sin(clock.elapsedTime * 6) * 0.25;
  });

  return (
    <group>
      {/* Snow ground */}
      <mesh position={[0,-2.3,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[20,20]}/>
        <meshPhysicalMaterial color="#eaeff5" roughness={0.95}/>
      </mesh>
      {/* Extra snow drifts */}
      {[[-2,-2.25,1], [1.5,-2.25,-2.2], [-1.2,-2.25,-1.8], [2.2,-2.25,1.5]].map(([x,y,z], i) => (
        <mesh key={i} position={[x,y,z]}>
          <sphereGeometry args={[0.4 + i*0.1, 8, 8]}/>
          <meshPhysicalMaterial color="#f0f5fa" roughness={0.9}/>
        </mesh>
      ))}

      {/* Heavy Snow particles */}
      <Particles type="snow" position={[0,3,0]} count={180} scale={2.2}/>

      {/* Snowman */}
      <group position={[-1.2,-2.1,-0.5]}>
        <mesh position={[0,0.4,0]}><sphereGeometry args={[0.52,16,16]}/><meshPhysicalMaterial color="#ffffff" roughness={0.85}/></mesh>
        <mesh position={[0,1.1,0]}><sphereGeometry args={[0.38,16,16]}/><meshPhysicalMaterial color="#ffffff" roughness={0.85}/></mesh>
        <mesh position={[0,1.6,0]}><sphereGeometry args={[0.26,16,16]}/><meshPhysicalMaterial color="#ffffff" roughness={0.85}/></mesh>
        {/* Buttons */}
        {[1.2, 1.0, 0.5, 0.35].map((y, i) => (
          <mesh key={i} position={[0, y, 0.24 + (1.6-y)*0.05]}><sphereGeometry args={[0.035,6,6]}/><meshStandardMaterial color="#222"/></mesh>
        ))}
        {/* Carrot nose */}
        <mesh position={[0,1.6,0.24]} rotation={[0.2,0,0]}><coneGeometry args={[0.035,0.22,6]}/><meshPhysicalMaterial color="#ff7300" roughness={0.6}/></mesh>
        {/* Coal Eyes */}
        <mesh position={[0.08,1.68,0.22]}><sphereGeometry args={[0.03,6,6]}/><meshStandardMaterial color="#222"/></mesh>
        <mesh position={[-0.08,1.68,0.22]}><sphereGeometry args={[0.03,6,6]}/><meshStandardMaterial color="#222"/></mesh>
        {/* Top Hat */}
        <group position={[0, 1.8, 0]} rotation={[0.05, 0, -0.05]}>
          <mesh position={[0,0,0]}><cylinderGeometry args={[0.34, 0.34, 0.02, 12]}/><meshPhysicalMaterial color="#1f1f1f" metalness={0.5} roughness={0.5}/></mesh>
          <mesh position={[0,0.2,0]}><cylinderGeometry args={[0.22, 0.22, 0.4, 12]}/><meshPhysicalMaterial color="#1f1f1f" metalness={0.5} roughness={0.5}/></mesh>
          <mesh position={[0,0.06,0]}><cylinderGeometry args={[0.23, 0.23, 0.04, 12]}/><meshStandardMaterial color="#cc1111"/></mesh>
        </group>
        {/* Twig Arms */}
        <mesh position={[0.42, 1.1, 0]} rotation={[0, 0.2, -0.6]}><cylinderGeometry args={[0.018, 0.018, 0.7, 6]}/><meshPhysicalMaterial color="#4f331b" roughness={0.95}/></mesh>
        <mesh position={[-0.42, 1.1, 0]} rotation={[0, -0.2, 0.6]}><cylinderGeometry args={[0.018, 0.018, 0.7, 6]}/><meshPhysicalMaterial color="#4f331b" roughness={0.95}/></mesh>
      </group>

      {/* Cozy Street Lamp */}
      <group position={[1.5,-2.3,-0.5]}>
        <mesh position={[0,1.6,0]}><cylinderGeometry args={[0.05,0.08,3.2,8]}/><meshPhysicalMaterial color="#1c2024" metalness={0.8} roughness={0.3}/></mesh>
        <mesh position={[0,3.28,0]}><cylinderGeometry args={[0.16,0.1,0.2,6]}/><meshPhysicalMaterial color="#1c2024" metalness={0.8} roughness={0.3}/></mesh>
        <mesh position={[0,3.42,0]}><coneGeometry args={[0.18,0.16,6]}/><meshPhysicalMaterial color="#1c2024" metalness={0.8} roughness={0.3}/></mesh>
        <mesh position={[0,3.16,0]}><cylinderGeometry args={[0.1,0.14,0.3,6]}/><meshPhysicalMaterial color="#ffeaa7" transparent opacity={0.4} transmission={0.9} thickness={0.1}/></mesh>
        <mesh position={[0,3.16,0]}><sphereGeometry args={[0.06,8,8]}/><meshStandardMaterial color="#fff" emissive="#ffdd77" emissiveIntensity={3.5}/></mesh>
        <pointLight ref={streetLampRef} position={[0,3.0,0]} intensity={6.5} color="#ffdd77" distance={8} decay={2}/>
      </group>

      {/* Pine Trees */}
      {[[2.5,-2.2,-2.5, 1.5], [-2.5,-2.2,-2.8, 1.8]].map(([x,y,z,h], i) => (
        <group key={i} position={[x,y,z]}>
          <mesh position={[0, h*0.25, 0]}><cylinderGeometry args={[0.07,0.11,h*0.5,6]}/><meshPhysicalMaterial color="#332015" roughness={0.95}/></mesh>
          <mesh position={[0, h*0.65, 0]}><coneGeometry args={[0.6,h*0.6,6]}/><meshPhysicalMaterial color="#2d5236" roughness={0.9}/></mesh>
          <mesh position={[0, h*0.65 + 0.05, 0]} scale={[1.05,1,1.05]}><coneGeometry args={[0.6,0.1,6]}/><meshPhysicalMaterial color="#eaeff5" roughness={0.9}/></mesh>
          <mesh position={[0, h*1.0, 0]}><coneGeometry args={[0.45,h*0.5,6]}/><meshPhysicalMaterial color="#2d5236" roughness={0.9}/></mesh>
          <mesh position={[0, h*1.0 + 0.04, 0]} scale={[1.05,1,1.05]}><coneGeometry args={[0.45,0.08,6]}/><meshPhysicalMaterial color="#eaeff5" roughness={0.9}/></mesh>
        </group>
      ))}
    </group>
  );
}

function RainforestWaterfall() {
  const waterFlowRef = useRef();
  useFrame(({ clock }) => {
    if (waterFlowRef.current) {
      waterFlowRef.current.position.y = 0.5 - (clock.elapsedTime * 0.6 % 1.2);
    }
  });

  return (
    <group>
      {/* Ground Meadow */}
      <mesh position={[0,-2.3,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[20,20]}/>
        <meshPhysicalMaterial color="#1c4718" roughness={0.95}/>
      </mesh>

      {/* Rocky Cliff */}
      <group position={[0, -0.2, -2.8]}>
        <mesh><boxGeometry args={[4.2, 4.2, 1.2]}/><meshPhysicalMaterial color="#3f3833" roughness={0.95}/></mesh>
        {/* Moss top */}
        <mesh position={[0, 2.12, 0.1]}><boxGeometry args={[4.2, 0.06, 1.2]}/><meshPhysicalMaterial color="#226e1f" roughness={0.9}/></mesh>
        {/* Rocky ledges */}
        <mesh position={[2.0, -0.4, 0.4]}><boxGeometry args={[0.8, 1.5, 0.8]}/><meshPhysicalMaterial color="#352f2b" roughness={0.95}/></mesh>
        <mesh position={[-2.0, -0.2, 0.4]}><boxGeometry args={[0.8, 1.8, 0.8]}/><meshPhysicalMaterial color="#352f2b" roughness={0.95}/></mesh>
      </group>

      {/* Waterfall stream */}
      <group position={[0, 0, -2.15]}>
        <mesh>
          <planeGeometry args={[1.5, 3.8]}/>
          <meshPhysicalMaterial color="#47a0ff" emissive="#114fa8" emissiveIntensity={1.5} transparent opacity={0.7} side={THREE.DoubleSide} transmission={0.5} thickness={0.5}/>
        </mesh>
        <mesh ref={waterFlowRef} position={[0, 0, 0.01]}>
          <planeGeometry args={[1.4, 1.0]}/>
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide}/>
        </mesh>
      </group>

      {/* Waterfall Pool */}
      <mesh position={[0, -2.1, -1.8]}>
        <cylinderGeometry args={[1.2, 1.2, 0.12, 20]}/>
        <meshPhysicalMaterial color="#0e3d7a" transparent opacity={0.8} roughness={0.1} transmission={0.6}/>
      </mesh>

      {/* Splash Mist */}
      <Particles type="water" position={[0, -1.9, -1.8]} count={100} scale={1.0}/>
      <Particles type="bubbles" position={[0, -1.9, -1.6]} count={40} scale={0.7}/>
      
      {/* Rainforest Trees */}
      {[[2.5,-2.2,-1.5, 2.2], [-2.5,-2.2,-1.5, 1.8], [3.2,-2.2,1.2, 2.0], [-2.8,-2.2,1.5, 1.7]].map(([x,y,z,h], i) => (
        <group key={i} position={[x,y,z]}>
          <mesh position={[0, h*0.35, 0]}><cylinderGeometry args={[0.07,0.12,h*0.7,6]}/><meshPhysicalMaterial color="#402a1d" roughness={0.95}/></mesh>
          <mesh position={[0, h, 0]}><sphereGeometry args={[0.6,12,12]}/><meshPhysicalMaterial color="#1a6e2e" roughness={0.85}/></mesh>
          <mesh position={[0.2, h*1.3, -0.1]}><sphereGeometry args={[0.45,10,10]}/><meshPhysicalMaterial color="#125923" roughness={0.85}/></mesh>
          <mesh position={[-0.2, h*1.2, 0.1]}><sphereGeometry args={[0.45,10,10]}/><meshPhysicalMaterial color="#125923" roughness={0.85}/></mesh>
        </group>
      ))}

      {/* Wildlife */}
      <Butterfly position={[1.2, 0.2, 0.5]} color="#ffdd33" scale={0.55}/>
      <Butterfly position={[-1.6, -0.2, 0.8]} color="#33ffaa" scale={0.5}/>
      <Eagle position={[-0.5, 1.2, 0]} scale={0.7}/>
    </group>
  );
}

// ── SCENE REGISTRY ────────────────────────────────────────────────────────

const DYNAMIC_SCENES = {
  shark:        { render: () => <><Shark position={[0,0,0]} scale={1.5}/><OceanFloor/><Particles type="bubbles" position={[0,-1,0]} count={40}/></>,         env:'#001a33', cam:[0,0,10], label:'🦈 Shark Swimming'      },
  butterfly:    { render: () => <><Butterfly position={[0,0,0]} color="#FF88CC" scale={1.2}/><Butterfly position={[2,0.3,-1]} color="#88FFCC" scale={0.9}/><Butterfly position={[-1.5,0.5,1]} color="#FFFF88" scale={0.8}/></>,                                   env:'#09170f', cam:[0,0,8], label:'🦋 Butterflies'          },
  eagle:        { render: () => <><Eagle position={[0,0,0]} scale={1.5}/><Stars radius={50} depth={20} count={1000} factor={2} fade/></>,                   env:'#87CEEB', cam:[0,0,9], label:'🦅 Soaring Eagle'        },
  fish:         { render: () => <Underwater/>,                                                                                                              env:'#001a33', cam:[0,0,10], label:'🐠 Underwater World'     },
  underwater:   { render: () => <Underwater/>,                                                                                                              env:'#001a33', cam:[0,0,10], label:'🌊 Underwater World'     },
  volcano:      { render: () => <VolcanoIsland/>,                                                                                                           env:'#1a0a00', cam:[0,2,12], label:'🌋 Volcano Eruption'     },
  solarsystem:  { render: () => <SolarSystem/>,                                                                                                             env:'#000005', cam:[0,5,18], label:'🪐 Solar System'         },
  solar:        { render: () => <SolarSystem/>,                                                                                                             env:'#000005', cam:[0,5,18], label:'🪐 Solar System'         },
  comet:        { render: () => <><Comet position={[0,0,0]} scale={1.2}/><Stars radius={100} depth={50} count={3000} factor={4} fade/></>,                  env:'#000010', cam:[0,0,10], label:'☄️ Comet'               },
  forest:       { render: () => <ForestScene/>,                                                                                                             env:'#051705', cam:[0,2,12], label:'🌲 Forest'               },
  spaceship:    { render: () => <SpaceBattle/>,                                                                                                             env:'#000005', cam:[0,0,12], label:'🚀 Space Scene'          },
  space:        { render: () => <SpaceBattle/>,                                                                                                             env:'#000005', cam:[0,0,12], label:'🚀 Space Scene'          },
  snow:         { render: () => <Snowstorm/>,                                                                                                               env:'#08101f', cam:[0,0,10], label:'❄️ Snowstorm'            },
  snowman:      { render: () => <Snowstorm/>,                                                                                                               env:'#08101f', cam:[0,0,10], label:'⛄ Snow Scene'           },
  waterfall:    { render: () => <RainforestWaterfall/>,                                                                                                     env:'#09170f', cam:[0,1,12], label:'💦 Rainforest Waterfall' },
  rainforest:   { render: () => <RainforestWaterfall/>,                                                                                                     env:'#09170f', cam:[0,1,12], label:'🌴 Rainforest'           },
  planet:       { render: () => <><Planet position={[0,0,0]} color="#2244FF" scale={1.5} hasAtmosphere hasRings/><Comet position={[2,1,-1]} scale={0.5}/><Stars radius={100} depth={50} count={3000} factor={4} fade/></>,   env:'#000008', cam:[0,2,9], label:'🪐 Planet'  },
};

// ── SMART KEYWORD MAPPER ─────────────────────────────────────────────────
const KEYWORD_MAP = {
  // Ocean / Water creatures
  shark:'shark', whale:'underwater', dolphin:'underwater', octopus:'underwater',
  jellyfish:'underwater', crab:'underwater', turtle:'underwater', seahorse:'underwater',
  coral:'underwater', ocean:'underwater', sea:'underwater', marine:'underwater',
  aquatic:'underwater', mermaid:'underwater', submarine:'underwater', diver:'underwater',
  fish:'fish', clownfish:'fish', nemo:'fish', piranha:'fish', tuna:'fish',
  // Birds / Air
  eagle:'eagle', hawk:'eagle', falcon:'eagle', vulture:'eagle', condor:'eagle',
  bird:'eagle', parrot:'eagle', owl:'eagle', hummingbird:'butterfly',
  butterfly:'butterfly', dragonfly:'butterfly', bee:'butterfly', insect:'butterfly',
  // Land animals
  tiger:'volcano', lion:'volcano', wolf:'forest', bear:'forest', deer:'forest',
  fox:'forest', rabbit:'forest', squirrel:'forest', horse:'forest',
  elephant:'forest', giraffe:'forest', zebra:'forest',
  // Reptiles / Fantasy
  snake:'underwater', crocodile:'underwater', alligator:'underwater',
  frog:'rainforest', lizard:'rainforest', chameleon:'rainforest',
  // Space
  planet:'planet', saturn:'planet', jupiter:'planet', mars:'planet', earth:'planet',
  moon:'planet', asteroid:'comet', meteorite:'comet', comet:'comet',
  solarsystem:'solarsystem', solar:'solarsystem', universe:'solarsystem',
  nebula:'space', galaxy:'space', milkyway:'space', cosmos:'space',
  alien:'space', ufo:'space', spaceship:'space', spacecraft:'space',
  satellite:'space', station:'space', astronaut:'space', star:'space',
  // Fire / Nature events
  volcano:'volcano', lava:'volcano', eruption:'volcano', magma:'volcano',
  fire:'volcano', explosion:'volcano', wildfire:'forest',
  tornado:'snow', cyclone:'snow', hurricane:'snow', storm:'snow',
  lightning:'space', thunder:'snow',
  // Winter
  snow:'snow', snowman:'snowman', blizzard:'snow', ice:'snow',
  winter:'snow', frost:'snow', tundra:'snow', arctic:'snow',
  // Forest / Nature
  forest:'forest', rainforest:'rainforest',
  tree:'forest', woods:'forest', nature:'forest', meadow:'forest',
  mountain:'volcano', hill:'forest', valley:'forest', cliff:'volcano',
  cave:'volcano', canyon:'volcano',
  // Water
  waterfall:'waterfall', river:'waterfall', lake:'underwater', pond:'underwater',
  stream:'waterfall', water:'waterfall', rain:'waterfall',
  // Vehicles / Tech
  car:'space', truck:'space', plane:'eagle', airplane:'eagle', jet:'eagle',
  helicopter:'eagle', rocket:'space', spacerocket:'space', drone:'eagle',
  // Fantasy
  unicorn:'butterfly', pegasus:'eagle', fairy:'butterfly', elf:'forest',
  dwarf:'volcano', wizard:'space', magic:'space',
  // Misc
  rainbow:'butterfly', cloud:'eagle', sky:'eagle', wind:'snow',
  desert:'volcano', beach:'underwater', island:'volcano', tropical:'rainforest',
  swamp:'underwater',
};

function resolveScene(input) {
  const key = input.toLowerCase().replace(/[^a-z]/g, '');
  if (DYNAMIC_SCENES[key]) return key;
  if (KEYWORD_MAP[key]) return KEYWORD_MAP[key];
  for (const [word, scene] of Object.entries(KEYWORD_MAP)) {
    if (key.includes(word) || word.includes(key)) return scene;
  }
  return 'shark';
}

export default function DynamicAnimatedScene({ scene = 'shark', label }) {
  const key = resolveScene(scene);
  const config = DYNAMIC_SCENES[key] || DYNAMIC_SCENES.shark;
  const displayLabel = label || config.label;
  const SceneRender = config.render;

  return (
    <div style={{
      width: '100%', height: '480px', background: config.env,
      border: '1px solid rgba(0,242,254,0.12)', borderRadius: '16px',
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.5)',
      margin: '20px 0',
    }}>
      <div style={{ position:'absolute', top:'12px', left:'12px', zIndex:10,
        background:'rgba(0,0,0,0.75)', padding:'5px 14px', borderRadius:'8px',
        border:'1px solid rgba(255,255,255,0.15)', fontSize:'0.85rem',
        fontWeight:'bold', color:'#fff', fontFamily:'Inter, sans-serif', backdropFilter:'blur(8px)' }}>
        {displayLabel}
      </div>
      <div style={{ position:'absolute', bottom:'12px', right:'15px',
        fontSize:'11px', color:'rgba(255,255,255,0.5)', pointerEvents:'none',
        fontFamily:'Inter, sans-serif', background:'rgba(0,0,0,0.4)',
        padding:'2px 8px', borderRadius:'4px', zIndex:10 }}>
        🖱️ Drag to rotate | Scroll to zoom
      </div>
      <Canvas camera={{ position: config.cam, fov: 50 }} shadows>
        <color attach="background" args={[config.env]} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[5, 8, 5]} intensity={2.5} castShadow />
        <directionalLight position={[-5, 5, -5]} intensity={1.2} />
        <Stars radius={100} depth={50} count={2000} factor={3} fade />
        {SceneRender()}
        <OrbitControls enableZoom maxDistance={25} minDistance={3} enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}

function VolcanoIsland() {
  return (
    <group>
      <mesh position={[0,-2.5,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[7,32]}/>
        <meshPhysicalMaterial color="#001830" roughness={0.3} metalness={0.2}/>
      </mesh>
      <mesh position={[0,-2,0]}>
        <cylinderGeometry args={[3.2,3.8,0.8,20]}/>
        <meshPhysicalMaterial color="#cfa076" roughness={0.8}/>
      </mesh>
      <mesh position={[0,-1.6,0]}>
        <cylinderGeometry args={[2.5,3.0,0.8,16]}/>
        <meshPhysicalMaterial color="#423930" roughness={0.95}/>
      </mesh>
      <Volcano position={[0,-1.2,0]} scale={1.2}/>
      <Particles type="lava" position={[1.8,-1.5,0.5]} count={30} scale={0.6}/>
      <Particles type="lava" position={[-1.5,-1.5,-1.2]} count={30} scale={0.6}/>
    </group>
  );
}

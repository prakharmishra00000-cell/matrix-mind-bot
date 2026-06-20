import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ── PARTICLE SYSTEMS ──────────────────────────────────────────────────────

function Particles({ type = 'fire', position = [0,0,0], count = 60, scale = 1 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const configs = {
    fire:     { c1:'#FF4500', c2:'#FFD700', spread: 0.3*scale, rise: 2*scale, emit: 2 },
    smoke:    { c1:'#888888', c2:'#555555', spread: 0.6*scale, rise: 1.5*scale, emit: 0.4 },
    sparkle:  { c1:'#FFFFFF', c2:'#FFFF88', spread: 1.5*scale, rise: 0.5*scale, emit: 1 },
    bubbles:  { c1:'#88CCFF', c2:'#AADDFF', spread: 0.4*scale, rise: 2*scale, emit: 0.6 },
    rain:     { c1:'#88AACC', c2:'#6688AA', spread: 2*scale, rise: -3*scale, emit: 3 },
    snow:     { c1:'#FFFFFF', c2:'#EEEEFF', spread: 1.5*scale, rise: -1*scale, emit: 0.5 },
    lava:     { c1:'#FF2200', c2:'#FF8800', spread: 0.8*scale, rise: 1.5*scale, emit: 1.2 },
    magic:    { c1:'#AA44FF', c2:'#FF44CC', spread: 1*scale,   rise: 1.5*scale, emit: 1 },
    electric: { c1:'#44FFFF', c2:'#FFFFFF', spread: 0.5*scale, rise: 2*scale,   emit: 3 },
    water:    { c1:'#2266FF', c2:'#44AAFF', spread: 1*scale,   rise: 0.8*scale, emit: 0.8 },
  };

  const cfg = configs[type] || configs.fire;

  const particles = useMemo(() => Array.from({ length: count }, () => ({
    offset: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random(),
    sx: (Math.random() - 0.5) * cfg.spread,
    sz: (Math.random() - 0.5) * cfg.spread,
    size: 0.04 + Math.random() * 0.1,
  })), [count, type]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    particles.forEach((p, i) => {
      const life = ((t * p.speed * cfg.emit * 0.5 + p.offset) % 1);
      const y = cfg.rise > 0 ? life * cfg.rise : (1-life) * Math.abs(cfg.rise);
      dummy.position.set(
        position[0] + p.sx * (1 + life),
        position[1] + y,
        position[2] + p.sz * (1 + life)
      );
      const s = p.size * (1 - life) * 1.5;
      dummy.scale.set(s,s,s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshStandardMaterial color={cfg.c1} emissive={cfg.c2} emissiveIntensity={2} transparent opacity={0.8} />
    </instancedMesh>
  );
}

// ── WAVE OCEAN ────────────────────────────────────────────────────────────
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
      <meshStandardMaterial color="#005580" transparent opacity={0.7} wireframe={false} />
    </mesh>
  );
}

// ── ANIMATED OBJECTS ─────────────────────────────────────────────────────

// Generic floater with customizable shape
function FloatObject({ children, speed = 1, amplitude = 0.4, rotSpeed = 0.5, yOffset = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = yOffset + Math.sin(t * speed) * amplitude;
    ref.current.rotation.y += 0.01 * rotSpeed;
    ref.current.rotation.z = Math.sin(t * speed * 0.7) * 0.08;
  });
  return <group ref={ref}>{children}</group>;
}

// ── SPECIFIC OBJECT BUILDERS ──────────────────────────────────────────────

function Shark({ position = [0,0,0], scale = 1 }) {
  const ref = useRef();
  const tailRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = position[0] + Math.sin(t * 0.6) * 2;
      ref.current.position.y = position[1] + Math.sin(t * 0.4) * 0.3;
      ref.current.position.z = position[2] + Math.cos(t * 0.5) * 1.5;
      ref.current.rotation.y = Math.atan2(Math.cos(t * 0.6) * 2, Math.cos(t * 0.5) * 1.5) + Math.PI / 2;
    }
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 4) * 0.5;
  });
  const s = scale;
  return (
    <group ref={ref} scale={[s,s,s]}>
      <mesh><capsuleGeometry args={[0.3,1.2,6,12]}/><meshStandardMaterial color="#607080" roughness={0.6}/></mesh>
      <mesh position={[0.8,0,0]}><coneGeometry args={[0.3,0.6,8]} rotation={[0,0,-Math.PI/2]}/><meshStandardMaterial color="#607080"/></mesh>
      <mesh position={[0,0.35,0]} rotation={[0,0,-0.3]}><boxGeometry args={[0.6,0.04,0.5]}/><meshStandardMaterial color="#607080"/></mesh>
      <mesh position={[0,0,0.32]} rotation={[0.4,0,0]}><boxGeometry args={[0.4,0.04,0.4]}/><meshStandardMaterial color="#607080"/></mesh>
      <mesh position={[0,0,-0.32]} rotation={[-0.4,0,0]}><boxGeometry args={[0.4,0.04,0.4]}/><meshStandardMaterial color="#607080"/></mesh>
      <mesh position={[0.15,0,0]}><sphereGeometry args={[0.05,8,8]}/><meshStandardMaterial color="#111" emissive="#222" emissiveIntensity={1}/></mesh>
      <group ref={tailRef} position={[-0.7,0,0]}>
        <mesh rotation={[0,0,0.5]}><boxGeometry args={[0.5,0.04,0.55]}/><meshStandardMaterial color="#607080"/></mesh>
        <mesh rotation={[0,0,-0.5]}><boxGeometry args={[0.5,0.04,0.55]}/><meshStandardMaterial color="#607080"/></mesh>
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
      bodyRef.current.position.x = position[0] + Math.sin(t * 0.8) * 1.5;
      bodyRef.current.position.y = position[1] + Math.sin(t * 1.2) * 0.5 + 0.5;
      bodyRef.current.position.z = position[2] + Math.cos(t * 0.6) * 1.0;
      bodyRef.current.rotation.y = Math.atan2(Math.cos(t * 0.8) * 1.5, Math.cos(t * 0.6)) + Math.PI;
    }
    const flap = Math.abs(Math.sin(t * 8)) * 1.1;
    if (wingLRef.current) wingLRef.current.rotation.y = flap;
    if (wingRRef.current) wingRRef.current.rotation.y = -flap;
  });
  const s = scale;
  return (
    <group ref={bodyRef} scale={[s,s,s]}>
      <mesh><capsuleGeometry args={[0.06, 0.4, 6, 8]}/><meshStandardMaterial color="#553300"/></mesh>
      <group ref={wingLRef} position={[0, 0.1, 0.05]}>
        <mesh rotation={[0, 0.3, 0]}><boxGeometry args={[0.05, 0.55, 0.7]}/><meshStandardMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide}/></mesh>
        <mesh position={[0, -0.2, 0.2]} rotation={[0, 0.2, 0]}><boxGeometry args={[0.05, 0.35, 0.45]}/><meshStandardMaterial color={color} transparent opacity={0.75} side={THREE.DoubleSide}/></mesh>
      </group>
      <group ref={wingRRef} position={[0, 0.1, -0.05]}>
        <mesh rotation={[0, -0.3, 0]}><boxGeometry args={[0.05, 0.55, 0.7]}/><meshStandardMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide}/></mesh>
        <mesh position={[0, -0.2, -0.2]} rotation={[0, -0.2, 0]}><boxGeometry args={[0.05, 0.35, 0.45]}/><meshStandardMaterial color={color} transparent opacity={0.75} side={THREE.DoubleSide}/></mesh>
      </group>
      <mesh position={[0.25, 0.2, 0]}><sphereGeometry args={[0.08, 8, 8]}/><meshStandardMaterial color="#553300"/></mesh>
    </group>
  );
}

function Volcano({ position = [0,0,0], scale = 1 }) {
  const s = scale;
  return (
    <group position={position} scale={[s,s,s]}>
      <mesh position={[0,-0.5,0]}><coneGeometry args={[2.5, 3, 16]}/><meshStandardMaterial color="#554433" roughness={0.9}/></mesh>
      <mesh position={[0,-0.2,0]}><coneGeometry args={[1.8, 2.5, 16]}/><meshStandardMaterial color="#443322" roughness={1}/></mesh>
      <pointLight position={[0, 1, 0]} intensity={5} color="#FF4400" distance={6} decay={2}/>
      <Particles type="fire" position={[0, 1.2, 0]} count={100} scale={1.2}/>
      <Particles type="smoke" position={[0, 2, 0]} count={30} scale={1.5}/>
      <Particles type="lava" position={[0.3, 0.8, 0.3]} count={40} scale={0.8}/>
      <Particles type="lava" position={[-0.3, 0.8, -0.2]} count={40} scale={0.8}/>
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
      ref.current.position.x = position[0] + Math.sin(t * 0.7) * 2;
      ref.current.position.y = position[1] + Math.sin(t * 0.5) * 0.4;
      ref.current.position.z = position[2] + Math.cos(t * 0.4) * 1.5;
      ref.current.rotation.y = Math.atan2(Math.cos(t * 0.7) * 2, Math.cos(t * 0.4) * 1.5) + Math.PI / 2;
    }
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 5) * 0.5;
  });
  const s = scale;
  return (
    <group ref={ref} scale={[s,s,s]}>
      <mesh><capsuleGeometry args={[0.15, 0.5, 6, 10]}/><meshStandardMaterial color={color} roughness={0.4}/></mesh>
      <group ref={tailRef} position={[-0.35, 0, 0]}>
        <mesh rotation={[0,0,0.4]}><coneGeometry args={[0.18, 0.3, 4]}/><meshStandardMaterial color={color}/></mesh>
        <mesh rotation={[0,0,-0.4]}><coneGeometry args={[0.18, 0.3, 4]}/><meshStandardMaterial color={color}/></mesh>
      </group>
      <mesh position={[0.18, 0.08, 0]}><sphereGeometry args={[0.04, 6, 6]}/><meshStandardMaterial color="#000"/></mesh>
    </group>
  );
}

function Planet({ position = [0,0,0], color = '#4466FF', hasRings = false, hasAtmosphere = false, scale = 1, orbitRadius = 0, orbitSpeed = 1 }) {
  const orbitRef = useRef();
  const planetRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (orbitRef.current && orbitRadius > 0) {
      orbitRef.current.position.x = Math.sin(t * orbitSpeed) * orbitRadius;
      orbitRef.current.position.z = Math.cos(t * orbitSpeed) * orbitRadius;
    }
    if (planetRef.current) planetRef.current.rotation.y += 0.005;
  });
  const s = scale;
  return (
    <group ref={orbitRef} position={position}>
      <group ref={planetRef} scale={[s,s,s]}>
        <mesh><sphereGeometry args={[1, 32, 32]}/><meshStandardMaterial color={color} roughness={0.7}/></mesh>
        {hasAtmosphere && <mesh><sphereGeometry args={[1.08, 24, 24]}/><meshStandardMaterial color={color} transparent opacity={0.15}/></mesh>}
        {hasRings && (
          <mesh rotation={[Math.PI/3, 0, 0]}>
            <torusGeometry args={[1.7, 0.25, 4, 64]}/>
            <meshStandardMaterial color="#AA8866" transparent opacity={0.7} side={THREE.DoubleSide}/>
          </mesh>
        )}
      </group>
    </group>
  );
}

function Eagle({ position = [0,0,0], color = '#886644', scale = 1 }) {
  const ref = useRef();
  const wingLRef = useRef();
  const wingRRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = position[0] + Math.sin(t * 0.5) * 3;
      ref.current.position.y = position[1] + Math.sin(t * 0.7) * 0.7 + 1;
      ref.current.position.z = position[2] + Math.cos(t * 0.4) * 2;
      ref.current.rotation.y = Math.atan2(Math.cos(t * 0.5) * 3, Math.cos(t * 0.4) * 2) + Math.PI / 2;
    }
    const flap = Math.sin(t * 3) * 0.4;
    if (wingLRef.current) wingLRef.current.rotation.z = 0.3 + flap;
    if (wingRRef.current) wingRRef.current.rotation.z = -(0.3 + flap);
  });
  const s = scale;
  return (
    <group ref={ref} scale={[s,s,s]}>
      <mesh><capsuleGeometry args={[0.15, 0.7, 6, 10]}/><meshStandardMaterial color={color} roughness={0.7}/></mesh>
      <mesh position={[0.45, 0.05, 0]}><sphereGeometry args={[0.18, 12, 12]}/><meshStandardMaterial color="#FFCC88"/></mesh>
      <mesh position={[0.6, 0, 0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[0.05, 0.22, 5]}/><meshStandardMaterial color="#FFAA00"/></mesh>
      <group ref={wingLRef} position={[0, 0.08, 0.18]}>
        <mesh rotation={[0.2, 0, 0]}><boxGeometry args={[0.9, 0.04, 0.55]}/><meshStandardMaterial color={color} side={THREE.DoubleSide}/></mesh>
      </group>
      <group ref={wingRRef} position={[0, 0.08, -0.18]}>
        <mesh rotation={[-0.2, 0, 0]}><boxGeometry args={[0.9, 0.04, 0.55]}/><meshStandardMaterial color={color} side={THREE.DoubleSide}/></mesh>
      </group>
    </group>
  );
}

function Comet({ position = [0,0,0], scale = 1 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = position[0] + Math.sin(t * 0.3) * 4;
      ref.current.position.y = position[1] + Math.cos(t * 0.4) * 2;
      ref.current.position.z = position[2] + Math.sin(t * 0.25 + 1) * 4;
      ref.current.lookAt(
        ref.current.position.x + Math.cos(t * 0.3) * 4,
        ref.current.position.y - Math.sin(t * 0.4) * 2,
        ref.current.position.z + Math.cos(t * 0.25 + 1) * 4
      );
    }
  });
  return (
    <group ref={ref} position={position} scale={[scale, scale, scale]}>
      <mesh><sphereGeometry args={[0.3, 16, 16]}/><meshStandardMaterial color="#AACCFF" emissive="#8899FF" emissiveIntensity={1}/></mesh>
      <Particles type="sparkle" position={[-0.3, 0, 0]} count={50} scale={0.6}/>
      <pointLight intensity={2} color="#88AAFF" distance={4}/>
    </group>
  );
}

function SolarSystem() {
  return (
    <group>
      <mesh><sphereGeometry args={[1.2, 32, 32]}/><meshStandardMaterial color="#FFDD44" emissive="#FFAA00" emissiveIntensity={2}/></mesh>
      <pointLight intensity={5} color="#FFEE88" distance={20}/>
      <Planet position={[0,0,0]} orbitRadius={2.5} orbitSpeed={0.8} color="#AAAAAA" scale={0.35}/>
      <Planet position={[0,0,0]} orbitRadius={3.8} orbitSpeed={0.5} color="#FFAA44" scale={0.5} hasAtmosphere/>
      <Planet position={[0,0,0]} orbitRadius={5.2} orbitSpeed={0.35} color="#2255FF" scale={0.6} hasAtmosphere/>
      <Planet position={[0,0,0]} orbitRadius={7.0} orbitSpeed={0.25} color="#FF4422" scale={0.45}/>
      <Planet position={[0,0,0]} orbitRadius={10} orbitSpeed={0.12} color="#CC8844" scale={1.1} hasRings hasAtmosphere/>
      {[2.5, 3.8, 5.2, 7.0, 10].map((r, i) => (
        <mesh key={i} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[r, 0.01, 4, 64]}/>
          <meshStandardMaterial color="#ffffff" transparent opacity={0.1}/>
        </mesh>
      ))}
    </group>
  );
}

function Underwater() {
  return (
    <group>
      <ambientLight intensity={0.4} color="#004488"/>
      <pointLight position={[0,5,0]} intensity={3} color="#2299FF" distance={20}/>
      <OceanFloor/>
      <Shark position={[0, 0, 0]} scale={1.2}/>
      <Fish position={[1, -0.5, 1]} color="#FF8800" scale={0.7}/>
      <Fish position={[-1.5, 0.2, -1]} color="#FF4466" scale={0.6}/>
      <Fish position={[0.5, 0.5, -2]} color="#44FF88" scale={0.5}/>
      <Fish position={[-0.8, -0.3, 1.5]} color="#FFFF44" scale={0.55}/>
      <Particles type="bubbles" position={[-1, -2, -1]} count={30} scale={0.8}/>
      <Particles type="bubbles" position={[1, -2, 1]} count={30} scale={0.8}/>
      {/* Coral */}
      {[[-2,-2,1],[2,-2,-1],[0,-2,2],[-1.5,-2,-2]].map(([x,y,z],i)=>(
        <mesh key={i} position={[x,y,z]}>
          <coneGeometry args={[0.2,1,5]}/>
          <meshStandardMaterial color={['#FF6688','#FF4444','#FF8800','#FF44CC'][i]}/>
        </mesh>
      ))}
    </group>
  );
}

function ForestScene() {
  const trees = useMemo(() => Array.from({length:8},(_,i)=>({
    x:(Math.random()-0.5)*8, z:(Math.random()-0.5)*8,
    h:1.5+Math.random()*1.5, r:0.5+Math.random()*0.5,
    c:['#1a5c1a','#1a7a1a','#22661a','#336633'][Math.floor(Math.random()*4)]
  })),[]);
  return (
    <group>
      <mesh position={[0,-2.1,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[20,20]}/>
        <meshStandardMaterial color="#2d5a1b" roughness={0.9}/>
      </mesh>
      {trees.map((t,i)=>(
        <group key={i} position={[t.x,-2,t.z]}>
          <mesh position={[0,t.h*0.4,0]}><cylinderGeometry args={[0.12,0.18,t.h*0.8,6]}/><meshStandardMaterial color="#5c3d1a"/></mesh>
          <mesh position={[0,t.h,0]}><coneGeometry args={[t.r,t.h*1.2,7]}/><meshStandardMaterial color={t.c}/></mesh>
          <mesh position={[0,t.h*0.7,0]}><coneGeometry args={[t.r*0.8,t.h,7]}/><meshStandardMaterial color={t.c}/></mesh>
        </group>
      ))}
      <Eagle position={[0,1,0]} scale={0.8}/>
      <Butterfly position={[1,0,1]} color="#FF88CC" scale={0.6}/>
      <Butterfly position={[-1.5,0.3,0]} color="#88FFCC" scale={0.5}/>
    </group>
  );
}

function SpaceBattle() {
  return (
    <group>
      <ambientLight intensity={0.2}/>
      <pointLight position={[3,2,0]} intensity={3} color="#FF4400" distance={10}/>
      <pointLight position={[-3,1,0]} intensity={3} color="#4444FF" distance={10}/>
      <Comet position={[0,0,0]} scale={0.8}/>
      <Planet position={[3,0,3]} color="#884422" scale={0.8} hasRings/>
      <Particles type="electric" position={[2,1,0]} count={60} scale={0.5}/>
      <Particles type="fire" position={[-2,-1,0]} count={60} scale={0.5}/>
      <Particles type="sparkle" position={[0,0,0]} count={80} scale={1}/>
    </group>
  );
}

function VolcanoIsland() {
  return (
    <group>
      <mesh position={[0,-2.5,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[6,32]}/>
        <meshStandardMaterial color="#001a33"/>
      </mesh>
      <mesh position={[0,-2,0]}>
        <cylinderGeometry args={[2.5,3,1,16]}/>
        <meshStandardMaterial color="#665544"/>
      </mesh>
      <Volcano position={[0,-1,0]} scale={1}/>
      <Particles type="lava" position={[1.5,-0.5,0]} count={30} scale={0.7}/>
      <Particles type="lava" position={[-1,-0.5,1]} count={30} scale={0.7}/>
    </group>
  );
}

function Snowstorm() {
  return (
    <group>
      <mesh position={[0,-2.5,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[20,20]}/>
        <meshStandardMaterial color="#DDEEFF"/>
      </mesh>
      <Particles type="snow" position={[0,3,0]} count={200} scale={2}/>
      {/* Snowman */}
      <group position={[0,-2,0]}>
        <mesh position={[0,0.5,0]}><sphereGeometry args={[0.7,16,16]}/><meshStandardMaterial color="#FFFFFF"/></mesh>
        <mesh position={[0,1.5,0]}><sphereGeometry args={[0.5,16,16]}/><meshStandardMaterial color="#FFFFFF"/></mesh>
        <mesh position={[0,2.1,0]}><sphereGeometry args={[0.35,16,16]}/><meshStandardMaterial color="#FFFFFF"/></mesh>
        <mesh position={[0.18,2.15,0.3]} rotation={[-0.3,0,0]}><coneGeometry args={[0.05,0.3,6]}/><meshStandardMaterial color="#FF8800"/></mesh>
        {[0.12,0.17,0.22].map((y,i)=>(
          <mesh key={i} position={[0,y+1.9,0.34]}><sphereGeometry args={[0.04,6,6]}/><meshStandardMaterial color="#333"/></mesh>
        ))}
      </group>
    </group>
  );
}

function RainforestWaterfall() {
  return (
    <group>
      <mesh position={[0,-2,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[20,20,20,20]}/>
        <meshStandardMaterial color="#1a5a1a" roughness={0.9}/>
      </mesh>
      <mesh position={[0,0,-3]}><boxGeometry args={[3,5,0.5]}/><meshStandardMaterial color="#665544" roughness={0.9}/></mesh>
      <Particles type="water" position={[0,2,-2.5]} count={100} scale={1}/>
      <Particles type="water" position={[0.5,1.5,-2]} count={60} scale={0.7}/>
      <mesh position={[0,-1.5,-2]}><cylinderGeometry args={[1,1,0.3,32]}/><meshStandardMaterial color="#1133AA" transparent opacity={0.7}/></mesh>
      {[[-3,-1.5,0],[3,-1.5,0],[0,-1.5,3],[2,-1.5,-1]].map(([x,y,z],i)=>(
        <group key={i} position={[x,y,z]}>
          <mesh><cylinderGeometry args={[0.15,0.2,3,7]}/><meshStandardMaterial color="#5c3d1a"/></mesh>
          <mesh position={[0,2.5,0]}><coneGeometry args={[1,2.5,7]}/><meshStandardMaterial color="#1a7a1a"/></mesh>
        </group>
      ))}
      <Butterfly position={[1,0.5,1]} color="#FFFF44" scale={0.5}/>
      <Eagle position={[-1,1,0]} scale={0.6}/>
    </group>
  );
}

// ── SCENE REGISTRY ────────────────────────────────────────────────────────

const DYNAMIC_SCENES = {
  shark:        { render: () => <><Shark position={[0,0,0]} scale={1.5}/><OceanFloor/><Particles type="bubbles" position={[0,-1,0]} count={40}/></>,         env:'#001a33', cam:[0,0,10], label:'🦈 Shark Swimming'      },
  butterfly:    { render: () => <><Butterfly position={[0,0,0]} color="#FF88CC" scale={1.2}/><Butterfly position={[2,0.3,-1]} color="#88FFCC" scale={0.9}/><Butterfly position={[-1.5,0.5,1]} color="#FFFF88" scale={0.8}/></>,                                   env:'#e8f5e9', cam:[0,0,8], label:'🦋 Butterflies'          },
  eagle:        { render: () => <><Eagle position={[0,0,0]} scale={1.5}/><Stars radius={50} depth={20} count={1000} factor={2} fade/></>,                   env:'#87CEEB', cam:[0,0,9], label:'🦅 Soaring Eagle'        },
  fish:         { render: () => <Underwater/>,                                                                                                              env:'#001a33', cam:[0,0,10], label:'🐠 Underwater World'     },
  underwater:   { render: () => <Underwater/>,                                                                                                              env:'#001a33', cam:[0,0,10], label:'🌊 Underwater World'     },
  volcano:      { render: () => <VolcanoIsland/>,                                                                                                           env:'#1a0a00', cam:[0,2,12], label:'🌋 Volcano Eruption'     },
  solarsystem:  { render: () => <SolarSystem/>,                                                                                                             env:'#000005', cam:[0,5,18], label:'🪐 Solar System'         },
  solar:        { render: () => <SolarSystem/>,                                                                                                             env:'#000005', cam:[0,5,18], label:'🪐 Solar System'         },
  comet:        { render: () => <><Comet position={[0,0,0]} scale={1.2}/><Stars radius={100} depth={50} count={3000} factor={4} fade/></>,                  env:'#000010', cam:[0,0,10], label:'☄️ Comet'               },
  forest:       { render: () => <ForestScene/>,                                                                                                             env:'#87CEEB', cam:[0,2,12], label:'🌲 Forest'               },
  spaceship:    { render: () => <SpaceBattle/>,                                                                                                             env:'#000005', cam:[0,0,12], label:'🚀 Space Scene'          },
  space:        { render: () => <SpaceBattle/>,                                                                                                             env:'#000005', cam:[0,0,12], label:'🚀 Space Scene'          },
  snow:         { render: () => <Snowstorm/>,                                                                                                               env:'#aaccff', cam:[0,0,10], label:'❄️ Snowstorm'            },
  snowman:      { render: () => <Snowstorm/>,                                                                                                               env:'#aaccff', cam:[0,0,10], label:'⛄ Snow Scene'           },
  waterfall:    { render: () => <RainforestWaterfall/>,                                                                                                     env:'#1a3322', cam:[0,1,12], label:'💦 Rainforest Waterfall' },
  rainforest:   { render: () => <RainforestWaterfall/>,                                                                                                     env:'#1a3322', cam:[0,1,12], label:'🌴 Rainforest'           },
  planet:       { render: () => <><Planet position={[0,0,0]} color="#2244FF" scale={1.5} hasAtmosphere hasRings/><Comet position={[2,1,-1]} scale={0.5}/><Stars radius={100} depth={50} count={3000} factor={4} fade/></>,   env:'#000008', cam:[0,2,9], label:'🪐 Planet'  },
};

// ── SMART KEYWORD MAPPER ─────────────────────────────────────────────────
// Maps ANY word the user might say to the closest scene
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
  forest:'forest', jungle:'rainforest', rainforest:'rainforest',
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
  jungle:'rainforest', swamp:'underwater',
};

function resolveScene(input) {
  const key = input.toLowerCase().replace(/[^a-z]/g, '');
  if (DYNAMIC_SCENES[key]) return key;
  // Try keyword map
  if (KEYWORD_MAP[key]) return KEYWORD_MAP[key];
  // Try partial match
  for (const [word, scene] of Object.entries(KEYWORD_MAP)) {
    if (key.includes(word) || word.includes(key)) return scene;
  }
  // Default fallback
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
      <Canvas camera={{ position: config.cam, fov: 50 }}>
        <color attach="background" args={[config.env]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Stars radius={100} depth={50} count={2000} factor={3} fade />
        {SceneRender()}
        <OrbitControls enableZoom maxDistance={25} minDistance={3} />
      </Canvas>
    </div>
  );
}

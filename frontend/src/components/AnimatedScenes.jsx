import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ── SHARED: FIRE PARTICLES ────────────────────────────────────────────────
function FireParticles({ pos=[0,0,0], count=80, spread=0.25, speed=2, c1='#FF4500', c2='#FFD700', sizeScale=1 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pts = useMemo(() => Array.from({ length: count }, () => ({
    off: Math.random() * Math.PI * 2,
    spd: 0.7 + Math.random() * speed,
    sx: (Math.random() - 0.5) * spread,
    sz: (Math.random() - 0.5) * spread,
    sz2: (Math.random() - 0.5) * spread * 0.5,
    sz3: (Math.random() - 0.5) * spread * 0.5,
    size: (0.04 + Math.random() * 0.09) * sizeScale,
  })), [count, spread, speed, sizeScale]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    pts.forEach((p, i) => {
      const life = ((t * p.spd * 0.5 + p.off) % 1);
      dummy.position.set(pos[0] + p.sx*(1+life), pos[1]+life*2, pos[2]+p.sz*(1+life));
      const s = p.size * (1-life) * 1.6;
      dummy.scale.set(s,s,s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[null,null,count]}>
      <sphereGeometry args={[1,6,6]}/>
      <meshStandardMaterial color={c1} emissive={c2} emissiveIntensity={3} transparent opacity={0.85}/>
    </instancedMesh>
  );
}

// ── DRAGON WING (DETAILED) ────────────────────────────────────────────────
function DragonWing({ side=1 }) {
  const root = useRef(); const mem1 = useRef(); const mem2 = useRef(); const mem3 = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) { root.current.rotation.z = side*(0.25 + Math.sin(t*3)*0.55); root.current.rotation.x = Math.sin(t*3+0.4)*0.12; }
    if (mem1.current) mem1.current.rotation.z = side * Math.sin(t*3+0.2)*0.15;
    if (mem2.current) mem2.current.rotation.z = side * Math.sin(t*3+0.4)*0.12;
    if (mem3.current) mem3.current.rotation.z = side * Math.sin(t*3+0.6)*0.10;
  });
  const memMat = { color:'#2a0808', transparent:true, opacity:0.82, side:THREE.DoubleSide, roughness:0.9 };
  const boneMat = { color:'#150404', roughness:0.7 };
  const s = side;
  return (
    <group ref={root} position={[s*0.65, 0.25, 0]}>
      {/* Primary arm bone */}
      <mesh position={[s*0.5,0,0]} rotation={[0,0,s*0.2]}>
        <cylinderGeometry args={[0.045,0.03,1.5,8]}/><meshStandardMaterial {...boneMat}/>
      </mesh>
      {/* Finger 1 */}
      <group ref={mem1} position={[s*1.1,0,0.18]}>
        <mesh rotation={[0,0,s*0.3]}><cylinderGeometry args={[0.025,0.01,1.2,6]}/><meshStandardMaterial {...boneMat}/></mesh>
        <mesh position={[s*0.5,0,0.3]}><boxGeometry args={[0.06,0.9,0.7]}/><meshStandardMaterial {...memMat}/></mesh>
      </group>
      {/* Finger 2 */}
      <group ref={mem2} position={[s*1.1,0,0]}>
        <mesh rotation={[0,0,s*0.15]}><cylinderGeometry args={[0.025,0.01,1.3,6]}/><meshStandardMaterial {...boneMat}/></mesh>
        <mesh position={[s*0.3,0,0]}><boxGeometry args={[0.06,1.0,0.65]}/><meshStandardMaterial {...memMat}/></mesh>
      </group>
      {/* Finger 3 */}
      <group ref={mem3} position={[s*1.1,0,-0.18]}>
        <mesh rotation={[0,0,-s*0.1]}><cylinderGeometry args={[0.025,0.01,1.0,6]}/><meshStandardMaterial {...boneMat}/></mesh>
        <mesh position={[s*0.2,0,-0.3]}><boxGeometry args={[0.06,0.85,0.6]}/><meshStandardMaterial {...memMat}/></mesh>
      </group>
      {/* Main membrane */}
      <mesh position={[s*0.9,0,0]} rotation={[0,0,0]}>
        <boxGeometry args={[1.5,0.03,1.1]}/><meshStandardMaterial {...memMat}/>
      </mesh>
      {/* Wing claw tip */}
      <mesh position={[s*1.75,0.05,0]} rotation={[0,0,s*(-Math.PI/2+0.3)]}>
        <coneGeometry args={[0.04,0.3,5]}/><meshStandardMaterial color="#0a0202"/>
      </mesh>
    </group>
  );
}

// ── DRAGON LEG ────────────────────────────────────────────────────────────
function DragonLeg({ pos=[0,0,0], side=1 }) {
  const legRef = useRef(); const footRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (legRef.current) { legRef.current.rotation.x = Math.sin(t*1.2+pos[2])*0.15; legRef.current.rotation.z = side*0.1; }
  });
  return (
    <group position={pos}>
      <group ref={legRef}>
        <mesh rotation={[0.5,0,side*0.2]}><cylinderGeometry args={[0.1,0.07,0.55,8]}/><meshStandardMaterial color="#1a3a0f" roughness={0.7}/></mesh>
        <group position={[0,-0.35,0.15]} ref={footRef}>
          <mesh rotation={[0.8,0,0]}><cylinderGeometry args={[0.07,0.05,0.45,8]}/><meshStandardMaterial color="#162e0c" roughness={0.8}/></mesh>
          {/* 3 claws */}
          {[-0.07,0,0.07].map((z,i)=>(
            <mesh key={i} position={[z,-0.3,0.15]} rotation={[0.7+Math.abs(z)*2,0,z*3]}>
              <coneGeometry args={[0.03,0.22,5]}/><meshStandardMaterial color="#0a1a06"/>
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

// ── FLYING DRAGON (ULTRA DETAILED) ────────────────────────────────────────
function FlyingDragon() {
  const root=useRef(), head=useRef(), neck=useRef(), tail1=useRef(), tail2=useRef(), tail3=useRef(), jaw=useRef(), tongue=useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) { root.current.position.y=Math.sin(t*1.1)*0.65; root.current.position.x=Math.sin(t*0.45)*0.4; root.current.rotation.z=Math.sin(t*1.1)*0.07; }
    if (neck.current) { neck.current.rotation.x=Math.sin(t*0.9)*0.18; neck.current.rotation.y=Math.sin(t*0.55)*0.1; }
    if (head.current) { head.current.rotation.x=Math.sin(t*1.0+0.4)*0.22; }
    if (jaw.current) { jaw.current.rotation.x=Math.max(0, Math.sin(t*2)*0.45); }
    if (tongue.current) { tongue.current.rotation.x=Math.max(0, Math.sin(t*2-0.2)*0.3); }
    if (tail1.current) { tail1.current.rotation.z=Math.sin(t*2)*0.35; tail1.current.rotation.x=Math.cos(t*1.6)*0.12; }
    if (tail2.current) { tail2.current.rotation.z=Math.sin(t*2+0.4)*0.45; }
    if (tail3.current) { tail3.current.rotation.z=Math.sin(t*2+0.8)*0.5; }
  });
  const bodyMat = { color:'#1a3a0f', roughness:0.6, metalness:0.15 };
  const scaleMat = { color:'#0f2208', roughness:0.8 };
  const spineGeom = [0.06,0.42,5];
  return (
    <group>
      <pointLight position={[3,1,0]} intensity={5} color="#FF5500" distance={7} decay={2}/>
      <pointLight position={[-4,2,0]} intensity={1.5} color="#4466ff" distance={12}/>
      <spotLight position={[0,8,3]} intensity={2} angle={0.5} penumbra={0.5} color="#ff8844" target-position={[0,0,0]}/>

      <group ref={root}>
        {/* ── BODY SEGMENTS ── */}
        <mesh position={[0,0,0]}><capsuleGeometry args={[0.58,1.9,10,18]}/><meshStandardMaterial {...bodyMat}/></mesh>
        {/* Belly plates */}
        {[-0.7,-0.4,-0.1,0.2,0.5,0.8].map((y,i)=>(
          <mesh key={i} position={[0,y,0.52]} rotation={[0.15,0,0]}>
            <capsuleGeometry args={[0.28+i*0.02,0.3,4,8]}/><meshStandardMaterial color="#2d5a1f" roughness={0.9}/>
          </mesh>
        ))}
        {/* Back spines - full row */}
        {[-0.8,-0.5,-0.2,0.1,0.4,0.7,1.0].map((y,i)=>(
          <mesh key={i} position={[0,y,-0.55]} rotation={[-0.3,0,0]}>
            <coneGeometry args={[0.05,0.3+i*0.03,5]}/><meshStandardMaterial {...scaleMat}/>
          </mesh>
        ))}
        {/* Scale bumps - sides */}
        {[...Array(14)].map((_,i)=>{
          const angle=(i/14)*Math.PI*2; const r=0.57;
          return <mesh key={i} position={[Math.sin(angle)*r*0.7, (i/14)*1.8-0.8, Math.cos(angle)*r]} rotation={[0,angle,0]}>
            <coneGeometry args={[0.025,0.1,4]}/><meshStandardMaterial {...scaleMat}/>
          </mesh>;
        })}

        {/* ── WINGS ── */}
        <DragonWing side={1}/>
        <DragonWing side={-1}/>

        {/* ── NECK (multi-segment) ── */}
        <group ref={neck} position={[0.95,0.5,0]}>
          <mesh rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[0.3,0.7,8,14]}/><meshStandardMaterial {...bodyMat}/></mesh>
          {/* Neck spines */}
          {[0.1,0.3,0.5].map((x,i)=>(
            <mesh key={i} position={[x,0.3,-0.28]} rotation={[-0.4,0,0]}>
              <coneGeometry args={[0.04,0.22,5]}/><meshStandardMaterial {...scaleMat}/>
            </mesh>
          ))}
          {/* ── HEAD ── */}
          <group ref={head} position={[0.85,0.1,0]}>
            {/* Skull */}
            <mesh><boxGeometry args={[0.68,0.42,0.48]}/><meshStandardMaterial {...bodyMat}/></mesh>
            {/* Brow ridges */}
            <mesh position={[0.15,0.22,0.2]} rotation={[0,0,-0.2]}><capsuleGeometry args={[0.05,0.35,4,6]}/><meshStandardMaterial {...scaleMat}/></mesh>
            <mesh position={[0.15,0.22,-0.2]} rotation={[0,0,-0.2]}><capsuleGeometry args={[0.05,0.35,4,6]}/><meshStandardMaterial {...scaleMat}/></mesh>
            {/* Snout */}
            <mesh position={[0.5,-0.04,0]}><boxGeometry args={[0.52,0.3,0.36]}/><meshStandardMaterial {...bodyMat}/></mesh>
            <mesh position={[0.72,-0.06,0]}><sphereGeometry args={[0.1,10,10]}/><meshStandardMaterial {...bodyMat}/></mesh>
            {/* Nostrils */}
            <mesh position={[0.72,0,0.08]}><sphereGeometry args={[0.03,6,6]}/><meshStandardMaterial color="#0a1a06"/></mesh>
            <mesh position={[0.72,0,-0.08]}><sphereGeometry args={[0.03,6,6]}/><meshStandardMaterial color="#0a1a06"/></mesh>
            {/* ── JAW ── */}
            <group ref={jaw} position={[0.15,-0.2,0]}>
              <mesh position={[0.2,0,0]}><boxGeometry args={[0.55,0.14,0.32]}/><meshStandardMaterial {...bodyMat}/></mesh>
              {/* Lower teeth */}
              {[-0.08,-0.02,0.04,0.1,0.16,0.22].map((x,i)=>(
                <mesh key={i} position={[x,0.1,i%2===0?0.1:-0.1]}>
                  <coneGeometry args={[0.025,0.13,5]}/><meshStandardMaterial color="#ddd"/>
                </mesh>
              ))}
              {/* Tongue */}
              <group ref={tongue} position={[0.1,-0.05,0]}>
                <mesh><capsuleGeometry args={[0.025,0.3,4,6]}/><meshStandardMaterial color="#cc2244"/></mesh>
                <mesh position={[0.2,0,0.05]} rotation={[0,0,0.3]}><coneGeometry args={[0.02,0.12,4]}/><meshStandardMaterial color="#cc2244"/></mesh>
                <mesh position={[0.2,0,-0.05]} rotation={[0,0,-0.3]}><coneGeometry args={[0.02,0.12,4]}/><meshStandardMaterial color="#cc2244"/></mesh>
              </group>
            </group>
            {/* Upper teeth */}
            {[-0.08,-0.02,0.04,0.1,0.16,0.22].map((x,i)=>(
              <mesh key={i} position={[x+0.1,-0.19,i%2===0?0.09:-0.09]}>
                <coneGeometry args={[0.028,0.15,5]}/><meshStandardMaterial color="#e0e0e0"/>
              </mesh>
            ))}
            {/* Eyes */}
            {[0.22,-0.22].map((z,i)=>(
              <group key={i} position={[0.18,0.12,z||0.22*(i===0?1:-1)]}>
                <mesh><sphereGeometry args={[0.09,14,14]}/><meshStandardMaterial color="#ff5500" emissive="#ff2200" emissiveIntensity={2.5}/></mesh>
                <mesh position={[0,0,0.06*(i===0?1:-1)]}><sphereGeometry args={[0.05,10,10]}/><meshStandardMaterial color="#000"/></mesh>
                {/* Eye shine */}
                <mesh position={[0.02,0.04,0.08*(i===0?1:-1)]}><sphereGeometry args={[0.02,6,6]}/><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1}/></mesh>
              </group>
            ))}
            {/* Horns */}
            {[[0.05,0.3,0.18],[0.05,0.3,-0.18],[-0.1,0.28,0.12],[-0.1,0.28,-0.12]].map(([x,y,z],i)=>(
              <mesh key={i} position={[x,y,z]} rotation={[0.5*Math.sign(z),Math.sign(z)*0.3,0]}>
                <coneGeometry args={[0.04,0.4+(i<2?0.1:0),5]}/><meshStandardMaterial color="#080d05"/>
              </mesh>
            ))}
            {/* Head scales */}
            {[...Array(8)].map((_,i)=>(
              <mesh key={i} position={[Math.sin(i*0.8)*0.32, Math.cos(i*0.8)*0.22, (i%2===0?0.22:-0.22)]}>
                <coneGeometry args={[0.02,0.08,4]}/><meshStandardMaterial {...scaleMat}/>
              </mesh>
            ))}
          </group>
        </group>

        {/* ── TAIL (segmented) ── */}
        <group ref={tail1} position={[-1.1,-0.25,0]}>
          <mesh rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[0.26,0.9,8,12]}/><meshStandardMaterial {...bodyMat}/></mesh>
          {[0.1,0.4].map((x,i)=>(
            <mesh key={i} position={[-x,0.28,-0.24]} rotation={[-0.4,0,0]}><coneGeometry args={[0.04,0.24,5]}/><meshStandardMaterial {...scaleMat}/></mesh>
          ))}
          <group ref={tail2} position={[-0.7,0,0]}>
            <mesh rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[0.17,0.8,6,10]}/><meshStandardMaterial {...bodyMat}/></mesh>
            {[0.1,0.35].map((x,i)=>(
              <mesh key={i} position={[-x,0.2,-0.18]} rotation={[-0.4,0,0]}><coneGeometry args={[0.03,0.18,5]}/><meshStandardMaterial {...scaleMat}/></mesh>
            ))}
            <group ref={tail3} position={[-0.6,0,0]}>
              <mesh rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[0.1,0.7,5,8]}/><meshStandardMaterial {...bodyMat}/></mesh>
              {/* Diamond tail tip */}
              <mesh position={[-0.5,0,0]} rotation={[0,0,-Math.PI/2]}>
                <coneGeometry args={[0.15,0.45,4]}/><meshStandardMaterial color="#0d2008"/>
              </mesh>
            </group>
          </group>
        </group>

        {/* ── LEGS ── */}
        <DragonLeg pos={[0.35,-0.65,0.42]} side={1}/>
        <DragonLeg pos={[0.35,-0.65,-0.42]} side={-1}/>
        <DragonLeg pos={[-0.3,-0.65,0.4]} side={1}/>
        <DragonLeg pos={[-0.3,-0.65,-0.4]} side={-1}/>

        {/* ── FIRE BREATH ── */}
        {/* Blue inner core */}
        <FireParticles pos={[2.9,0.05,0]} count={60} spread={0.1} speed={3} c1="#44AAFF" c2="#FFFFFF" sizeScale={0.6}/>
        {/* Orange middle */}
        <FireParticles pos={[2.9,0.05,0]} count={90} spread={0.22} speed={2.2} c1="#FF6600" c2="#FFD700" sizeScale={1}/>
        {/* Outer glow */}
        <FireParticles pos={[2.8,0.1,0]} count={50} spread={0.35} speed={1.5} c1="#FF2200" c2="#FF8800" sizeScale={1.4}/>
        <pointLight position={[3,0.5,0]} intensity={6} color="#FF5500" distance={5} decay={2}/>
        <pointLight position={[2.5,0.2,0]} intensity={3} color="#4488FF" distance={3} decay={2}/>
      </group>
    </group>
  );
}

// ── GALAXY ────────────────────────────────────────────────────────────────
function GalaxyScene() {
  const ref = useRef(); const dustRef = useRef();
  const count = 12000; const dustCount = 3000;

  const { pos, col } = useMemo(() => {
    const pos = new Float32Array(count*3); const col = new Float32Array(count*3);
    const c = new THREE.Color();
    for (let i=0; i<count; i++) {
      const arms=4; const r=0.3+Math.random()*4.5;
      const arm=(i%arms)/arms*Math.PI*2;
      const spin=r*0.9; const angle=arm+spin+Math.random()*0.5;
      const spread=Math.pow(Math.random(),2)*0.5;
      pos[i*3]=Math.cos(angle)*r+(Math.random()-0.5)*spread;
      pos[i*3+1]=(Math.random()-0.5)*0.25;
      pos[i*3+2]=Math.sin(angle)*r+(Math.random()-0.5)*spread;
      const t=r/4.5; c.setHSL(0.62-t*0.35, 1.0, 0.45+Math.random()*0.45);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    }
    return { pos, col };
  }, []);

  const { dpos, dcol } = useMemo(() => {
    const dpos=new Float32Array(dustCount*3); const dcol=new Float32Array(dustCount*3);
    const c=new THREE.Color();
    for (let i=0; i<dustCount; i++) {
      const r=Math.random()*5; const a=Math.random()*Math.PI*2;
      dpos[i*3]=Math.cos(a)*r; dpos[i*3+1]=(Math.random()-0.5)*0.6; dpos[i*3+2]=Math.sin(a)*r;
      c.setHSL(0.7+Math.random()*0.2, 0.6, 0.6+Math.random()*0.3);
      dcol[i*3]=c.r; dcol[i*3+1]=c.g; dcol[i*3+2]=c.b;
    }
    return { dpos, dcol };
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime*0.07;
    if (dustRef.current) dustRef.current.rotation.y = clock.elapsedTime*0.05;
  });

  return (
    <group>
      <group ref={ref}>
        <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[pos,3]}/><bufferAttribute attach="attributes-color" args={[col,3]}/></bufferGeometry><pointsMaterial size={0.022} vertexColors sizeAttenuation/></points>
      </group>
      <group ref={dustRef}>
        <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[dpos,3]}/><bufferAttribute attach="attributes-color" args={[dcol,3]}/></bufferGeometry><pointsMaterial size={0.01} vertexColors sizeAttenuation transparent opacity={0.4}/></points>
      </group>
      {/* Galactic core */}
      <mesh><sphereGeometry args={[0.45,24,24]}/><meshStandardMaterial color="#FFFFCC" emissive="#FFFF66" emissiveIntensity={4}/></mesh>
      <mesh><sphereGeometry args={[0.7,24,24]}/><meshStandardMaterial color="#FFEEAA" emissive="#FFCC44" emissiveIntensity={1.5} transparent opacity={0.35}/></mesh>
      <pointLight intensity={8} color="#FFEEAA" distance={12}/>
    </group>
  );
}

// ── BLACK HOLE ────────────────────────────────────────────────────────────
function BlackHoleScene() {
  const disk1=useRef(), disk2=useRef(), disk3=useRef(), jets=useRef();
  const count=5000;
  const mesh=useRef(); const dummy=useMemo(()=>new THREE.Object3D(),[]);

  const particles=useMemo(()=>Array.from({length:count},()=>({
    a: Math.random()*Math.PI*2, r: 1.3+Math.random()*3.2,
    h: (Math.random()-0.5)*0.25, spd: 0.4+Math.random()*0.8,
    size: 0.008+Math.random()*0.025,
  })),[]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (disk1.current) disk1.current.rotation.z = t*0.35;
    if (disk2.current) disk2.current.rotation.z = -t*0.28;
    if (disk3.current) disk3.current.rotation.z = t*0.22;
    particles.forEach((p,i)=>{
      const a=p.a+t*p.spd*(1/Math.max(p.r-0.8,0.4));
      dummy.position.set(Math.cos(a)*p.r, p.h, Math.sin(a)*p.r);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i,dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate=true;
  });

  return (
    <group>
      {/* Event horizon */}
      <mesh><sphereGeometry args={[1.05,48,48]}/><meshStandardMaterial color="#000" roughness={1}/></mesh>
      {/* Photon sphere glow */}
      <mesh><sphereGeometry args={[1.1,48,48]}/><meshStandardMaterial color="#FF8800" emissive="#FF4400" emissiveIntensity={5} transparent opacity={0.3}/></mesh>
      {/* Accretion disk layers */}
      <group ref={disk1} rotation={[Math.PI/2+0.15,0,0]}>
        <mesh><torusGeometry args={[1.5,0.45,16,80]}/><meshStandardMaterial color="#FF6600" emissive="#FF3300" emissiveIntensity={2.5} transparent opacity={0.85}/></mesh>
      </group>
      <group ref={disk2} rotation={[Math.PI/2+0.08,0,0]}>
        <mesh><torusGeometry args={[2.3,0.3,12,80]}/><meshStandardMaterial color="#FF9900" emissive="#FF6600" emissiveIntensity={2} transparent opacity={0.6}/></mesh>
      </group>
      <group ref={disk3} rotation={[Math.PI/2-0.12,0,0]}>
        <mesh><torusGeometry args={[3.2,0.18,8,80]}/><meshStandardMaterial color="#FF4400" emissive="#FF2200" emissiveIntensity={1.5} transparent opacity={0.4}/></mesh>
      </group>
      {/* Relativistic jets */}
      {[1,-1].map((dir,i)=>(
        <mesh key={i} position={[0,dir*3.5,0]}>
          <cylinderGeometry args={[0.02,0.15,3,8]}/><meshStandardMaterial color="#88AAFF" emissive="#4466FF" emissiveIntensity={4} transparent opacity={0.5}/>
        </mesh>
      ))}
      {/* Orbiting particles */}
      <instancedMesh ref={mesh} args={[null,null,count]}>
        <sphereGeometry args={[1,4,4]}/>
        <meshStandardMaterial color="#FFBB44" emissive="#FF7700" emissiveIntensity={2}/>
      </instancedMesh>
      <pointLight intensity={4} color="#FF6600" distance={10}/>
      <pointLight position={[0,5,0]} intensity={3} color="#4466FF" distance={8}/>
      <pointLight position={[0,-5,0]} intensity={3} color="#4466FF" distance={8}/>
    </group>
  );
}

// ── PHOENIX ───────────────────────────────────────────────────────────────
function PhoenixScene() {
  const body=useRef(), wL=useRef(), wR=useRef(), tail=useRef(), head=useRef();
  useFrame(({ clock }) => {
    const t=clock.elapsedTime;
    if (body.current) { body.current.position.y=Math.sin(t*1.4)*0.5; body.current.rotation.z=Math.sin(t*1.4)*0.06; }
    if (wL.current) wL.current.rotation.z = 0.3+Math.sin(t*4.5)*0.65;
    if (wR.current) wR.current.rotation.z = -(0.3+Math.sin(t*4.5)*0.65);
    if (tail.current) { tail.current.rotation.z=Math.sin(t*2)*0.2; tail.current.rotation.x=Math.sin(t*1.5)*0.15; }
    if (head.current) head.current.rotation.x=Math.sin(t*1.2)*0.15;
  });
  const bMat={color:'#cc2800',emissive:'#ff4400',emissiveIntensity:0.7,roughness:0.5};
  const fMat={color:'#ff6600',emissive:'#ff9900',emissiveIntensity:0.8,roughness:0.6};
  return (
    <group ref={body}>
      <pointLight intensity={6} color="#FF5500" distance={7} decay={2}/>
      {/* Body */}
      <mesh><capsuleGeometry args={[0.32,1.3,10,16]}/><meshStandardMaterial {...bMat}/></mesh>
      {/* Breast feathers */}
      {[0,0.25,0.5].map((y,i)=>(
        <mesh key={i} position={[0,y-0.2,0.28]} rotation={[-0.2,0,0]}>
          <capsuleGeometry args={[0.22-i*0.04,0.2,4,8]}/><meshStandardMaterial color="#ff5500" emissive="#ff7700" emissiveIntensity={0.6}/>
        </mesh>
      ))}
      {/* Head */}
      <group ref={head} position={[0,0.9,0]}>
        <mesh><sphereGeometry args={[0.25,16,16]}/><meshStandardMaterial color="#ff3300" emissive="#ff6600" emissiveIntensity={1}/></mesh>
        <mesh position={[0.22,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[0.05,0.32,6]}/><meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={1.2}/></mesh>
        {/* Crest feathers */}
        {[-0.12,0,0.12].map((z,i)=>(
          <mesh key={i} position={[0,0.32,z]} rotation={[z*2,0,0]}><coneGeometry args={[0.03,0.4,4]}/><meshStandardMaterial color="#ffaa00" emissive="#ffcc00" emissiveIntensity={1.5}/></mesh>
        ))}
        {/* Eyes */}
        {[0.12,-0.12].map((z,i)=>(
          <mesh key={i} position={[0.2,0.08,z]}><sphereGeometry args={[0.06,10,10]}/><meshStandardMaterial color="#ffff00" emissive="#ffee00" emissiveIntensity={2}/></mesh>
        ))}
      </group>
      {/* Wings */}
      <group ref={wL} position={[0,0.2,0.4]}>
        <mesh rotation={[-0.4,0,0]}><boxGeometry args={[0.08,2.0,1.3]}/><meshStandardMaterial {...fMat} transparent opacity={0.85} side={THREE.DoubleSide}/></mesh>
        {[0.5,0.9,1.3].map((z,i)=>(
          <mesh key={i} position={[0,-0.5-i*0.15,z]} rotation={[0.3,0,0]}><boxGeometry args={[0.05,0.7-i*0.15,0.3]}/><meshStandardMaterial color="#ff8800" emissive="#ffaa00" emissiveIntensity={0.8} side={THREE.DoubleSide}/></mesh>
        ))}
        <FireParticles pos={[0,-0.8,0.7]} count={50} spread={0.4} speed={1.5} c1="#FF6600" c2="#FFDD00" sizeScale={0.7}/>
      </group>
      <group ref={wR} position={[0,0.2,-0.4]}>
        <mesh rotation={[0.4,0,0]}><boxGeometry args={[0.08,2.0,1.3]}/><meshStandardMaterial {...fMat} transparent opacity={0.85} side={THREE.DoubleSide}/></mesh>
        {[0.5,0.9,1.3].map((z,i)=>(
          <mesh key={i} position={[0,-0.5-i*0.15,-z]} rotation={[-0.3,0,0]}><boxGeometry args={[0.05,0.7-i*0.15,0.3]}/><meshStandardMaterial color="#ff8800" emissive="#ffaa00" emissiveIntensity={0.8} side={THREE.DoubleSide}/></mesh>
        ))}
        <FireParticles pos={[0,-0.8,-0.7]} count={50} spread={0.4} speed={1.5} c1="#FF6600" c2="#FFDD00" sizeScale={0.7}/>
      </group>
      {/* Tail */}
      <group ref={tail} position={[0,-1.1,0]}>
        {[-0.25,-0.12,0,0.12,0.25].map((z,i)=>(
          <mesh key={i} position={[0,-0.3*Math.abs(z-0.05), z*2.2]} rotation={[Math.PI/2,0,z*2]}>
            <coneGeometry args={[0.04,1.0,5]}/><meshStandardMaterial color={['#ff4400','#ff6600','#ff8800','#ff6600','#ff4400'][i]} emissive="#ff9900" emissiveIntensity={1.2}/>
          </mesh>
        ))}
        <FireParticles pos={[0,-0.6,0]} count={60} spread={0.6} speed={1.2} c1="#FF4500" c2="#FF9900" sizeScale={0.9}/>
      </group>
    </group>
  );
}

// ── TORNADO ────────────────────────────────────────────────────────────────
function TornadoScene() {
  const spinRef=useRef(); const count=350;
  const mesh=useRef(); const dummy=useMemo(()=>new THREE.Object3D(),[]);
  const particles=useMemo(()=>Array.from({length:count},()=>({
    h: (Math.random()-0.5)*5.5,
    ang: Math.random()*Math.PI*2,
    spd: 1+Math.random()*2.5,
    size: 0.04+Math.random()*0.14,
    c: Math.random()>0.7,
  })),[]);

  useFrame(({ clock }) => {
    const t=clock.elapsedTime;
    if (spinRef.current) spinRef.current.rotation.y = t*2.8;
    particles.forEach((p,i)=>{
      const normH=(p.h+2.75)/5.5; const r=normH*2.4+0.08;
      const a=p.ang+t*p.spd*(1+normH);
      dummy.position.set(Math.cos(a)*r, p.h, Math.sin(a)*r);
      dummy.scale.setScalar(p.size*(1-normH*0.3));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i,dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate=true;
  });

  return (
    <group>
      <group ref={spinRef}>
        {[0,1,2,3,4,5,6,7].map(i=>(
          <mesh key={i} position={[0, i*0.65-2.5, 0]}>
            <torusGeometry args={[i*0.22+0.08, 0.035, 8, 40]}/><meshStandardMaterial color={`hsl(${270+i*5},60%,${40+i*4}%)`} transparent opacity={0.45}/>
          </mesh>
        ))}
      </group>
      <instancedMesh ref={mesh} args={[null,null,count]}>
        <sphereGeometry args={[1,4,4]}/>
        <meshStandardMaterial color="#aa99cc" transparent opacity={0.75}/>
      </instancedMesh>
      {/* Ground */}
      <mesh position={[0,-2.75,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[5,40]}/><meshStandardMaterial color="#3d2b1f" roughness={0.9}/>
      </mesh>
      {/* Dust at base */}
      <FireParticles pos={[0,-2.5,0]} count={60} spread={1.5} speed={0.8} c1="#AA8855" c2="#886633" sizeScale={1.5}/>
    </group>
  );
}

// ── ROCKET ────────────────────────────────────────────────────────────────
function RocketScene() {
  const rRef=useRef();
  useFrame(({ clock }) => {
    const t=clock.elapsedTime;
    if (rRef.current) { rRef.current.position.y=Math.sin(t*0.5)*0.35; rRef.current.rotation.z=Math.sin(t*0.9)*0.035; }
  });
  return (
    <group ref={rRef}>
      <pointLight position={[0,-2,0]} intensity={8} color="#FF6600" distance={7} decay={2}/>
      <spotLight position={[0,8,3]} angle={0.4} intensity={2} color="#ffffff"/>
      {/* Main body */}
      <mesh position={[0,0.5,0]}><cylinderGeometry args={[0.42,0.42,2.7,24]}/><meshStandardMaterial color="#f5f5f5" metalness={0.8} roughness={0.2}/></mesh>
      {/* Nose cone */}
      <mesh position={[0,2.05,0]}><coneGeometry args={[0.42,1.1,24]}/><meshStandardMaterial color="#cc1111" metalness={0.6} roughness={0.3}/></mesh>
      {/* Stage separation ring */}
      <mesh position={[0,0.5,0]}><cylinderGeometry args={[0.45,0.45,0.12,24]}/><meshStandardMaterial color="#888" metalness={0.9}/></mesh>
      {/* USA text plate */}
      <mesh position={[0.43,0.5,0]}><boxGeometry args={[0.02,0.8,0.5]}/><meshStandardMaterial color="#cc1111"/></mesh>
      {/* Windows */}
      {[1.0,0.5,0.05].map((y,i)=>(
        <mesh key={i} position={[0.435,y,0]}>
          <circleGeometry args={[0.1,14]}/><meshStandardMaterial color="#88CCFF" emissive="#4488ff" emissiveIntensity={0.9}/>
        </mesh>
      ))}
      {/* Fins */}
      {[0,1,2,3].map(i=>{
        const a=i*Math.PI/2;
        return (
          <mesh key={i} position={[Math.sin(a)*0.55,-0.9,Math.cos(a)*0.55]} rotation={[0,a+Math.PI/4,0]}>
            <boxGeometry args={[0.7,1.0,0.06]}/><meshStandardMaterial color="#cc1111" metalness={0.5}/>
          </mesh>
        );
      })}
      {/* Engine nozzle */}
      <mesh position={[0,-1.2,0]}><cylinderGeometry args={[0.28,0.42,0.55,18]}/><meshStandardMaterial color="#555" metalness={0.9}/></mesh>
      {/* Exhaust */}
      <FireParticles pos={[0,-1.6,0]} count={120} spread={0.32} speed={2.8} c1="#FF4500" c2="#FFD700" sizeScale={1.1}/>
      <FireParticles pos={[0,-1.5,0]} count={60} spread={0.18} speed={3.5} c1="#88DDFF" c2="#FFFFFF" sizeScale={0.5}/>
      {/* Side boosters */}
      {[[0.65,-0.8,0],[-0.65,-0.8,0]].map(([x,y,z],i)=>(
        <group key={i} position={[x,y,z]}>
          <mesh><cylinderGeometry args={[0.16,0.16,1.3,12]}/><meshStandardMaterial color="#aaa" metalness={0.8}/></mesh>
          <mesh position={[0,-0.9,0]}><cylinderGeometry args={[0.12,0.18,0.35,10]}/><meshStandardMaterial color="#666" metalness={0.9}/></mesh>
          <mesh position={[0,0.75,0]}><coneGeometry args={[0.16,0.4,12]}/><meshStandardMaterial color="#cc1111"/></mesh>
          <FireParticles pos={[0,-0.9,0]} count={50} spread={0.15} speed={2.5} c1="#FF6600" c2="#FFCC00" sizeScale={0.7}/>
        </group>
      ))}
    </group>
  );
}

// ── SCENE REGISTRY ────────────────────────────────────────────────────────
const SCENES = {
  dragon:   { C: FlyingDragon,  bg:'#030a02', cam:[0,1,9],  label:'🐉 Dragon — Breathes Fire' },
  phoenix:  { C: PhoenixScene,  bg:'#0a0300', cam:[0,0,8],  label:'🔥 Phoenix — Fire Bird'    },
  galaxy:   { C: GalaxyScene,   bg:'#000006', cam:[0,4,12], label:'🌌 Galaxy — 12K Stars'      },
  blackhole:{ C: BlackHoleScene,bg:'#000000', cam:[0,4,10], label:'🌑 Black Hole'              },
  tornado:  { C: TornadoScene,  bg:'#1a1025', cam:[0,0,11], label:'🌪️ Tornado'                 },
  rocket:   { C: RocketScene,   bg:'#000510', cam:[0,0,10], label:'🚀 Rocket Launch'           },
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
        <ambientLight intensity={0.25}/>
        <Stars radius={100} depth={50} count={4000} factor={4} fade/>
        <Comp/>
        <OrbitControls enableZoom maxDistance={22} minDistance={3} enableDamping dampingFactor={0.08}/>
      </Canvas>
    </div>
  );
}

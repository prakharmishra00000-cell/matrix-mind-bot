import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sphere, Ring, Sparkles, Cloud, Float, Plane } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// DYNAMIC cosmic EXPLOSION & HIGH-SPEED UNIVERSE THEMES
// Animated speed scaled up by 10x-50x to create dramatic active visuals
// ============================================================================

// 1. SUPERNOVA BLAST
function ThemeSupernovaBlast() {
  const novaRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (novaRef.current) {
      novaRef.current.rotation.y = t * 0.12;
      novaRef.current.rotation.z = t * 0.05;
      // expanding shockwave pulse
      const pulse = 1.0 + Math.sin(t * 8.0) * 0.25;
      novaRef.current.scale.setScalar(pulse);
    }
  });
  return (
    <group>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 0, 0]} intensity={5000} color="#ff007f" distance={150} />
      <group ref={novaRef}>
        <Sphere args={[2, 12, 12]}>
          <meshBasicMaterial color="#ff007f" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
        </Sphere>
        <Ring args={[3, 12, 24]}>
          <meshBasicMaterial color="#7928ca" transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>
        <Sparkles count={150} scale={[80, 80, 80]} size={28} speed={2.0} color="#ff007f" opacity={0.85} blending={THREE.AdditiveBlending} />
        <Sparkles count={100} scale={[120, 120, 120]} size={20} speed={1.5} color="#7928ca" opacity={0.65} blending={THREE.AdditiveBlending} />
        <Sparkles count={60} scale={[40, 40, 40]} size={45} speed={3.0} color="#ffffff" opacity={0.9} blending={THREE.AdditiveBlending} />
      </group>
    </group>
  );
}

// 2. SOLAR ERUPTION
function ThemeSolarEruption() {
  const sunRef = useRef();
  const flareRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (sunRef.current) {
      sunRef.current.rotation.y = t * 0.15;
      sunRef.current.scale.setScalar(1.0 + Math.sin(t * 5.0) * 0.15);
    }
    if (flareRef.current) {
      flareRef.current.rotation.z = -t * 0.3;
    }
  });
  return (
    <group>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={8000} color="#ff4e50" distance={200} />
      <group ref={sunRef}>
        <Sphere args={[12, 24, 24]}>
          <meshStandardMaterial color="#f9d423" roughness={0.9} emissive="#ff4e50" emissiveIntensity={2} />
        </Sphere>
      </group>
      <group ref={flareRef}>
        <Sparkles count={150} scale={[60, 60, 60]} size={30} speed={2.5} color="#ff4e50" opacity={0.9} blending={THREE.AdditiveBlending} />
        <Sparkles count={120} scale={[80, 80, 80]} size={18} speed={2.0} color="#f9d423" opacity={0.7} blending={THREE.AdditiveBlending} />
      </group>
    </group>
  );
}

// 3. QUASAR JET
function ThemeQuasarJet() {
  const jetRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (jetRef.current) {
      jetRef.current.position.z += 4.5;
      if (jetRef.current.position.z > 80) jetRef.current.position.z = -160;
      jetRef.current.rotation.z = t * 0.8;
    }
  });
  return (
    <group>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, -50]} intensity={6000} color="#00f2fe" distance={150} />
      <group ref={jetRef} position={[0, 0, -80]}>
        <Sparkles count={150} scale={[15, 15, 200]} size={12} speed={4.0} color="#00f2fe" opacity={0.95} blending={THREE.AdditiveBlending} />
        <Sparkles count={100} scale={[25, 25, 160]} size={24} speed={3.0} color="#4facfe" opacity={0.75} blending={THREE.AdditiveBlending} />
      </group>
      <Stars radius={200} count={400} speed={2.0} />
    </group>
  );
}

// 4. NEBULA TEMPEST
function ThemeNebulaTempest() {
  const tempestRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (tempestRef.current) {
      tempestRef.current.rotation.y = t * 0.25;
      tempestRef.current.rotation.x = t * 0.12;
    }
  });
  return (
    <group>
      <Stars radius={150} depth={50} count={500} factor={6} saturation={1} fade speed={1.5} />
      <ambientLight intensity={0.3} />
      <pointLight position={[25, 25, 15]} intensity={150} color="#da22ff" />
      <pointLight position={[-25, -25, -15]} intensity={150} color="#9114ff" />
      <group ref={tempestRef}>
        <Float speed={2.0} rotationIntensity={1.0} floatIntensity={1.0}>
          <Cloud opacity={0.5} speed={1.5} width={45} depth={4} segments={15} color="#da22ff" position={[-15, 5, -20]} />
          <Cloud opacity={0.4} speed={1.2} width={50} depth={4} segments={15} color="#9114ff" position={[15, -5, -30]} />
        </Float>
      </group>
    </group>
  );
}

// 5. HYPERDRIVE WARP
function ThemeHyperdriveWarp() {
  const warpRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (warpRef.current) {
      warpRef.current.position.z += 6.0;
      if (warpRef.current.position.z > 60) warpRef.current.position.z = -100;
      warpRef.current.rotation.z = t * 0.4;
    }
  });
  return (
    <group>
      <group ref={warpRef}>
        <Sparkles count={250} scale={[40, 40, 300]} size={10} speed={4.5} color="#ffffff" opacity={0.9} blending={THREE.AdditiveBlending} />
        <Sparkles count={150} scale={[25, 25, 200]} size={16} speed={3.5} color="#00c6ff" opacity={0.8} blending={THREE.AdditiveBlending} />
        <Sparkles count={80} scale={[15, 15, 150]} size={28} speed={2.5} color="#0072ff" opacity={0.95} blending={THREE.AdditiveBlending} />
      </group>
    </group>
  );
}

// 6. METEOR SHOWER
function ThemeMeteorShower() {
  const showerRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (showerRef.current) {
      showerRef.current.position.y -= 3.5;
      showerRef.current.position.x -= 2.0;
      if (showerRef.current.position.y < -80) {
        showerRef.current.position.y = 80;
        showerRef.current.position.x = 45;
      }
      showerRef.current.rotation.z = Math.sin(t * 0.5) * 0.2;
    }
  });
  return (
    <group>
      <Stars radius={200} count={400} speed={1.0} />
      <group ref={showerRef} position={[20, 40, -40]}>
        <Sparkles count={120} scale={[6, 80, 6]} size={15} speed={5.0} color="#38ef7d" opacity={0.95} blending={THREE.AdditiveBlending} />
        <Sparkles count={80} scale={[8, 120, 8]} size={22} speed={4.0} color="#11998e" opacity={0.7} blending={THREE.AdditiveBlending} />
      </group>
    </group>
  );
}

// 7. BLACK HOLE VORTEX
function ThemeBlackHoleVortex() {
  const vortexRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (vortexRef.current) {
      vortexRef.current.rotation.z = -t * 0.45;
      vortexRef.current.scale.setScalar(1.0 + Math.sin(t * 6.0) * 0.08);
    }
  });
  return (
    <group rotation={[Math.PI / 3.5, 0, 0]}>
      <Stars radius={150} count={500} speed={0.5} />
      <Sphere args={[7.5, 16, 16]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>
      <group ref={vortexRef} rotation={[Math.PI / 2, 0, 0]}>
        <Ring args={[8.0, 22, 32]}>
          <meshBasicMaterial color="#f12711" transparent opacity={0.5} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </Ring>
        <Sparkles count={150} scale={[44, 44, 2]} size={12} speed={3.0} color="#f5af19" opacity={0.85} blending={THREE.AdditiveBlending} />
        <Sparkles count={100} scale={[30, 30, 3]} size={20} speed={4.0} color="#ffffff" opacity={0.9} blending={THREE.AdditiveBlending} />
      </group>
    </group>
  );
}

// 8. GAMMA RAY BURST
function ThemeGammaRayBurst() {
  const systemRef = useRef();
  const lightRef1 = useRef();
  const lightRef2 = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (systemRef.current) {
      systemRef.current.rotation.y = t * 0.45;
    }
    if (lightRef1.current) lightRef1.current.intensity = 1500 + Math.sin(t * 22) * 1000;
    if (lightRef2.current) lightRef2.current.intensity = 1200 + Math.cos(t * 18) * 800;
  });
  return (
    <group>
      <Stars radius={150} count={400} speed={0.8} />
      <ambientLight intensity={0.4} />
      <group ref={systemRef}>
        <pointLight ref={lightRef1} position={[-12, 0, 0]} color="#a8c0ff" distance={120} />
        <Sphere args={[3.5, 16, 16]} position={[-12, 0, 0]}>
          <meshBasicMaterial color="#a8c0ff" />
        </Sphere>
        <Sparkles count={60} scale={[15, 15, 15]} position={[-12, 0, 0]} size={24} speed={2.5} color="#ffffff" opacity={0.8} blending={THREE.AdditiveBlending} />

        <pointLight ref={lightRef2} position={[12, 0, 0]} color="#3f2b96" distance={120} />
        <Sphere args={[3, 16, 16]} position={[12, 0, 0]}>
          <meshBasicMaterial color="#3f2b96" />
        </Sphere>
        <Sparkles count={60} scale={[12, 12, 12]} position={[12, 0, 0]} size={24} speed={2.0} color="#3f2b96" opacity={0.7} blending={THREE.AdditiveBlending} />
      </group>
    </group>
  );
}

// 9. ASTEROID STORM
function ThemeAsteroidStorm() {
  const stormRef = useRef();
  const planetRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (stormRef.current) {
      stormRef.current.rotation.z = t * 0.12;
      stormRef.current.rotation.x = t * 0.05;
    }
    if (planetRef.current) {
      planetRef.current.rotation.y = -t * 0.18;
    }
  });
  return (
    <group rotation={[Math.PI / 7, Math.PI / 4, 0]} position={[15, -8, -35]}>
      <Stars radius={200} count={500} speed={1.2} />
      <pointLight intensity={2500} position={[-40, 40, 40]} color="#fda085" />
      
      <Sphere ref={planetRef} args={[28, 20, 20]}>
        <meshStandardMaterial color="#fda085" roughness={0.95} />
      </Sphere>
      
      <group ref={stormRef} rotation={[Math.PI / 2, 0, 0]}>
        <Ring args={[32, 70, 32]}>
          <meshStandardMaterial color="#f6d365" transparent opacity={0.5} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </Ring>
        <Sparkles count={250} scale={[140, 140, 4]} size={8} speed={2.5} color="#f6d365" opacity={0.85} />
        <Sparkles count={120} scale={[160, 160, 6]} size={18} speed={2.0} color="#ffffff" opacity={0.6} />
      </group>
    </group>
  );
}

// 10. COSMIC COLLISION
function ThemeCosmicCollision() {
  const collisionRef = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (collisionRef.current) {
      collisionRef.current.rotation.y = t * 0.35;
      collisionRef.current.rotation.z = t * 0.15;
      const cycle = (t * 12.0) % 80;
      collisionRef.current.scale.setScalar(0.4 + cycle * 0.08);
    }
  });
  return (
    <group>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={6000} color="#00f2fe" distance={150} />
      <group ref={collisionRef}>
        <Sparkles count={200} scale={[25, 25, 25]} size={20} speed={3.5} color="#00f2fe" opacity={0.9} blending={THREE.AdditiveBlending} />
        <Sparkles count={150} scale={[30, 30, 30]} size={12} speed={2.5} color="#e0e0e0" opacity={0.8} blending={THREE.AdditiveBlending} />
      </group>
      <Stars radius={250} count={400} speed={1.5} />
    </group>
  );
}

// ============================================================================
// SCENE MANAGER & THEME REGISTRY
// ============================================================================

const THEMES = [
  ThemeSupernovaBlast,
  ThemeSolarEruption,
  ThemeQuasarJet,
  ThemeNebulaTempest,
  ThemeHyperdriveWarp,
  ThemeMeteorShower,
  ThemeBlackHoleVortex,
  ThemeGammaRayBurst,
  ThemeAsteroidStorm,
  ThemeCosmicCollision
];

const THEME_MAP = {
  'supernova-blast': 0,
  'solar-eruption': 1,
  'quasar-jet': 2,
  'nebula-tempest': 3,
  'hyperdrive-warp': 4,
  'meteor-shower': 5,
  'blackhole-vortex': 6,
  'gammaray-burst': 7,
  'asteroid-storm': 8,
  'cosmic-collision': 9
};

function SceneManager({ theme }) { 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const fadeRef = useRef();

  useEffect(() => {
    if (theme && THEME_MAP[theme] !== undefined) {
      const targetIndex = THEME_MAP[theme];
      if (targetIndex !== currentIndex) {
        setNextIndex(targetIndex);
        setFading(true);
      }
    }
  }, [theme, currentIndex]);

  useFrame((state, delta) => {
    if (!fadeRef.current) return;
    
    if (fading) {
      fadeRef.current.opacity += delta * 1.5; 
      if (fadeRef.current.opacity >= 1) {
        fadeRef.current.opacity = 1;
        setCurrentIndex(nextIndex); 
        setFading(false); 
      }
    } else {
      if (fadeRef.current.opacity > 0) {
        fadeRef.current.opacity -= delta * 1.5; 
        if (fadeRef.current.opacity <= 0) fadeRef.current.opacity = 0;
      }
    }
  });

  const ActiveTheme = THEMES[currentIndex];

  return (
    <>
      <ActiveTheme />
      <Plane args={[200, 200]} position={[0, 0, -2]}>
        <meshBasicMaterial ref={fadeRef} color="#000000" transparent opacity={0} depthTest={false} />
      </Plane>
    </>
  );
}

function MasterCamera() {
  const { camera } = useThree();
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    camera.position.x = Math.sin(time * 0.05) * 5; 
    camera.position.y = Math.sin(time * 0.03) * 5 + 10;
    camera.position.z = Math.cos(time * 0.04) * 5 + 60;
    
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function SpaceBackground({ theme }) {
  const [isLowPerf, setIsLowPerf] = useState(() => {
    return localStorage.getItem('perf_mode_static_bg') === 'true';
  });

  useEffect(() => {
    const handlePerfChange = () => {
      setIsLowPerf(localStorage.getItem('perf_mode_static_bg') === 'true');
    };
    window.addEventListener('storage', handlePerfChange);
    window.addEventListener('perfModeChanged', handlePerfChange);
    return () => {
      window.removeEventListener('storage', handlePerfChange);
      window.removeEventListener('perfModeChanged', handlePerfChange);
    };
  }, []);

  if (isLowPerf) {
    let gradientStyle = {};
    switch (theme) {
      case 'supernova-blast':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(255, 0, 127, 0.15) 0%, rgba(13, 10, 24, 1) 70%)',
          backgroundColor: '#0a050f'
        };
        break;
      case 'solar-eruption':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(249, 212, 35, 0.15) 0%, rgba(15, 6, 4, 1) 70%)',
          backgroundColor: '#0c0402'
        };
        break;
      case 'quasar-jet':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 242, 254, 0.15) 0%, rgba(6, 12, 24, 1) 70%)',
          backgroundColor: '#03060f'
        };
        break;
      case 'nebula-tempest':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(218, 34, 255, 0.15) 0%, rgba(10, 5, 20, 1) 70%)',
          backgroundColor: '#080312'
        };
        break;
      case 'hyperdrive-warp':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 198, 255, 0.15) 0%, rgba(4, 8, 20, 1) 70%)',
          backgroundColor: '#02040d'
        };
        break;
      case 'meteor-shower':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(56, 239, 125, 0.12) 0%, rgba(4, 12, 8, 1) 70%)',
          backgroundColor: '#010603'
        };
        break;
      case 'blackhole-vortex':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(241, 39, 17, 0.15) 0%, rgba(12, 4, 4, 1) 70%)',
          backgroundColor: '#080202'
        };
        break;
      case 'gammaray-burst':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(168, 192, 255, 0.15) 0%, rgba(6, 6, 16, 1) 70%)',
          backgroundColor: '#04030a'
        };
        break;
      case 'asteroid-storm':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(246, 211, 101, 0.12) 0%, rgba(12, 9, 4, 1) 70%)',
          backgroundColor: '#060402'
        };
        break;
      case 'cosmic-collision':
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(224, 224, 224, 0.1) 0%, rgba(8, 9, 12, 1) 70%)',
          backgroundColor: '#040507'
        };
        break;
      default:
        gradientStyle = {
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 242, 254, 0.15) 0%, rgba(6, 12, 24, 1) 70%)',
          backgroundColor: '#03060f'
        };
    }

    return (
      <div 
        className="low-perf-space-background"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          ...gradientStyle,
          overflow: 'hidden',
          transition: 'background 1.5s ease-in-out'
        }}
      >
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '15%',
          width: '40vw',
          height: '40vw',
          borderRadius: '50%',
          filter: 'blur(100px)',
          opacity: 0.18,
          background: 'var(--accent-cyan, #00f2fe)',
          mixBlendMode: 'screen'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '15%',
          right: '10%',
          width: '45vw',
          height: '45vw',
          borderRadius: '50%',
          filter: 'blur(120px)',
          opacity: 0.15,
          background: 'var(--accent-purple, #7928ca)',
          mixBlendMode: 'screen'
        }} />
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.2,
          maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black, transparent 75%)'
        }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: -1,
      background: '#010103',
      overflow: 'hidden'
    }}>
      <Canvas camera={{ position: [0, 10, 70], fov: 45 }}>
        <MasterCamera />
        <SceneManager theme={theme} />
      </Canvas>
    </div>
  );
}

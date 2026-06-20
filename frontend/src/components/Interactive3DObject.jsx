import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Helper to parse materials
function getMaterialProps(materialName, color) {
  let materialProps = { color };
  const lowerMat = (materialName || '').toLowerCase();
  if (lowerMat === 'metallic') {
    materialProps.roughness = 0.1;
    materialProps.metalness = 0.95;
    materialProps.clearcoat = 1.0;
    materialProps.clearcoatRoughness = 0.1;
  } else if (lowerMat === 'matte') {
    materialProps.roughness = 0.9;
    materialProps.metalness = 0.05;
    materialProps.sheen = 0.55;
    materialProps.sheenColor = color;
  } else if (lowerMat === 'glow') {
    materialProps.roughness = 0.2;
    materialProps.metalness = 0.5;
    materialProps.emissive = color;
    materialProps.emissiveIntensity = 3.5;
  } else if (lowerMat === 'glass') {
    materialProps.roughness = 0.02;
    materialProps.metalness = 0.1;
    materialProps.transmission = 0.96;
    materialProps.thickness = 1.2;
    materialProps.clearcoat = 1.0;
    materialProps.transparent = true;
    materialProps.opacity = 0.85;
  } else {
    // Standard shiny physical material
    materialProps.roughness = 0.35;
    materialProps.metalness = 0.15;
    materialProps.clearcoat = 0.65;
    materialProps.clearcoatRoughness = 0.18;
  }
  return materialProps;
}

// Helper to get geometries for primitives
function PrimitiveMesh({ shape, color, materialProps }) {
  let geometry;
  const s = (shape || '').toLowerCase();
  if (s === 'sphere') {
    geometry = <sphereGeometry args={[2, 32, 32]} />;
  } else if (s === 'torus') {
    geometry = <torusGeometry args={[1.6, 0.5, 16, 100]} />;
  } else if (s === 'torusKnot' || s === 'knot') {
    geometry = <torusKnotGeometry args={[1.1, 0.35, 120, 16]} />;
  } else if (s === 'cylinder') {
    geometry = <cylinderGeometry args={[1.5, 1.5, 3.5, 32]} />;
  } else if (s === 'cone') {
    geometry = <coneGeometry args={[1.8, 3.5, 32]} />;
  } else if (s === 'pyramid') {
    geometry = <coneGeometry args={[1.8, 3, 4]} />;
  } else if (s === 'ring') {
    geometry = <ringGeometry args={[0.6, 2, 32]} />;
  } else if (s === 'capsule') {
    geometry = <capsuleGeometry args={[1, 1.8, 8, 32]} />;
  } else if (s === 'dodecahedron') {
    geometry = <dodecahedronGeometry args={[2]} />;
  } else if (s === 'heart') {
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.6);
    heartShape.bezierCurveTo(0, 0.6, 0.5, 1.3, 1.1, 1.3);
    heartShape.bezierCurveTo(2.0, 1.3, 2.0, 0.4, 2.0, 0.4);
    heartShape.bezierCurveTo(2.0, -0.5, 1.1, -1.3, 0, -2.2);
    heartShape.bezierCurveTo(-1.1, -1.3, -2.0, -0.5, -2.0, 0.4);
    heartShape.bezierCurveTo(-2.0, 0.4, -2.0, 1.3, -1.1, 1.3);
    heartShape.bezierCurveTo(-0.5, 1.3, 0, 0.6, 0, 0.6);
    geometry = <extrudeGeometry args={[heartShape, { depth: 0.5, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.08 }]} />;
  } else if (s === 'star') {
    const starShape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.8;
    const innerRadius = 0.8;
    starShape.moveTo(0, outerRadius);
    for (let i = 1; i <= points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      starShape.lineTo(Math.sin(angle) * r, Math.cos(angle) * r);
    }
    starShape.closePath();
    geometry = <extrudeGeometry args={[starShape, { depth: 0.5, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.08 }]} />;
  } else {
    // Cube/box is fallback
    geometry = <boxGeometry args={[2.5, 2.5, 2.5]} />;
  }

  return (
    <mesh>
      {geometry}
      <meshPhysicalMaterial {...materialProps} />
    </mesh>
  );
}

// Prebuilt composite objects
function PrebuiltComposite({ shape, color, materialProps }) {
  const s = (shape || '').toLowerCase();
  if (s === 'tree') {
    return (
      <group>
        {/* Trunk */}
        <mesh position={[0, -1, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 2, 16]} />
          <meshPhysicalMaterial color="#8B4513" roughness={0.9} />
        </mesh>
        {/* Leaves */}
        <mesh position={[0, 0.6, 0]}>
          <coneGeometry args={[1.6, 2.2, 16]} />
          <meshPhysicalMaterial color={color || "#2e8b57"} roughness={0.8} sheen={0.5} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <coneGeometry args={[1.2, 1.8, 16]} />
          <meshPhysicalMaterial color={color || "#3cb371"} roughness={0.8} sheen={0.5} />
        </mesh>
      </group>
    );
  }
  if (s === 'house') {
    return (
      <group>
        {/* Main body */}
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[2.4, 1.8, 2.4]} />
          <meshPhysicalMaterial {...materialProps} />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[2.1, 1.4, 4]} />
          <meshPhysicalMaterial color="#b22222" roughness={0.6} clearcoat={0.4} />
        </mesh>
        {/* Door */}
        <mesh position={[0, -0.85, 1.21]}>
          <boxGeometry args={[0.5, 1.1, 0.05]} />
          <meshPhysicalMaterial color="#5c4033" roughness={0.8} />
        </mesh>
      </group>
    );
  }
  if (s === 'car') {
    return (
      <group>
        {/* Chassis */}
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[3.2, 0.8, 1.6]} />
          <meshPhysicalMaterial {...materialProps} />
        </mesh>
        {/* Cabin */}
        <mesh position={[-0.2, 0.5, 0]}>
          <boxGeometry args={[1.8, 0.7, 1.4]} />
          <meshPhysicalMaterial {...materialProps} />
        </mesh>
        {/* Wheels */}
        <mesh position={[0.9, -0.6, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.25, 24]} />
          <meshPhysicalMaterial color="#111" roughness={0.8} clearcoat={0.3} />
        </mesh>
        <mesh position={[0.9, -0.6, -0.82]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.25, 24]} />
          <meshPhysicalMaterial color="#111" roughness={0.8} clearcoat={0.3} />
        </mesh>
        <mesh position={[-0.9, -0.6, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.25, 24]} />
          <meshPhysicalMaterial color="#111" roughness={0.8} clearcoat={0.3} />
        </mesh>
        <mesh position={[-0.9, -0.6, -0.82]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.25, 24]} />
          <meshPhysicalMaterial color="#111" roughness={0.8} clearcoat={0.3} />
        </mesh>
      </group>
    );
  }
  if (s === 'robot') {
    return (
      <group>
        {/* Head */}
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.9, 0.8, 0.9]} />
          <meshPhysicalMaterial {...materialProps} />
        </mesh>
        {/* Eyes */}
        <mesh position={[0.2, 1.2, 0.46]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshPhysicalMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={3.5} />
        </mesh>
        <mesh position={[-0.2, 1.2, 0.46]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshPhysicalMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={3.5} />
        </mesh>
        {/* Body */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[1.4, 1.0, 1.0]} />
          <meshPhysicalMaterial {...materialProps} />
        </mesh>
        {/* Limbs */}
        {/* Arm L */}
        <mesh position={[0.85, 0.1, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 1.1, 16]} />
          <meshPhysicalMaterial color="#777" metalness={0.8} clearcoat={0.5} />
        </mesh>
        {/* Arm R */}
        <mesh position={[-0.85, 0.1, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 1.1, 16]} />
          <meshPhysicalMaterial color="#777" metalness={0.8} clearcoat={0.5} />
        </mesh>
        {/* Leg L */}
        <mesh position={[0.35, -0.85, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.9, 16]} />
          <meshPhysicalMaterial color="#777" metalness={0.8} clearcoat={0.5} />
        </mesh>
        {/* Leg R */}
        <mesh position={[-0.35, -0.85, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.9, 16]} />
          <meshPhysicalMaterial color="#777" metalness={0.8} clearcoat={0.5} />
        </mesh>
      </group>
    );
  }
  if (s === 'rocket' || s === 'spaceship') {
    return (
      <group>
        {/* Body */}
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 2.4, 24]} />
          <meshPhysicalMaterial {...materialProps} />
        </mesh>
        {/* Nose */}
        <mesh position={[0, 1.3, 0]}>
          <coneGeometry args={[0.55, 0.9, 24]} />
          <meshPhysicalMaterial color="#ff3366" roughness={0.4} metalness={0.6} clearcoat={0.5} />
        </mesh>
        {/* Fins */}
        <mesh position={[0, -0.9, 0]}>
          <boxGeometry args={[1.9, 0.2, 0.35]} />
          <meshPhysicalMaterial color="#333" roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.9, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.9, 0.2, 0.35]} />
          <meshPhysicalMaterial color="#333" roughness={0.6} />
        </mesh>
        {/* Fire */}
        <mesh position={[0, -1.8, 0]}>
          <coneGeometry args={[0.35, 0.7, 16]} rotation={[Math.PI, 0, 0]} />
          <meshPhysicalMaterial color="#ff5500" emissive="#ff2200" emissiveIntensity={4} />
        </mesh>
      </group>
    );
  }
  if (s === 'duck') {
    return (
      <group>
        {/* Body */}
        <mesh position={[0, -0.3, 0]}>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshPhysicalMaterial {...materialProps} color={color || "yellow"} />
        </mesh>
        {/* Head */}
        <mesh position={[0.65, 0.75, 0]}>
          <sphereGeometry args={[0.75, 32, 32]} />
          <meshPhysicalMaterial {...materialProps} color={color || "yellow"} />
        </mesh>
        {/* Beak */}
        <mesh position={[1.3, 0.75, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.22, 0.55, 16]} />
          <meshPhysicalMaterial color="orange" roughness={0.5} clearcoat={0.3} />
        </mesh>
        {/* Eyes */}
        <mesh position={[0.85, 0.9, 0.35]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshPhysicalMaterial color="black" roughness={0.1} clearcoat={1.0} />
        </mesh>
        <mesh position={[0.85, 0.9, -0.35]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshPhysicalMaterial color="black" roughness={0.1} clearcoat={1.0} />
        </mesh>
      </group>
    );
  }
  if (s === 'sword') {
    return (
      <group rotation={[0, 0, Math.PI / 4]}>
        {/* Hilt */}
        <mesh position={[0, -1.7, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 16]} />
          <meshPhysicalMaterial color="#5c4033" roughness={0.8} />
        </mesh>
        {/* Crossguard */}
        <mesh position={[0, -1.15, 0]}>
          <boxGeometry args={[1.1, 0.15, 0.22]} />
          <meshPhysicalMaterial color="gold" roughness={0.2} metalness={0.9} clearcoat={0.5} />
        </mesh>
        {/* Blade */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.18, 3.0, 0.04]} />
          <meshPhysicalMaterial color="#e5e5e5" metalness={0.95} roughness={0.05} clearcoat={1.0} />
        </mesh>
      </group>
    );
  }
  if (s === 'airplane' || s === 'plane') {
    return (
      <group>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.35, 0.35, 3.5, 16]} /><meshPhysicalMaterial {...materialProps} /></mesh>
        <mesh position={[2.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.35, 0.8, 16]} /><meshPhysicalMaterial color="#ff3366" metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[0, 0.1, 0]}><boxGeometry args={[0.8, 0.08, 3.6]} /><meshPhysicalMaterial {...materialProps} /></mesh>
        <mesh position={[-1.5, 0.3, 0]}><boxGeometry args={[0.4, 0.8, 0.08]} /><meshPhysicalMaterial {...materialProps} /></mesh>
        <mesh position={[-1.5, 0.1, 0]}><boxGeometry args={[0.3, 0.05, 1.2]} /><meshPhysicalMaterial {...materialProps} /></mesh>
      </group>
    );
  }
  if (s === 'ship' || s === 'boat') {
    return (
      <group>
        <mesh position={[0, -0.5, 0]}><boxGeometry args={[3.2, 0.8, 1.4]} /><meshPhysicalMaterial color="#5D4037" roughness={0.8} /></mesh>
        <mesh position={[1.2, -0.9, 0]} rotation={[0, 0, 0.3]}><boxGeometry args={[1, 0.15, 1.5]} /><meshPhysicalMaterial color="#5D4037" roughness={0.8} /></mesh>
        <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.08, 0.08, 2, 8]} /><meshPhysicalMaterial color="#8B4513" /></mesh>
        <mesh position={[0, 1, 0.01]}><boxGeometry args={[0.05, 1.2, 0.8]} /><meshPhysicalMaterial color="#EEEEEE" /></mesh>
      </group>
    );
  }
  if (s === 'snowman') {
    return (
      <group>
        <mesh position={[0, -1.2, 0]}><sphereGeometry args={[1.1, 32, 32]} /><meshPhysicalMaterial color="#F5F5F5" roughness={0.9} /></mesh>
        <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.85, 32, 32]} /><meshPhysicalMaterial color="#FAFAFA" roughness={0.9} /></mesh>
        <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.6, 32, 32]} /><meshPhysicalMaterial color="#FFFFFF" roughness={0.9} /></mesh>
        <mesh position={[0.35, 1.25, 0.4]}><sphereGeometry args={[0.06, 8, 8]} /><meshPhysicalMaterial color="#111" /></mesh>
        <mesh position={[-0.35, 1.25, 0.4]}><sphereGeometry args={[0.06, 8, 8]} /><meshPhysicalMaterial color="#111" /></mesh>
        <mesh position={[0, 1.1, 0.55]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.08, 0.5, 8]} /><meshPhysicalMaterial color="#FF6600" /></mesh>
        <mesh position={[0, 1.65, 0]}><cylinderGeometry args={[0.45, 0.55, 0.4, 16]} /><meshPhysicalMaterial color="#111" /></mesh>
        <mesh position={[0, 1.85, 0]}><cylinderGeometry args={[0.45, 0.45, 0.1, 16]} /><meshPhysicalMaterial color="#111" /></mesh>
      </group>
    );
  }
  if (s === 'table') {
    return (
      <group>
        <mesh position={[0, 0.6, 0]}><boxGeometry args={[2.5, 0.15, 1.5]} /><meshPhysicalMaterial color={color || "#8B4513"} roughness={0.7} /></mesh>
        <mesh position={[1, -0.2, 0.55]}><cylinderGeometry args={[0.08, 0.08, 1.5, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
        <mesh position={[-1, -0.2, 0.55]}><cylinderGeometry args={[0.08, 0.08, 1.5, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
        <mesh position={[1, -0.2, -0.55]}><cylinderGeometry args={[0.08, 0.08, 1.5, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
        <mesh position={[-1, -0.2, -0.55]}><cylinderGeometry args={[0.08, 0.08, 1.5, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
      </group>
    );
  }
  if (s === 'chair') {
    return (
      <group>
        <mesh position={[0, 0, 0]}><boxGeometry args={[1.2, 0.1, 1.2]} /><meshPhysicalMaterial color={color || "#8B4513"} roughness={0.7} /></mesh>
        <mesh position={[0, 0.85, -0.55]}><boxGeometry args={[1.2, 1.6, 0.1]} /><meshPhysicalMaterial color={color || "#8B4513"} roughness={0.7} /></mesh>
        <mesh position={[0.5, -0.55, 0.5]}><cylinderGeometry args={[0.06, 0.06, 1, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
        <mesh position={[-0.5, -0.55, 0.5]}><cylinderGeometry args={[0.06, 0.06, 1, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
        <mesh position={[0.5, -0.55, -0.5]}><cylinderGeometry args={[0.06, 0.06, 1, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
        <mesh position={[-0.5, -0.55, -0.5]}><cylinderGeometry args={[0.06, 0.06, 1, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
      </group>
    );
  }
  if (s === 'lamp') {
    return (
      <group>
        <mesh position={[0, -1.5, 0]}><cylinderGeometry args={[0.6, 0.7, 0.15, 16]} /><meshPhysicalMaterial color="#333" metalness={0.8} /></mesh>
        <mesh position={[0, -0.3, 0]}><cylinderGeometry args={[0.06, 0.06, 2.2, 8]} /><meshPhysicalMaterial color="#888" metalness={0.9} /></mesh>
        <mesh position={[0, 0.9, 0]}><coneGeometry args={[0.9, 0.8, 16]} /><meshPhysicalMaterial color={color || "#FFD700"} roughness={0.6} /></mesh>
        <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.15, 16, 16]} /><meshPhysicalMaterial color="#FFFF88" emissive="#FFFF44" emissiveIntensity={3.5} /></mesh>
      </group>
    );
  }
  if (s === 'tower' || s === 'building') {
    return (
      <group>
        <mesh position={[0, 0, 0]}><boxGeometry args={[1.6, 4, 1.6]} /><meshPhysicalMaterial {...materialProps} /></mesh>
        <mesh position={[0, 2.4, 0]}><coneGeometry args={[1.2, 1.2, 4]} /><meshPhysicalMaterial color="#b22222" roughness={0.6} /></mesh>
        <mesh position={[0.4, 0.5, 0.81]}><boxGeometry args={[0.3, 0.4, 0.05]} /><meshPhysicalMaterial color="#87CEEB" roughness={0.1} metalness={0.8} /></mesh>
        <mesh position={[-0.4, 0.5, 0.81]}><boxGeometry args={[0.3, 0.4, 0.05]} /><meshPhysicalMaterial color="#87CEEB" roughness={0.1} metalness={0.8} /></mesh>
      </group>
    );
  }
  if (s === 'planet' || s === 'earth' || s === 'globe') {
    return (
      <group>
        <mesh><sphereGeometry args={[2, 64, 64]} /><meshPhysicalMaterial color={color || "#2196F3"} roughness={0.8} /></mesh>
        <mesh><torusGeometry args={[3, 0.12, 8, 64]} /><meshPhysicalMaterial color="#B0BEC5" roughness={0.4} metalness={0.6} /></mesh>
      </group>
    );
  }
  if (s === 'crown') {
    return (
      <group>
        <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[1, 1.1, 0.6, 16]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} /></mesh>
        <mesh position={[0, 0.3, 0.85]}><coneGeometry args={[0.15, 0.6, 4]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} /></mesh>
        <mesh position={[0.7, 0.3, 0.5]}><coneGeometry args={[0.15, 0.6, 4]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} /></mesh>
        <mesh position={[-0.7, 0.3, 0.5]}><coneGeometry args={[0.15, 0.6, 4]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} /></mesh>
        <mesh position={[0.85, 0.3, -0.2]}><coneGeometry args={[0.15, 0.6, 4]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} /></mesh>
        <mesh position={[-0.85, 0.3, -0.2]}><coneGeometry args={[0.15, 0.6, 4]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} /></mesh>
        <mesh position={[0, 0.55, 0.85]}><sphereGeometry args={[0.1, 16, 16]} /><meshPhysicalMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.5} /></mesh>
        <mesh position={[0, 0.55, -0.85]}><sphereGeometry args={[0.1, 16, 16]} /><meshPhysicalMaterial color="#0000FF" emissive="#0000FF" emissiveIntensity={0.5} /></mesh>
      </group>
    );
  }
  if (s === 'flower') {
    return (
      <group>
        <mesh position={[0, -1.2, 0]}><cylinderGeometry args={[0.06, 0.06, 2, 8]} /><meshPhysicalMaterial color="#228B22" /></mesh>
        <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.3, 16, 16]} /><meshPhysicalMaterial color="#FFD700" /></mesh>
        {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.cos(i * 1.257) * 0.55, 0.2, Math.sin(i * 1.257) * 0.55]}><sphereGeometry args={[0.3, 16, 16]} /><meshPhysicalMaterial color={color || "#FF69B4"} /></mesh>)}
      </group>
    );
  }
  if (s === 'mushroom') {
    return (
      <group>
        <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.35, 0.4, 1.5, 16]} /><meshPhysicalMaterial color="#F5F5DC" roughness={0.9} /></mesh>
        <mesh position={[0, 0.5, 0]}><sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color={color || "#FF0000"} roughness={0.7} /></mesh>
        <mesh position={[0.4, 0.7, 0.3]}><sphereGeometry args={[0.12, 8, 8]} /><meshPhysicalMaterial color="#FFFFFF" /></mesh>
        <mesh position={[-0.3, 0.8, -0.2]}><sphereGeometry args={[0.1, 8, 8]} /><meshPhysicalMaterial color="#FFFFFF" /></mesh>
      </group>
    );
  }
  if (s === 'trophy') {
    return (
      <group>
        {/* Base */}
        <mesh position={[0, -1.2, 0]}><boxGeometry args={[1, 0.25, 1]} /><meshPhysicalMaterial color="#8B4513" roughness={0.7} /></mesh>
        {/* Stem */}
        <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.15, 0.35, 0.8, 8]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} clearcoat={1.0} /></mesh>
        {/* Cup */}
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.6, 0.3, 1.2, 16]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} roughness={0.05} clearcoat={1.0} /></mesh>
        {/* Handles */}
        <mesh position={[0.75, 0.2, 0]}><torusGeometry args={[0.2, 0.06, 8, 16]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} /></mesh>
        <mesh position={[-0.75, 0.2, 0]}><torusGeometry args={[0.2, 0.06, 8, 16]} /><meshPhysicalMaterial color="#FFD700" metalness={0.95} /></mesh>
      </group>
    );
  }
  if (s === 'diamond' || s === 'gem') {
    return (
      <group>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[1.2, 1.5, 0.5, 8]} /><meshPhysicalMaterial color={color || "#00BFFF"} transparent opacity={0.7} metalness={0.9} roughness={0.05} transmission={0.9} thickness={0.5} /></mesh>
        <mesh position={[0, -0.6, 0]}><coneGeometry args={[1.2, 1.5, 8]} rotation={[Math.PI, 0, 0]} /><meshPhysicalMaterial color={color || "#00BFFF"} transparent opacity={0.7} metalness={0.9} roughness={0.05} transmission={0.9} thickness={0.5} /></mesh>
      </group>
    );
  }
  if (s === 'gift' || s === 'present') {
    return (
      <group>
        <mesh><boxGeometry args={[1.8, 1.8, 1.8]} /><meshPhysicalMaterial color={color || "#FF0000"} roughness={0.6} /></mesh>
        <mesh position={[0, 0, 0]}><boxGeometry args={[2, 0.2, 0.2]} /><meshPhysicalMaterial color="#FFD700" metalness={0.8} /></mesh>
        <mesh position={[0, 0, 0]}><boxGeometry args={[0.2, 0.2, 2]} /><meshPhysicalMaterial color="#FFD700" metalness={0.8} /></mesh>
        <mesh position={[0, 0, 0]}><boxGeometry args={[0.2, 2, 0.2]} /><meshPhysicalMaterial color="#FFD700" metalness={0.8} /></mesh>
        <mesh position={[0, 1.15, 0]}><torusGeometry args={[0.35, 0.08, 8, 16]} /><meshPhysicalMaterial color="#FFD700" metalness={0.8} /></mesh>
      </group>
    );
  }
  if (s === 'football' || s === 'soccer' || s === 'ball') {
    return (
      <group>
        <mesh><sphereGeometry args={[1.5, 32, 32]} /><meshPhysicalMaterial color={color || "#FFFFFF"} roughness={0.7} /></mesh>
        <mesh position={[0, 0, 1.51]}><dodecahedronGeometry args={[0.4]} /><meshPhysicalMaterial color="#111111" /></mesh>
        <mesh position={[0, 1.3, 0.7]}><dodecahedronGeometry args={[0.35]} /><meshPhysicalMaterial color="#111111" /></mesh>
        <mesh position={[1.1, 0, 1]}><dodecahedronGeometry args={[0.35]} /><meshPhysicalMaterial color="#111111" /></mesh>
      </group>
    );
  }
  if (s === 'candle') {
    return (
      <group>
        <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.4, 0.45, 2, 16]} /><meshPhysicalMaterial color={color || "#FFFDD0"} roughness={0.8} /></mesh>
        <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.02, 0.02, 0.3, 8]} /><meshPhysicalMaterial color="#333" /></mesh>
        <mesh position={[0, 0.9, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshPhysicalMaterial color="#FF6600" emissive="#FF4400" emissiveIntensity={4} /></mesh>
        <mesh position={[0, 1.05, 0]} scale={[0.6, 1.2, 0.6]}><coneGeometry args={[0.12, 0.25, 8]} /><meshPhysicalMaterial color="#FFAA00" emissive="#FF6600" emissiveIntensity={2.5} transparent opacity={0.8} /></mesh>
      </group>
    );
  }
  if (s === 'umbrella') {
    return (
      <group>
        <mesh position={[0, -0.3, 0]}><cylinderGeometry args={[0.04, 0.04, 3, 8]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
        <mesh position={[0, 1.2, 0]}><sphereGeometry args={[1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color={color || "#FF0000"} roughness={0.6} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, -1.8, 0.15]} rotation={[0.3, 0, 0]}><torusGeometry args={[0.15, 0.03, 8, 16, Math.PI]} /><meshPhysicalMaterial color="#5D4037" /></mesh>
      </group>
    );
  }
  if (s === 'balloon') {
    return (
      <group>
        <mesh position={[0, 0.5, 0]}><sphereGeometry args={[1.2, 32, 32]} /><meshPhysicalMaterial color={color || "#FF1744"} roughness={0.3} clearcoat={1.0} /></mesh>
        <mesh position={[0, -0.8, 0]}><coneGeometry args={[0.15, 0.3, 8]} /><meshPhysicalMaterial color={color || "#FF1744"} roughness={0.3} /></mesh>
        <mesh position={[0, -1.5, 0]}><cylinderGeometry args={[0.01, 0.01, 1.2, 4]} /><meshPhysicalMaterial color="#888" /></mesh>
      </group>
    );
  }
  if (s === 'camera') {
    return (
      <group>
        <mesh><boxGeometry args={[2, 1.4, 1]} /><meshPhysicalMaterial color="#333" metalness={0.7} roughness={0.3} clearcoat={0.5} /></mesh>
        <mesh position={[0, 0, 0.55]}><cylinderGeometry args={[0.45, 0.45, 0.4, 24]} rotation={[Math.PI / 2, 0, 0]} /><meshPhysicalMaterial color="#222" metalness={0.9} /></mesh>
        <mesh position={[0, 0, 0.75]}><cylinderGeometry args={[0.35, 0.4, 0.3, 24]} rotation={[Math.PI / 2, 0, 0]} /><meshPhysicalMaterial color="#111" metalness={0.9} /></mesh>
        <mesh position={[0.6, 0.85, 0]}><boxGeometry args={[0.5, 0.35, 0.4]} /><meshPhysicalMaterial color="#444" metalness={0.7} /></mesh>
      </group>
    );
  }
  return null;
}

// Dynamic Composite parsed from DSL
function DynamicComposite({ composite }) {
  const parts = [];
  if (composite) {
    const partStrings = composite.split(/[;|]/);
    partStrings.forEach((pStr) => {
      const tokens = pStr.trim().split(',');
      if (tokens.length >= 3) {
        const pShape = tokens[0].trim();
        const pColor = tokens[1].trim();
        const pMat = tokens[2].trim();
        const sx = tokens[3] ? parseFloat(tokens[3]) : 1;
        const sy = tokens[4] ? parseFloat(tokens[4]) : 1;
        const sz = tokens[5] ? parseFloat(tokens[5]) : 1;
        const px = tokens[6] ? parseFloat(tokens[6]) : 0;
        const py = tokens[7] ? parseFloat(tokens[7]) : 0;
        const pz = tokens[8] ? parseFloat(tokens[8]) : 0;
        const rx = tokens[9] ? parseFloat(tokens[9]) : 0;
        const ry = tokens[10] ? parseFloat(tokens[10]) : 0;
        const rz = tokens[11] ? parseFloat(tokens[11]) : 0;
        parts.push({
          shape: pShape,
          color: pColor,
          materialProps: getMaterialProps(pMat, pColor),
          scale: [sx, sy, sz],
          position: [px, py, pz],
          rotation: [rx, ry, rz]
        });
      }
    });
  }

  return (
    <group>
      {parts.map((p, idx) => {
        let geometry;
        const s = p.shape.toLowerCase();
        if (s === 'sphere') {
          geometry = <sphereGeometry args={[1, 32, 32]} />;
        } else if (s === 'torus') {
          geometry = <torusGeometry args={[0.8, 0.25, 16, 64]} />;
        } else if (s === 'cylinder') {
          geometry = <cylinderGeometry args={[0.5, 0.5, 1, 16]} />;
        } else if (s === 'cone') {
          geometry = <coneGeometry args={[0.5, 1, 16]} />;
        } else if (s === 'pyramid') {
          geometry = <coneGeometry args={[0.5, 1, 4]} />;
        } else if (s === 'ring') {
          geometry = <ringGeometry args={[0.3, 1, 16]} />;
        } else if (s === 'capsule') {
          geometry = <capsuleGeometry args={[0.4, 1, 4, 16]} />;
        } else if (s === 'dodecahedron') {
          geometry = <dodecahedronGeometry args={[0.8]} />;
        } else {
          geometry = <boxGeometry args={[1, 1, 1]} />;
        }

        return (
          <mesh key={idx} position={p.position} rotation={p.rotation} scale={p.scale}>
            {geometry}
            <meshPhysicalMaterial {...p.materialProps} />
          </mesh>
        );
      })}
    </group>
  );
}

// Main Wrapper Mesh for rotation
function ShapeMesh({ shape, color, material, composite }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
  });

  const materialProps = getMaterialProps(material, color || '#00f2fe');

  if (composite) {
    return (
      <group ref={meshRef}>
        <DynamicComposite composite={composite} />
      </group>
    );
  }

  const isPrebuilt = ['tree', 'house', 'car', 'robot', 'rocket', 'spaceship', 'duck', 'sword', 'airplane', 'plane', 'ship', 'boat', 'snowman', 'table', 'chair', 'lamp', 'tower', 'building', 'planet', 'earth', 'globe', 'crown', 'flower', 'mushroom', 'trophy', 'diamond', 'gem', 'gift', 'present', 'football', 'soccer', 'ball', 'candle', 'umbrella', 'balloon', 'camera'].includes((shape || '').toLowerCase());
  if (isPrebuilt) {
    return (
      <group ref={meshRef}>
        <PrebuiltComposite shape={shape} color={color} materialProps={materialProps} />
      </group>
    );
  }

  return (
    <group ref={meshRef}>
      <PrimitiveMesh shape={shape} color={color} materialProps={materialProps} />
    </group>
  );
}

export default function Interactive3DObject({ shape, color, material, composite, label }) {
  const displayColor = color || '#00f2fe';
  return (
    <div style={{
      width: '100%',
      height: '380px',
      background: 'rgba(6, 6, 18, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.85), 0 8px 32px rgba(0,0,0,0.4)',
      margin: '20px 0',
      backdropFilter: 'blur(8px)'
    }}>
      {label && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          color: '#fff',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.65)',
          padding: '5px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.15)',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          letterSpacing: '0.02em'
        }}>
          🎨 3D Rendered {label}
        </div>
      )}
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} shadows>
        <color attach="background" args={['#060612']} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 10]} intensity={2.5} castShadow />
        <directionalLight position={[-10, 10, -10]} intensity={1.2} />
        <pointLight position={[0, -10, 0]} intensity={0.8} />
        <ShapeMesh shape={shape} color={displayColor} material={material} composite={composite} />
        <OrbitControls enableZoom={true} enablePan={true} maxDistance={15} minDistance={3.5} />
      </Canvas>
      <div style={{
        position: 'absolute',
        bottom: '12px',
        right: '15px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.45)',
        pointerEvents: 'none',
        fontFamily: 'Inter, sans-serif',
        background: 'rgba(0,0,0,0.4)',
        padding: '2px 8px',
        borderRadius: '4px'
      }}>
        🖱️ Drag to rotate | Scroll to zoom
      </div>
    </div>
  );
}

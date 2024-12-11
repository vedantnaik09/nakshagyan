'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float } from '@react-three/drei';
import * as THREE from 'three';

function Rocket(props: any) {
  const rocketRef = useRef<THREE.Group>();

  useFrame((state) => {
    if (rocketRef.current) {
      rocketRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
      rocketRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
      <group ref={rocketRef} {...props} rotation={[0, -Math.PI / 4, 0]}>
        {/* Main body */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.5, 2, 32]} />
          <meshStandardMaterial color="#ff3333" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Nose cone */}
        <mesh position={[0, 1.2, 0]}>
          <coneGeometry args={[0.3, 0.8, 32]} />
          <meshStandardMaterial color="#ff3333" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Fins */}
        {[0, Math.PI * (2/3), Math.PI * (4/3)].map((rotation, index) => (
          <mesh key={index} position={[0, -0.8, 0]} rotation={[0, rotation, 0]}>
            <boxGeometry args={[0.1, 0.8, 0.8]} />
            <meshStandardMaterial color="#cc0000" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Engine nozzle */}
        <mesh position={[0, -1.2, 0]}>
          <cylinderGeometry args={[0.2, 0.3, 0.4, 32]} />
          <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Windows/Details */}
        {[0, Math.PI/2, Math.PI, Math.PI * 1.5].map((rotation, index) => (
          <mesh key={`window-${index}`} position={[0, 0.3, 0]} rotation={[0, rotation, 0]}>
            <cylinderGeometry args={[0.51, 0.51, 0.2, 16]} />
            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.5} />
          </mesh>
        ))}

        {/* Engine Glow */}
        <mesh position={[0, -1.4, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color="#ff4400" transparent opacity={0.6} />
        </mesh>
      </group>
    </Float>
  );
}

export function RocketScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 5], fov: 45 }}
      className="bg-black"
    >
      <Environment preset="night" />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 5, 5]}
        castShadow
        intensity={1}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Rocket position={[0, 0, 0]} scale={0.8} />
      
      {/* Red accent lights */}
      <pointLight position={[-2, 0, 2]} color="#ff0000" intensity={2} />
      <pointLight position={[2, 0, -2]} color="#ff0000" intensity={2} />

      {/* Engine glow */}
      <pointLight position={[0, -2, 0]} color="#ff4400" intensity={5} />

      {/* Ambient glow */}
      <fog attach="fog" args={['#000', 5, 15]} />
    </Canvas>
  );
}
/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import React, { useRef, useState, useEffect, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import { easing } from 'maath';

interface FluidGlassProps {
  scale?: number;
  ior?: number;
  thickness?: number;
  roughness?: number;
  transmission?: number;
}

export default function FluidGlass({ 
  scale = 0.5,
  ior = 1.35,
  thickness = 1.8,
  roughness = 0.08,
  transmission = 0.92
}: FluidGlassProps) {
  return (
    <Canvas 
      camera={{ position: [0, 0, 20], fov: 15 }} 
      gl={{ alpha: true, antialias: true }}
      style={{ pointerEvents: 'none', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999 }}
    >
      {/* Lights to illuminate the glass sphere and catch specular highlights */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[8, 8, 8]} intensity={2.5} color="#ffffff" />
      <pointLight position={[-5, -5, -5]} intensity={1.5} color="#E6BE72" />
      <pointLight position={[5, -5, 5]} intensity={1.0} color="#7C5CFF" />
      
      <GlassCursor 
        scale={scale}
        ior={ior}
        thickness={thickness}
        roughness={roughness}
        transmission={transmission}
      />
      <Preload />
    </Canvas>
  );
}

const GlassCursor = memo(function GlassCursor({
  scale,
  ior,
  thickness,
  roughness,
  transmission
}: {
  scale: number;
  ior: number;
  thickness: number;
  roughness: number;
  transmission: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    const { pointer, camera } = state;
    const v = state.viewport.getCurrentViewport(camera, [0, 0, 15]);

    // Map screen cursor (-1 to 1) to viewport space coordinates
    const destX = (pointer.x * v.width) / 2;
    const destY = (pointer.y * v.height) / 2;
    
    // Easing for smooth lag follow effect
    easing.damp3(ref.current.position, [destX, destY, 15], 0.08, delta);
    
    // Rotate slightly on move for physical feeling
    ref.current.rotation.x = destY * 0.08;
    ref.current.rotation.y = destX * 0.08;
  });

  return (
    <mesh
      ref={ref}
      scale={scale}
    >
      {/* Smooth sphere representing the magnifying glass bubble */}
      <sphereGeometry args={[1.5, 64, 64]} />
      <meshPhysicalMaterial
        transmission={transmission}
        roughness={roughness}
        ior={ior}
        thickness={thickness}
        clearcoat={1.0}
        clearcoatRoughness={0.0}
        color="#faf6ee"
        transparent
        opacity={0.88}
        roughnessMap={null}
        metalness={0.05}
      />
    </mesh>
  );
});

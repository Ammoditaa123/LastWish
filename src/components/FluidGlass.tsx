/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import React, { useRef, useState, useEffect, memo, ReactNode } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import {
  useFBO,
  Preload,
  MeshTransmissionMaterial,
  Text
} from '@react-three/drei';
import { easing } from 'maath';

type Mode = 'lens' | 'bar' | 'cube';

interface NavItem {
  label: string;
  link: string;
}

type ModeProps = Record<string, unknown>;

interface FluidGlassProps {
  mode?: Mode;
  lensProps?: ModeProps;
  barProps?: ModeProps;
  cubeProps?: ModeProps;
  children?: ReactNode;
}

export default function FluidGlass({ 
  mode = 'lens', 
  lensProps = {}, 
  barProps = {}, 
  cubeProps = {},
  children
}: FluidGlassProps) {
  const Wrapper = mode === 'bar' ? Bar : mode === 'cube' ? Cube : Lens;
  const rawOverrides = mode === 'bar' ? barProps : mode === 'cube' ? cubeProps : lensProps;

  const {
    navItems = [
      { label: 'Home', link: '' },
      { label: 'About', link: '' },
      { label: 'Contact', link: '' }
    ],
    ...modeProps
  } = rawOverrides;

  return (
    <Canvas 
      camera={{ position: [0, 0, 20], fov: 15 }} 
      gl={{ alpha: true, antialias: true }}
      style={{ pointerEvents: 'none' }} // allow clicking through to standard HTML components
    >
      {mode === 'bar' && <NavItems items={navItems as NavItem[]} />}
      <Wrapper modeProps={modeProps}>
        {children || <WebGLBackgroundScene />}
        <Preload />
      </Wrapper>
    </Canvas>
  );
}

interface ModeWrapperProps {
  children?: ReactNode;
  geometryKey: 'Lens' | 'Cube' | 'Bar';
  lockToBottom?: boolean;
  followPointer?: boolean;
  modeProps?: ModeProps;
}

const ModeWrapper = memo(function ModeWrapper({
  children,
  geometryKey,
  lockToBottom = false,
  followPointer = true,
  modeProps = {},
  ...props
}: ModeWrapperProps) {
  const ref = useRef<THREE.Mesh>(null!);
  const buffer = useFBO();
  const { viewport: vp } = useThree();
  const [scene] = useState(() => new THREE.Scene());

  useFrame((state, delta) => {
    const { gl, viewport, pointer, camera } = state;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);

    // Track cursor with smooth damp easing
    const destX = followPointer ? (pointer.x * v.width) / 2 : 0;
    const destY = lockToBottom ? -v.height / 2 + 0.25 : followPointer ? (pointer.y * v.height) / 2 : 0;
    
    easing.damp3(ref.current.position, [destX, destY, 15], 0.08, delta);

    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  });

  const { scale, ior, thickness, anisotropy, chromaticAberration, ...extraMat } = modeProps as {
    scale?: number;
    ior?: number;
    thickness?: number;
    anisotropy?: number;
    chromaticAberration?: number;
    [key: string]: unknown;
  };

  // Determine standard 3D geometry to use instead of GLB models
  const renderGeometry = () => {
    if (geometryKey === 'Lens') {
      // Standard smooth sphere geometry to act as a magnifying lens
      return <sphereGeometry args={[2.0, 64, 64]} />;
    } else if (geometryKey === 'Cube') {
      return <boxGeometry args={[2.5, 2.5, 2.5]} />;
    } else {
      // Bar mode geometry
      return <boxGeometry args={[10, 1, 1]} />;
    }
  };

  return (
    <>
      {createPortal(children, scene)}
      
      {/* Background canvas buffer layer */}
      <mesh scale={[vp.width, vp.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} transparent opacity={1} />
      </mesh>
      
      {/* Refraction Lens Mesh */}
      <mesh
        ref={ref}
        scale={scale ?? 1.2}
        rotation-x={geometryKey === 'Lens' ? 0 : Math.PI / 4}
        rotation-y={geometryKey === 'Lens' ? 0 : Math.PI / 4}
        {...props}
      >
        {renderGeometry()}
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          ior={ior ?? 1.22}
          thickness={thickness ?? 2.5}
          anisotropy={anisotropy ?? 0.05}
          chromaticAberration={chromaticAberration ?? 0.08}
          roughness={0.0}
          transmission={1.0}
          distortion={0.15}
          distortionScale={0.15}
          temporalDistortion={0.0}
          {...(typeof extraMat === 'object' && extraMat !== null ? extraMat : {})}
        />
      </mesh>
    </>
  );
});

function Lens({ modeProps, children, ...p }: { modeProps?: ModeProps; children?: ReactNode }) {
  return <ModeWrapper geometryKey="Lens" followPointer modeProps={modeProps} {...p}>{children}</ModeWrapper>;
}

function Cube({ modeProps, children, ...p }: { modeProps?: ModeProps; children?: ReactNode }) {
  return <ModeWrapper geometryKey="Cube" followPointer modeProps={modeProps} {...p}>{children}</ModeWrapper>;
}

function Bar({ modeProps = {}, children, ...p }: { modeProps?: ModeProps; children?: ReactNode }) {
  const defaultMat = {
    transmission: 1,
    roughness: 0,
    thickness: 10,
    ior: 1.15,
    color: '#ffffff',
    attenuationColor: '#ffffff',
    attenuationDistance: 0.25
  };

  return (
    <ModeWrapper
      geometryKey="Bar"
      lockToBottom
      followPointer={false}
      modeProps={{ ...defaultMat, ...modeProps }}
      {...p}
    >
      {children}
    </ModeWrapper>
  );
}

function NavItems({ items }: { items: NavItem[] }) {
  const group = useRef<THREE.Group>(null!);
  const { viewport, camera } = useThree();

  const DEVICE = {
    mobile: { max: 639, spacing: 0.2, fontSize: 0.035 },
    tablet: { max: 1023, spacing: 0.24, fontSize: 0.045 },
    desktop: { max: Infinity, spacing: 0.3, fontSize: 0.045 }
  };
  const getDevice = () => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    return w <= DEVICE.mobile.max ? 'mobile' : w <= DEVICE.tablet.max ? 'tablet' : 'desktop';
  };

  const [device, setDevice] = useState<keyof typeof DEVICE>('desktop');

  useEffect(() => {
    setDevice(getDevice());
    const onResize = () => setDevice(getDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { spacing, fontSize } = DEVICE[device];

  useFrame(() => {
    if (!group.current) return;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);
    group.current.position.set(0, -v.height / 2 + 0.2, 15.1);

    group.current.children.forEach((child, i) => {
      child.position.x = (i - (items.length - 1) / 2) * spacing;
    });
  });

  const handleNavigate = (link: string) => {
    if (!link) return;
    link.startsWith('#') ? (window.location.hash = link) : (window.location.href = link);
  };

  return (
    <group ref={group} renderOrder={10}>
      {items.map(({ label, link }) => (
        <Text
          key={label}
          fontSize={fontSize}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0}
          outlineBlur="20%"
          outlineColor="#000"
          outlineOpacity={0.5}
          renderOrder={10}
          onClick={e => {
            e.stopPropagation();
            handleNavigate(link);
          }}
          onPointerOver={() => {
            if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
          }}
        >
          {label}
        </Text>
      ))}
    </group>
  );
}

function WebGLBackgroundScene() {
  const particlesRef = useRef<THREE.Group>(null!);
  const blob1Ref = useRef<THREE.Mesh>(null!);
  const blob2Ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.015;
      particlesRef.current.rotation.x = t * 0.008;
    }
    if (blob1Ref.current) {
      blob1Ref.current.position.y = Math.sin(t * 0.5) * 0.5;
      blob1Ref.current.position.x = Math.cos(t * 0.3) * 0.4 - 2;
    }
    if (blob2Ref.current) {
      blob2Ref.current.position.y = Math.cos(t * 0.4) * 0.4;
      blob2Ref.current.position.x = Math.sin(t * 0.5) * 0.4 + 2;
    }
  });

  return (
    <group>
      {/* 3D Drifting stars */}
      <group ref={particlesRef}>
        {Array.from({ length: 45 }).map((_, i) => {
          const x = (Math.random() - 0.5) * 16;
          const y = (Math.random() - 0.5) * 10;
          const z = (Math.random() - 0.5) * 10;
          const size = Math.random() * 0.04 + 0.015;
          return (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[size, 8, 8]} />
              <meshBasicMaterial color="#E6BE72" transparent opacity={0.35} />
            </mesh>
          );
        })}
      </group>

      {/* Floating blurred accent blobs */}
      <mesh ref={blob1Ref} position={[-2, 0, -2]}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color="#2563EB" transparent opacity={0.07} />
      </mesh>
      
      <mesh ref={blob2Ref} position={[2, 0, -2]}>
        <sphereGeometry args={[3.0, 32, 32]} />
        <meshBasicMaterial color="#E6BE72" transparent opacity={0.04} />
      </mesh>

      {/* Center ambient glow sphere */}
      <mesh position={[0, 0, -1]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color="#E6BE72" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

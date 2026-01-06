"use client";

import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function Voxels({ voxelsRef, voxelsVersion, gridW, gridH, voxelOffset = { x: 0, y: 0 }, insetX = 0.18, insetY = 0.14 }) {
  // Convert insets to NDC space (-1 to 1)
  const ndcLeft = insetX * 2 - 1;
  const ndcRight = (1 - insetX) * 2 - 1;
  const ndcTop = 1 - insetY * 2;

  const gridWidthNDC = ndcRight - ndcLeft;
  const gridHeightNDC = ndcTop - (-ndcTop); // symmetric

  const cellW = gridWidthNDC / gridW;
  const cellH = gridHeightNDC / gridH;

  // Convert offset from grid-relative (0-1) to NDC
  const offsetX = voxelOffset.x * gridWidthNDC;
  const offsetY = -voxelOffset.y * gridHeightNDC; // negative because Y is inverted

  // Convert Set to array for rendering
  const voxelKeys = useMemo(() => {
    return Array.from(voxelsRef.current);
  }, [voxelsVersion, voxelsRef]);

  return (
    <group>
      {voxelKeys.map((key) => {
        const [gx, gy] = key.split(",").map(Number);
        const x = ndcLeft + (gx + 0.5) * cellW + offsetX;
        const y = ndcTop - (gy + 0.5) * cellH + offsetY;
        
        return (
          <mesh key={key} position={[x, y, 0.5]}>
            <boxGeometry args={[cellW * 0.85, cellH * 0.85, 0.1]} />
            <meshStandardMaterial
              color="#1a1a2e"
              emissive="#2d2d44"
              emissiveIntensity={0.8}
              transparent
              opacity={0.95}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function PointerGlow({ pointer, pinching }) {
  const ref = useRef(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (!ref.current) return;
      const x = pointer.x * 2 - 1;
      const y = 1 - pointer.y * 2;
      ref.current.position.set(x, y, 0.35);
      // Scale smaller for pinching feedback
      const size = pinching ? 0.025 : 0.018;
      ref.current.scale.set(size, size * 1.6, size); // stretch Y to compensate for aspect ratio
    }, 16);
    return () => clearInterval(t);
  }, [pointer, pinching]);

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color={"#3d3d5c"}
        emissive={"#4a4a6a"}
        emissiveIntensity={1.2}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

export default function VoxelScene({
  voxelsRef,
  voxelsVersion,
  gridW,
  gridH,
  pointer,
  pinching,
  dragging,
  voxelOffset = { x: 0, y: 0 },
  insetX = 0.18,
  insetY = 0.14,
}) {
  return (
    <Canvas
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 3,
      }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <OrthographicCamera 
        makeDefault 
        position={[0, 0, 10]} 
        left={-1}
        right={1}
        top={1}
        bottom={-1}
        near={0.1}
        far={100}
      />
      <ambientLight intensity={1.05} />
      <directionalLight position={[2, 3, 6]} intensity={1.3} />

      <Voxels
        voxelsRef={voxelsRef}
        voxelsVersion={voxelsVersion}
        gridW={gridW}
        gridH={gridH}
        voxelOffset={voxelOffset}
        insetX={insetX}
        insetY={insetY}
      />
      <PointerGlow pointer={pointer} pinching={pinching} />
    </Canvas>
  );
}

"use client";

import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function Voxels({ voxelsRef, voxelsVersion, gridW, gridH }) {
  const meshRef = useRef(null);
  const maxCount = gridW * gridH;

  const cellW = 2 / gridW;
  const cellH = 2 / gridH;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#00E5FF"),
        transparent: true,
        opacity: 0.75,
        roughness: 0.15,
        metalness: 0.05,
        emissive: new THREE.Color("#00CFFF"),
        emissiveIntensity: 1.15,
      }),
    []
  );

  useEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;

    const dummy = new THREE.Object3D();
    const keys = Array.from(voxelsRef.current);

    let i = 0;

    for (; i < keys.length && i < maxCount; i++) {
      const [gx, gy] = keys[i].split(",").map(Number);

      // Map grid to -1..1 world
      const x = -1 + (gx + 0.5) * cellW;
      const y = 1 - (gy + 0.5) * cellH;

      dummy.position.set(x, y, 0.1); // keep above grid
      dummy.scale.set(cellW * 0.9, cellH * 0.9, Math.min(cellW, cellH) * 0.7);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }

    // hide remaining instances
    for (; i < maxCount; i++) {
      dummy.position.set(999, 999, 999);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }

    inst.instanceMatrix.needsUpdate = true;
  }, [voxelsVersion, voxelsRef, gridW, gridH, maxCount, cellW, cellH]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, maxCount]}>
      <boxGeometry args={[1, 1, 1]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
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
      ref.current.scale.setScalar(pinching ? 0.09 : 0.07);
    }, 16);
    return () => clearInterval(t);
  }, [pointer, pinching]);

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 28, 28]} />
      <meshStandardMaterial
        color={"#00E5FF"}
        emissive={"#00CFFF"}
        emissiveIntensity={1.45}
        transparent
        opacity={0.92}
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
}) {
  return (
    <Canvas
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5, // make sure it's above grid overlay
      }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={1} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[2, 3, 6]} intensity={1.3} />

      <Voxels
        voxelsRef={voxelsRef}
        voxelsVersion={voxelsVersion}
        gridW={gridW}
        gridH={gridH}
      />
      <PointerGlow pointer={pointer} pinching={pinching} />
    </Canvas>
  );
}

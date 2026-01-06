"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VoxelScene from "./VoxelScene";
import GridOverlay from "./GridOverlay";

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function isPinch(lm) {
  return dist(lm[4], lm[8]) < 0.045;
}
function fingerExtended(lm, tip, pip) {
  return lm[tip].y < lm[pip].y;
}
function isOK(lm) {
  const pinch = isPinch(lm);
  const middle = fingerExtended(lm, 12, 10);
  const ring = fingerExtended(lm, 16, 14);
  const pinky = fingerExtended(lm, 20, 18);
  return pinch && middle && ring && pinky;
}

function drawHand(ctx, lm, w, h) {
  const lines = [
    [0, 1],[1, 2],[2, 3],[3, 4],
    [0, 5],[5, 6],[6, 7],[7, 8],
    [5, 9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17],
  ];

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
  ctx.fillStyle = "rgba(0, 229, 255, 0.95)";

  ctx.beginPath();
  for (const [a, b] of lines) {
    const ax = lm[a].x * w;
    const ay = lm[a].y * h;
    const bx = lm[b].x * w;
    const by = lm[b].y * h;
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();

  for (let i = 0; i < lm.length; i++) {
    const x = lm[i].x * w;
    const y = lm[i].y * h;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function Gesture3DWriter() {
  const videoRef = useRef(null);
  const handCanvasRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [pinching, setPinching] = useState(false);
  const [status, setStatus] = useState("Loading…");

  const voxelsRef = useRef(new Set());
  const [voxelsVersion, setVoxelsVersion] = useState(0);

  const lastDropRef = useRef(0);
  const lastOkRef = useRef(0);

  const GRID_W = 34;
  const GRID_H = 22;

  // Inset values must match GridOverlay
  const INSET_X = 0.18;
  const INSET_Y = 0.14;

  // pointer in DISPLAY coords (mirrored)
  const pointer = useMemo(() => ({ x: 0.5, y: 0.5 }), []);

  useEffect(() => {
    // prevent double-init in dev
    if (typeof window !== "undefined" && window.__GW_STARTED) return;
    if (typeof window !== "undefined") window.__GW_STARTED = true;

    let stream = null;
    let rafId = 0;
    let disposed = false;
    let handLandmarker = null;

    const waitForVideoReady = (video) =>
      new Promise((resolve) => {
        const check = () => {
          if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });

    const start = async () => {
      try {
        setStatus("Requesting camera…");
        const video = videoRef.current;
        const canvas = handCanvasRef.current;
        if (!video || !canvas) return;

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;

        await waitForVideoReady(video);

        try {
          await video.play();
        } catch (e) {
          if (!disposed) console.warn("video.play warning:", e);
        }

        setStatus("Loading hand model…");

        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, HandLandmarker } = vision;

        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        handLandmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        setReady(true);
        setStatus("READY");

        const loop = () => {
          if (disposed || !handLandmarker) return;

          if (video.readyState < 2 || video.videoWidth === 0) {
            rafId = requestAnimationFrame(loop);
            return;
          }

          const w = video.videoWidth;
          const h = video.videoHeight;

          // canvas uses video pixels; CSS stretches it fullscreen
          const canvasEl = handCanvasRef.current;
          canvasEl.width = w;
          canvasEl.height = h;

          const ctx = canvasEl.getContext("2d");
          ctx.clearRect(0, 0, w, h);

          try {
            const res = handLandmarker.detectForVideo(video, performance.now());

            if (res?.landmarks?.length) {
              const raw = res.landmarks[0];

              // mirror coords so they match mirrored video
              const lm = raw.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));

              pointer.x = lm[8].x;
              pointer.y = lm[8].y;

              drawHand(ctx, lm, w, h);

              const pinch = isPinch(lm);
              setPinching(pinch);

              if (isOK(lm)) {
                const now = Date.now();
                if (now - lastOkRef.current > 900) {
                  lastOkRef.current = now;
                  voxelsRef.current.clear();
                  setVoxelsVersion((v) => v + 1);
                }
              }

              if (pinch) {
                const now = Date.now();
                if (now - lastDropRef.current > 35) {
                  lastDropRef.current = now;

                  // Map pointer to grid-relative coordinates (accounting for inset)
                  const gridRelX = (pointer.x - INSET_X) / (1 - 2 * INSET_X);
                  const gridRelY = (pointer.y - INSET_Y) / (1 - 2 * INSET_Y);

                  // Clamp to grid bounds
                  const clampedX = Math.max(0, Math.min(1, gridRelX));
                  const clampedY = Math.max(0, Math.min(1, gridRelY));
                  
                  const gx = Math.floor(clampedX * (GRID_W - 1));
                  const gy = Math.floor(clampedY * (GRID_H - 1));

                  const key = `${gx},${gy}`;
                  if (!voxelsRef.current.has(key)) {
                    voxelsRef.current.add(key);
                    setVoxelsVersion((v) => v + 1);
                  }
                }
              }
            } else {
              setPinching(false);
            }
          } catch (e) {
            if (!disposed) console.warn("detectForVideo warning:", e);
          }

          rafId = requestAnimationFrame(loop);
        };

        loop();
      } catch (e) {
        console.error(e);
        setStatus(e?.name === "NotAllowedError" ? "Camera blocked" : "Error starting");
      }
    };

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);

      try {
        handLandmarker?.close?.();
      } catch {}

      const v = videoRef.current;
      const s = stream || v?.srcObject;
      if (s?.getTracks) s.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;

      try {
        delete window.__GW_STARTED;
      } catch {}
    };
  }, [pointer]);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}>
      {/* ✅ FULLSCREEN CAMERA (real object-fit cover, no stretching) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)", // mirror selfie
          background: "#000",
          zIndex: 1,
        }}
      />
      <GridOverlay gridW={GRID_W} gridH={GRID_H} />

      {/* 3D overlays (grid + voxels + pointer) */}
      <VoxelScene
        voxelsRef={voxelsRef}
        voxelsVersion={voxelsVersion}
        gridW={GRID_W}
        gridH={GRID_H}
        pointer={pointer}
        pinching={pinching}
        insetX={INSET_X}
        insetY={INSET_Y}
      />

      {/* Hand overlay */}
      <canvas
        ref={handCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity: 0.95,
          zIndex: 4,
        }}
      />

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 14,
          padding: "8px 12px",
          borderRadius: 999,
          background: "rgba(0,0,0,.45)",
          border: "1px solid rgba(255,255,255,.10)",
          color: "#fff",
          fontSize: 12,
          zIndex: 10,
        }}
      >
        {ready ? (pinching ? "DRAWING (pinch)" : "READY") : status}
      </div>

      <div
        style={{
          position: "absolute",
          right: 14,
          top: 14,
          padding: "8px 12px",
          borderRadius: 999,
          background: "rgba(0,0,0,.45)",
          border: "1px solid rgba(255,255,255,.10)",
          color: "#fff",
          fontSize: 12,
          opacity: 0.9,
          zIndex: 10,
        }}
      >
        OK = clear
      </div>
    </main>
  );
}

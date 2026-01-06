"use client";

import { useEffect, useRef } from "react";

export default function GridOverlay({ gridW = 34, gridH = 22 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const draw = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, w, h);

      // grid style (visible like your reference)
      ctx.strokeStyle = "rgba(0, 229, 255, 0.18)";
      ctx.lineWidth = 1;

      // optional: center area grid stronger
      const insetX = w * 0.18;
      const insetY = h * 0.14;
      const gw = w - insetX * 2;
      const gh = h - insetY * 2;

      // draw main grid only in center region (looks cleaner)
      for (let i = 0; i <= gridW; i++) {
        const x = insetX + (i / gridW) * gw;
        ctx.beginPath();
        ctx.moveTo(x, insetY);
        ctx.lineTo(x, insetY + gh);
        ctx.stroke();
      }
      for (let j = 0; j <= gridH; j++) {
        const y = insetY + (j / gridH) * gh;
        ctx.beginPath();
        ctx.moveTo(insetX, y);
        ctx.lineTo(insetX + gw, y);
        ctx.stroke();
      }

      // subtle vignette (Ironman-ish)
      const grd = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.2, w/2, h/2, Math.min(w,h)*0.65);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    };

    draw();

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);

    window.addEventListener("resize", draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [gridW, gridH]);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: 1,
      }}
    />
  );
}

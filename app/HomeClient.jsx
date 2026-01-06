"use client";

import dynamic from "next/dynamic";

const Gesture3DWriter = dynamic(
  () => import("./gesture-3d-writer/ui/Gesture3DWriter"),
  { ssr: false }
);

export default function HomeClient() {
  return <Gesture3DWriter />;
}

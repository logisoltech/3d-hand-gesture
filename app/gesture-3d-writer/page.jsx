"use client";

import dynamic from "next/dynamic";

const Gesture3DWriter = dynamic(() => import("./ui/Gesture3DWriter"), {
  ssr: false,
});

export default function Page() {
  return <Gesture3DWriter />;
}

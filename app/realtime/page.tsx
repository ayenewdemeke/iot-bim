"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type PoseMsg = {
  actorId: string;
  ts: number;
  x: number;
  y: number;
  z: number;
};

export default function RealtimePage() {
  const socketRef = useRef<Socket | null>(null);
  const [pose, setPose] = useState<PoseMsg | null>(null);

  useEffect(() => {
    const s = io({ transports: ["websocket"] });
    socketRef.current = s;

    s.on("pose", (msg: PoseMsg) => setPose(msg));

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Simple 2D visual: map x,y (-5..5) into a 300x300 box
  const px = pose ? (pose.x + 5) * 30 : 150;
  const py = pose ? (pose.y + 5) * 30 : 150;

  return (
    <div style={{ padding: 20 }}>
      <h2>Realtime stream test</h2>

      <div
        style={{
          width: 300,
          height: 300,
          border: "1px solid #ccc",
          position: "relative",
          marginTop: 12,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            position: "absolute",
            left: px - 7,
            top: py - 7,
            background: "black",
          }}
        />
      </div>

      <pre style={{ marginTop: 12 }}>
        {pose ? JSON.stringify(pose, null, 2) : "waiting..."}
      </pre>
    </div>
  );
}

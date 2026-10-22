"use client";

import { useEffect, useRef, useState } from "react";

export default function OmegaCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  async function startCamera() {
    try {
      setError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setActive(true);
    } catch {
      setError("No se pudo activar la cámara. Comprueba los permisos.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setActive(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          objectFit: "cover",
          transform: "scaleX(-1)",
          zIndex: 0,
          display: active ? "block" : "none"
        }}
      />

      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        <button
          type="button"
          onClick={active ? stopCamera : startCamera}
          style={{
            background: "rgba(0,15,25,0.85)",
            border: "1px solid #00eaff",
            borderRadius: 10,
            color: "#00eaff",
            padding: "12px 18px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          {active ? "APAGAR CÁMARA" : "ENCENDER CÁMARA"}
        </button>

        {error && (
          <span style={{ color: "#ff5577", fontSize: 12 }}>
            {error}
          </span>
        )}
      </div>
    </>
  );
}

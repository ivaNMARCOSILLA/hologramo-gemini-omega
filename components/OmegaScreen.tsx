"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";

export type OmegaScreenHandle = {
  start: () => Promise<boolean>;
  stop: () => void;
  capture: () => string | null;
};

const OmegaScreen = forwardRef<OmegaScreenHandle>(
  function OmegaScreen(_, ref) {
    const streamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [sharing, setSharing] = useState(false);
    const [message, setMessage] = useState("");

    function stop() {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setSharing(false);
    }

    async function start(): Promise<boolean> {
      try {
        setMessage("");

        const stream =
          await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: "monitor"
            },
            audio: false,
          });

        streamRef.current = stream;

        stream.getVideoTracks()[0].addEventListener(
          "ended",
          () => {
            streamRef.current = null;
            setSharing(false);
          },
          { once: true }
        );

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setSharing(true);
        return true;
      } catch {
        setMessage("No se ha compartido ninguna pantalla.");
        return false;
      }
    }

    useImperativeHandle(ref, () => ({
      // OMEGA_SCREEN_VOICE_CONTROL
      start,
      stop,
      capture() {
        const video = videoRef.current;

        if (
          !streamRef.current ||
          !video ||
          video.readyState < 2 ||
          !video.videoWidth
        ) {
          return null;
        }

        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1280 / video.videoWidth);

        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);

        const context = canvas.getContext("2d");
        if (!context) return null;

        context.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height
        );

        return canvas.toDataURL("image/jpeg", 0.68);
      }
    }));

    useEffect(() => {
      return () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
      };
    }, []);

    return (
      <div className="omega-screen-tools">
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          style={{ display: "none" }}
        />

        <button
          type="button"
          onClick={sharing ? stop : start}
          className="omega-screen-button"
        >
          {sharing
            ? "■ DEJAR DE COMPARTIR"
            : "▣ COMPARTIR PANTALLA"}
        </button>

        <span className="omega-screen-state">
          {sharing
            ? "● OMEGA PUEDE ANALIZAR LA PANTALLA COMPARTIDA"
            : "PANTALLA NO COMPARTIDA"}
        </span>

        {message && (
          <span className="omega-screen-error">{message}</span>
        )}
      </div>
    );
  }
);

export default OmegaScreen;
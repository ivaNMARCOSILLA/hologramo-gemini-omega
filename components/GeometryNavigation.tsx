"use client";

import { useEffect } from "react";

type Props = {
  onPrevious: () => void;
  onNext: () => void;
};

export default function GeometryNavigation({
  onPrevious,
  onNext
}: Props) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("input, textarea, select") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) return;

      if (event.key === "ArrowRight") onNext();
      if (event.key === "ArrowLeft") onPrevious();
    }

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onPrevious, onNext]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12
      }}
    >
      <button type="button" onClick={onPrevious}>
        ◀ Anterior
      </button>
      <button type="button" onClick={onNext}>
        Siguiente ▶
      </button>
    </div>
  );
}

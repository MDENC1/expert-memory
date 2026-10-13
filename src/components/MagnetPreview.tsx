import { useEffect, useRef } from "react";
import type { CalendarDay, Notice } from "../types";
import { MAGNET_HEIGHT, MAGNET_WIDTH, renderMagnetCanvas } from "../lib/renderMagnet";

export default function MagnetPreview({
  day,
  notice,
  shulName = "SHUL",
  fit = false,
}: {
  day: CalendarDay;
  notice?: Notice;
  shulName?: string;
  fit?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderMagnetCanvas(canvasRef.current, {
      day,
      notice,
      shulName,
      width: MAGNET_WIDTH,
      height: MAGNET_HEIGHT,
    });
  }, [day, notice, shulName]);

  return (
    <div className={fit ? "panel previewPanel fitPreviewPanel" : "panel previewPanel"}>
      <div className="panelHead">
        <div>
          <span className="eyebrow">648 × 480 preview · LIVE DAY</span>
          <h2>Magnet Preview</h2>
        </div>
        <span className="pill">Monochrome</span>
      </div>

      <canvas
        ref={canvasRef}
        width={MAGNET_WIDTH}
        height={MAGNET_HEIGHT}
        aria-label="Live e-paper magnet preview"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxWidth: MAGNET_WIDTH,
          margin: fit ? "0 auto" : undefined,
          background: "#fff",
          border: "1px solid #111",
          borderRadius: 8,
        }}
      />
    </div>
  );
}

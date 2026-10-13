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
          <span className="eyebrow">Goal product · roughly 6&quot; × 4&quot;</span>
          <h2>Magnet Preview</h2>
        </div>
        <span className="pill">E-paper</span>
      </div>

      <div className="goalMagnetPreviewWrap">
        <div className="goalMagnetDevice" aria-label="Goal refrigerator magnet product preview">
          <div className="goalMagnetScreen">
            <canvas
              ref={canvasRef}
              width={MAGNET_WIDTH}
              height={MAGNET_HEIGHT}
              aria-label="Live e-paper screen preview"
            />
          </div>
        </div>
        <small className="goalMagnetCaption">Concept enclosure · screen content shown at the target 648 × 480 layout</small>
      </div>
    </div>
  );
}

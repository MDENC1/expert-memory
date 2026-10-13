import { useEffect, useRef } from "react";
import type { CalendarDay, Notice } from "../types";
import { MAGNET_HEIGHT, MAGNET_WIDTH, renderMagnetCanvas } from "../lib/renderMagnet";

const PREVIEW_SCALE=1.5;
const PREVIEW_WIDTH=Math.round(MAGNET_WIDTH*PREVIEW_SCALE);
const PREVIEW_HEIGHT=Math.round(MAGNET_HEIGHT*PREVIEW_SCALE);

export default function MagnetPreview({
  day,
  notice,
  notices,
  shulName = "SHUL",
  fit = false,
}: {
  day: CalendarDay;
  notice?: Notice;
  notices?: Notice[];
  shulName?: string;
  fit?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderMagnetCanvas(canvasRef.current, {
      day,
      notice,
      notices,
      shulName,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
    });
  }, [day, notice, notices, shulName]);

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
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              aria-label="Live e-paper screen preview"
            />
          </div>
        </div>
        <small className="goalMagnetCaption">Concept enclosure · responsive e-paper layout · final native resolution follows the production panel</small>
      </div>
    </div>
  );
}

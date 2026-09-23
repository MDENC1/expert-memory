import type { CalendarDay, Notice } from "../types";

export default function MagnetPreview({day, notice}:{day:CalendarDay; notice?:Notice}) {
  return (
    <div className="panel previewPanel">
      <div className="panelHead">
        <div><span className="eyebrow">648 × 480 preview</span><h2>Magnet Preview</h2></div>
        <span className="pill">Monochrome</span>
      </div>
      <div className="epaper">
        <div className="epHeader">
          <strong>YOUNG ISRAEL OF EXAMPLE</strong>
          <span>{day.hebrewDate} {day.hebrewMonth} 5787 · OCT {day.englishDay}</span>
        </div>
        <div className="epBody">
          <div className="epTimes">
            <div><b>SHACHARIS</b><strong>{day.shacharis}</strong></div>
            <div><b>MINCHA</b><strong>{day.mincha}</strong></div>
            <div><b>MAARIV</b><strong>{day.maariv}</strong></div>
          </div>
          <div className="epNotice">
            <b>{notice?.headline || day.event || "THIS WEEK"}</b>
            <span>{notice?.details || "Weekly shiur Wednesday 8:45 PM"}</span>
          </div>
        </div>
        <div className="epFooter"><span>Candle Lighting 6:27 PM</span><span>Daf Yomi: Menachos 42</span></div>
      </div>
    </div>
  );
}

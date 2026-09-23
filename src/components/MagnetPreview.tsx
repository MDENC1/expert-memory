import type { CalendarDay, Notice } from "../types";

export default function MagnetPreview({day, notice}:{day:CalendarDay; notice?:Notice}) {
  const prominent = day.specialTimes?.filter(item => item.importance === "prominent") ?? [];
  const parsed = new Date(`${day.date}T12:00:00`);
  const englishDate = new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(parsed).toUpperCase();

  return (
    <div className="panel previewPanel">
      <div className="panelHead">
        <div><span className="eyebrow">648 × 480 preview</span><h2>Magnet Preview</h2></div>
        <span className="pill">Monochrome</span>
      </div>

      <div className="epaper">
        <div className="epHeader">
          <strong>YOUNG ISRAEL OF EXAMPLE</strong>
          <span>{day.hebrewDate} {day.hebrewMonth} · {englishDate}</span>
        </div>

        {(day.holiday || day.isRoshChodesh) && (
          <div className="epJewishDay">{day.holiday || "ROSH CHODESH"}</div>
        )}

        {prominent.length > 0 && (
          <div className="epKeyTimes">
            {prominent.map(item => (
              <div key={item.key} className="epKeyTime">
                <b>{item.label.toUpperCase()}</b>
                <strong>{item.time}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="epBody">
          <div className="epTimes">
            <div><b>SHACHARIS</b><strong>{day.shacharis || "—"}</strong></div>
            <div><b>MINCHA</b><strong>{day.mincha || "—"}</strong></div>
            <div><b>MAARIV</b><strong>{day.maariv || "—"}</strong></div>
          </div>

          <div className="epNotice">
            <b>{notice?.headline || day.event || "COMMUNITY UPDATE"}</b>
            {notice?.eventTime && <strong className="epEventTime">{notice.eventTime}</strong>}
            <span>{notice?.details || "No special notice scheduled for this day."}</span>
          </div>
        </div>

        <div className="epFooter">
          <span>{day.isRoshChodesh ? "Rosh Chodesh" : "Jewish calendar synced"}</span>
          <span>Daf Yomi</span>
        </div>
      </div>
    </div>
  );
}

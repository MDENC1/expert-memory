import type { CalendarDay, Notice } from "../types";

export default function MagnetPreview({day, notice, shulName="SHUL"}:{day:CalendarDay; notice?:Notice; shulName?:string}) {
  const prominent = day.specialTimes?.filter(item => item.importance === "prominent") ?? [];
  const parsed = new Date(`${day.date}T12:00:00`);
  const englishDate = new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric"}).format(parsed).toUpperCase();
  const scheduleRows=day.shulScheduleRows ?? [];

  return (
    <div className="panel previewPanel">
      <div className="panelHead">
        <div><span className="eyebrow">648 × 480 preview · LIVE DAY</span><h2>Magnet Preview</h2></div>
        <span className="pill">Monochrome</span>
      </div>

      <div className="epaper">
        <div className="epHeader">
          <strong>{shulName.toUpperCase()}</strong>
          <span dir="rtl">{day.hebrewFullDate || `${day.hebrewDate} ${day.hebrewMonth}`}</span>
          <span>{englishDate}</span>
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
          {scheduleRows.length > 0 ? (
            <div className="epScheduleRows">
              {scheduleRows.map((row,i)=>(
                <div className="epScheduleRow" key={`${row.label}-${i}`}>
                  <b>{row.label}</b>
                  <strong>{row.time || ""}</strong>
                  {row.note && <small>{row.note}</small>}
                </div>
              ))}
            </div>
          ) : (
            <div className="epTimes">
              <div><b>SHACHARIS</b><strong>{day.shacharis || "—"}</strong></div>
              <div><b>MINCHA</b><strong>{day.mincha || "—"}</strong></div>
              <div><b>MAARIV</b><strong>{day.maariv || "—"}</strong></div>
            </div>
          )}

          {(notice || day.event) && (
            <div className="epNotice">
              <b>{notice?.headline || day.event}</b>
              {notice?.eventTime && <strong className="epEventTime">{notice.eventTime}</strong>}
              {notice?.details && <span>{notice.details}</span>}
            </div>
          )}
        </div>

        <div className="epFooter">
          <span>{day.isRoshChodesh ? "Rosh Chodesh" : "Supabase schedule"}</span>
          <span>Daf Yomi</span>
        </div>
      </div>
    </div>
  );
}

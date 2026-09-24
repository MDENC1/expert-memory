import { useEffect, useRef, useState } from "react";
import type { CalendarDay, Notice } from "../types";

export default function MagnetPreview({day, notice, shulName="SHUL", fit=false}:{day:CalendarDay; notice?:Notice; shulName?:string; fit?:boolean}) {
  const fitRef=useRef<HTMLDivElement|null>(null);
  const [fitScale,setFitScale]=useState(1);

  useEffect(()=>{
    if(!fit||!fitRef.current)return;
    const node=fitRef.current;
    const update=()=>setFitScale(Math.min(1,Math.max(0,(node.clientWidth-2)/648)));
    update();
    const ro=new ResizeObserver(update);
    ro.observe(node);
    return()=>ro.disconnect();
  },[fit]);
  const prominent = day.specialTimes?.filter(item => item.importance === "prominent") ?? [];
  const parsed = new Date(`${day.date}T12:00:00`);
  const englishDate = new Intl.DateTimeFormat("en-US",{
    weekday:"long",
    month:"long",
    day:"numeric",
    year:"numeric"
  }).format(parsed);
  const scheduleRows=day.shulScheduleRows ?? [];

  return (
    <div className={fit ? "panel previewPanel fitPreviewPanel" : "panel previewPanel"}>
      <div className="panelHead">
        <div><span className="eyebrow">648 × 480 preview · LIVE DAY</span><h2>Magnet Preview</h2></div>
        <span className="pill">Monochrome</span>
      </div>

      {fit ? (
        <div className="epaperFitViewport" ref={fitRef} style={{height:480*fitScale}}>
          <div className="epaper epaperFitCanvas" style={{transform:`scale(${fitScale})`}}>
        <div className="epBrandHeader">
          <div className="epLogoSlot" aria-label="Shul logo placeholder">
            <span>LOGO</span>
          </div>
          <div className="epBrandText">
            <strong className="epShulName">{shulName.toUpperCase()}</strong>
            <div className="epDateRow">
              <div className="epEnglishDate" dir="ltr">{englishDate}</div>
              <div className="epHebrewDate" dir="rtl" lang="he">{day.hebrewFullDate || `${day.hebrewDate} ${day.hebrewMonth}`}</div>
            </div>
          </div>
        </div>

        {prominent.length > 0 && (
          <div className="epPriorityBox">
            {prominent.map(item => (
              <div key={item.key}>
                <b>{item.label.toUpperCase()}</b>
                <strong>{item.time}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="epTopSplit">
          <section className="epZmanim">
            <div className="epSectionTitle">ZMANIM</div>
            <div className="epUnavailable">
              <strong>Live zmanim pending</strong>
              <span>MyZmanim is not connected yet.</span>
            </div>
          </section>

          <section className="epShul">
            <div className="epSectionTitle">SHUL</div>
            {day.holiday && <div className="epHolidayLabel">{day.holiday}</div>}

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
              <div className="epScheduleRows">
                <div className="epScheduleRow"><b>Shacharis</b><strong>{day.shacharis || "—"}</strong></div>
                <div className="epScheduleRow"><b>Mincha</b><strong>{day.mincha || "—"}</strong></div>
                <div className="epScheduleRow"><b>Maariv</b><strong>{day.maariv || "—"}</strong></div>
              </div>
            )}
          </section>
        </div>

        <section className="epNotices">
          <div className="epSectionTitle">NOTICES</div>
          {(notice || day.event) ? (
            <div className="epNotice">
              <b>{notice?.headline || day.event}</b>
              {notice?.eventTime && <strong className="epEventTime">{notice.eventTime}</strong>}
              {notice?.details && <span>{notice.details}</span>}
            </div>
          ) : (
            <div className="epNoNotice">No notices today.</div>
          )}
        </section>

        <div className="epFooter">
          <span>{day.isRoshChodesh ? "Rosh Chodesh" : "Supabase schedule"}</span>
          <span>Daf Yomi</span>
        </div>
          </div>
        </div>
      ) : (
        <div className="epaper">
          <div className="epBrandHeader">
            <div className="epLogoSlot" aria-label="Shul logo placeholder"><span>LOGO</span></div>
            <div className="epBrandText">
              <strong className="epShulName">{shulName.toUpperCase()}</strong>
              <div className="epDateRow">
                <div className="epEnglishDate" dir="ltr">{englishDate}</div>
                <div className="epHebrewDate" dir="rtl" lang="he">{day.hebrewFullDate || `${day.hebrewDate} ${day.hebrewMonth}`}</div>
              </div>
            </div>
          </div>

          {prominent.length > 0 && (
            <div className="epPriorityBox">
              {prominent.map(item => (
                <div key={item.key}><b>{item.label.toUpperCase()}</b><strong>{item.time}</strong></div>
              ))}
            </div>
          )}

          <div className="epTopSplit">
            <section className="epZmanim">
              <div className="epSectionTitle">ZMANIM</div>
              <div className="epUnavailable"><strong>Live zmanim pending</strong><span>MyZmanim is not connected yet.</span></div>
            </section>
            <section className="epShul">
              <div className="epSectionTitle">SHUL</div>
              {day.holiday && <div className="epHolidayLabel">{day.holiday}</div>}
              {scheduleRows.length > 0 ? (
                <div className="epScheduleRows">
                  {scheduleRows.map((row,i)=>(
                    <div className="epScheduleRow" key={`${row.label}-${i}`}>
                      <b>{row.label}</b><strong>{row.time || ""}</strong>{row.note && <small>{row.note}</small>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="epScheduleRows">
                  <div className="epScheduleRow"><b>Shacharis</b><strong>{day.shacharis || "—"}</strong></div>
                  <div className="epScheduleRow"><b>Mincha</b><strong>{day.mincha || "—"}</strong></div>
                  <div className="epScheduleRow"><b>Maariv</b><strong>{day.maariv || "—"}</strong></div>
                </div>
              )}
            </section>
          </div>

          <section className="epNotices">
            <div className="epSectionTitle">NOTICES</div>
            {(notice || day.event) ? (
              <div className="epNotice">
                <b>{notice?.headline || day.event}</b>
                {notice?.eventTime && <strong className="epEventTime">{notice.eventTime}</strong>}
                {notice?.details && <span>{notice.details}</span>}
              </div>
            ) : <div className="epNoNotice">No notices today.</div>}
          </section>

          <div className="epFooter">
            <span>{day.isRoshChodesh ? "Rosh Chodesh" : "Supabase schedule"}</span>
            <span>Daf Yomi</span>
          </div>
        </div>
      )}
    </div>
  );
}

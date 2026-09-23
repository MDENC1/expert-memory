import { useMemo, useState } from "react";
import type { CalendarDay, Notice, NoticeType } from "../types";
import MagnetPreview from "../components/MagnetPreview";

type Props = {
  days: CalendarDay[];
  setDays: (days:CalendarDay[]) => void;
  notices: Notice[];
  setNotices: (notices:Notice[]) => void;
};

type MonthCell = {
  date: string;
  day: number;
  hebrewDay: string;
  hebrewMonth: string;
  isRoshChodesh: boolean;
  isShabbos: boolean;
};

const pad = (n:number) => String(n).padStart(2,"0");
const isoDate = (d:Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function hebrewParts(date:Date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-hebrew",{day:"numeric",month:"short"}).formatToParts(date);
  const day = parts.find(p=>p.type==="day")?.value ?? "";
  const month = parts.find(p=>p.type==="month")?.value ?? "";
  return {day,month};
}

function buildMonth(year:number,month:number):MonthCell[] {
  const count = new Date(year,month+1,0).getDate();
  return Array.from({length:count},(_,i)=>{
    const d = new Date(year,month,i+1,12);
    const h = hebrewParts(d);
    return {
      date: isoDate(d),
      day:i+1,
      hebrewDay:h.day,
      hebrewMonth:h.month,
      isRoshChodesh:h.day==="1" || h.day==="30",
      isShabbos:d.getDay()===6
    };
  });
}

function noticeMatchesDate(notice:Notice,date:string) {
  if (date < notice.startAt || date > notice.endAt) return false;
  if (!notice.recurrence?.enabled) return true;

  const d = new Date(`${date}T12:00:00`);
  if (notice.recurrence.frequency === "daily") return true;
  if (notice.recurrence.frequency === "weekly") return notice.recurrence.weekdays?.includes(d.getDay()) ?? false;
  if (notice.recurrence.frequency === "monthly") return notice.recurrence.monthDays?.includes(d.getDate()) ?? false;
  return true;
}

export default function CalendarPage({days,setDays,notices,setNotices}:Props) {
  const [viewDate,setViewDate] = useState(new Date(2026,8,1,12));
  const [multiMode,setMultiMode] = useState(false);
  const [selected,setSelected] = useState<string[]>([]);
  const [showAdd,setShowAdd] = useState(false);
  const [newType,setNewType] = useState<NoticeType>("Event");
  const [newHeadline,setNewHeadline] = useState("");
  const [newDetails,setNewDetails] = useState("");
  const [newTime,setNewTime] = useState("");

  const year=viewDate.getFullYear();
  const month=viewDate.getMonth();
  const monthName=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(viewDate);
  const monthCells=useMemo(()=>buildMonth(year,month),[year,month]);
  const firstDow=new Date(year,month,1,12).getDay();

  const seedByDate=useMemo(()=>new Map(days.map(d=>[d.date,d])),[days]);
  const selectedDay=selected.length===1 ? selected[0] : undefined;
  const selectedCell=selectedDay ? monthCells.find(c=>c.date===selectedDay) : undefined;

  const selectedCalendarDay:CalendarDay|undefined = selectedCell ? (() => {
    const existing=seedByDate.get(selectedCell.date);
    return existing ?? {
      date:selectedCell.date,
      englishDay:selectedCell.day,
      hebrewDate:selectedCell.hebrewDay,
      hebrewMonth:selectedCell.hebrewMonth,
      isRoshChodesh:selectedCell.isRoshChodesh,
      isShabbos:selectedCell.isShabbos,
      shacharis:selectedCell.isShabbos?"9:00":"6:30 · 7:30",
      mincha:"6:25",
      maariv:selectedCell.isShabbos?"7:35":"8:15",
      template:selectedCell.isShabbos?"Shabbos":"Regular Weekday"
    };
  })() : undefined;

  const previewNotice=selectedDay ? notices.find(n=>noticeMatchesDate(n,selectedDay)) : undefined;

  const changeMonth=(delta:number)=>{
    setViewDate(new Date(year,month+delta,1,12));
    setSelected([]);
    setShowAdd(false);
  };

  const handleDayClick=(date:string)=>{
    if (multiMode) {
      setSelected(v=>v.includes(date)?v.filter(x=>x!==date):[...v,date].sort());
      return;
    }
    setSelected([date]);
    setShowAdd(false);
  };

  const updateSelectedDay=(key:"shacharis"|"mincha"|"maariv",value:string)=>{
    if (!selectedDay || !selectedCalendarDay) return;
    const next={...selectedCalendarDay,[key]:value};
    const without=days.filter(d=>d.date!==selectedDay);
    setDays([...without,next].sort((a,b)=>a.date.localeCompare(b.date)));
  };

  const addToSelectedDates=()=>{
    if (!selected.length || !newHeadline.trim()) return;
    const additions=selected.map((date,i):Notice=>({
      id:`calendar_${Date.now()}_${i}`,
      type:newType,
      headline:newHeadline.trim(),
      details:newDetails.trim(),
      startAt:date,
      endAt:date,
      eventTime:(newType==="Event" || newType==="Schedule Change") ? newTime : undefined,
      recurrence:{enabled:false},
      priority:"normal",
      publishMode:"scheduled",
      status:"scheduled"
    }));
    setNotices([...additions,...notices]);
    setNewHeadline("");setNewDetails("");setNewTime("");setShowAdd(false);
  };

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Calendar</span>
          <h1>{monthName}</h1>
          <p>Browse past or future months, edit individual days, select multiple dates, and preview exactly what members will see.</p>
        </div>
        <div className="headerActions">
          <button className="secondary" onClick={()=>changeMonth(-1)}>← Previous</button>
          <button className="secondary" onClick={()=>setViewDate(new Date(2026,8,1,12))}>This Month</button>
          <button className="secondary" onClick={()=>changeMonth(1)}>Next →</button>
        </div>
      </div>

      <div className="calendarToolbar">
        <button className={multiMode?"choice active":"secondary"} onClick={()=>{setMultiMode(v=>!v);setSelected([]);setShowAdd(false);}}>
          {multiMode ? "✓ Selecting Multiple Days" : "Select Multiple Days"}
        </button>
        <span>{selected.length ? `${selected.length} day${selected.length===1?"":"s"} selected` : "Click a day to edit and preview it."}</span>
        {selected.length>0 && <button className="primary" onClick={()=>setShowAdd(true)}>+ Add Event / Notice</button>}
      </div>

      <div className="calendarLayout">
        <div className="calendarWrap">
          <div className="calendar">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Shabbos"].map(w=><div key={w} className="weekday">{w}</div>)}
            {Array.from({length:firstDow}).map((_,i)=><div key={`blank-${i}`} className="dayCell empty" />)}
            {monthCells.map(cell=>{
              const existing=seedByDate.get(cell.date);
              const matching=notices.filter(n=>noticeMatchesDate(n,cell.date));
              return (
                <button
                  key={cell.date}
                  className={`dayCell ${selected.includes(cell.date)?"selected":""} ${cell.isShabbos?"shabbos":""} ${cell.isRoshChodesh?"roshChodesh":""}`}
                  onClick={()=>handleDayClick(cell.date)}
                >
                  <div className="dateTop"><strong>{cell.day}</strong><span>{cell.hebrewDay} {cell.hebrewMonth}</span></div>
                  <div className="dayTags">
                    {cell.isRoshChodesh && <span className="jewishTag">Rosh Chodesh</span>}
                    {matching.length>0 && <span className="eventCount">{matching.length} scheduled</span>}
                  </div>
                  <div className="times">
                    <span><b>Shach.</b> {existing?.shacharis || (cell.isShabbos?"9:00":"6:30 · 7:30")}</span>
                    <span><b>Min.</b> {existing?.mincha || "6:25"}</span>
                    <span><b>Maariv</b> {existing?.maariv || (cell.isShabbos?"7:35":"8:15")}</span>
                  </div>
                  {existing?.specialTimes?.slice(0,1).map(item=><div className="keyCalendarTime" key={item.key}><b>{item.label}</b><strong>{item.time}</strong></div>)}
                  {matching.slice(0,2).map(n=><div className="eventTag" key={n.id}>{n.eventTime && <b>{n.eventTime} · </b>}{n.headline}</div>)}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="calendarSide">
          {selectedCalendarDay ? (
            <>
              <div className="panel compactPanel">
                <div className="panelHead"><div><span className="eyebrow">Selected day</span><h2>{new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric"}).format(new Date(`${selectedCalendarDay.date}T12:00:00`))}</h2></div></div>
                <div className="inlineTimeFields">
                  <label>Shacharis<input value={selectedCalendarDay.shacharis || ""} onChange={e=>updateSelectedDay("shacharis",e.target.value)} /></label>
                  <label>Mincha<input value={selectedCalendarDay.mincha || ""} onChange={e=>updateSelectedDay("mincha",e.target.value)} /></label>
                  <label>Maariv<input value={selectedCalendarDay.maariv || ""} onChange={e=>updateSelectedDay("maariv",e.target.value)} /></label>
                </div>
                <button className="primary fullButton" onClick={()=>setShowAdd(true)}>+ Add Event / Notice to This Day</button>
              </div>
              <MagnetPreview day={selectedCalendarDay} notice={previewNotice} />
            </>
          ) : (
            <div className="panel emptyPreview"><strong>Select one day</strong><span>Its editable schedule and magnet preview will appear here.</span></div>
          )}
        </aside>
      </div>

      {showAdd && selected.length>0 && (
        <div className="panel calendarAddPanel">
          <div className="panelHead"><div><span className="eyebrow">Add to calendar</span><h2>{selected.length===1?"This day":`${selected.length} selected days`}</h2></div><button className="secondary" onClick={()=>setShowAdd(false)}>Close</button></div>
          <div className="formGrid">
            <label>Type<select value={newType} onChange={e=>setNewType(e.target.value as NoticeType)}><option>Event</option><option>Schedule Change</option><option>General Notice</option><option>Sponsorship</option><option>Yahrtzeit</option></select></label>
            {(newType==="Event" || newType==="Schedule Change") && <label>Time<input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} /></label>}
          </div>
          <label>Headline<input value={newHeadline} onChange={e=>setNewHeadline(e.target.value)} placeholder="e.g. Daf Yomi Shiur" /></label>
          <label>Details<textarea value={newDetails} onChange={e=>setNewDetails(e.target.value)} placeholder="Optional details" /></label>
          <div className="formActions"><button className="primary" onClick={addToSelectedDates}>Add to Selected Date{selected.length===1?"":"s"}</button></div>
        </div>
      )}
    </>
  );
}

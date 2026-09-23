import { useMemo, useState } from "react";
import type { Notice, NoticeType, RecurrenceFrequency } from "../types";

const noticeTypes: NoticeType[] = ["Yahrtzeit","Sponsorship","Mazel Tov","Condolence / Shiva","Schedule Change","Event","General Notice"];
const recurringTypes = new Set<NoticeType>(["Yahrtzeit","Sponsorship","Schedule Change","Event","General Notice"]);
const weekdayOptions = [
  ["Sun",0],["Mon",1],["Tue",2],["Wed",3],["Thu",4],["Fri",5],["Shabbos",6]
] as const;

export default function NoticesPage({
  notices,setNotices,remainingPushes,usePush
}:{
  notices:Notice[];
  setNotices:(n:Notice[])=>void;
  remainingPushes:number;
  usePush:()=>void;
}) {
  const [showForm,setShowForm] = useState(false);
  const [type,setType] = useState<NoticeType>("General Notice");
  const [headline,setHeadline] = useState("");
  const [details,setDetails] = useState("");
  const [startAt,setStartAt] = useState("2026-09-23");
  const [endAt,setEndAt] = useState("2026-09-30");
  const [eventTime,setEventTime] = useState("");
  const [recurring,setRecurring] = useState(false);
  const [frequency,setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [weekdays,setWeekdays] = useState<number[]>([]);
  const [monthDays,setMonthDays] = useState<number[]>([]);

  const canRecur = recurringTypes.has(type);
  const needsTime = type === "Event" || type === "Schedule Change";
  const recurrenceSummary = useMemo(() => {
    if (!recurring || !canRecur) return "";
    if (frequency === "daily") return "Daily";
    if (frequency === "weekly") return `Weekly: ${weekdays.map(d=>weekdayOptions.find(x=>x[1]===d)?.[0]).filter(Boolean).join(", ") || "choose day(s)"}`;
    if (frequency === "monthly") return `Monthly: day ${monthDays.join(", ") || "—"}`;
    return "Yearly on Hebrew date";
  },[recurring,canRecur,frequency,weekdays,monthDays]);

  const publish = (mode:"scheduled"|"immediate") => {
    if (mode==="immediate" && remainingPushes<=0) return;

    const newNotice:Notice = {
      id:`notice_${Date.now()}`,
      type,
      headline:headline || type,
      details,
      startAt,
      endAt,
      eventTime: needsTime ? eventTime : undefined,
      recurrence: canRecur ? { enabled: recurring, frequency: recurring ? frequency : undefined, weekdays, monthDays } : { enabled:false },
      priority:"normal",
      publishMode:mode,
      status: mode==="immediate" ? "live" : "scheduled"
    };

    setNotices([newNotice,...notices]);
    if(mode==="immediate") usePush();
    setHeadline(""); setDetails(""); setEventTime(""); setRecurring(false); setWeekdays([]); setMonthDays([]); setShowForm(false);
  };

  const toggleWeekday = (day:number) => setWeekdays(v=>v.includes(day)?v.filter(x=>x!==day):[...v,day].sort());
  const toggleMonthDay = (day:number) => setMonthDays(v=>v.includes(day)?v.filter(x=>x!==day):[...v,day].sort((a,b)=>a-b));

  return (
    <>
      <div className="pageHeader">
        <div><span className="eyebrow">Scheduled communication</span><h1>Notices & Events</h1><p>One-time or recurring content that appears on the magnet during the dates you choose.</p></div>
        <button className="primary" onClick={()=>setShowForm(true)}>+ Add Notice or Event</button>
      </div>

      <div className="pushBanner">
        <div><strong>Immediate updates today</strong><span>{remainingPushes} of 2 remaining</span></div>
        <p>Regular overnight updates do not count against this limit.</p>
      </div>

      {showForm && (
        <div className="panel formPanel">
          <div className="panelHead"><div><span className="eyebrow">New content</span><h2>Add Notice or Event</h2></div></div>

          <div className="formGrid">
            <label>Type<select value={type} onChange={e=>{setType(e.target.value as NoticeType);setRecurring(false);}}>{noticeTypes.map(n=><option key={n}>{n}</option>)}</select></label>
            {needsTime && <label>Event / schedule time<input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} /></label>}
            <label>Display start date<input type="date" value={startAt} onChange={e=>setStartAt(e.target.value)} /></label>
            <label>Display end date<input type="date" value={endAt} onChange={e=>setEndAt(e.target.value)} /></label>
          </div>

          <label>Headline<input value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="Short headline" /></label>
          <label>Details<textarea value={details} onChange={e=>setDetails(e.target.value)} placeholder="What should members see?" /></label>

          {canRecur && (
            <div className="recurrenceBox">
              <label className="checkRow">
                <input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)} />
                <span><strong>Recurring?</strong><small>Set this once instead of recreating the notice or event.</small></span>
              </label>

              {recurring && (
                <>
                  <label>Repeats
                    <select value={frequency} onChange={e=>setFrequency(e.target.value as RecurrenceFrequency)}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      {type === "Yahrtzeit" && <option value="yearly_hebrew">Yearly on Hebrew date</option>}
                    </select>
                  </label>

                  {frequency === "weekly" && <div className="choiceRow">{weekdayOptions.map(([label,day])=><button type="button" key={day} className={weekdays.includes(day)?"choice active":"choice"} onClick={()=>toggleWeekday(day)}>{label}</button>)}</div>}
                  {frequency === "monthly" && <div className="monthDayGrid">{Array.from({length:31},(_,i)=>i+1).map(day=><button type="button" key={day} className={monthDays.includes(day)?"choice active":"choice"} onClick={()=>toggleMonthDay(day)}>{day}</button>)}</div>}
                  <div className="recurrenceSummary">{recurrenceSummary}</div>
                </>
              )}
            </div>
          )}

          <div className="formActions">
            <button className="secondary" onClick={()=>setShowForm(false)}>Cancel</button>
            <button className="secondary" onClick={()=>publish("scheduled")}>Save for regular update</button>
            <button className="primary" disabled={remainingPushes<=0} onClick={()=>publish("immediate")}>Send to Magnets Now ({remainingPushes} left)</button>
          </div>
        </div>
      )}

      <div className="noticeList">
        {notices.map(n=>(
          <div className="noticeRow" key={n.id}>
            <span className="typeBadge">{n.type}</span>
            <div>
              <strong>{n.headline}</strong>
              {n.eventTime && <div className="noticeTime">{n.eventTime}</div>}
              <p>{n.details}</p>
              {n.recurrence?.enabled && <small className="recurringLabel">Recurring · {n.recurrence.frequency}</small>}
            </div>
            <div className="noticeMeta"><span>{n.startAt} → {n.endAt}</span><b>{n.status}</b></div>
          </div>
        ))}
      </div>
    </>
  );
}

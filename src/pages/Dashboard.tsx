import type { CalendarDay, Notice } from "../types";
import type { LiveScheduleEntry } from "../App";
import MagnetPreview from "../components/MagnetPreview";

const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Shabbos"];
function prettyTime(t:string|null){
  if(!t) return "";
  const [h,m]=t.split(":").map(Number);
  const d=new Date(2000,0,1,h,m);
  return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(d);
}
function ruleText(r:LiveScheduleEntry){
  if(r.service_time) return prettyTime(r.service_time);
  const base=(r.timing_source||"rule").replaceAll("_"," ");
  const off=r.timing_offset_minutes||0;
  return `${base}${off ? ` ${off>0?"+":""}${off} min` : ""}`;
}

export default function Dashboard({
  days, notices, remainingPushes, onGoCalendar, onAddNotice,
  shulName,activeMagnets,healthyMagnets,scheduleEntries,loading
}: {
  days: CalendarDay[];
  notices: Notice[];
  remainingPushes: number;
  onGoCalendar: () => void;
  onAddNotice: () => void;
  shulName:string;
  activeMagnets:number;
  healthyMagnets:number;
  scheduleEntries:LiveScheduleEntry[];
  loading:boolean;
}) {
  const today = days[8];
  const now=new Date();
  const dateLabel=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(now);

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">{dateLabel} · LIVE SUPABASE</span>
          <h1>{loading ? "Loading…" : shulName}</h1>
          <p>This page is now reading the pilot shul directly from Supabase.</p>
        </div>
        <button className="primary" onClick={onAddNotice}>+ Add Notice</button>
      </div>

      <div className="statsGrid">
        <div className="stat"><span>Active magnets</span><strong>{loading ? "—" : activeMagnets}</strong><small>{healthyMagnets} healthy</small></div>
        <div className="stat"><span>Next regular update</span><strong>12:15 AM</strong><small>current pilot rule</small></div>
        <div className="stat"><span>Immediate updates</span><strong>{remainingPushes} / 2</strong><small>remaining today</small></div>
        <div className="stat"><span>Active notices</span><strong>{notices.length}</strong><small>from Supabase</small></div>
      </div>

      <div className="twoCol">
        <div className="panel">
          <div className="panelHead">
            <div><span className="eyebrow">Supabase</span><h2>Weekly shul rules</h2></div>
            <button className="secondary" onClick={onGoCalendar}>Open Calendar</button>
          </div>
          <div className="miniSchedule">
            {scheduleEntries.slice(0,8).map(r=>(
              <div key={r.id}>
                <b>{dayNames[r.day_of_week] || `Day ${r.day_of_week}`} · {r.display_name || r.service_type}</b>
                <span>{ruleText(r)}{r.follows_text ? ` · ${r.follows_text}` : ""}</span>
              </div>
            ))}
            {!loading && scheduleEntries.length===0 && <div><b>No weekly rules found</b><span>Nothing is currently stored in schedule_entries.</span></div>}
          </div>
        </div>
        <MagnetPreview day={today} notice={notices.find(n => n.status === "live")} />
      </div>
    </>
  );
}

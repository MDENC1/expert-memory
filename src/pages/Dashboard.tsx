import type { CalendarDay, Notice } from "../types";
import type { HebcalSpecialEvent, LiveScheduleEntry, SpecialSetupAlert } from "../App";
import { AlertTriangle, CalendarClock } from "lucide-react";
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
  if(r.timing_source==="none") return "NO MINYAN";
  if(r.timing_source==="follows") return r.follows_text || "Follows Mincha";
  const base=(r.timing_source||"rule").replaceAll("_"," ");
  const off=r.timing_offset_minutes||0;
  return `${base}${off ? ` ${off>0?"+":""}${off} min` : ""}`;
}

function shortDate(value:string){
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"})
    .format(new Date(`${value}T12:00:00`));
}

export default function Dashboard({
  days, previewDay, notices, remainingPushes, onGoCalendar, onOpenSpecialSetup, onAddNotice,
  shulName,activeMagnets,healthyMagnets,scheduleEntries,specialSetupAlerts,todaySpecialRequirement,loading
}: {
  days: CalendarDay[];
  previewDay:CalendarDay;
  notices: Notice[];
  remainingPushes: number;
  onGoCalendar: () => void;
  onOpenSpecialSetup: (groupKey:string) => void;
  onAddNotice: () => void;
  shulName:string;
  activeMagnets:number;
  healthyMagnets:number;
  scheduleEntries:LiveScheduleEntry[];
  specialSetupAlerts:SpecialSetupAlert[];
  todaySpecialRequirement:HebcalSpecialEvent|undefined;
  loading:boolean;
}) {
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

      {(todaySpecialRequirement||specialSetupAlerts.length>0) && (
        <div className={`panel specialSetupNotice ${todaySpecialRequirement?"urgent":""}`}>
          <div className="specialSetupNoticeHead">
            <div className="specialSetupNoticeIcon">
              {todaySpecialRequirement?<AlertTriangle size={20}/>:<CalendarClock size={20}/>}
            </div>
            <div>
              <span className="eyebrow">Upcoming setup</span>
              <h2>{todaySpecialRequirement?"Today's special schedule is not set":"Special schedules need attention"}</h2>
              <p>
                {todaySpecialRequirement
                  ?`${todaySpecialRequirement.title} should not use the regular weekly schedule. Set or confirm today's times.`
                  :"Hebcal found upcoming dates that still need a shul-specific schedule."}
              </p>
            </div>
          </div>

          <div className="specialSetupAlertList">
            {specialSetupAlerts.slice(0,3).map(alert=>(
              <div className={`specialSetupAlertRow ${alert.urgent?"urgent":""}`} key={alert.groupKey}>
                <div>
                  <strong>{alert.label}</strong>
                  <span>
                    {alert.missingCount} of {alert.totalCount} special date{alert.totalCount===1?"":"s"} still need confirmation
                    {" · "}
                    {alert.daysUntil===0
                      ?"needs attention today"
                      :alert.daysUntil>0
                        ?`next missing date in ${alert.daysUntil} day${alert.daysUntil===1?"":"s"}`
                        :"overdue"}
                    {" · "}{shortDate(alert.nextMissingDate)}
                  </span>
                </div>
                <button className="primary" onClick={()=>onOpenSpecialSetup(alert.groupKey)}>Set Times</button>
              </div>
            ))}
            {todaySpecialRequirement&&!specialSetupAlerts.some(alert=>alert.nextMissingDate===todaySpecialRequirement.date)&&(
              <div className="specialSetupAlertRow urgent">
                <div>
                  <strong>{todaySpecialRequirement.title}</strong>
                  <span>Today's schedule needs to be set before the regular schedule can be used.</span>
                </div>
                <button className="primary" onClick={()=>onOpenSpecialSetup(todaySpecialRequirement.group_key)}>Set Today's Times</button>
              </div>
            )}
          </div>
        </div>
      )}

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
        <MagnetPreview day={previewDay} notice={notices.find(n => n.status === "live")} shulName={shulName} />
      </div>
    </>
  );
}

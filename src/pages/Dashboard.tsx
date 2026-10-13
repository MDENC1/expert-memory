import { useState } from "react";
import type { CalendarDay, Notice } from "../types";
import type { HebcalSpecialEvent, LiveScheduleEntry, SpecialSetupAlert } from "../App";
import { AlertTriangle, CalendarClock } from "lucide-react";
import MagnetPreview from "../components/MagnetPreview";
import { supabase } from "../lib/supabase";
import { magnetPngBase64 } from "../lib/renderMagnet";

function shortDate(value:string){
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"})
    .format(new Date(`${value}T12:00:00`));
}



export default function Dashboard({
  days, previewDay, notices, remainingPushes, onGoCalendar, onOpenSpecialSetup, onAddNotice,
  shulId,shulName,activeMagnets,healthyMagnets,scheduleEntries,specialSetupAlerts,todaySpecialRequirement,loading
}: {
  days: CalendarDay[];
  previewDay:CalendarDay;
  notices: Notice[];
  remainingPushes: number;
  onGoCalendar: () => void;
  onOpenSpecialSetup: (groupKey:string) => void;
  onAddNotice: () => void;
  shulId:string;
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
  const [publishing,setPublishing]=useState(false);
  const [publishStatus,setPublishStatus]=useState("");
  const liveNotices=notices.filter(n=>n.status==="live");

  async function publishToBadger(){
    if(!shulId||publishing)return;
    setPublishing(true);
    setPublishStatus("");
    try{
      const imageBase64=magnetPngBase64({day:previewDay,notices:liveNotices,shulName,width:264,height:176});
      const {error}=await supabase.functions.invoke("publish-badger-screen",{
        body:{shul_id:shulId,image_base64:imageBase64}
      });
      if(error)throw error;
      setPublishStatus("Screen published successfully.");
    }catch(error:any){
      setPublishStatus("Publish failed: "+(error?.message||String(error)));
    }finally{
      setPublishing(false);
    }
  }

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">{dateLabel}</span>
          <h1>{loading ? "Loading…" : shulName}</h1>
          <p>See what households are seeing today and handle anything that needs attention.</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button className="secondary" onClick={onGoCalendar}>Open Calendar</button>
          <button className="secondary" onClick={onAddNotice}>+ Add Notice</button>
          <button className="primary" onClick={publishToBadger} disabled={publishing||loading}>
            {publishing?"Publishing…":"Publish Screen"}
          </button>
          {publishStatus&&<small style={{width:"100%",textAlign:"right"}}>{publishStatus}</small>}
        </div>
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
        <div className="stat"><span>Active magnets</span><strong>{loading ? "—" : activeMagnets}</strong><small>{healthyMagnets} reporting healthy</small></div>
        <div className="stat"><span>Next automatic refresh</span><strong>12:15 AM</strong><small>scheduled overnight</small></div>
        <div className="stat"><span>Urgent updates</span><strong>{remainingPushes} / 2</strong><small>available today</small></div>
        <div className="stat"><span>Active notices</span><strong>{notices.filter(n=>n.status==="live").length}</strong><small>currently on screen</small></div>
      </div>

      <div className="twoCol">
        <MagnetPreview day={previewDay} notices={liveNotices} shulName={shulName} />
        <div className="panel">
          <div className="panelHead">
            <div><span className="eyebrow">Today</span><h2>Today’s Schedule</h2></div>
            <button className="secondary" onClick={onGoCalendar}>Edit Calendar</button>
          </div>
          <div className="miniSchedule">
            {(previewDay.shulScheduleRows || []).map((row,i)=>(
              <div key={`${row.label}-${i}`}>
                <b>{row.label}</b>
                <span>{row.time || "No time set"}{row.note ? ` · ${row.note}` : ""}</span>
              </div>
            ))}
            {!loading && !(previewDay.shulScheduleRows || []).length && (
              <div><b>No schedule set for today</b><span>Open Calendar to add or adjust today’s schedule.</span></div>
            )}
          </div>
          {liveNotices.length>0 && (
            <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #edf2f0"}}>
              <span className="eyebrow">On screen now</span>
              {liveNotices.map(item=>(
                <div key={item.id} style={{marginTop:8}}>
                  <h3 style={{margin:"4px 0 4px"}}>
                    {item.headline}{item.eventTime ? " · "+item.eventTime : ""}
                  </h3>
                  {item.location&&<small style={{display:"block"}}>Location: {item.location}</small>}
                  {item.details&&<p style={{margin:"3px 0 0"}}>{item.details}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

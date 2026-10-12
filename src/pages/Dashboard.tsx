import { useState } from "react";
import type { CalendarDay, Notice } from "../types";
import type { HebcalSpecialEvent, LiveScheduleEntry, SpecialSetupAlert } from "../App";
import { AlertTriangle, CalendarClock } from "lucide-react";
import MagnetPreview from "../components/MagnetPreview";
import { supabase } from "../lib/supabase";

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


function clippedText(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
  if(ctx.measureText(text).width<=maxWidth)return text;
  let out=text;
  while(out.length>1&&ctx.measureText(out+"…").width>maxWidth)out=out.slice(0,-1);
  return out+"…";
}

function renderBadgerPng(day:CalendarDay,notice:Notice|undefined,shulName:string){
  const canvas=document.createElement("canvas");
  canvas.width=264;
  canvas.height=176;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Could not create Badger image.");

  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,264,176);
  ctx.fillStyle="#000";
  ctx.textBaseline="top";

  const dateLabel=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric"})
    .format(new Date(day.date+"T12:00:00"));

  ctx.font="700 13px Arial";
  ctx.fillText(clippedText(ctx,shulName.toUpperCase(),172),5,4);
  ctx.font="9px Arial";
  ctx.textAlign="right";
  ctx.fillText(dateLabel,259,6);
  ctx.textAlign="left";
  ctx.fillRect(4,25,256,1);

  const drawColumn=(title:string,rows:{label:string;time?:string}[],x:number,width:number)=>{
    ctx.font="700 9px Arial";
    ctx.fillText(title,x,31);
    let y=44;
    for(const row of rows.slice(0,5)){
      ctx.font="700 8px Arial";
      ctx.fillText(clippedText(ctx,row.label,width-42),x,y);
      ctx.font="8px Arial";
      ctx.textAlign="right";
      ctx.fillText(clippedText(ctx,row.time||"",38),x+width,y);
      ctx.textAlign="left";
      y+=14;
    }
  };

  const zmanRows=(day.zmanimRows||[]).map(r=>({label:r.label,time:r.time}));
  const scheduleRows=(day.shulScheduleRows||[]).map(r=>({label:r.label,time:r.time||""}));

  drawColumn("ZMANIM",zmanRows,5,119);
  ctx.fillRect(130,31,1,86);
  drawColumn("SHUL",scheduleRows,137,122);

  ctx.fillRect(4,121,256,1);
  ctx.font="700 8px Arial";
  ctx.fillText("NOTICE",5,127);

  const headline=notice?.headline||day.event||"No notices today.";
  ctx.font="700 10px Arial";
  ctx.fillText(clippedText(ctx,headline,254),5,139);

  if(notice?.details){
    ctx.font="8px Arial";
    ctx.fillText(clippedText(ctx,notice.details,254),5,153);
  }

  ctx.font="7px Arial";
  ctx.textAlign="right";
  ctx.fillText("LIVE ADMIN",259,166);
  ctx.textAlign="left";

  return canvas.toDataURL("image/png").split(",",2)[1];
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
  const liveNotice=notices.find(n=>n.status==="live");

  async function publishToBadger(){
    if(!shulId||publishing)return;
    setPublishing(true);
    setPublishStatus("");
    try{
      const imageBase64=renderBadgerPng(previewDay,liveNotice,shulName);
      const {error}=await supabase.functions.invoke("publish-badger-screen",{
        body:{shul_id:shulId,image_base64:imageBase64}
      });
      if(error)throw error;
      setPublishStatus("Published. Refresh shul_test on the Badger.");
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
          <span className="eyebrow">{dateLabel} · LIVE SUPABASE</span>
          <h1>{loading ? "Loading…" : shulName}</h1>
          <p>This page is now reading the pilot shul directly from Supabase.</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button className="secondary" onClick={publishToBadger} disabled={publishing||loading}>
            {publishing?"Publishing…":"Push to Badger"}
          </button>
          <button className="primary" onClick={onAddNotice}>+ Add Notice</button>
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
        <MagnetPreview day={previewDay} notice={liveNotice} shulName={shulName} />
      </div>
    </>
  );
}

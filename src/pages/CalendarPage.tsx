import { useEffect, useMemo, useState } from "react";
import type { CalendarDay, Notice, NoticeType } from "../types";
import type { LiveScheduleEntry } from "../App";
import MagnetPreview from "../components/MagnetPreview";
import { PILOT_SHUL_ID, supabase } from "../lib/supabase";

type Props = {
  notices: Notice[];
  setNotices: (notices:Notice[]) => void;
  scheduleEntries: LiveScheduleEntry[];
  shulName: string;
  postalCode: string;
};

type MonthCell = {
  date: string;
  day: number;
  hebrewDay: string;
  hebrewMonth: string;
  isRoshChodesh: boolean;
  isShabbos: boolean;
};

type SpecialDay = {
  event_date: string;
  title: string | null;
  replace_normal_schedule: boolean;
};

type SpecialEntry = {
  event_date: string;
  title: string;
  event_time: string | null;
  approximate: boolean;
  note: string | null;
  sort_order: number;
};

type ZmanimBatch = {
  plagHaMincha?: Record<string,string>;
  sunset?: Record<string,string>;
};

type ScheduleOverride = {
  id: string;
  event_date: string;
  service_type: string;
  service_time: string | null;
  timing_source: string;
  sort_order: number;
  active: boolean;
  priority_level: number;
};

type EditRow = {
  label: string;
  timeText: string;
  note: string;
};

type BulkEditRow = {
  label: string;
  timeText: string;
  mixed: boolean;
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

export default function CalendarPage({notices,setNotices,scheduleEntries,shulName,postalCode}:Props) {
  const [viewDate,setViewDate] = useState(new Date());
  const [multiMode,setMultiMode] = useState(false);
  const [selected,setSelected] = useState<string[]>([]);
  const [showAdd,setShowAdd] = useState(false);
  const [newType,setNewType] = useState<NoticeType>("Event");
  const [newHeadline,setNewHeadline] = useState("");
  const [newDetails,setNewDetails] = useState("");
  const [newTime,setNewTime] = useState("");
  const [specialDays,setSpecialDays] = useState<SpecialDay[]>([]);
  const [specialEntries,setSpecialEntries] = useState<SpecialEntry[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [zmanim,setZmanim] = useState<ZmanimBatch>({});
  const [zmanimError,setZmanimError] = useState("");
  const [overrides,setOverrides] = useState<ScheduleOverride[]>([]);
  const [editRows,setEditRows] = useState<EditRow[]>([]);
  const [savingDay,setSavingDay] = useState(false);
  const [daySaveMessage,setDaySaveMessage] = useState("");
  const [bulkEditRows,setBulkEditRows] = useState<BulkEditRow[]>([]);
  const [bulkSaveMessage,setBulkSaveMessage] = useState("");

  const year=viewDate.getFullYear();
  const month=viewDate.getMonth();
  const monthName=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(viewDate);
  const monthCells=useMemo(()=>buildMonth(year,month),[year,month]);
  const firstDow=new Date(year,month,1,12).getDay();
  const startDate=`${year}-${pad(month+1)}-01`;
  const endDate=`${year}-${pad(month+1)}-${pad(new Date(year,month+1,0).getDate())}`;

  useEffect(()=>{
    let cancelled=false;
    async function loadMonth(){
      setLoading(true);
      setError("");
      setZmanimError("");

      const supabasePromise=Promise.all([
        supabase.from("special_schedule_days")
          .select("event_date,title,replace_normal_schedule")
          .eq("shul_id",PILOT_SHUL_ID)
          .gte("event_date",startDate)
          .lte("event_date",endDate)
          .order("event_date"),
        supabase.from("special_schedule_entries")
          .select("event_date,title,event_time,approximate,note,sort_order")
          .eq("shul_id",PILOT_SHUL_ID)
          .eq("active",true)
          .gte("event_date",startDate)
          .lte("event_date",endDate)
          .order("event_date")
          .order("sort_order"),
        supabase.from("schedule_overrides")
          .select("id,event_date,service_type,service_time,timing_source,sort_order,active,priority_level")
          .eq("shul_id",PILOT_SHUL_ID)
          .eq("active",true)
          .gte("event_date",startDate)
          .lte("event_date",endDate)
          .order("event_date")
          .order("sort_order")
      ]);

      const zmanimPromise=postalCode
        ? fetch(`https://www.hebcal.com/zmanim?cfg=json&zip=${encodeURIComponent(postalCode)}&start=${startDate}&end=${endDate}`)
            .then(r=>{if(!r.ok)throw new Error(`Zmanim request failed (${r.status})`);return r.json();})
            .then(data=>data?.times||{})
            .catch(err=>({__error:String(err?.message||err)}))
        : Promise.resolve({__error:"No ZIP code configured"});

      const [[daysRes,entriesRes,overridesRes],zmanimRes]=await Promise.all([supabasePromise,zmanimPromise]);
      if(cancelled)return;

      const err=daysRes.error||entriesRes.error||overridesRes.error;
      if(err)setError(err.message);
      else{
        const nextDays=(daysRes.data||[]) as SpecialDay[];
        const nextEntries=(entriesRes.data||[]) as SpecialEntry[];
        const nextOverrides=(overridesRes.data||[]) as ScheduleOverride[];

        setSpecialDays(prev=>{
          const outside=prev.filter(row=>row.event_date<startDate||row.event_date>endDate);
          return [...outside,...nextDays];
        });
        setSpecialEntries(prev=>{
          const outside=prev.filter(row=>row.event_date<startDate||row.event_date>endDate);
          return [...outside,...nextEntries];
        });
        setOverrides(prev=>{
          const outside=prev.filter(row=>row.event_date<startDate||row.event_date>endDate);
          return [...outside,...nextOverrides];
        });
      }

      if((zmanimRes as any).__error){
        setZmanim({});
        setZmanimError((zmanimRes as any).__error);
      }else{
        setZmanim(zmanimRes as ZmanimBatch);
      }
      setLoading(false);
    }
    loadMonth();
    return()=>{cancelled=true};
  },[startDate,endDate,postalCode]);

  const dayMap=useMemo(()=>new Map(specialDays.map(d=>[d.event_date,d])),[specialDays]);
  const entriesMap=useMemo(()=>{
    const m=new Map<string,SpecialEntry[]>();
    for(const e of specialEntries)m.set(e.event_date,[...(m.get(e.event_date)||[]),e]);
    return m;
  },[specialEntries]);

  const overrideMap=useMemo(()=>{
    const m=new Map<string,ScheduleOverride[]>();
    for(const o of overrides)m.set(o.event_date,[...(m.get(o.event_date)||[]),o]);
    return m;
  },[overrides]);

  const prettyTime=(value:string|null)=>{
    if(!value)return "";
    const [h,m]=value.split(":").map(Number);
    return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"})
      .format(new Date(2000,0,1,h,m));
  };

  const displayTimeTo24=(value:string)=>{
    // Friendly admin input:
    // 645pm -> 6:45 PM
    // 6:45pm -> 6:45 PM
    // 6 pm -> 6:00 PM
    // 1245am -> 12:45 AM
    const clean=value
      .trim()
      .toUpperCase()
      .replace(/\./g,"")
      .replace(/\s+/g,"");

    const suffix=clean.match(/(AM|PM)$/)?.[1];
    if(!suffix)return "";

    const numeric=clean.slice(0,-suffix.length);
    let hour:number;
    let minute:number;

    if(numeric.includes(":")){
      const parts=numeric.split(":");
      if(parts.length!==2||!/^\d{1,2}$/.test(parts[0])||!/^\d{1,2}$/.test(parts[1]))return "";
      hour=Number(parts[0]);
      minute=Number(parts[1]);
    }else{
      if(!/^\d{1,4}$/.test(numeric))return "";
      if(numeric.length<=2){
        hour=Number(numeric);
        minute=0;
      }else{
        hour=Number(numeric.slice(0,-2));
        minute=Number(numeric.slice(-2));
      }
    }

    if(hour<1||hour>12||minute<0||minute>59)return "";

    let hour24=hour;
    if(suffix==="PM"&&hour!==12)hour24+=12;
    if(suffix==="AM"&&hour===12)hour24=0;
    return `${pad(hour24)}:${pad(minute)}`;
  };

  const normalizeDisplayTime=(value:string)=>{
    const as24=displayTimeTo24(value);
    if(!as24)return value;
    return prettyTime(as24);
  };

  const timeMinutesFromIso=(value:string|undefined)=>{
    if(!value)return null;
    const match=value.match(/T(\d{2}):(\d{2})/);
    if(!match)return null;
    return Number(match[1])*60+Number(match[2]);
  };

  const minutesToDisplay=(minutes:number)=>{
    const normalized=((minutes%1440)+1440)%1440;
    const h=Math.floor(normalized/60);
    const m=normalized%60;
    return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"})
      .format(new Date(2000,0,1,h,m));
  };

  const floorToFive=(minutes:number)=>minutes-(minutes%5);

  const weekStart=(date:string)=>{
    const d=new Date(`${date}T12:00:00`);
    d.setDate(d.getDate()-d.getDay());
    return isoDate(d);
  };

  const weeklyResolvedTime=(date:string,source:string|null,offset:number|null)=>{
    if(source!=="plag"&&source!=="sunset")return "";
    const start=weekStart(date);
    const sunday=new Date(`${start}T12:00:00`);
    const map=source==="plag" ? zmanim.plagHaMincha : zmanim.sunset;
    if(!map)return "";

    const targets:number[]=[];
    for(let i=0;i<=4;i++){
      const d=new Date(sunday);
      d.setDate(sunday.getDate()+i);
      const key=isoDate(d);
      const base=timeMinutesFromIso(map[key]);
      if(base!==null)targets.push(base+(offset||0));
    }
    if(!targets.length)return "";
    return minutesToDisplay(floorToFive(Math.min(...targets)));
  };

  const specialResolvedTime=(date:string,special:SpecialDay|undefined,row:SpecialEntry)=>{
    const title=row.title.trim().toLowerCase();
    const group=(special?.title||"").trim().toLowerCase();

    // Generic Tishrei and Chol Hamoed schedules inherit the shul's
    // weekly Plag/Sunset rules instead of preserving stale per-day math.
    const usesWeeklyRules = group==="tishrei schedule" || group==="chol hamoed";

    if(usesWeeklyRules && title.includes("plag mincha")){
      return weeklyResolvedTime(date,"plag",-10) || (row.event_time?minutesToDisplay(floorToFive((Number(row.event_time.slice(0,2))*60)+Number(row.event_time.slice(3,5)))):"");
    }
    if(usesWeeklyRules && title==="mincha / maariv"){
      return weeklyResolvedTime(date,"sunset",-10) || (row.event_time?minutesToDisplay(floorToFive((Number(row.event_time.slice(0,2))*60)+Number(row.event_time.slice(3,5)))):"");
    }
    return row.event_time?prettyTime(row.event_time):"";
  };

  const weeklyRowText=(date:string,r:LiveScheduleEntry)=>{
    if(r.service_time)return prettyTime(r.service_time);
    const resolved=weeklyResolvedTime(date,r.timing_source,r.timing_offset_minutes);
    return resolved || "Timing unavailable";
  };

  const rowsForDate=(date:string)=>{
    const d=new Date(`${date}T12:00:00`);
    const manual=overrideMap.get(date)||[];
    if(manual.length){
      return manual.map(r=>({
        label:r.service_type,
        time:r.service_time?prettyTime(r.service_time):"",
        note:""
      }));
    }
    const special=dayMap.get(date);
    const rows=entriesMap.get(date)||[];
    if(special?.replace_normal_schedule&&rows.length){
      return rows.map(r=>({label:r.title,time:specialResolvedTime(date,special,r),note:r.note||""}));
    }
    return scheduleEntries
      .filter(r=>r.day_of_week===d.getDay())
      .map(r=>({label:r.display_name||r.service_type.replaceAll("_"," "),time:weeklyRowText(date,r),note:""}));
  };

  const selectedDay=selected.length===1 ? selected[0] : undefined;
  const selectedCell=selectedDay ? monthCells.find(c=>c.date===selectedDay) : undefined;
  const selectedRows=selectedDay ? rowsForDate(selectedDay) : [];
  const selectedSpecial=selectedDay ? dayMap.get(selectedDay) : undefined;
  const selectedHasManualOverride=selectedDay ? (overrideMap.get(selectedDay)?.length||0)>0 : false;

  useEffect(()=>{
    if(!selectedDay){
      setEditRows([]);
      setDaySaveMessage("");
      return;
    }
    setEditRows(selectedRows.map(r=>({
      label:r.label,
      timeText:r.time,
      note:r.note||""
    })));
    setDaySaveMessage("");
  },[selectedDay,overrides,specialEntries,zmanim,scheduleEntries]);

  useEffect(()=>{
    if(selected.length<=1){
      setBulkEditRows([]);
      setBulkSaveMessage("");
      return;
    }

    const schedules=selected.map(date=>rowsForDate(date));
    const first=schedules[0]||[];
    const commonLabels=first
      .map(r=>r.label)
      .filter((label,index,arr)=>arr.indexOf(label)===index)
      .filter(label=>schedules.every(rows=>rows.some(r=>r.label===label)));

    const next=commonLabels.map(label=>{
      const times=schedules.map(rows=>rows.find(r=>r.label===label)?.time||"");
      const unique=[...new Set(times)];
      return {
        label,
        timeText:unique.length===1?unique[0]:"",
        mixed:unique.length>1
      };
    });

    setBulkEditRows(next);
    setBulkSaveMessage("");
  },[selected.join("|"),overrides,specialEntries,zmanim,scheduleEntries]);

  const selectedCalendarDay:CalendarDay|undefined = selectedCell ? {
    date:selectedCell.date,
    englishDay:selectedCell.day,
    hebrewDate:selectedCell.hebrewDay,
    hebrewMonth:selectedCell.hebrewMonth,
    isRoshChodesh:selectedCell.isRoshChodesh,
    isShabbos:selectedCell.isShabbos,
    holiday:selectedSpecial?.title && !/^tishrei schedule$/i.test(selectedSpecial.title) ? selectedSpecial.title : undefined,
    shulScheduleRows:selectedRows
  } : undefined;

  const previewNotice=selectedDay ? notices.find(n=>noticeMatchesDate(n,selectedDay)) : undefined;

  const changeMonth=(delta:number)=>{
    setViewDate(new Date(year,month+delta,1,12));
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

  const saveBulkSelectedTimes=async(rowsToSave:BulkEditRow[]=bulkEditRows)=>{
    if(selected.length<=1||!rowsToSave.length)return;
    setSavingDay(true);
    setBulkSaveMessage("");
    setError("");

    const selectedSet=new Set(selected);
    const allPayload:any[]=[];

    for(const date of selected){
      const currentRows=rowsForDate(date);
      currentRows.forEach((row,index)=>{
        const bulkRow=rowsToSave.find(edit=>edit.label===row.label);
        const replacement=bulkRow?.timeText.trim()
          ? normalizeDisplayTime(bulkRow.timeText)
          : row.time;
        allPayload.push({
          shul_id:PILOT_SHUL_ID,
          event_date:date,
          service_type:row.label,
          service_time:displayTimeTo24(replacement)||null,
          timing_source:"fixed",
          sort_order:(index+1)*10,
          active:true,
          priority_level:3
        });
      });
    }

    const deleteRes=await supabase.from("schedule_overrides")
      .delete()
      .eq("shul_id",PILOT_SHUL_ID)
      .in("event_date",selected);

    if(deleteRes.error){
      setError(deleteRes.error.message);
      setSavingDay(false);
      return;
    }

    const insertRes=await supabase.from("schedule_overrides")
      .insert(allPayload)
      .select("id,event_date,service_type,service_time,timing_source,sort_order,active,priority_level");

    if(insertRes.error){
      setError(insertRes.error.message);
      setSavingDay(false);
      return;
    }

    setOverrides(prev=>[
      ...prev.filter(o=>!selectedSet.has(o.event_date)),
      ...((insertRes.data||[]) as ScheduleOverride[])
    ]);
    setBulkEditRows(rowsToSave.map(row=>({
      ...row,
      timeText:row.timeText.trim()?normalizeDisplayTime(row.timeText):row.timeText,
      mixed:false
    })));
    setBulkSaveMessage(`Saved for ${selected.length} selected days only. Your regular rules were not changed.`);
    setSavingDay(false);
  };

  const saveSelectedDayTimes=async(rowsToSave:EditRow[]=editRows)=>{
    if(!selectedDay||!rowsToSave.length)return;
    setSavingDay(true);
    setDaySaveMessage("");
    setError("");

    const deleteRes=await supabase.from("schedule_overrides")
      .delete()
      .eq("shul_id",PILOT_SHUL_ID)
      .eq("event_date",selectedDay);

    if(deleteRes.error){
      setError(deleteRes.error.message);
      setSavingDay(false);
      return;
    }

    const payload=rowsToSave.map((row,index)=>({
      shul_id:PILOT_SHUL_ID,
      event_date:selectedDay,
      service_type:row.label,
      service_time:displayTimeTo24(row.timeText)||null,
      timing_source:"fixed",
      sort_order:(index+1)*10,
      active:true,
      priority_level:3
    }));

    const insertRes=await supabase.from("schedule_overrides").insert(payload).select("id,event_date,service_type,service_time,timing_source,sort_order,active,priority_level");
    if(insertRes.error){
      setError(insertRes.error.message);
      setSavingDay(false);
      return;
    }

    setOverrides(prev=>[
      ...prev.filter(o=>o.event_date!==selectedDay),
      ...((insertRes.data||[]) as ScheduleOverride[])
    ]);
    setDaySaveMessage("Saved for this date only. Your regular rules were not changed.");
    setSavingDay(false);
  };

  const resetSelectedDayTimes=async()=>{
    if(!selectedDay)return;
    setSavingDay(true);
    setDaySaveMessage("");
    setError("");
    const res=await supabase.from("schedule_overrides")
      .delete()
      .eq("shul_id",PILOT_SHUL_ID)
      .eq("event_date",selectedDay);
    if(res.error){
      setError(res.error.message);
      setSavingDay(false);
      return;
    }
    setOverrides(prev=>prev.filter(o=>o.event_date!==selectedDay));
    setDaySaveMessage("Manual times cleared. This date is back to the normal rule.");
    setSavingDay(false);
  };

  const addToSelectedDates=async()=>{
    if (!selected.length || !newHeadline.trim()) return;
    const payload=selected.map(date=>({
      shul_id:PILOT_SHUL_ID,
      content_type:newType,
      title:newHeadline.trim(),
      details:newDetails.trim()||null,
      display_start:date,
      display_end:date,
      event_time:(newType==="Event" || newType==="Schedule Change") && newTime ? newTime : null,
      recurring:false,
      active:true,
      priority_level:2
    }));
    const {data,error}=await supabase.from("notices_events").insert(payload).select("*");
    if(error){setError(error.message);return;}
    const additions:Notice[]=(data||[]).map((row:any)=>({
      id:row.id,
      type:row.content_type,
      headline:row.title,
      details:row.details||"",
      startAt:row.display_start,
      endAt:row.display_end,
      eventTime:row.event_time||undefined,
      recurrence:{enabled:false},
      priority:"important",
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
          <span className="eyebrow">Calendar - LIVE SUPABASE</span>
          <h1>{monthName}</h1>
          <p>Browse past or future months, edit individual days, select multiple dates, and preview exactly what members will see.</p>
        </div>
        <div className="headerActions">
          <button className="secondary" onClick={()=>changeMonth(-1)}>← Previous</button>
          <button className="secondary" onClick={()=>{setViewDate(new Date());setShowAdd(false)}}>This Month</button>
          <button className="secondary" onClick={()=>changeMonth(1)}>Next →</button>
        </div>
      </div>

      {error && <div className="panel" style={{marginBottom:14,borderColor:"#c44"}}><strong>Calendar error:</strong> {error}</div>}
      <div className="calendarToolbar">
        <button className={multiMode?"choice active":"secondary"} onClick={()=>{setMultiMode(v=>!v);setSelected([]);setShowAdd(false);}}>
          {multiMode ? "Selecting Multiple Days" : "Select Multiple Days"}
        </button>
        <span>{loading ? "Loading live calendar..." : (selected.length ? `${selected.length} day${selected.length===1?"":"s"} selected across any month` : "Click a day to see its real schedule and preview.")}</span>
        {!loading && <small>{zmanimError ? "Zmanim fallback unavailable" : "Timing fallback: Hebcal"}</small>}
        {selected.length>0 && <button className="secondary" onClick={()=>{setSelected([]);setShowAdd(false)}}>Clear Selection</button>}
        {selected.length>0 && <button className="primary" onClick={()=>setShowAdd(true)}>+ Add Event / Notice</button>}
      </div>

      <div className="calendarLayout">
        <div className="calendarWrap">
          <div className="calendar">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Shabbos"].map(w=><div key={w} className="weekday">{w}</div>)}
            {Array.from({length:firstDow}).map((_,i)=><div key={`blank-${i}`} className="dayCell empty" />)}
            {monthCells.map(cell=>{
              const rows=rowsForDate(cell.date);
              const special=dayMap.get(cell.date);
              const matching=notices.filter(n=>noticeMatchesDate(n,cell.date));
              const holiday=special?.title && !/^tishrei schedule$/i.test(special.title) ? special.title : undefined;
              return (
                <button
                  key={cell.date}
                  className={`dayCell ${selected.includes(cell.date)?"selected":""} ${cell.isShabbos?"shabbos":""} ${cell.isRoshChodesh?"roshChodesh":""}`}
                  onClick={()=>handleDayClick(cell.date)}
                >
                  <div className="dateTop"><strong>{cell.day}</strong><span>{cell.hebrewDay} {cell.hebrewMonth}</span></div>
                  <div className="dayTags">
                    {holiday && <span className="jewishTag">{holiday}</span>}
                    {cell.isRoshChodesh && !holiday && <span className="jewishTag">Rosh Chodesh</span>}
                    {matching.length>0 && <span className="eventCount">{matching.length} scheduled</span>}
                  </div>
                  <div className="times">
                    {rows.slice(0,4).map((r,i)=><span key={i}><b>{r.label}</b> {r.time}</span>)}
                    {rows.length>4 && <span>+{rows.length-4} more</span>}
                  </div>
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
                <div className="selectedDayEditList">
                  {editRows.map((r,i)=>(
                    <label className="selectedDayEditRow" key={`${r.label}-${i}`}>
                      <span><b>{r.label}</b>{r.note&&<small>{r.note}</small>}</span>
                      <input
                        className="manualTimeInput"
                        type="text"
                        inputMode="text"
                        value={r.timeText}
                        placeholder="6:45 AM"
                        aria-label={`${r.label} time`}
                        onFocus={e=>e.currentTarget.select()}
                        onChange={e=>setEditRows(rows=>rows.map((row,index)=>index===i?{...row,timeText:e.target.value}:row))}
                        onKeyDown={async e=>{
                          if(e.key!=="Enter")return;
                          e.preventDefault();
                          const normalized=normalizeDisplayTime(e.currentTarget.value);
                          const nextRows=editRows.map((row,index)=>index===i?{...row,timeText:normalized}:row);
                          setEditRows(nextRows);
                          await saveSelectedDayTimes(nextRows);
                          e.currentTarget.blur();
                        }}
                        onBlur={e=>{
                          const normalized=normalizeDisplayTime(e.currentTarget.value);
                          setEditRows(rows=>rows.map((row,index)=>index===i?{...row,timeText:normalized}:row));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="selectedDayActions">
                  <button className="primary" disabled={savingDay} onClick={()=>saveSelectedDayTimes()}>{savingDay?"Saving...":"Save Times for This Day Only"}</button>
                  {selectedHasManualOverride&&<button className="secondary" disabled={savingDay} onClick={resetSelectedDayTimes}>Use Normal Rule Again</button>}
                </div>
                {daySaveMessage&&<div className="daySaveMessage">{daySaveMessage}</div>}
                <button className="secondary fullButton" onClick={()=>setShowAdd(true)}>+ Add Event / Notice to This Day</button>
              </div>
              <MagnetPreview day={selectedCalendarDay} notice={previewNotice} shulName={shulName} fit />
            </>
          ) : selected.length>1 ? (
            <div className="panel compactPanel">
              <div className="panelHead">
                <div>
                  <span className="eyebrow">Multiple days selected</span>
                  <h2>{selected.length} Selected Days</h2>
                  <p className="bulkEditHelp">Change a shared time once and it will update only these dates. Blank “Mixed” fields keep each day’s current time until you enter a new one.</p>
                </div>
              </div>

              {bulkEditRows.length ? (
                <div className="selectedDayEditList">
                  {bulkEditRows.map((r,i)=>(
                    <label className="selectedDayEditRow" key={`${r.label}-bulk-${i}`}>
                      <span>
                        <b>{r.label}</b>
                        {r.mixed&&<small>Different times on selected days</small>}
                      </span>
                      <input
                        className="manualTimeInput"
                        type="text"
                        inputMode="text"
                        value={r.timeText}
                        placeholder={r.mixed?"Mixed":"6:45 PM"}
                        aria-label={`${r.label} time for selected days`}
                        onFocus={e=>e.currentTarget.select()}
                        onChange={e=>setBulkEditRows(rows=>rows.map((row,index)=>index===i?{...row,timeText:e.target.value}:row))}
                        onKeyDown={async e=>{
                          if(e.key!=="Enter")return;
                          e.preventDefault();
                          const raw=e.currentTarget.value;
                          const normalized=raw.trim()?normalizeDisplayTime(raw):"";
                          const nextRows=bulkEditRows.map((row,index)=>index===i?{...row,timeText:normalized,mixed:false}:row);
                          setBulkEditRows(nextRows);
                          await saveBulkSelectedTimes(nextRows);
                          e.currentTarget.blur();
                        }}
                        onBlur={e=>{
                          if(!e.currentTarget.value.trim())return;
                          const normalized=normalizeDisplayTime(e.currentTarget.value);
                          setBulkEditRows(rows=>rows.map((row,index)=>index===i?{...row,timeText:normalized,mixed:false}:row));
                        }}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="bulkNoCommon">These dates do not share the same schedule items. Select dates with at least one matching service to edit them together.</div>
              )}

              {bulkEditRows.length>0&&(
                <div className="selectedDayActions">
                  <button className="primary" disabled={savingDay} onClick={()=>saveBulkSelectedTimes()}>
                    {savingDay?"Saving...":`Save Times to ${selected.length} Days`}
                  </button>
                </div>
              )}
              {bulkSaveMessage&&<div className="daySaveMessage">{bulkSaveMessage}</div>}
              <button className="secondary fullButton" onClick={()=>setShowAdd(true)}>+ Add Event / Notice to Selected Days</button>
            </div>
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

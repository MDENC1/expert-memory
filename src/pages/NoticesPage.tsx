import { useMemo, useState } from "react";
import type { Notice, NoticeType, RecurrenceFrequency } from "../types";
import { supabase } from "../lib/supabase";

const noticeTypes: NoticeType[] = ["Yahrtzeit","Sponsorship","Mazel Tov","Condolence / Shiva","Schedule Change","Event","General Notice"];
const recurringTypes = new Set<NoticeType>(["Yahrtzeit","Sponsorship","Schedule Change","Event","General Notice"]);
const weekdayOptions = [
  ["Sun",0],["Mon",1],["Tue",2],["Wed",3],["Thu",4],["Fri",5],["Shabbos",6]
] as const;

const pad=(n:number)=>String(n).padStart(2,"0");
const todayIso=()=>{
  const d=new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

function prettyTime(value:string|null|undefined){
  if(!value)return "";
  const match=String(value).match(/^(\d{1,2}):(\d{2})/);
  if(!match)return String(value);
  const h=Number(match[1]);
  const m=Number(match[2]);
  return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"})
    .format(new Date(2000,0,1,h,m));
}

function friendlyTimeTo24(value:string|undefined){
  if(!value)return "";
  const raw=value.trim();
  const direct=raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if(direct)return `${pad(Number(direct[1]))}:${direct[2]}`;

  const clean=raw.toUpperCase().replace(/\./g,"").replace(/\s+/g,"");
  const suffix=clean.match(/(AM|PM)$/)?.[1];
  if(!suffix)return "";
  const numeric=clean.slice(0,-suffix.length);
  let hour:number;
  let minute:number;
  if(numeric.includes(":")){
    const [h,m]=numeric.split(":");
    hour=Number(h);
    minute=Number(m);
  }else if(/^\d{1,4}$/.test(numeric)){
    if(numeric.length<=2){hour=Number(numeric);minute=0;}
    else{hour=Number(numeric.slice(0,-2));minute=Number(numeric.slice(-2));}
  }else return "";
  if(hour<1||hour>12||minute<0||minute>59)return "";
  if(suffix==="PM"&&hour!==12)hour+=12;
  if(suffix==="AM"&&hour===12)hour=0;
  return `${pad(hour)}:${pad(minute)}`;
}

function noticeFromRow(row:any,existing?:Notice):Notice{
  const now=todayIso();
  const status:Notice["status"]=row.archived_at
    ?"expired"
    :row.display_start<=now&&row.display_end>=now
      ?"live"
      :row.display_start>now?"scheduled":"expired";

  return {
    id:row.id,
    type:row.content_type,
    headline:row.title,
    details:row.details||"",
    location:row.location||undefined,
    linkedSpecialEventKey:row.linked_special_event_key||undefined,
    startAt:row.display_start,
    endAt:row.display_end,
    eventTime:row.event_time?prettyTime(row.event_time):undefined,
    recurrence:row.recurring?{
      enabled:true,
      frequency:row.recurrence_type||undefined,
      weekdays:row.recurrence_weekdays||[],
      monthDays:row.recurrence_month_days||[],
      excludedDates:(row.recurrence_excluded_dates||[]).map((value:string)=>String(value))
    }:{enabled:false},
    priority:existing?.priority||"normal",
    publishMode:row.immediate_sent_at?"immediate":"scheduled",
    status
  };
}

export default function NoticesPage({
  notices,setNotices,shulId,remainingPushes,usePush
}:{
  notices:Notice[];
  setNotices:(n:Notice[])=>void;
  shulId:string;
  remainingPushes:number;
  usePush:()=>void;
}) {
  const today=todayIso();
  const [showForm,setShowForm] = useState(false);
  const [editingNoticeId,setEditingNoticeId] = useState<string|null>(null);
  const [type,setType] = useState<NoticeType>("General Notice");
  const [headline,setHeadline] = useState("");
  const [details,setDetails] = useState("");
  const [location,setLocation] = useState("");
  const [startAt,setStartAt] = useState(today);
  const [endAt,setEndAt] = useState(today);
  const [eventTime,setEventTime] = useState("");
  const [recurring,setRecurring] = useState(false);
  const [frequency,setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [weekdays,setWeekdays] = useState<number[]>([]);
  const [monthDays,setMonthDays] = useState<number[]>([]);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [showDeleteConfirm,setShowDeleteConfirm] = useState(false);
  const [deleting,setDeleting] = useState(false);
  const [deleteOccurrenceDate,setDeleteOccurrenceDate] = useState(today);

  const editingNotice=editingNoticeId
    ?notices.find(notice=>notice.id===editingNoticeId)
    :undefined;
  const isLinkedSpecialEvent=Boolean(editingNotice?.linkedSpecialEventKey);

  const canRecur = !isLinkedSpecialEvent&&recurringTypes.has(type);
  const needsTime = type === "Event" || type === "Schedule Change";
  const recurrenceSummary = useMemo(() => {
    if (!recurring || !canRecur) return "";
    if (frequency === "daily") return "Daily";
    if (frequency === "weekly") return `Weekly: ${weekdays.map(d=>weekdayOptions.find(x=>x[1]===d)?.[0]).filter(Boolean).join(", ") || "choose day(s)"}`;
    if (frequency === "monthly") return `Monthly: day ${monthDays.join(", ") || "—"}`;
    return "Yearly on Hebrew date";
  },[recurring,canRecur,frequency,weekdays,monthDays]);

  const resetForm=()=>{
    setType("General Notice");
    setHeadline("");
    setDetails("");
    setLocation("");
    setStartAt(today);
    setEndAt(today);
    setEventTime("");
    setRecurring(false);
    setFrequency("weekly");
    setWeekdays([]);
    setMonthDays([]);
    setEditingNoticeId(null);
    setShowDeleteConfirm(false);
    setDeleteOccurrenceDate(today);
    setError("");
  };

  const openNew=()=>{
    resetForm();
    setShowForm(true);
  };

  const openEdit=(notice:Notice)=>{
    setEditingNoticeId(notice.id);
    setType(notice.type);
    setHeadline(notice.headline);
    setDetails(notice.details);
    setLocation(notice.location||"");
    setStartAt(notice.startAt);
    setEndAt(notice.endAt);
    setEventTime(friendlyTimeTo24(notice.eventTime));
    setRecurring(Boolean(notice.recurrence?.enabled));
    setFrequency(notice.recurrence?.frequency||"weekly");
    setWeekdays(notice.recurrence?.weekdays||[]);
    setMonthDays(notice.recurrence?.monthDays||[]);
    setDeleteOccurrenceDate(notice.startAt);
    setShowDeleteConfirm(false);
    setError("");
    setShowForm(true);
  };

  const closeForm=()=>{
    setShowForm(false);
    resetForm();
  };

  const publish = async(mode:"scheduled"|"immediate") => {
    if (mode==="immediate" && remainingPushes<=0) return;
    if(!headline.trim())return;

    setSaving(true);
    setError("");

    const doesRecur=canRecur&&recurring;
    const standardPayload={
      shul_id:shulId,
      content_type:type,
      title:headline.trim()||type,
      details:details.trim()||null,
      location:location.trim()||null,
      display_start:startAt,
      display_end:endAt,
      event_time:needsTime&&eventTime?eventTime:null,
      recurring:doesRecur,
      recurrence_type:doesRecur?frequency:null,
      recurrence_weekdays:doesRecur&&frequency==="weekly"?weekdays:[],
      recurrence_month_days:doesRecur&&frequency==="monthly"?monthDays:[],
      recurrence_excluded_dates:doesRecur?(editingNotice?.recurrence?.excludedDates||[]):[],
      active:true,
      priority_level:2,
      updated_at:new Date().toISOString(),
      ...(mode==="immediate"?{immediate_sent_at:new Date().toISOString()}:{})
    };

    const linkedDetailsPayload={
      details:details.trim()||null,
      location:location.trim()||null,
      updated_at:new Date().toISOString(),
      ...(mode==="immediate"?{immediate_sent_at:new Date().toISOString()}:{})
    };

    const result=editingNoticeId
      ? await supabase.from("notices_events")
          .update(isLinkedSpecialEvent?linkedDetailsPayload:standardPayload)
          .eq("id",editingNoticeId)
          .eq("shul_id",shulId)
          .select("*")
          .maybeSingle()
      : await supabase.from("notices_events")
          .insert(standardPayload)
          .select("*")
          .maybeSingle();

    if(result.error||!result.data){
      setError(result.error?.message||"Could not save this notice or event.");
      setSaving(false);
      return;
    }

    const saved=noticeFromRow(result.data,editingNotice);
    setNotices(editingNoticeId
      ?notices.map(notice=>notice.id===editingNoticeId?saved:notice)
      :[saved,...notices]
    );

    if(mode==="immediate")usePush();
    setSaving(false);
    closeForm();
  };

  const deleteNotice=async(scope:"occurrence"|"series")=>{
    if(!editingNoticeId||!editingNotice)return;
    setDeleting(true);
    setError("");

    if(scope==="occurrence"&&editingNotice.recurrence?.enabled){
      if(!deleteOccurrenceDate){
        setError("Choose the occurrence date to delete.");
        setDeleting(false);
        return;
      }

      const excludedDates=[...new Set([
        ...(editingNotice.recurrence.excludedDates||[]),
        deleteOccurrenceDate
      ])].sort();

      const {error}=await supabase
        .from("notices_events")
        .update({
          recurrence_excluded_dates:excludedDates,
          updated_at:new Date().toISOString()
        })
        .eq("id",editingNoticeId)
        .eq("shul_id",shulId);

      if(error){
        setError(error.message);
        setDeleting(false);
        return;
      }

      setNotices(notices.map(notice=>
        notice.id===editingNoticeId
          ?{
              ...notice,
              status:deleteOccurrenceDate===today?"scheduled":notice.status,
              recurrence:{
                ...(notice.recurrence||{enabled:true}),
                enabled:true,
                excludedDates
              }
            }
          :notice
      ));
    }else{
      const {error}=await supabase
        .from("notices_events")
        .update({
          archived_at:new Date().toISOString(),
          active:false,
          updated_at:new Date().toISOString()
        })
        .eq("id",editingNoticeId)
        .eq("shul_id",shulId);

      if(error){
        setError(error.message);
        setDeleting(false);
        return;
      }

      setNotices(notices.filter(notice=>notice.id!==editingNoticeId));
    }

    setDeleting(false);
    closeForm();
  };

  const toggleWeekday = (day:number) => setWeekdays(v=>v.includes(day)?v.filter(x=>x!==day):[...v,day].sort());
  const toggleMonthDay = (day:number) => setMonthDays(v=>v.includes(day)?v.filter(x=>x!==day):[...v,day].sort((a,b)=>a-b));

  return (
    <>
      <div className="pageHeader">
        <div><span className="eyebrow">Scheduled communication</span><h1>Notices & Events</h1><p>One-time or recurring content that appears on the magnet during the dates you choose.</p></div>
        <button className="primary" onClick={openNew}>+ Add Notice or Event</button>
      </div>

      <div className="pushBanner">
        <div><strong>Immediate updates today</strong><span>{remainingPushes} of 2 remaining</span></div>
        <p>Regular overnight updates do not count against this limit.</p>
      </div>

      {showForm && (
        <div className="panel formPanel">
          <div className="panelHead">
            <div>
              <span className="eyebrow">{editingNoticeId?"Edit content":"New content"}</span>
              <h2>{editingNoticeId?"Edit Notice or Event":"Add Notice or Event"}</h2>
            </div>
          </div>

          {error&&<div className="monthlySetupError">{error}</div>}

          {isLinkedSpecialEvent&&(
            <div className="linkedSpecialEventNotice">
              <strong>Linked to Monthly Setup</strong>
              <span>Name, date and time come from Monthly Setup. Add the communication details here.</span>
            </div>
          )}

          <div className="formGrid">
            <label>Type<select disabled={isLinkedSpecialEvent} value={type} onChange={e=>{setType(e.target.value as NoticeType);setRecurring(false);}}>{noticeTypes.map(n=><option key={n}>{n}</option>)}</select></label>
            {needsTime && <label>Event / schedule time<input disabled={isLinkedSpecialEvent} type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} /></label>}
            <label>Display start date<input disabled={isLinkedSpecialEvent} type="date" value={startAt} onChange={e=>setStartAt(e.target.value)} /></label>
            <label>Display end date<input disabled={isLinkedSpecialEvent} type="date" value={endAt} onChange={e=>setEndAt(e.target.value)} /></label>
            <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Main ballroom, social hall, address…" /></label>
          </div>

          <label>Headline<input disabled={isLinkedSpecialEvent} value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="Short headline" /></label>
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

          {editingNoticeId&&showDeleteConfirm&&editingNotice&&(
            <div className="deleteConfirmBox">
              <div>
                <strong>Are you sure you want to delete this?</strong>
                <span>{editingNotice.recurrence?.enabled?"This is a recurring series.":"This notice or event will be removed."}</span>
              </div>

              {editingNotice.recurrence?.enabled&&(
                <label className="deleteOccurrenceDate">
                  <span>Occurrence date</span>
                  <input
                    type="date"
                    min={editingNotice.startAt}
                    max={editingNotice.endAt}
                    value={deleteOccurrenceDate}
                    onChange={e=>setDeleteOccurrenceDate(e.target.value)}
                  />
                  <small>Use this when deleting only one occurrence.</small>
                </label>
              )}

              <div className="deleteConfirmActions">
                <button type="button" className="secondary" disabled={deleting} onClick={()=>setShowDeleteConfirm(false)}>Keep it</button>
                {editingNotice.recurrence?.enabled?(
                  <>
                    <button type="button" className="dangerButton" disabled={deleting} onClick={()=>void deleteNotice("occurrence")}>
                      {deleting?"Deleting…":"Delete Only This Date"}
                    </button>
                    <button type="button" className="dangerButton" disabled={deleting} onClick={()=>void deleteNotice("series")}>
                      {deleting?"Deleting…":"Delete Entire Series"}
                    </button>
                  </>
                ):(
                  <button type="button" className="dangerButton" disabled={deleting} onClick={()=>void deleteNotice("series")}>
                    {deleting?"Deleting…":"Yes, Delete"}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="formActions">
            {editingNoticeId&&!isLinkedSpecialEvent&&(
              <button className="dangerButton" disabled={saving||deleting} onClick={()=>setShowDeleteConfirm(true)}>Delete</button>
            )}
            <button className="secondary" disabled={saving||deleting} onClick={closeForm}>Cancel</button>
            <button className="secondary" disabled={saving||deleting||!headline.trim()} onClick={()=>void publish("scheduled")}>
              {saving?"Saving…":editingNoticeId?"Save changes":"Save for regular update"}
            </button>
            <button className="primary" disabled={saving||deleting||remainingPushes<=0||!headline.trim()} onClick={()=>void publish("immediate")}>
              {editingNoticeId?"Save & Send Now":"Send to Magnets Now"} ({remainingPushes} left)
            </button>
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
              {n.location&&<div className="noticeLocation">Location: {n.location}</div>}
              <p>{n.details}</p>
              {n.linkedSpecialEventKey&&<small className="linkedNoticeLabel">Linked to Monthly Setup</small>}
              {n.recurrence?.enabled && <small className="recurringLabel">Recurring · {n.recurrence.frequency}</small>}
            </div>
            <div className="noticeMeta">
              <span>{n.startAt} → {n.endAt}</span>
              <b>{n.status}</b>
              <button type="button" className="secondary" onClick={()=>openEdit(n)}>Edit</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

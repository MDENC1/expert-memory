import { useEffect, useMemo, useState } from "react";
import type { CalendarDay } from "../types";
import type { HebcalSpecialEvent } from "../App";
import { jewishMonthTemplates } from "../data/mock";
import { supabase } from "../lib/supabase";

type SpecialValues = Record<string,string>;
type FastEndRule = 42 | 60 | 72;
type FastOverride = {start?:string;end?:string};
type FocusedScheduleRow = {label:string;time:string};
type FocusedSpecialDate = {event:HebcalSpecialEvent};

const fastDays = [
  {key:"gedalia",name:"Tzom Gedalia",startSource:"MyZmanim Alos",autoStart:"5:34 AM",sunsetMinutes:19*60+1},
  {key:"yom_kippur",name:"Yom Kippur",startSource:"MyZmanim sunset / candle-lighting",autoStart:"6:43 PM",sunsetMinutes:18*60+58},
  {key:"teves",name:"Asarah B'Teves",startSource:"MyZmanim Alos",autoStart:"6:12 AM",sunsetMinutes:17*60+7},
  {key:"esther",name:"Taanis Esther",startSource:"MyZmanim Alos",autoStart:"5:31 AM",sunsetMinutes:18*60+39},
  {key:"tammuz",name:"17 Tammuz",startSource:"MyZmanim Alos",autoStart:"4:31 AM",sunsetMinutes:20*60+51},
  {key:"tisha_bav",name:"Tisha B'Av",startSource:"MyZmanim sunset",autoStart:"8:48 PM",sunsetMinutes:20*60+45}
];

function formatMinutes(total:number) {
  const normalized=((total%1440)+1440)%1440;
  const h24=Math.floor(normalized/60);
  const minute=normalized%60;
  const suffix=h24>=12?"PM":"AM";
  return `${h24%12 || 12}:${String(minute).padStart(2,"0")} ${suffix}`;
}

function defaultRowsForSpecialDate(title:string):FocusedScheduleRow[] {
  const t=title.toLowerCase();

  if(t.includes("yom kippur")){
    return [
      {label:"Shacharis",time:""},
      {label:"Yizkor",time:""},
      {label:"Mincha",time:""},
      {label:"Neilah",time:""},
      {label:"Maariv",time:""}
    ];
  }

  if(t.includes("rosh hashana")){
    return [
      {label:"Shacharis",time:""},
      {label:"Shofar",time:""},
      {label:"Mincha",time:""},
      {label:"Maariv",time:""}
    ];
  }

  if(t.includes("chol") || t.includes("hoshana")){
    return [
      {label:"Shacharis",time:""},
      {label:"Mincha / Maariv",time:""}
    ];
  }

  if(t.includes("shemini")){
    return [
      {label:"Shacharis",time:""},
      {label:"Yizkor",time:""},
      {label:"Mincha",time:""},
      {label:"Maariv",time:""}
    ];
  }

  if(t.includes("simchat") || t.includes("simchas")){
    return [
      {label:"Shacharis",time:""},
      {label:"Hakafos",time:""},
      {label:"Mincha",time:""},
      {label:"Maariv",time:""}
    ];
  }

  if(t.includes("purim")){
    return [
      {label:"Shacharis",time:""},
      {label:"Megillah",time:""},
      {label:"Mincha",time:""},
      {label:"Maariv",time:""}
    ];
  }

  if(t.includes("selich")){
    return [
      {label:"Selichos",time:""},
      {label:"Shacharis",time:""}
    ];
  }

  return [
    {label:"Shacharis",time:""},
    {label:"Mincha",time:""},
    {label:"Maariv",time:""}
  ];
}

function focusedDateLabel(date:string){
  return new Intl.DateTimeFormat("en-US",{
    weekday:"long",
    month:"long",
    day:"numeric",
    year:"numeric"
  }).format(new Date(`${date}T12:00:00`));
}

export default function MonthlySetupPage({
  days,
  setDays,
  shulId="",
  specialCalendarEvents=[],
  focusGroup="",
  onClearFocus,
  onSpecialSchedulesChanged
}:{
  days:CalendarDay[];
  setDays:(d:CalendarDay[])=>void;
  shulId?:string;
  specialCalendarEvents?:HebcalSpecialEvent[];
  focusGroup?:string;
  onClearFocus?:()=>void;
  onSpecialSchedulesChanged?:()=>void;
}) {
  const [month,setMonth] = useState("Tishrei");
  const [postalCode,setPostalCode] = useState("44124");
  const [fastEndRule,setFastEndRule] = useState<FastEndRule>(42);
  const [status,setStatus] = useState("MyZmanim settings are current.");
  const [fastOverrides,setFastOverrides] = useState<Record<string,FastOverride>>({});
  const [focusedMissing,setFocusedMissing] = useState<FocusedSpecialDate[]>([]);
  const [focusedDrafts,setFocusedDrafts] = useState<Record<string,FocusedScheduleRow[]>>({});
  const [focusedLoading,setFocusedLoading] = useState(false);
  const [focusedError,setFocusedError] = useState("");
  const [focusedSavingDate,setFocusedSavingDate] = useState("");

  const [values,setValues] = useState<SpecialValues>({
    selichos:"06:00",
    rh_shacharis:"08:00",
    shofar:"10:30",
    yk_kol_nidrei:"18:25",
    yk_shacharis:"08:30",
    yk_yizkor:"11:15",
    yk_neilah:"17:45",
    sukkos_shacharis:"09:00",
    hoshana_rabbah:"06:30",
    shemini_yizkor:"10:45",
    hakafos_night:"19:45",
    hakafos_day:"10:45"
  });

  useEffect(()=>{
    if(!focusGroup||!shulId){
      setFocusedMissing([]);
      return;
    }

    let cancelled=false;

    async function loadFocusedMissing(){
      setFocusedLoading(true);
      setFocusedError("");

      const uniqueByDate=new Map<string,HebcalSpecialEvent>();
      for(const event of specialCalendarEvents
        .filter(event=>event.group_key===focusGroup&&event.requires_confirmation)
        .sort((a,b)=>a.date.localeCompare(b.date))){
        const existing=uniqueByDate.get(event.date);
        if(!existing||(!existing.blocks_regular_schedule&&event.blocks_regular_schedule)){
          uniqueByDate.set(event.date,event);
        }
      }

      const events=[...uniqueByDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
      const dates=events.map(event=>event.date);

      if(!dates.length){
        if(!cancelled){
          setFocusedMissing([]);
          setFocusedLoading(false);
        }
        return;
      }

      const [daysRes,entriesRes,overridesRes]=await Promise.all([
        supabase.from("special_schedule_days")
          .select("event_date,replace_normal_schedule,confirmed_at")
          .eq("shul_id",shulId)
          .in("event_date",dates),
        supabase.from("special_schedule_entries")
          .select("event_date")
          .eq("shul_id",shulId)
          .eq("active",true)
          .in("event_date",dates),
        supabase.from("schedule_overrides")
          .select("event_date")
          .eq("shul_id",shulId)
          .eq("active",true)
          .in("event_date",dates)
      ]);

      if(cancelled)return;

      const err=daysRes.error||entriesRes.error||overridesRes.error;
      if(err){
        setFocusedError(err.message);
        setFocusedLoading(false);
        return;
      }

      const dayMap=new Map((daysRes.data||[]).map(row=>[String(row.event_date),row]));
      const entryCounts=new Map<string,number>();
      for(const row of entriesRes.data||[]){
        const key=String(row.event_date);
        entryCounts.set(key,(entryCounts.get(key)||0)+1);
      }
      const overrideCounts=new Map<string,number>();
      for(const row of overridesRes.data||[]){
        const key=String(row.event_date);
        overrideCounts.set(key,(overrideCounts.get(key)||0)+1);
      }

      const configured=(date:string)=>{
        if((overrideCounts.get(date)||0)>0)return true;
        const day:any=dayMap.get(date);
        if(!day||!day.confirmed_at)return false;
        if(day.replace_normal_schedule===false)return true;
        return (entryCounts.get(date)||0)>0;
      };

      const missing=events.filter(event=>!configured(event.date)).map(event=>({event}));
      setFocusedMissing(missing);
      setFocusedDrafts(current=>{
        const next={...current};
        for(const {event} of missing){
          if(!next[event.date])next[event.date]=defaultRowsForSpecialDate(event.title);
        }
        return next;
      });
      setFocusedLoading(false);
    }

    void loadFocusedMissing();
    return()=>{cancelled=true;};
  },[focusGroup,shulId,specialCalendarEvents]);

  const updateFocusedRow=(date:string,index:number,field:keyof FocusedScheduleRow,value:string)=>{
    setFocusedDrafts(current=>({
      ...current,
      [date]:(current[date]||[]).map((row,i)=>i===index?{...row,[field]:value}:row)
    }));
  };

  const addFocusedRow=(date:string)=>{
    setFocusedDrafts(current=>({
      ...current,
      [date]:[...(current[date]||[]),{label:"",time:""}]
    }));
  };

  const removeFocusedRow=(date:string,index:number)=>{
    setFocusedDrafts(current=>({
      ...current,
      [date]:(current[date]||[]).filter((_,i)=>i!==index)
    }));
  };

  const confirmFocusedSchedule=async(event:HebcalSpecialEvent)=>{
    const rows=(focusedDrafts[event.date]||[])
      .map((row,index)=>({
        title:row.label.trim(),
        event_time:row.time||null,
        approximate:false,
        note:null,
        sort_order:(index+1)*10
      }))
      .filter(row=>row.title);

    if(!rows.length){
      setFocusedError(`Add at least one schedule item for ${event.title}.`);
      return;
    }

    setFocusedSavingDate(event.date);
    setFocusedError("");

    const {error}=await supabase.rpc("confirm_special_schedule",{
      p_shul_id:shulId,
      p_event_date:event.date,
      p_title:event.title,
      p_rows:rows,
      p_replace_normal_schedule:true
    });

    if(error){
      setFocusedError(error.message);
      setFocusedSavingDate("");
      return;
    }

    setFocusedMissing(current=>current.filter(item=>item.event.date!==event.date));
    setFocusedDrafts(current=>{
      const next={...current};
      delete next[event.date];
      return next;
    });
    setFocusedSavingDate("");
    onSpecialSchedulesChanged?.();
  };


  const template = useMemo(
    () => jewishMonthTemplates.find(item => item.month === month) ?? jewishMonthTemplates[0],
    [month]
  );

  const displayTime = (value:string) => {
    const [h,m] = value.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const saveMonth = () => {
    setDays(days.map(day => {
      const generatedKeys = new Set(["hoshana_rabbah","shemini_yizkor","hakafos_day"]);
      const specialTimes = (day.specialTimes ?? []).filter(item => !generatedKeys.has(item.key));

      if (month === "Tishrei") {
        if (day.holiday === "Hoshana Rabbah" && values.hoshana_rabbah) {
          specialTimes.push({key:"hoshana_rabbah",label:"Hoshana Rabbah Shacharis",time:displayTime(values.hoshana_rabbah),importance:"prominent"});
        }
        if (day.holiday === "Shemini Atzeres" && values.shemini_yizkor) {
          specialTimes.push({key:"shemini_yizkor",label:"Yizkor",time:displayTime(values.shemini_yizkor),importance:"prominent"});
        }
        if (day.holiday === "Simchas Torah" && values.hakafos_day) {
          specialTimes.push({key:"hakafos_day",label:"Hakafos",time:displayTime(values.hakafos_day),importance:"prominent"});
        }
      }
      return {...day,specialTimes};
    }));
    setStatus(`${month} special times saved and applied to the correct Jewish dates.`);
  };

  const setFastOverride=(key:string,field:"start"|"end",value:string)=>{
    setFastOverrides(v=>({...v,[key]:{...v[key],[field]:value}}));
  };

  const saveAndRecalculate=()=>{
    setStatus(`MyZmanim recalculated for ZIP ${postalCode}. All automatic fast-end times now use ${fastEndRule} minutes after sunset; manual overrides were preserved.`);
  };

  if(focusGroup){
    const focusEvents=specialCalendarEvents.filter(event=>event.group_key===focusGroup);
    const focusLabel=focusEvents[0]?.group_label || "Special Schedule";

    return (
      <>
        <div className="pageHeader">
          <div>
            <span className="eyebrow">Monthly Setup · Needs attention</span>
            <h1>{focusLabel}</h1>
            <p>Only dates that still need a confirmed shul schedule are shown here.</p>
          </div>
          {onClearFocus&&<button className="secondary" onClick={onClearFocus}>Show All Monthly Setup</button>}
        </div>

        {focusedError&&(
          <div className="panel" style={{marginBottom:14,borderColor:"#c44"}}>
            <strong>Setup error:</strong> {focusedError}
          </div>
        )}

        {focusedLoading ? (
          <div className="panel"><strong>Checking which special dates still need times…</strong></div>
        ) : focusedMissing.length===0 ? (
          <div className="panel specialSetupComplete">
            <span className="eyebrow">Complete</span>
            <h2>All {focusLabel} dates are confirmed.</h2>
            <p className="helperText">The dashboard reminder will stay cleared unless a schedule is changed or a new required date appears.</p>
          </div>
        ) : (
          <div className="focusedSpecialSetupList">
            <div className="panel focusedSpecialSummary">
              <strong>{focusedMissing.length} date{focusedMissing.length===1?"":"s"} still need confirmation</strong>
              <span>Enter only the shul-specific times for each date, then confirm it. Confirmed dates disappear from this list.</span>
            </div>

            {focusedMissing.map(({event})=>{
              const rows=focusedDrafts[event.date]||[];
              return (
                <div className="panel focusedSpecialCard" key={event.date}>
                  <div className="panelHead">
                    <div>
                      <span className="eyebrow">{focusedDateLabel(event.date)}</span>
                      <h2>{event.title}</h2>
                      <p className="helperText">Regular weekly times will not be used for this date until a special schedule is confirmed.</p>
                    </div>
                  </div>

                  <div className="focusedSpecialRows">
                    {rows.map((row,index)=>(
                      <div className="focusedSpecialRow" key={index}>
                        <label>
                          <span>Schedule item</span>
                          <input
                            value={row.label}
                            placeholder="Shacharis"
                            onChange={e=>updateFocusedRow(event.date,index,"label",e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Time</span>
                          <input
                            type="time"
                            value={row.time}
                            onChange={e=>updateFocusedRow(event.date,index,"time",e.target.value)}
                          />
                        </label>
                        <button className="secondary focusedRemoveRow" onClick={()=>removeFocusedRow(event.date,index)}>Remove</button>
                      </div>
                    ))}
                  </div>

                  <div className="focusedSpecialActions">
                    <button className="secondary" onClick={()=>addFocusedRow(event.date)}>+ Add Time</button>
                    <button
                      className="primary"
                      disabled={focusedSavingDate===event.date}
                      onClick={()=>confirmFocusedSchedule(event)}
                    >
                      {focusedSavingDate===event.date?"Saving…":"Confirm This Date"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Guided setup</span>
          <h1>Monthly Setup</h1>
          <p>Set shul-specific times and annual zmanim rules once. The calendar handles the dates.</p>
        </div>
      </div>

      <div className="panel zmanimSettings">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Automatic zmanim</span>
            <h2>MyZmanim</h2>
            <p className="helperText">Candle lighting, Shabbos/Yom Tov endings and fast-day times are generated from MyZmanim for the shul's location.</p>
          </div>
          <span className="sourceBadge">Connected</span>
        </div>

        <div className="zmanimSettingsGrid">
          <label>
            <span>ZIP code</span>
            <input value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,"").slice(0,5))} />
            <small>Admin only · never shown on the magnet.</small>
          </label>

          <label>
            <span>Minor fast begins</span>
            <div className="readOnlySetting">MyZmanim Alos / dawn</div>
            <small>Calculated separately for each fast date.</small>
          </label>

          <label>
            <span>Default fast-end rule</span>
            <select value={fastEndRule} onChange={e=>setFastEndRule(Number(e.target.value) as FastEndRule)}>
              <option value={42}>42 minutes after sunset</option>
              <option value={60}>60 minutes after sunset</option>
              <option value={72}>72 minutes after sunset</option>
            </select>
            <small>Changing this immediately recalculates all automatic fast-end times below.</small>
          </label>

          <div className="zmanimSave">
            <strong>Yearly default</strong>
            <span>Save the rule for the Jewish year while preserving individual overrides.</span>
            <button className="primary" onClick={saveAndRecalculate}>Save & Recalculate Year</button>
          </div>
        </div>

        <div className="sourceLine">
          <strong>Times from MyZmanim</strong>
          <span>ZIP {postalCode || "—"}</span>
          <span>{fastEndRule}-minute default fast-end rule</span>
          <span>Manual overrides allowed</span>
        </div>
      </div>

      <div className="panel fastDaysPanel">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Fast days</span>
            <h2>Fast Start & End Times</h2>
            <p className="helperText">Automatic times below recalculate from the selected MyZmanim rule. Override any individual fast without affecting the rest.</p>
          </div>
        </div>

        <div className="fastDayList">
          {fastDays.map(fast=>{
            const override=fastOverrides[fast.key] ?? {};
            const automaticEnd=formatMinutes(fast.sunsetMinutes+fastEndRule);
            return (
              <div className="fastDayRow" key={fast.key}>
                <div className="fastName">
                  <strong>{fast.name}</strong>
                  <small>{fast.startSource} · ZIP {postalCode}</small>
                </div>

                <label>
                  <span>Fast begins</span>
                  <div className="generatedTime">
                    {override.start ? displayTime(override.start) : fast.autoStart}
                    <small>{override.start ? "Manual override" : "MyZmanim generated"}</small>
                  </div>
                  <input type="time" value={override.start || ""} onChange={e=>setFastOverride(fast.key,"start",e.target.value)} aria-label={`Override ${fast.name} start`} />
                </label>

                <label>
                  <span>Fast ends</span>
                  <div className="generatedTime">
                    {override.end ? displayTime(override.end) : automaticEnd}
                    <small>{override.end ? "Manual override" : `MyZmanim sunset + ${fastEndRule} min`}</small>
                  </div>
                  <input type="time" value={override.end || ""} onChange={e=>setFastOverride(fast.key,"end",e.target.value)} aria-label={`Override ${fast.name} end`} />
                </label>

                <button className="secondary" onClick={()=>setFastOverrides(v=>{const next={...v};delete next[fast.key];return next;})}>Use Automatic</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Jewish month</span>
            <h2>{month} Special Times</h2>
            <p className="helperText">Only fields likely to matter for this month are shown. Zmanim-generated fields remain automatic unless overridden above.</p>
          </div>
          <select value={month} onChange={e=>setMonth(e.target.value)}>
            {jewishMonthTemplates.map(item=><option key={item.month}>{item.month}</option>)}
          </select>
        </div>

        {template.specialItems.length ? (
          <div className="specialSetupGrid">
            {template.specialItems.map(item=>(
              <label key={item.key} className="specialSetupField">
                <span>{item.label}</span>
                <small>{item.appliesTo}</small>
                <input type="time" value={values[item.key] || ""} onChange={e=>setValues(v=>({...v,[item.key]:e.target.value}))} />
                {item.helpText && <small>{item.helpText}</small>}
              </label>
            ))}
          </div>
        ) : (
          <div className="emptyMonthSetup">No standard shul-entered special times are needed for {month}.</div>
        )}

        <div className="monthlySetupActions">
          <span>{status}</span>
          <button className="primary" onClick={saveMonth}>Save & Auto-Populate {month}</button>
        </div>
      </div>
    </>
  );
}

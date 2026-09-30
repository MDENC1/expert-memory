import { useEffect, useMemo, useState } from "react";
import type { CalendarDay } from "../types";
import type { HebcalSpecialEvent, LiveScheduleEntry } from "../App";
import { jewishMonthTemplates } from "../data/mock";
import { supabase } from "../lib/supabase";

type SpecialValues = Record<string,string>;
type FastEndRule = 42 | 60 | 72;
type FastOverride = {start?:string;end?:string};
type FocusedScheduleRow = {
  label:string;
  overrideTime:string;
  regularByDate:Record<string,string>;
};
type FocusedSpecialUnit = {
  id:string;
  label:string;
  events:HebcalSpecialEvent[];
  isCholHamoed:boolean;
};
type FocusedZmanimBatch = {
  sunset?:Record<string,string>;
  plagHaMincha?:Record<string,string>;
  sources?:Record<string,Record<string,string>>;
};
type FocusedZmanDefaults = {
  dawn:string;
  shema:string;
  midday:string;
  mincha:string;
  nightfall:string;
};

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

function extraRowsForSpecialDate(title:string){
  const t=title.toLowerCase();
  if(t.includes("yom kippur"))return ["Yizkor","Neilah"];
  if(t.includes("rosh hashana"))return ["Shofar"];
  if(t.includes("shemini"))return ["Yizkor"];
  if(t.includes("simchat")||t.includes("simchas"))return ["Hakafos"];
  if(t.includes("purim"))return ["Megillah"];
  if(t.includes("selich"))return ["Selichos"];
  return [] as string[];
}

const FOCUSED_DEFAULTS:FocusedZmanDefaults={
  dawn:"72fix",
  shema:"gra",
  midday:"standard",
  mincha:"gra",
  nightfall:"gra"
};

function focusedSourceFromDefault(family:string,defaults:FocusedZmanDefaults){
  if(family==="dawn")return defaults.dawn==="ben_ish" ? "dawn_benish" : "dawn_72fix";
  if(family==="sunrise")return "sunrise_default";
  if(family==="shema"){
    if(defaults.shema==="ben_ish")return "shema_benish";
    if(defaults.shema==="ma72")return "shema_ma72fix";
    return "shema_gra";
  }
  if(family==="midday")return defaults.midday==="ben_ish" ? "midday_benish" : "midday";
  if(family==="mincha_gedolah"){
    if(defaults.mincha==="ben_ish")return "mincha_benish";
    if(defaults.mincha==="ma72")return "mincha_ma72fix";
    return "mincha_gra";
  }
  if(family==="mincha_ketana"){
    if(defaults.mincha==="ben_ish")return "ketana_benish";
    if(defaults.mincha==="ma72")return "ketana_ma72fix";
    return "ketana_gra";
  }
  if(family==="plag"){
    if(defaults.mincha==="ben_ish")return "plag_benish";
    if(defaults.mincha==="ma72")return "plag_ma72fix";
    return "plag_gra";
  }
  if(family==="sunset")return "sunset_default";
  if(family==="nightfall"){
    if(defaults.nightfall==="ben_ish")return "night_benish";
    if(defaults.nightfall==="rt72")return "night_72fix";
    return "night_gra180";
  }
  if(family==="shabbos_end")return "shabbos_end";
  return "";
}

function focusedIsoDate(date:Date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function focusedShiftDate(date:string,days:number){
  const d=new Date(`${date}T12:00:00`);
  d.setDate(d.getDate()+days);
  return focusedIsoDate(d);
}

function focusedTimeMinutes(value:string|undefined){
  if(!value)return null;
  const match=value.match(/T(\d{2}):(\d{2})/);
  if(!match)return null;
  return Number(match[1])*60+Number(match[2]);
}

function focusedMinutesTo24(minutes:number){
  const normalized=((minutes%1440)+1440)%1440;
  return `${String(Math.floor(normalized/60)).padStart(2,"0")}:${String(normalized%60).padStart(2,"0")}`;
}

function focusedRound(minutes:number,to:number|null|undefined,direction:string|null|undefined){
  if(!to||to<=1)return minutes;
  if(direction==="up")return Math.ceil(minutes/to)*to;
  if(direction==="nearest")return Math.round(minutes/to)*to;
  return Math.floor(minutes/to)*to;
}

function focusedPretty24(value:string){
  if(!/^\d{2}:\d{2}$/.test(value))return value;
  const [h,m]=value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"})
    .format(new Date(2000,0,1,h,m));
}

function focusedWeekStart(date:string){
  const d=new Date(`${date}T12:00:00`);
  d.setDate(d.getDate()-d.getDay());
  return focusedIsoDate(d);
}

function focusedResolveRuleTime(
  date:string,
  rule:LiveScheduleEntry,
  schedule:LiveScheduleEntry[],
  zmanim:FocusedZmanimBatch,
  defaults:FocusedZmanDefaults,
  shabbosEndMinutes:number
){
  if(rule.service_time){
    const match=String(rule.service_time).match(/^(\d{2}):(\d{2})/);
    return match?`${match[1]}:${match[2]}`:"";
  }
  if(rule.timing_source==="none"||rule.timing_source==="follows")return "";

  const source=(rule.use_shul_zman_default&&rule.zman_family)
    ? focusedSourceFromDefault(rule.zman_family,defaults)
    : (rule.timing_source||"");

  const isShabbosEnd=source==="shabbos_end";
  const map=source==="plag"
    ? zmanim.plagHaMincha
    : source==="sunset"||isShabbosEnd
      ? zmanim.sunset
      : zmanim.sources?.[source];

  if(!map)return "";

  const period=rule.group_period||(rule.use_weekly_earliest?"week_earliest":"individual");
  let candidateDates=[date];

  if(period!=="individual"){
    const groupKey=rule.rule_group_id||rule.weekly_group;
    const matching=groupKey
      ? schedule.filter(row=>(row.rule_group_id||row.weekly_group)===groupKey)
      : [rule];
    const dows=new Set(matching.map(row=>row.day_of_week));

    if(period==="week_earliest"){
      const start=focusedWeekStart(date);
      const sunday=new Date(`${start}T12:00:00`);
      candidateDates=Array.from({length:7},(_,i)=>{
        const d=new Date(sunday);
        d.setDate(sunday.getDate()+i);
        return focusedIsoDate(d);
      }).filter(key=>dows.has(new Date(`${key}T12:00:00`).getDay()));
    }else if(period==="month_earliest"){
      const base=new Date(`${date}T12:00:00`);
      const count=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
      candidateDates=Array.from({length:count},(_,i)=>
        focusedIsoDate(new Date(base.getFullYear(),base.getMonth(),i+1,12))
      ).filter(key=>dows.has(new Date(`${key}T12:00:00`).getDay()));
    }
  }

  const values=candidateDates
    .map(key=>focusedTimeMinutes(map[key]))
    .filter((value):value is number=>value!==null)
    .map(value=>value+(isShabbosEnd?shabbosEndMinutes:0)+(rule.timing_offset_minutes||0));

  if(!values.length)return "";
  const raw=period==="individual"?values[0]:Math.min(...values);
  return focusedMinutesTo24(focusedRound(raw,rule.round_to_minutes,rule.round_direction));
}

function focusedRegularRows(
  date:string,
  schedule:LiveScheduleEntry[],
  zmanim:FocusedZmanimBatch,
  defaults:FocusedZmanDefaults,
  shabbosEndMinutes:number
){
  const dow=new Date(`${date}T12:00:00`).getDay();
  const rules=schedule.filter(rule=>rule.day_of_week===dow);
  const follows=rules.some(rule=>
    rule.service_type.toLowerCase()==="maariv"&&rule.timing_source==="follows"
  );

  return rules
    .filter(rule=>rule.timing_source!=="none")
    .filter(rule=>!(rule.service_type.toLowerCase()==="maariv"&&rule.timing_source==="follows"))
    .map(rule=>{
      const service=rule.service_type.toLowerCase();
      let label=rule.display_name||rule.service_type;
      if(follows&&service==="mincha"){
        label=label.replace(/\s*\/\s*Maariv$/i,"")+" / Maariv";
      }
      return {
        label,
        time:focusedResolveRuleTime(date,rule,schedule,zmanim,defaults,shabbosEndMinutes)
      };
    })
    .filter(row=>row.label);
}

function focusedDateRangeLabel(events:HebcalSpecialEvent[]){
  const sorted=events.slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(sorted.length===1)return focusedDateLabel(sorted[0].date);
  const first=new Date(`${sorted[0].date}T12:00:00`);
  const last=new Date(`${sorted[sorted.length-1].date}T12:00:00`);
  const firstText=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(first);
  const lastText=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(last);
  return `${firstText}–${lastText} · ${sorted.length} dates`;
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
  const [focusedUnits,setFocusedUnits] = useState<FocusedSpecialUnit[]>([]);
  const [focusedDrafts,setFocusedDrafts] = useState<Record<string,FocusedScheduleRow[]>>({});
  const [focusedLoading,setFocusedLoading] = useState(false);
  const [focusedError,setFocusedError] = useState("");
  const [focusedSavingUnit,setFocusedSavingUnit] = useState("");

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
      setFocusedUnits([]);
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
          setFocusedUnits([]);
          setFocusedLoading(false);
        }
        return;
      }

      const [daysRes,entriesRes,overridesRes,scheduleRes,zmanimSettingsRes,shulRes]=await Promise.all([
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
          .in("event_date",dates),
        supabase.from("schedule_entries")
          .select("*")
          .eq("shul_id",shulId)
          .eq("active",true)
          .order("day_of_week")
          .order("sort_order"),
        supabase.from("zmanim_settings")
          .select("myzmanim_location_id,shabbos_yom_tov_end_minutes,zman_defaults")
          .eq("shul_id",shulId)
          .maybeSingle(),
        supabase.from("shuls")
          .select("country_code,postal_code")
          .eq("id",shulId)
          .maybeSingle()
      ]);

      if(cancelled)return;

      const err=daysRes.error||entriesRes.error||overridesRes.error||scheduleRes.error||zmanimSettingsRes.error||shulRes.error;
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

      const missingEvents=events.filter(event=>!configured(event.date));
      if(!missingEvents.length){
        setFocusedUnits([]);
        setFocusedDrafts({});
        setFocusedLoading(false);
        return;
      }

      const schedule=(scheduleRes.data||[]) as LiveScheduleEntry[];
      const defaults:FocusedZmanDefaults={
        ...FOCUSED_DEFAULTS,
        ...((zmanimSettingsRes.data?.zman_defaults||{}) as Partial<FocusedZmanDefaults>)
      };
      const shabbosEndMinutes=Number(zmanimSettingsRes.data?.shabbos_yom_tov_end_minutes||60);
      const locationId=String(zmanimSettingsRes.data?.myzmanim_location_id||"");
      const country=String(shulRes.data?.country_code||"US");
      const postal=String(shulRes.data?.postal_code||"");

      let rangeStart=focusedShiftDate(missingEvents[0].date,-6);
      let rangeEnd=focusedShiftDate(missingEvents[missingEvents.length-1].date,6);

      if(schedule.some(rule=>rule.group_period==="month_earliest")){
        const first=new Date(`${missingEvents[0].date}T12:00:00`);
        const last=new Date(`${missingEvents[missingEvents.length-1].date}T12:00:00`);
        rangeStart=focusedIsoDate(new Date(first.getFullYear(),first.getMonth(),1,12));
        rangeEnd=focusedIsoDate(new Date(last.getFullYear(),last.getMonth()+1,0,12));
      }

      const merged:FocusedZmanimBatch={sunset:{},plagHaMincha:{},sources:{}};
      let chunkStart=rangeStart;

      while(chunkStart<=rangeEnd){
        const candidateEnd=focusedShiftDate(chunkStart,39);
        const chunkEnd=candidateEnd<rangeEnd?candidateEnd:rangeEnd;

        const {data,error}=await supabase.functions.invoke("myzmanim",{
          body:{
            postal_code:postal,
            country_code:country,
            location_id:locationId||undefined,
            start_date:chunkStart,
            end_date:chunkEnd
          }
        });

        if(error||!data?.success){
          setFocusedError(data?.error||error?.message||"Could not load regular MyZmanim times.");
          setFocusedLoading(false);
          return;
        }

        const times=(data.times||{}) as FocusedZmanimBatch;
        merged.sunset={...(merged.sunset||{}),...(times.sunset||{})};
        merged.plagHaMincha={...(merged.plagHaMincha||{}),...(times.plagHaMincha||{})};
        for(const [source,map] of Object.entries(times.sources||{})){
          merged.sources={
            ...(merged.sources||{}),
            [source]:{
              ...(merged.sources?.[source]||{}),
              ...(map||{})
            }
          };
        }

        chunkStart=focusedShiftDate(chunkEnd,1);
      }

      if(cancelled)return;

      const regularByDate=new Map<string,Array<{label:string;time:string}>>();
      for(const event of missingEvents){
        regularByDate.set(
          event.date,
          focusedRegularRows(event.date,schedule,merged,defaults,shabbosEndMinutes)
        );
      }

      const chol=missingEvents.filter(event=>event.is_chol_hamoed);
      const units:FocusedSpecialUnit[]=[];

      if(chol.length){
        units.push({
          id:`chol-hamoed-${focusGroup}`,
          label:focusGroup==="pesach"?"Chol Hamoed Pesach":"Chol Hamoed Succos",
          events:chol,
          isCholHamoed:true
        });
      }

      for(const event of missingEvents.filter(event=>!event.is_chol_hamoed)){
        units.push({
          id:event.date,
          label:event.title,
          events:[event],
          isCholHamoed:false
        });
      }

      units.sort((a,b)=>a.events[0].date.localeCompare(b.events[0].date));

      const nextDrafts:Record<string,FocusedScheduleRow[]>={};

      for(const unit of units){
        const rowMap=new Map<string,FocusedScheduleRow>();

        for(const event of unit.events){
          for(const regular of regularByDate.get(event.date)||[]){
            const current=rowMap.get(regular.label)||{
              label:regular.label,
              overrideTime:"",
              regularByDate:{}
            };
            current.regularByDate[event.date]=regular.time;
            rowMap.set(regular.label,current);
          }
        }

        if(!unit.isCholHamoed){
          for(const extra of extraRowsForSpecialDate(unit.events[0].title)){
            if(!rowMap.has(extra)){
              rowMap.set(extra,{label:extra,overrideTime:"",regularByDate:{}});
            }
          }
        }

        nextDrafts[unit.id]=[...rowMap.values()];
      }

      setFocusedUnits(units);
      setFocusedDrafts(nextDrafts);
      setFocusedLoading(false);
    }

    void loadFocusedMissing();
    return()=>{cancelled=true;};
  },[focusGroup,shulId,specialCalendarEvents]);

  const updateFocusedRow=(unitId:string,index:number,field:"label"|"overrideTime",value:string)=>{
    setFocusedDrafts(current=>({
      ...current,
      [unitId]:(current[unitId]||[]).map((row,i)=>i===index?{...row,[field]:value}:row)
    }));
  };

  const addFocusedRow=(unitId:string)=>{
    setFocusedDrafts(current=>({
      ...current,
      [unitId]:[...(current[unitId]||[]),{label:"",overrideTime:"",regularByDate:{}}]
    }));
  };

  const removeFocusedRow=(unitId:string,index:number)=>{
    setFocusedDrafts(current=>({
      ...current,
      [unitId]:(current[unitId]||[]).filter((_,i)=>i!==index)
    }));
  };

  const confirmFocusedUnit=async(unit:FocusedSpecialUnit)=>{
    const draftRows=focusedDrafts[unit.id]||[];

    const datePayloads=unit.events.map(event=>{
      const rows=draftRows.map((row,index)=>{
        const time=row.overrideTime||row.regularByDate[event.date]||"";
        return {
          title:row.label.trim(),
          event_time:time||null,
          approximate:false,
          note:null,
          sort_order:(index+1)*10
        };
      }).filter(row=>row.title&&row.event_time);

      return {
        event_date:event.date,
        title:unit.isCholHamoed?unit.label:event.title,
        replace_normal_schedule:true,
        rows
      };
    });

    const missingDate=datePayloads.find(item=>!item.rows.length);
    if(missingDate){
      setFocusedError(`No usable times are available for ${focusedDateLabel(missingDate.event_date)}. Add an override before confirming.`);
      return;
    }

    setFocusedSavingUnit(unit.id);
    setFocusedError("");

    const {error}=await supabase.rpc("confirm_special_schedule_group",{
      p_shul_id:shulId,
      p_dates:datePayloads
    });

    if(error){
      setFocusedError(error.message);
      setFocusedSavingUnit("");
      return;
    }

    setFocusedUnits(current=>current.filter(item=>item.id!==unit.id));
    setFocusedDrafts(current=>{
      const next={...current};
      delete next[unit.id];
      return next;
    });
    setFocusedSavingUnit("");
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
    const missingDateCount=focusedUnits.reduce((sum,unit)=>sum+unit.events.length,0);

    return (
      <>
        <div className="pageHeader">
          <div>
            <span className="eyebrow">Monthly Setup · Needs attention</span>
            <h1>{focusLabel}</h1>
            <p>Regular shul times are shown as the default. Leave an override blank to keep the regular time.</p>
          </div>
          {onClearFocus&&<button className="secondary" onClick={onClearFocus}>Show All Monthly Setup</button>}
        </div>

        {focusedError&&(
          <div className="panel" style={{marginBottom:14,borderColor:"#c44"}}>
            <strong>Setup error:</strong> {focusedError}
          </div>
        )}

        {focusedLoading ? (
          <div className="panel"><strong>Loading regular shul times and checking what still needs confirmation…</strong></div>
        ) : focusedUnits.length===0 ? (
          <div className="panel specialSetupComplete">
            <span className="eyebrow">Complete</span>
            <h2>All {focusLabel} dates are confirmed.</h2>
            <p className="helperText">The dashboard reminder will stay cleared unless a schedule is changed or a new required date appears.</p>
          </div>
        ) : (
          <div className="focusedSpecialSetupList">
            <div className="panel focusedSpecialSummary">
              <strong>{missingDateCount} date{missingDateCount===1?"":"s"} still need confirmation</strong>
              <span>Regular times are preloaded below. Override only what is different for the special schedule.</span>
            </div>

            {focusedUnits.map(unit=>{
              const rows=focusedDrafts[unit.id]||[];
              return (
                <div className={`panel focusedSpecialCard ${unit.isCholHamoed?"cholHamoedGroup":""}`} key={unit.id}>
                  <div className="panelHead">
                    <div>
                      <span className="eyebrow">{focusedDateRangeLabel(unit.events)}</span>
                      <h2>{unit.label}</h2>
                      <p className="helperText">
                        {unit.isCholHamoed
                          ?`Grouped once for all ${unit.events.length} Chol Hamoed dates. Each date keeps its own regular calculated time unless you override it here.`
                          :"The regular schedule is the default. Add an override only where this special date is different."}
                      </p>
                    </div>
                    {unit.isCholHamoed&&<span className="sourceBadge">Grouped CH&quot;M</span>}
                  </div>

                  <div className="focusedSpecialRows">
                    {rows.map((row,index)=>{
                      const datedRegulars=unit.events
                        .map(event=>({date:event.date,time:row.regularByDate[event.date]||""}))
                        .filter(item=>item.time);
                      const uniqueTimes=[...new Set(datedRegulars.map(item=>item.time))];

                      return (
                        <div className="focusedSpecialRow regularDefaultRow" key={index}>
                          <label>
                            <span>Schedule item</span>
                            <input
                              value={row.label}
                              placeholder="Shacharis"
                              onChange={e=>updateFocusedRow(unit.id,index,"label",e.target.value)}
                            />
                          </label>

                          <div className="regularTimeDefault">
                            <span>Regular schedule</span>
                            {datedRegulars.length===0 ? (
                              <strong>No regular time</strong>
                            ) : uniqueTimes.length===1 ? (
                              <>
                                <strong>{focusedPretty24(uniqueTimes[0])}</strong>
                                <small>{unit.events.length>1?"Applies automatically to each matching date":"Current regular time"}</small>
                              </>
                            ) : (
                              <>
                                <strong>Varies by date</strong>
                                <div className="regularTimeDateList">
                                  {datedRegulars.map(item=>(
                                    <small key={item.date}>
                                      {new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric"})
                                        .format(new Date(`${item.date}T12:00:00`))}: {focusedPretty24(item.time)}
                                    </small>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>

                          <label>
                            <span>Override</span>
                            <input
                              type="time"
                              value={row.overrideTime}
                              onChange={e=>updateFocusedRow(unit.id,index,"overrideTime",e.target.value)}
                            />
                            <small>{row.overrideTime?"Using override":"Blank = use regular time"}</small>
                          </label>

                          <button className="secondary focusedRemoveRow" onClick={()=>removeFocusedRow(unit.id,index)}>Remove</button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="focusedSpecialActions">
                    <button className="secondary" onClick={()=>addFocusedRow(unit.id)}>+ Add Special Time</button>
                    <button
                      className="primary"
                      disabled={focusedSavingUnit===unit.id}
                      onClick={()=>confirmFocusedUnit(unit)}
                    >
                      {focusedSavingUnit===unit.id
                        ?"Saving…"
                        :unit.isCholHamoed
                          ?`Confirm All ${unit.events.length} Chol Hamoed Dates`
                          :"Confirm This Date"}
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

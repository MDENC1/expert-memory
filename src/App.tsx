import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Bell, MonitorSmartphone, Settings, ShieldCheck, LayoutDashboard, WandSparkles } from "lucide-react";
import { calendarDays as seedDays } from "./data/mock";
import type { CalendarDay, Notice } from "./types";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import MonthlySetupPage from "./pages/MonthlySetupPage";
import NoticesPage from "./pages/NoticesPage";
import DevicesPage from "./pages/DevicesPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import OnboardingPage from "./pages/OnboardingPage";
import { PILOT_SHUL_ID, supabase } from "./lib/supabase";

type Tab = "dashboard" | "calendar" | "monthly" | "notices" | "devices" | "settings" | "super" | "onboarding";

export type LiveDevice = {
  id: string;
  device_code: string;
  household_label: string;
  battery_percent: number | null;
  last_check_in: string | null;
  status: string;
  active: boolean;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
};

export type LiveScheduleEntry = {
  id: string;
  day_of_week: number;
  service_type: string;
  service_time: string | null;
  timing_source: string | null;
  timing_offset_minutes: number | null;
  display_name: string | null;
  follows_text: string | null;
  sort_order: number;
  round_to_minutes: number | null;
  round_direction: "down" | "up" | "nearest" | null;
  use_weekly_earliest: boolean | null;
  weekly_group: string | null;
  group_period: "individual" | "week_earliest" | "month_earliest" | null;
  zman_family: string | null;
  use_shul_zman_default: boolean | null;
  rule_group_id: string | null;
};

type SpecialScheduleDay = {
  event_date:string;
  title:string|null;
  replace_normal_schedule:boolean;
  confirmed_at:string|null;
};

type SpecialScheduleEntry = {
  event_date:string;
  title:string;
  event_time:string|null;
  approximate:boolean;
  note:string|null;
  sort_order:number;
};

type ScheduleOverrideRow = {
  event_date:string;
  service_type:string;
  service_time:string|null;
  sort_order:number;
};

export type HebcalSpecialEvent = {
  date:string;
  title:string;
  hdate:string|null;
  hebrew:string|null;
  group_key:string;
  group_label:string;
  lead_days:number;
  blocks_regular_schedule:boolean;
  requires_confirmation:boolean;
  yomtov:boolean;
  subcat:string|null;
};

export type SpecialSetupAlert = {
  groupKey:string;
  label:string;
  firstDate:string;
  nextMissingDate:string;
  missingCount:number;
  totalCount:number;
  daysUntil:number;
  urgent:boolean;
};

type PreviewZmanimBatch = {
  plagHaMincha?: Record<string,string>;
  sunset?: Record<string,string>;
  sunrise?: Record<string,string>;
  latestShema?: Record<string,string>;
  midday?: Record<string,string>;
  candleLighting?: Record<string,string>;
  sources?: Record<string,Record<string,string>>;
};

type ZmanDefaults = {
  dawn:string;
  shema:string;
  midday:string;
  mincha:string;
  nightfall:string;
};

const DEFAULT_ZMAN_DEFAULTS:ZmanDefaults={
  dawn:"72fix",
  shema:"gra",
  midday:"standard",
  mincha:"gra",
  nightfall:"gra"
};

function sourceFromShulDefault(family:string,defaults:ZmanDefaults){
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

function initials(name:string){
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "M";
}

function localIsoDate(date=new Date()){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function prettyTime(t:string|null){
  if(!t) return "";
  const [h,m]=t.split(":").map(Number);
  const d=new Date(2000,0,1,h,m);
  return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(d);
}

function prettyIsoClock(value:string|undefined){
  if(!value)return "";
  const match=value.match(/T(\d{2}):(\d{2})/);
  if(!match)return "";
  return prettyTime(`${match[1]}:${match[2]}`);
}

function timeMinutesFromIso(value:string|undefined){
  if(!value)return null;
  const match=value.match(/T(\d{2}):(\d{2})/);
  if(!match)return null;
  return Number(match[1])*60+Number(match[2]);
}

function minutesToDisplay(minutes:number){
  const normalized=((minutes%1440)+1440)%1440;
  const h=Math.floor(normalized/60);
  const m=normalized%60;
  return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"})
    .format(new Date(2000,0,1,h,m));
}

function roundMinutes(minutes:number,to:number|null|undefined,direction:string|null|undefined){
  if(!to||to<=1)return minutes;
  if(direction==="up")return Math.ceil(minutes/to)*to;
  if(direction==="nearest")return Math.round(minutes/to)*to;
  return Math.floor(minutes/to)*to;
}

function weekStart(date:string){
  const d=new Date(`${date}T12:00:00`);
  d.setDate(d.getDate()-d.getDay());
  return localIsoDate(d);
}

function resolvePreviewScheduleRuleTime(
  date:string,
  rule:LiveScheduleEntry,
  schedule:LiveScheduleEntry[],
  zmanim:PreviewZmanimBatch,
  defaults:ZmanDefaults,
  shabbosEndMinutes:number
){
  const source=(rule.use_shul_zman_default&&rule.zman_family)
    ? sourceFromShulDefault(rule.zman_family,defaults)
    : (rule.timing_source||"");

  const isShabbosEnd=source==="shabbos_end";
  const map=source==="plag"
    ? zmanim.plagHaMincha
    : source==="sunset" || isShabbosEnd
      ? zmanim.sunset
      : zmanim.sources?.[source];

  if(!map)return "";

  const period=rule.group_period || (rule.use_weekly_earliest ? "week_earliest" : "individual");
  let candidateDates:string[]=[date];

  if(period!=="individual"){
    const groupKey=rule.rule_group_id||rule.weekly_group;
    const matchingGroup=groupKey
      ? schedule.filter(row=>(row.rule_group_id||row.weekly_group)===groupKey)
      : [rule];
    const dows=new Set(matchingGroup.map(row=>row.day_of_week));

    if(period==="week_earliest"){
      const start=weekStart(date);
      const sunday=new Date(`${start}T12:00:00`);
      candidateDates=Array.from({length:7},(_,i)=>{
        const d=new Date(sunday);
        d.setDate(sunday.getDate()+i);
        return localIsoDate(d);
      }).filter(key=>dows.has(new Date(`${key}T12:00:00`).getDay()));
    }else if(period==="month_earliest"){
      const baseDate=new Date(`${date}T12:00:00`);
      const y=baseDate.getFullYear();
      const m=baseDate.getMonth();
      const count=new Date(y,m+1,0).getDate();
      candidateDates=Array.from({length:count},(_,i)=>localIsoDate(new Date(y,m,i+1,12)))
        .filter(key=>dows.has(new Date(`${key}T12:00:00`).getDay()));
    }
  }

  const targets=candidateDates
    .map(key=>timeMinutesFromIso(map[key]))
    .filter((value):value is number=>value!==null)
    .map(value=>value+(isShabbosEnd?shabbosEndMinutes:0)+(rule.timing_offset_minutes||0));

  if(!targets.length)return "";
  const raw=period==="individual" ? targets[0] : Math.min(...targets);
  return minutesToDisplay(roundMinutes(raw,rule.round_to_minutes,rule.round_direction));
}

function hebrewParts(date:Date){
  const parts=new Intl.DateTimeFormat("en-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).formatToParts(date);
  return {
    day:parts.find(p=>p.type==="day")?.value || "",
    month:parts.find(p=>p.type==="month")?.value || "",
    year:parts.find(p=>p.type==="year")?.value || ""
  };
}

function hebrewNumeral(value:number){
  if(!Number.isFinite(value) || value<=0) return String(value);
  const ones=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens=["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  const hundreds=["","ק","ר","ש","ת"];
  let n=value;
  let out="";
  while(n>=400){out+="ת";n-=400;}
  if(n>=100){const h=Math.floor(n/100);out+=hundreds[h]||"";n%=100;}
  if(n===15){out+="טו";n=0;}
  else if(n===16){out+="טז";n=0;}
  else {
    if(n>=10){out+=tens[Math.floor(n/10)]||"";n%=10;}
    if(n>0) out+=ones[n]||"";
  }
  if(out.length===1) return out+"׳";
  return out.slice(0,-1)+"״"+out.slice(-1);
}

function hebrewMonthHebrew(english:string){
  const map:Record<string,string>={
    Tishri:"תשרי",Tishrei:"תשרי",Heshvan:"חשון",Cheshvan:"חשון",Kislev:"כסלו",Tevet:"טבת",Teves:"טבת",
    Shevat:"שבט",Adar:"אדר","Adar I":"אדר א׳","Adar II":"אדר ב׳",Nisan:"ניסן",Nissan:"ניסן",
    Iyar:"אייר",Sivan:"סיון",Tamuz:"תמוז",Tammuz:"תמוז",Av:"אב",Elul:"אלול"
  };
  return map[english] || english;
}

function hebrewFullDate(date:Date){
  const h=hebrewParts(date);
  const day=hebrewNumeral(Number(h.day));
  const yearNum=Number(h.year);
  const year=hebrewNumeral(yearNum % 1000);
  return `${day} ב${hebrewMonthHebrew(h.month)} תש${year.startsWith("תש") ? year.slice(2) : year}`.replace("תשתש","תש");
}

function isGenericSpecialTitle(title:string|null|undefined){
  return !title || /^tishrei schedule$/i.test(title.trim());
}

function mapNotice(row:any):Notice {
  const now = localIsoDate();
  const status:Notice["status"] = row.archived_at ? "expired" : row.display_start <= now && row.display_end >= now ? "live" : row.display_start > now ? "scheduled" : "expired";
  const priority:Notice["priority"] = row.priority_level === 3 ? "urgent" : row.priority_level === 2 ? "important" : "normal";
  return {
    id: row.id,
    type: row.content_type,
    headline: row.title,
    details: row.details || "",
    startAt: row.display_start,
    endAt: row.display_end,
    eventTime: row.event_time || undefined,
    recurrence: row.recurring ? {
      enabled:true,
      frequency:row.recurrence_type || undefined,
      weekdays:row.recurrence_weekdays || undefined,
      monthDays:row.recurrence_month_days || undefined
    } : {enabled:false},
    priority,
    publishMode: row.immediate_sent_at ? "immediate" : "scheduled",
    status
  };
}

function buildLiveDay(
  schedule:LiveScheduleEntry[],
  specialDay:SpecialScheduleDay|undefined,
  specialEntries:SpecialScheduleEntry[],
  zmanim:PreviewZmanimBatch,
  zmanDefaults:ZmanDefaults,
  shabbosEndMinutes:number,
  manualOverrides:ScheduleOverrideRow[],
  specialRequirement:HebcalSpecialEvent|undefined
):CalendarDay {
  const now=new Date();
  const today=localIsoDate(now);
  const h=hebrewParts(now);
  const dow=now.getDay();

  const base:CalendarDay={
    date:today,
    englishDay:now.getDate(),
    hebrewDate:h.day,
    hebrewMonth:`${h.month} ${h.year}`,
    hebrewFullDate:hebrewFullDate(now),
    isShabbos:dow===6,
    isRoshChodesh:h.day==="1" || h.day==="30",
    holiday:isGenericSpecialTitle(specialDay?.title)
      ? (specialRequirement?.title || undefined)
      : (specialDay?.title || specialRequirement?.title || undefined),
    template:specialDay?.title || specialRequirement?.group_label || (dow===6 ? "Shabbos" : "Regular")
  };

  if(manualOverrides.length){
    return {
      ...base,
      shulScheduleRows:manualOverrides
        .slice()
        .sort((a,b)=>a.sort_order-b.sort_order)
        .map(row=>({
          label:row.service_type,
          time:row.service_time?prettyTime(row.service_time):undefined
        }))
    };
  }

    if(specialDay?.replace_normal_schedule && specialDay.confirmed_at && specialEntries.length){
    const rows=specialEntries.map(e=>({
      label:e.title,
      time:e.event_time ? prettyTime(e.event_time) : undefined,
      note:e.note || undefined
    }));
    const exact=(needle:string)=>specialEntries
      .filter(e=>e.title.trim().toLowerCase()===needle)
      .filter(e=>e.event_time)
      .map(e=>prettyTime(e.event_time))
      .filter(Boolean);
    return {
      ...base,
      shacharis:exact("shacharis").join(" · ") || undefined,
      mincha:exact("mincha").join(" · ") || undefined,
      maariv:exact("maariv").join(" · ") || undefined,
      shulScheduleRows:rows,
      event:isGenericSpecialTitle(specialDay.title) ? undefined : (specialDay.title || undefined)
    };
  }

  if(specialRequirement?.blocks_regular_schedule){
    return {
      ...base,
      event:specialRequirement.title,
      shulScheduleRows:[{
        label:"Special schedule not set",
        time:undefined,
        note:specialRequirement.title
      }]
    };
  }

  const todayRules=schedule.filter(r=>r.day_of_week===dow);
  const maarivFollowsMincha=todayRules.some(r=>
    (r.service_type||"").toLowerCase()==="maariv" && r.timing_source==="follows"
  );

  const displayRule=(r:LiveScheduleEntry)=>{
    if(r.service_time)return prettyTime(r.service_time);
    if(r.timing_source==="none")return "NO MINYAN";
    if(r.timing_source==="follows")return r.follows_text || "Follows Mincha";
    return resolvePreviewScheduleRuleTime(today,r,schedule,zmanim,zmanDefaults,shabbosEndMinutes) || "Unavailable";
  };

  const rows=todayRules
    .filter(r=>!((r.service_type||"").toLowerCase()==="maariv" && r.timing_source==="follows"))
    .map(r=>{
      const service=(r.service_type||"").toLowerCase();
      let label=r.display_name||r.service_type.replaceAll("_"," ");
      if(maarivFollowsMincha && service==="mincha" && r.timing_source!=="none"){
        label=label.replace(/\s*\/\s*Maariv$/i,"")+" / Maariv";
      }
      return {label,time:displayRule(r)};
    });

  return {
    ...base,
    shulScheduleRows:rows
  };
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [currentShulId,setCurrentShulId] = useState("");
  const [authReady,setAuthReady] = useState(false);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(seedDays);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [shulName,setShulName] = useState("Loading shul…");
  const [postalCode,setPostalCode] = useState("");
  const [countryCode,setCountryCode] = useState("US");
  const [myzmanimLocationId,setMyzmanimLocationId] = useState("");
  const [devices,setDevices] = useState<LiveDevice[]>([]);
  const [scheduleEntries,setScheduleEntries] = useState<LiveScheduleEntry[]>([]);
  const [specialDay,setSpecialDay] = useState<SpecialScheduleDay|undefined>();
  const [specialEntries,setSpecialEntries] = useState<SpecialScheduleEntry[]>([]);
  const [todayOverrides,setTodayOverrides] = useState<ScheduleOverrideRow[]>([]);
  const [specialCalendarEvents,setSpecialCalendarEvents] = useState<HebcalSpecialEvent[]>([]);
  const [specialSetupAlerts,setSpecialSetupAlerts] = useState<SpecialSetupAlert[]>([]);
  const [specialStatusVersion,setSpecialStatusVersion] = useState(0);
  const [calendarFocusDate,setCalendarFocusDate] = useState("");
  const [monthlyFocusGroup,setMonthlyFocusGroup] = useState("");
  const [pushesUsed,setPushesUsed] = useState(0);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState("");
  const [liveZmanim,setLiveZmanim] = useState<PreviewZmanimBatch>({});
  const [liveZmanimRows,setLiveZmanimRows] = useState<Array<{label:string;time:string}>>([]);
  const [zmanDefaults,setZmanDefaults] = useState<ZmanDefaults>(DEFAULT_ZMAN_DEFAULTS);
  const [shabbosEndMinutes,setShabbosEndMinutes] = useState(60);
  const [dataVersion,setDataVersion] = useState(0);

  const remainingPushes = Math.max(0, 2 - pushesUsed);
  const activeDevices = devices.filter(d=>d.active);
  const healthyDevices = activeDevices.filter(d=>String(d.status).toLowerCase()==="healthy");
  const todaySpecialRequirement=useMemo(()=>{
    const today=localIsoDate();
    return specialCalendarEvents.find(event=>event.date===today&&event.blocks_regular_schedule);
  },[specialCalendarEvents]);

  const livePreviewDay=useMemo(
    ()=>({...buildLiveDay(
      scheduleEntries,
      specialDay,
      specialEntries,
      liveZmanim,
      zmanDefaults,
      shabbosEndMinutes,
      todayOverrides,
      todaySpecialRequirement
    ),zmanimRows:liveZmanimRows}),
    [scheduleEntries,specialDay,specialEntries,liveZmanim,zmanDefaults,shabbosEndMinutes,todayOverrides,todaySpecialRequirement,liveZmanimRows]
  );

  useEffect(()=>{
    let cancelled=false;

    // The live preview only needs MyZmanim while the Dashboard is visible.
    // Calendar loads its own month range, so don't duplicate that traffic.
    if(tab!=="dashboard"||!postalCode){
      if(!postalCode){
        setLiveZmanim({});
        setLiveZmanimRows([]);
      }
      return;
    }

    const now=new Date();
    const today=localIsoDate(now);
    const dow=now.getDay();
    const todayRules=scheduleEntries.filter(rule=>rule.day_of_week===dow);

    const needsMonth=todayRules.some(rule=>rule.group_period==="month_earliest");
    const needsWeek=todayRules.some(rule=>
      rule.group_period==="week_earliest"||Boolean(rule.use_weekly_earliest)
    );

    let start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
    let end=new Date(start);

    if(needsMonth){
      start=new Date(now.getFullYear(),now.getMonth(),1,12);
      end=new Date(now.getFullYear(),now.getMonth()+1,0,12);
    }else if(needsWeek){
      start=new Date(now);
      start.setHours(12,0,0,0);
      start.setDate(start.getDate()-start.getDay());
      end=new Date(start);
      end.setDate(end.getDate()+6);
    }

    supabase.functions.invoke("myzmanim",{
      body:{
        postal_code:postalCode,
        country_code:countryCode,
        location_id:myzmanimLocationId||undefined,
        start_date:localIsoDate(start),
        end_date:localIsoDate(end)
      }
    }).then(({data,error})=>{
      if(cancelled)return;
      if(error||!data?.success){
        setLiveZmanim({});
        setLiveZmanimRows([]);
        return;
      }

      const times=(data.times||{}) as PreviewZmanimBatch;
      setLiveZmanim(times);

      const shemaSource=sourceFromShulDefault("shema",zmanDefaults);
      const middaySource=sourceFromShulDefault("midday",zmanDefaults);
      const plagSource=sourceFromShulDefault("plag",zmanDefaults);

      const rows=[
        {label:"Netz",time:prettyIsoClock(times.sunrise?.[today])},
        {label:"Latest Shema",time:prettyIsoClock(times.sources?.[shemaSource]?.[today]||times.latestShema?.[today])},
        {label:"Chatzos",time:prettyIsoClock(times.sources?.[middaySource]?.[today]||times.midday?.[today])},
        {label:"Plag",time:prettyIsoClock(times.sources?.[plagSource]?.[today]||times.plagHaMincha?.[today])},
        {label:"Shkia",time:prettyIsoClock(times.sunset?.[today])}
      ].filter(row=>row.time);
      setLiveZmanimRows(rows);
    });

    return()=>{cancelled=true;};
  },[tab,postalCode,countryCode,myzmanimLocationId,currentShulId,zmanDefaults,scheduleEntries]);

  useEffect(()=>{
    if(!authReady||!currentShulId)return;

    let cancelled=false;

    async function loadSpecialSetupStatus(){
      const todayDate=new Date();
      const today=localIsoDate(todayDate);
      const end=new Date(todayDate);
      end.setDate(end.getDate()+60);
      const endDate=localIsoDate(end);

      const {data:calendarData,error:calendarError}=await supabase.functions.invoke("hebcal-calendar",{
        body:{
          start_date:today,
          end_date:endDate,
          country_code:countryCode
        }
      });

      if(cancelled)return;

      if(calendarError||!calendarData?.success){
        setSpecialCalendarEvents([]);
        setSpecialSetupAlerts([]);
        return;
      }

      const events=(calendarData.events||[]) as HebcalSpecialEvent[];
      setSpecialCalendarEvents(events);

      const [daysRes,entriesRes,overridesRes]=await Promise.all([
        supabase.from("special_schedule_days")
          .select("event_date,replace_normal_schedule,confirmed_at")
          .eq("shul_id",currentShulId)
          .gte("event_date",today)
          .lte("event_date",endDate),
        supabase.from("special_schedule_entries")
          .select("event_date")
          .eq("shul_id",currentShulId)
          .eq("active",true)
          .gte("event_date",today)
          .lte("event_date",endDate),
        supabase.from("schedule_overrides")
          .select("event_date")
          .eq("shul_id",currentShulId)
          .eq("active",true)
          .gte("event_date",today)
          .lte("event_date",endDate)
      ]);

      if(cancelled)return;
      if(daysRes.error||entriesRes.error||overridesRes.error)return;

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

      const groups=new Map<string,HebcalSpecialEvent[]>();
      for(const event of events.filter(event=>event.requires_confirmation)){
        groups.set(event.group_key,[...(groups.get(event.group_key)||[]),event]);
      }

      const alerts:SpecialSetupAlert[]=[];
      for(const [groupKey,groupEvents] of groups){
        const uniqueByDate=new Map<string,HebcalSpecialEvent>();
        for(const event of groupEvents.slice().sort((a,b)=>a.date.localeCompare(b.date))){
          const existing=uniqueByDate.get(event.date);
          if(!existing||(!existing.blocks_regular_schedule&&event.blocks_regular_schedule)){
            uniqueByDate.set(event.date,event);
          }
        }

        const sorted=[...uniqueByDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
        const missing=sorted.filter(event=>!configured(event.date));
        if(!missing.length)continue;

        const firstDate=sorted[0].date;
        const leadDays=Math.max(...sorted.map(event=>event.lead_days||0));
        const alertDateObj=new Date(firstDate+"T12:00:00");
        alertDateObj.setDate(alertDateObj.getDate()-leadDays);
        const alertDate=localIsoDate(alertDateObj);

        const currentMissing=missing.find(event=>event.date===today);
        if(today<alertDate&&!currentMissing)continue;

        const nextMissing=missing.find(event=>event.date>=today)||missing[0];
        const dayDiff=Math.round(
          (new Date(nextMissing.date+"T12:00:00").getTime()-new Date(today+"T12:00:00").getTime())/86400000
        );

        alerts.push({
          groupKey,
          label:sorted[0].group_label,
          firstDate,
          nextMissingDate:nextMissing.date,
          missingCount:missing.length,
          totalCount:sorted.length,
          daysUntil:dayDiff,
          urgent:Boolean(currentMissing)||dayDiff<=7
        });
      }

      alerts.sort((a,b)=>{
        if(a.urgent!==b.urgent)return a.urgent?-1:1;
        return a.nextMissingDate.localeCompare(b.nextMissingDate);
      });
      setSpecialSetupAlerts(alerts);
    }

    void loadSpecialSetupStatus();
    return()=>{cancelled=true;};
  },[authReady,currentShulId,countryCode,specialStatusVersion]);

  const nav = useMemo(() => [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["calendar", "Calendar", CalendarDays],
    ["monthly", "Monthly Setup", WandSparkles],
    ["notices", "Notices", Bell],
    ["devices", "Magnets", MonitorSmartphone],
    ["settings", "Settings", Settings]
  ] as const, []);

  useEffect(()=>{
    let cancelled=false;

    async function resolveStartingShul(){
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(cancelled)return;

      if(sessionError){
        setLoadError(sessionError.message);
        setAuthReady(true);
        return;
      }

      if(!session){
        const fallback=localStorage.getItem("magnets.currentShulId") || PILOT_SHUL_ID;
        setCurrentShulId(fallback);
        setAuthReady(true);
        return;
      }

      const {data:memberships,error:membershipError}=await supabase
        .from("shul_memberships")
        .select("shul_id,created_at")
        .eq("user_id",session.user.id)
        .order("created_at");

      if(cancelled)return;

      if(membershipError){
        setLoadError(membershipError.message);
        setAuthReady(true);
        return;
      }

      const ids=(memberships||[]).map(row=>row.shul_id as string);
      if(ids.length===0){
        localStorage.removeItem("magnets.currentShulId");
        setCurrentShulId("");
        setLoadError("");
        setLoading(false);
        setTab("onboarding");
        setAuthReady(true);
        return;
      }

      const saved=localStorage.getItem("magnets.currentShulId");
      const chosen=saved && ids.includes(saved) ? saved : ids[0];
      localStorage.setItem("magnets.currentShulId",chosen);
      setCurrentShulId(chosen);
      setAuthReady(true);
    }

    resolveStartingShul();
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(!authReady || !currentShulId){
      setLoading(false);
      return;
    }

    let cancelled=false;
    async function loadLiveData(){
      setLoading(true); setLoadError("");
      const today = localIsoDate();
      const [shulRes,deviceRes,noticeRes,scheduleRes,pushRes,specialDayRes,specialEntryRes,todayOverridesRes,zmanimSettingsRes] = await Promise.all([
        supabase.from("shuls").select("id,name,country_code,postal_code,timezone").eq("id",currentShulId).maybeSingle(),
        supabase.from("magnets").select("*").eq("shul_id",currentShulId).order("device_code"),
        supabase.from("notices_events").select("*").eq("shul_id",currentShulId).is("archived_at",null).order("display_start"),
        supabase.from("schedule_entries").select("*").eq("shul_id",currentShulId).eq("active",true).order("day_of_week").order("sort_order"),
        supabase.from("immediate_pushes").select("id",{count:"exact",head:true}).eq("shul_id",currentShulId).eq("sent_on",today),
        supabase.from("special_schedule_days").select("event_date,title,replace_normal_schedule,confirmed_at").eq("shul_id",currentShulId).eq("event_date",today).maybeSingle(),
        supabase.from("special_schedule_entries").select("event_date,title,event_time,approximate,note,sort_order").eq("shul_id",currentShulId).eq("event_date",today).eq("active",true).order("sort_order"),
        supabase.from("schedule_overrides").select("event_date,service_type,service_time,sort_order").eq("shul_id",currentShulId).eq("event_date",today).eq("active",true).order("sort_order"),
        supabase.from("zmanim_settings").select("myzmanim_location_id,zman_defaults,shabbos_yom_tov_end_minutes").eq("shul_id",currentShulId).maybeSingle()
      ]);
      if(cancelled) return;
      const firstError = shulRes.error || deviceRes.error || noticeRes.error || scheduleRes.error || pushRes.error || specialDayRes.error || specialEntryRes.error || todayOverridesRes.error || zmanimSettingsRes.error;
      if(firstError){
        setLoadError(firstError.message);
      } else if(!shulRes.data){
        localStorage.removeItem("magnets.currentShulId");
        setCurrentShulId("");
        setLoadError("");
        setLoading(false);
        setTab("onboarding");
        return;
      } else {
        setShulName(shulRes.data?.name || "Shul");
        setPostalCode(shulRes.data?.postal_code || "");
        setCountryCode(shulRes.data?.country_code || "US");
        setMyzmanimLocationId(zmanimSettingsRes.data?.myzmanim_location_id || "");
        setZmanDefaults({
          ...DEFAULT_ZMAN_DEFAULTS,
          ...((zmanimSettingsRes.data?.zman_defaults||{}) as Partial<ZmanDefaults>)
        });
        setShabbosEndMinutes(Number(zmanimSettingsRes.data?.shabbos_yom_tov_end_minutes||60));
        setDevices((deviceRes.data || []) as LiveDevice[]);
        setNotices((noticeRes.data || []).map(mapNotice));
        setScheduleEntries((scheduleRes.data || []) as LiveScheduleEntry[]);
        setSpecialDay((specialDayRes.data || undefined) as SpecialScheduleDay|undefined);
        setSpecialEntries((specialEntryRes.data || []) as SpecialScheduleEntry[]);
        setTodayOverrides((todayOverridesRes.data || []) as ScheduleOverrideRow[]);
        setPushesUsed(pushRes.count || 0);
      }
      setLoading(false);
    }
    loadLiveData();

    const channel=supabase.channel("pilot-live-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"magnets",filter:`shul_id=eq.${currentShulId}`},()=>loadLiveData())
      .on("postgres_changes",{event:"*",schema:"public",table:"notices_events",filter:`shul_id=eq.${currentShulId}`},()=>loadLiveData())
      .on("postgres_changes",{event:"*",schema:"public",table:"schedule_entries",filter:`shul_id=eq.${currentShulId}`},()=>loadLiveData())
      .on("postgres_changes",{event:"*",schema:"public",table:"special_schedule_days",filter:`shul_id=eq.${currentShulId}`},()=>{
        loadLiveData();
        setSpecialStatusVersion(v=>v+1);
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"special_schedule_entries",filter:`shul_id=eq.${currentShulId}`},()=>{
        loadLiveData();
        setSpecialStatusVersion(v=>v+1);
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"schedule_overrides",filter:`shul_id=eq.${currentShulId}`},()=>{
        loadLiveData();
        setSpecialStatusVersion(v=>v+1);
      })
      .subscribe();

    return ()=>{cancelled=true; supabase.removeChannel(channel);};
  },[authReady,currentShulId,dataVersion]);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">M</div>
          <div><strong>Magnets</strong><span>Organization Admin</span></div>
        </div>

        <div className="orgCard">
          <div className="orgLogo">{initials(shulName)}</div>
          <div><strong>{shulName}</strong><small>{activeDevices.length} magnets · LIVE</small></div>
        </div>

        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "navBtn active" : "navBtn"}
              onClick={() => {
                if(id==="monthly")setMonthlyFocusGroup("");
                setTab(id);
              }}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>

        <div className="sidebarBottom">
          <button className={tab === "super" ? "navBtn active" : "navBtn"} onClick={() => setTab("super")}>
            <ShieldCheck size={18} /> Company Super Admin
          </button>
        </div>
      </aside>

      <main className="main">
        {loadError && <div className="panel" style={{marginBottom:16,borderColor:"#c44"}}><strong>Supabase connection error:</strong> {loadError}</div>}

        {tab === "dashboard" && (
          <Dashboard
            days={calendarDays}
            previewDay={livePreviewDay}
            notices={notices}
            remainingPushes={remainingPushes}
            onGoCalendar={() => {setCalendarFocusDate("");setTab("calendar");}}
            onOpenSpecialSetup={(groupKey)=>{
              setMonthlyFocusGroup(groupKey);
              setTab("monthly");
            }}
            onAddNotice={() => setTab("notices")}
            shulName={shulName}
            activeMagnets={activeDevices.length}
            healthyMagnets={healthyDevices.length}
            scheduleEntries={scheduleEntries}
            specialSetupAlerts={specialSetupAlerts}
            todaySpecialRequirement={todaySpecialRequirement}
            loading={loading}
          />
        )}

        {tab === "calendar" && (
          <CalendarPage
            notices={notices}
            setNotices={setNotices}
            scheduleEntries={scheduleEntries}
            shulName={shulName}
            postalCode={postalCode}
            countryCode={countryCode}
            locationId={myzmanimLocationId}
            shulId={currentShulId}
            focusDate={calendarFocusDate}
          />
        )}

        {tab === "monthly" && (
          <MonthlySetupPage
            days={calendarDays}
            setDays={setCalendarDays}
            shulId={currentShulId}
            specialCalendarEvents={specialCalendarEvents}
            focusGroup={monthlyFocusGroup}
            onClearFocus={()=>setMonthlyFocusGroup("")}
            onSpecialSchedulesChanged={()=>setSpecialStatusVersion(v=>v+1)}
          />
        )}

        {tab === "notices" && (
          <NoticesPage
            notices={notices}
            setNotices={setNotices}
            remainingPushes={remainingPushes}
            usePush={() => setPushesUsed(v => Math.min(2, v + 1))}
          />
        )}

        {tab === "devices" && <DevicesPage devices={devices} />}

        {tab === "settings" && currentShulId && (
          <OnboardingPage
            mode="edit"
            shulId={currentShulId}
            onCancel={()=>setTab("dashboard")}
            onComplete={()=>{
              setDataVersion(v=>v+1);
            }}
          />
        )}

        {tab === "super" && <SuperAdminPage onNewOrganization={()=>setTab("onboarding")} />}
        {tab === "onboarding" && (
          <OnboardingPage
            onCancel={()=>setTab("super")}
            onComplete={(shulId)=>{
              localStorage.setItem("magnets.currentShulId",shulId);
              setCurrentShulId(shulId);
              setTab("dashboard");
            }}
          />
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { CalendarDay } from "../types";
import type { HebcalSpecialEvent, LiveScheduleEntry } from "../App";
import { jewishMonthTemplates } from "../data/mock";
import { supabase } from "../lib/supabase";
import { linkedSpecialEventsForDate } from "../lib/specialEventCatalog";

type SpecialValues = Record<string,string[]>;
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
  candleLighting?:Record<string,string>;
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

type MonthlyService = "Shacharis" | "Mincha" | "Maariv";
type MonthlyAdditionalField = {key:string;label:string;helpText?:string;allowMultiple?:boolean};
type MonthlyCustomEvent = {id:string;label:string;time:string};
type ChanukahDateChoice = {date:string;hebrewLabel:string;englishLabel:string};
type MonthlyDateCard = {
  date:string;
  hebrewDay:number;
  title:string;
  replaceSchedule:boolean;
  additional:MonthlyAdditionalField[];
  isCholHamoed:boolean;
};
type HebrewMonthOccurrence = {
  year:string;
  start:string;
  end:string;
  datesByDay:Record<number,string>;
};

const MONTHLY_SERVICES:MonthlyService[]=["Shacharis","Mincha","Maariv"];

const STATIC_MONTHLY_DATES:Record<string,Array<{
  day:number;
  title:string;
  additional:MonthlyAdditionalField[];
}>>={
  Shevat:[
    {day:15,title:"Tu B'Shvat",additional:[{key:"tu_bishvat_event",label:"Tu B'Shvat Program"}]}
  ],
  Iyar:[
    {day:18,title:"Lag B'Omer",additional:[{key:"lag_baomer",label:"Lag B'Omer Program"}]}
  ]
};

function normalizeHebrewMonthName(value:string){
  const month=value.trim();
  const aliases:Record<string,string>={
    Tishri:"Tishrei",
    Heshvan:"Cheshvan",
    Marcheshvan:"Cheshvan",
    Tevet:"Teves",
    Nisan:"Nissan",
    Tamuz:"Tammuz",
    "Adar II":"Adar"
  };
  return aliases[month]||month;
}

function hebrewPartsForDate(date:Date){
  const parts=new Intl.DateTimeFormat("en-u-ca-hebrew",{
    day:"numeric",
    month:"long",
    year:"numeric"
  }).formatToParts(date);
  const day=Number(parts.find(part=>part.type==="day")?.value||0);
  const month=parts.find(part=>part.type==="month")?.value||"";
  const year=parts.find(part=>part.type==="year")?.value||"";
  return {day,month,year};
}

function currentHebrewYear(){
  const today=new Date();
  today.setHours(12,0,0,0);
  const raw=hebrewPartsForDate(today).year;
  const parsed=Number(raw.replace(/[^0-9]/g,""));
  return Number.isFinite(parsed)&&parsed>0?parsed:5787;
}

function findHebrewMonthOccurrence(month:string,targetYear:number):HebrewMonthOccurrence|null{
  const today=new Date();
  today.setHours(12,0,0,0);

  // Scan far enough in both directions to cover the full current Hebrew year
  // and the entire following Hebrew year. The selected year, not "next occurrence",
  // determines which month is returned.
  const scanStart=new Date(today);
  scanStart.setDate(scanStart.getDate()-430);
  const scanEnd=new Date(today);
  scanEnd.setDate(scanEnd.getDate()+800);

  const matches:Array<{date:string;day:number;rawMonth:string;year:string}>=[];
  for(let cursor=new Date(scanStart);cursor<=scanEnd;cursor.setDate(cursor.getDate()+1)){
    const parts=hebrewPartsForDate(cursor);
    const normalized=normalizeHebrewMonthName(parts.month);
    if(Number(parts.year)!==targetYear)continue;
    if(normalized!==month)continue;
    // Purim belongs to Adar II in a leap year, not Adar I.
    if(month==="Adar"&&parts.month==="Adar I")continue;
    matches.push({
      date:focusedIsoDate(cursor),
      day:parts.day,
      rawMonth:parts.month,
      year:parts.year
    });
  }

  if(!matches.length)return null;
  matches.sort((a,b)=>a.date.localeCompare(b.date));

  return {
    year:String(targetYear),
    start:matches[0].date,
    end:matches[matches.length-1].date,
    datesByDay:Object.fromEntries(matches.map(item=>[item.day,item.date]))
  };
}

function monthlyEnglishDate(date:string){
  return new Intl.DateTimeFormat("en-US",{
    weekday:"long",
    month:"long",
    day:"numeric",
    year:"numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function monthlyHebrewDayText(value:number){
  const ones=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens=["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  if(value===15)return "ט״ו";
  if(value===16)return "ט״ז";
  if(value<10)return `${ones[value]||value}׳`;
  const ten=Math.floor(value/10);
  const one=value%10;
  const raw=`${tens[ten]||""}${ones[one]||""}`;
  return raw.length<=1?`${raw}׳`:`${raw.slice(0,-1)}״${raw.slice(-1)}`;
}

function monthlyHebrewMonthText(value:string){
  const map:Record<string,string>={
    Tishrei:"תשרי",
    Cheshvan:"חשון",
    Kislev:"כסלו",
    Teves:"טבת",
    Shevat:"שבט",
    Adar:"אדר",
    Nissan:"ניסן",
    Iyar:"אייר",
    Sivan:"סיון",
    Tammuz:"תמוז",
    Av:"אב",
    Elul:"אלול"
  };
  return map[value]||value;
}

function monthlyAdditionalFields(title:string):MonthlyAdditionalField[]{
  const t=title.toLowerCase();
  const fields:MonthlyAdditionalField[]=[];
  if(t.includes("rosh hashana"))fields.push({key:"shofar",label:"Shofar",allowMultiple:true});
  if(t.includes("yom kippur")){
    fields.push(
      {key:"kol_nidrei",label:"Kol Nidrei"},
      {key:"yizkor",label:"Yizkor"},
      {key:"neilah",label:"Neilah"}
    );
  }
  if(t.includes("shemini atzer"))fields.push({key:"yizkor",label:"Yizkor"});
  if(t.includes("simchat torah")||t.includes("simchas torah")){
    fields.push(
      {key:"hakafos_night",label:"Hakafos - Night"},
      {key:"hakafos_day",label:"Hakafos - Day"}
    );
  }
  if(t.includes("purim")&&!t.includes("katan")){
    fields.push(
      {key:"megillah_night",label:"Megillah - Night"},
      {key:"megillah_day",label:"Megillah - Day"}
    );
  }
  if(t.includes("selich")){
    fields.push({key:"selichos",label:"Selichos"});
  }
  if(t.includes("erev pesach")){
    fields.push(
      {key:"siyum_bechorim",label:"Siyum Bechorim"},
      {key:"chametz_stop",label:"Stop Eating Chametz"},
      {key:"chametz_burn",label:"Burn / Sell Chametz By"}
    );
  }
  if(t.includes("shavuot")||t.includes("shavuos")){
    if(!/ii|2/.test(t))fields.push({key:"shavuos_learning",label:"Shavuos Night Learning"});
    if(/ii|2/.test(t))fields.push({key:"shavuos_yizkor",label:"Yizkor"});
  }
  if(t.includes("pesach")&&(/viii|8/.test(t)))fields.push({key:"pesach_yizkor",label:"Yizkor"});
  if(t.includes("tisha b")||t.includes("tish'a b"))fields.push({key:"eicha",label:"Eicha"});
  return fields;
}

function monthlyIsFast(title:string){
  const t=title.toLowerCase();
  return /tzom gedalia|asara b|tevet|taanit esther|fast of esther|17th of tammuz|tzom tammuz|tisha b|tish'a b|yom kippur/.test(t);
}

function monthlyIsCholHamoedEvent(event:HebcalSpecialEvent){
  if(event.is_chol_hamoed)return true;
  const normalized=(event.title||"")
    .toLowerCase()
    .replace(/[’‘”“"'״׳]/g,"")
    .replace(/[^a-z0-9]+/g," ")
    .trim();
  return /chol ha moed|chol hamoed|ch m|chm/.test(normalized);
}

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

function monthlyRegularServiceRows(
  date:string,
  service:MonthlyService,
  schedule:LiveScheduleEntry[],
  zmanim:FocusedZmanimBatch,
  defaults:FocusedZmanDefaults,
  shabbosEndMinutes:number
){
  const dow=new Date(`${date}T12:00:00`).getDay();
  const directRules=schedule.filter(rule=>
    rule.day_of_week===dow&&rule.service_type.toLowerCase()===service.toLowerCase()
  );

  const rules=directRules.length
    ? directRules
    : service==="Maariv"
      ? schedule.filter(rule=>
          rule.day_of_week===dow&&
          rule.service_type.toLowerCase()==="mincha"&&
          Boolean(rule.follows_text)
        )
      : [];

  return rules.map(rule=>{
    const isInheritedMaariv=service==="Maariv"&&rule.service_type.toLowerCase()==="mincha";

    if(isInheritedMaariv){
      const raw=focusedResolveRuleTime(date,rule,schedule,zmanim,defaults,shabbosEndMinutes);
      const baseLabel=(rule.display_name||"Mincha").replace(/\s*\/\s*Maariv$/i,"");
      return {
        label:`Maariv after ${baseLabel}`,
        time:raw?`Follows ${focusedPretty24(raw)}`:(rule.follows_text||"Follows Mincha"),
        rawTime:""
      };
    }

    if(rule.timing_source==="none"){
      return {label:rule.display_name||service,time:"NO MINYAN",rawTime:""};
    }
    if(rule.timing_source==="follows"){
      return {label:rule.display_name||service,time:rule.follows_text||"Follows Mincha",rawTime:""};
    }
    const raw=focusedResolveRuleTime(date,rule,schedule,zmanim,defaults,shabbosEndMinutes);
    return {
      label:rule.display_name||service,
      time:raw?focusedPretty24(raw):"Timing unavailable",
      rawTime:raw
    };
  });
}

function monthlyFastAutomaticTimes(
  date:string,
  title:string,
  zmanim:FocusedZmanimBatch,
  defaults:FocusedZmanDefaults,
  shabbosEndMinutes:number
){
  const t=title.toLowerCase();
  const previous=focusedShiftDate(date,-1);
  const dawnSource=focusedSourceFromDefault("dawn",defaults);
  const nightSource=focusedSourceFromDefault("nightfall",defaults);

  let beginRaw="";
  let endRaw="";

  if(t.includes("yom kippur")||t.includes("tisha b")||t.includes("tish'a b")){
    const previousSunset=focusedTimeMinutes(zmanim.sunset?.[previous]);
    if(previousSunset!==null)beginRaw=focusedMinutesTo24(previousSunset);
  }else{
    const dawn=focusedTimeMinutes(zmanim.sources?.[dawnSource]?.[date]);
    if(dawn!==null)beginRaw=focusedMinutesTo24(dawn);
  }

  if(t.includes("yom kippur")){
    const sunset=focusedTimeMinutes(zmanim.sunset?.[date]);
    if(sunset!==null)endRaw=focusedMinutesTo24(sunset+shabbosEndMinutes);
  }else{
    const night=focusedTimeMinutes(zmanim.sources?.[nightSource]?.[date]);
    if(night!==null)endRaw=focusedMinutesTo24(night);
  }

  return {
    beginRaw,
    endRaw,
    beginDisplay:beginRaw?focusedPretty24(beginRaw):"Automatic time unavailable",
    endDisplay:endRaw?focusedPretty24(endRaw):"Automatic time unavailable"
  };
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
  scheduleEntries=[],
  postalCode="",
  countryCode="US",
  locationId="",
  zmanDefaults=FOCUSED_DEFAULTS,
  shabbosEndMinutes=60,
  focusGroup="",
  onClearFocus,
  onSpecialSchedulesChanged
}:{
  days:CalendarDay[];
  setDays:(d:CalendarDay[])=>void;
  shulId?:string;
  specialCalendarEvents?:HebcalSpecialEvent[];
  scheduleEntries?:LiveScheduleEntry[];
  postalCode?:string;
  countryCode?:string;
  locationId?:string;
  zmanDefaults?:FocusedZmanDefaults;
  shabbosEndMinutes?:number;
  focusGroup?:string;
  onClearFocus?:()=>void;
  onSpecialSchedulesChanged?:()=>void;
}) {
  const [month,setMonth] = useState("Tishrei");
  const [monthPickerOpen,setMonthPickerOpen] = useState(false);
  const [planNextYear,setPlanNextYear] = useState(false);
  const [status,setStatus] = useState("");
  const [fastOverrides,setFastOverrides] = useState<Record<string,FastOverride>>({});
  const [monthlyScheduleOverrides,setMonthlyScheduleOverrides] = useState<Record<string,Partial<Record<MonthlyService,string[]>>>>({});
  const [monthlyZmanim,setMonthlyZmanim] = useState<FocusedZmanimBatch>({});
  const [monthHebcalEvents,setMonthHebcalEvents] = useState<HebcalSpecialEvent[]>([]);
  const [monthlyLoading,setMonthlyLoading] = useState(false);
  const [monthlyError,setMonthlyError] = useState("");
  const [monthlySaving,setMonthlySaving] = useState(false);
  const [focusedUnits,setFocusedUnits] = useState<FocusedSpecialUnit[]>([]);
  const [focusedDrafts,setFocusedDrafts] = useState<Record<string,FocusedScheduleRow[]>>({});
  const [focusedLoading,setFocusedLoading] = useState(false);
  const [focusedError,setFocusedError] = useState("");
  const [focusedSavingUnit,setFocusedSavingUnit] = useState("");

  const [values,setValues] = useState<SpecialValues>({});
  const [monthlyCustomEvents,setMonthlyCustomEvents] = useState<Record<string,MonthlyCustomEvent[]>>({});
  const [collapsedDates,setCollapsedDates] = useState<Record<string,boolean>>({});

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


  const activeHebrewYear=useMemo(()=>currentHebrewYear()+(planNextYear?1:0),[planNextYear]);
  const monthOccurrence=useMemo(
    ()=>findHebrewMonthOccurrence(month,activeHebrewYear),
    [month,activeHebrewYear]
  );

  const chanukahDates=useMemo(()=>{
    if(month!=="Kislev"||!monthOccurrence?.datesByDay[25])return [] as ChanukahDateChoice[];
    const first=monthOccurrence.datesByDay[25];
    return Array.from({length:8},(_,index)=>{
      const date=focusedShiftDate(first,index);
      const parts=hebrewPartsForDate(new Date(`${date}T12:00:00`));
      const normalizedMonth=normalizeHebrewMonthName(parts.month);
      return {
        date,
        hebrewLabel:`${monthlyHebrewDayText(parts.day)} ${monthlyHebrewMonthText(normalizedMonth)}`,
        englishLabel:monthlyEnglishDate(date)
      };
    });
  },[month,monthOccurrence?.datesByDay[25]]);

  useEffect(()=>{
    if(focusGroup||!monthOccurrence){
      setMonthHebcalEvents([]);
      setMonthlyZmanim({});
      setMonthlyError("");
      return;
    }

    let cancelled=false;

    async function loadMonthlyContext(){
      setMonthlyLoading(true);
      setMonthlyError("");

      try{
        const first=new Date(`${monthOccurrence.start}T12:00:00`);
        const last=new Date(`${monthOccurrence.end}T12:00:00`);
        const rangeStart=focusedIsoDate(new Date(first.getFullYear(),first.getMonth(),1,12));
        const rangeEnd=focusedIsoDate(new Date(last.getFullYear(),last.getMonth()+1,0,12));

        const hebcalPromise=supabase.functions.invoke("hebcal-calendar",{
          body:{
            start_date:monthOccurrence.start,
            end_date:monthOccurrence.end,
            country_code:countryCode
          }
        });

        const merged:FocusedZmanimBatch={sunset:{},candleLighting:{},plagHaMincha:{},sources:{}};

        if(postalCode){
          let chunkStart=rangeStart;
          while(chunkStart<=rangeEnd){
            const candidateEnd=focusedShiftDate(chunkStart,39);
            const chunkEnd=candidateEnd<rangeEnd?candidateEnd:rangeEnd;
            const {data,error}=await supabase.functions.invoke("myzmanim",{
              body:{
                postal_code:postalCode,
                country_code:countryCode,
                location_id:locationId||undefined,
                start_date:chunkStart,
                end_date:chunkEnd
              }
            });
            if(error||!data?.success){
              throw new Error(data?.error||error?.message||"Could not load regular MyZmanim times.");
            }
            const times=(data.times||{}) as FocusedZmanimBatch;
            merged.sunset={...(merged.sunset||{}),...(times.sunset||{})};
            merged.candleLighting={...(merged.candleLighting||{}),...(times.candleLighting||{})};
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
        }

        const {data:hebcalData,error:hebcalError}=await hebcalPromise;
        if(hebcalError||!hebcalData?.success){
          throw new Error(hebcalData?.error||hebcalError?.message||"Could not load Jewish calendar dates.");
        }

        if(cancelled)return;
        setMonthlyZmanim(merged);
        setMonthHebcalEvents((hebcalData.events||[]) as HebcalSpecialEvent[]);
      }catch(error){
        if(cancelled)return;
        setMonthlyError(error instanceof Error?error.message:"Could not load monthly setup.");
        setMonthlyZmanim({});
        setMonthHebcalEvents([]);
      }finally{
        if(!cancelled)setMonthlyLoading(false);
      }
    }

    void loadMonthlyContext();
    return()=>{cancelled=true;};
  },[
    focusGroup,
    monthOccurrence?.start,
    monthOccurrence?.end,
    postalCode,
    countryCode,
    locationId
  ]);

  useEffect(()=>{
    if(!shulId||!monthOccurrence){
      setMonthlyCustomEvents({});
      return;
    }

    let cancelled=false;
    const rangeStart=monthOccurrence.start;
    const rangeEnd=month==="Kislev"&&chanukahDates.length
      ?chanukahDates[chanukahDates.length-1].date
      :monthOccurrence.end;

    async function loadSavedMonthlySpecialEvents(){
      const {data,error}=await supabase
        .from("special_schedule_entries")
        .select("event_date,title,event_time,note,sort_order")
        .eq("shul_id",shulId)
        .eq("active",true)
        .gte("event_date",rangeStart)
        .lte("event_date",rangeEnd)
        .order("event_date")
        .order("sort_order");

      if(cancelled)return;
      if(error){
        setMonthlyError(error.message);
        return;
      }

      const grouped:Record<string,MonthlyCustomEvent[]>={};
      (data||[]).forEach((row:any,index:number)=>{
        const title=String(row.title||"").trim();
        const isSavedCustom=row.note==="monthly_custom_event"
          ||/simchas beis hashoeva/i.test(title)
          ||/menorah lighting/i.test(title);
        if(!isSavedCustom)return;

        const date=String(row.event_date);
        grouped[date]=[
          ...(grouped[date]||[]),
          {
            id:`saved-${date}-${row.sort_order||index}-${index}`,
            label:title,
            time:row.event_time?String(row.event_time).slice(0,5):""
          }
        ];
      });
      setMonthlyCustomEvents(grouped);
    }

    void loadSavedMonthlySpecialEvents();
    return()=>{cancelled=true;};
  },[
    shulId,
    month,
    activeHebrewYear,
    monthOccurrence?.start,
    monthOccurrence?.end,
    chanukahDates.map(item=>item.date).join("|")
  ]);

  const monthlyCards=useMemo(()=>{
    if(!monthOccurrence)return [] as MonthlyDateCard[];

    const byDate=new Map<string,MonthlyDateCard>();

    for(const event of monthHebcalEvents){
      const title=event.title||"Special Date";
      const lower=title.toLowerCase();
      const include=event.requires_confirmation||lower.includes("erev pesach")||lower.includes("selich");
      if(!include)continue;

      const parts=hebrewPartsForDate(new Date(`${event.date}T12:00:00`));
      if(normalizeHebrewMonthName(parts.month)!==month)continue;

      const existing=byDate.get(event.date);
      const additions=monthlyAdditionalFields(title);
      if(existing){
        const seen=new Set(existing.additional.map(item=>item.key));
        existing.additional.push(...additions.filter(item=>!seen.has(item.key)));
        if(event.blocks_regular_schedule)existing.replaceSchedule=true;
        if(event.blocks_regular_schedule)existing.title=title;
        if(monthlyIsCholHamoedEvent(event))existing.isCholHamoed=true;
      }else{
        byDate.set(event.date,{
          date:event.date,
          hebrewDay:parts.day,
          title,
          replaceSchedule:!lower.includes("selich"),
          additional:additions,
          isCholHamoed:monthlyIsCholHamoedEvent(event)
        });
      }
    }

    for(const item of STATIC_MONTHLY_DATES[month]||[]){
      const date=monthOccurrence.datesByDay[item.day];
      if(!date)continue;
      const existing=byDate.get(date);
      if(existing){
        const seen=new Set(existing.additional.map(field=>field.key));
        existing.additional.push(...item.additional.filter(field=>!seen.has(field.key)));
      }else{
        byDate.set(date,{
          date,
          hebrewDay:item.day,
          title:item.title,
          replaceSchedule:false,
          additional:item.additional,
          isCholHamoed:false
        });
      }
    }

    return [...byDate.values()].sort((a,b)=>
      a.hebrewDay-b.hebrewDay||a.date.localeCompare(b.date)
    );
  },[month,monthOccurrence,monthHebcalEvents]);

  const displayTime = (value:string) => {
    const [h,m] = value.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const additionalValues=(date:string,key:string)=>{
    const current=values[`${date}|${key}`];
    return current?.length?current:[""];
  };

  const setAdditionalValue=(date:string,key:string,index:number,value:string)=>{
    setValues(current=>{
      const mapKey=`${date}|${key}`;
      const next=[...(current[mapKey]?.length?current[mapKey]:[""])];
      next[index]=value;
      return {...current,[mapKey]:next};
    });
  };

  const addAdditionalValue=(date:string,key:string)=>{
    setValues(current=>{
      const mapKey=`${date}|${key}`;
      const next=current[mapKey]?.length?[...current[mapKey]]:[""];
      next.push("");
      return {...current,[mapKey]:next};
    });
  };

  const removeAdditionalValue=(date:string,key:string,index:number)=>{
    setValues(current=>{
      const mapKey=`${date}|${key}`;
      const next=(current[mapKey]||[""]).filter((_,i)=>i!==index);
      return {...current,[mapKey]:next.length?next:[""]};
    });
  };

  const customEventsForDate=(date:string)=>monthlyCustomEvents[date]||[];

  const chanukahEventsByLabel=(label:string)=>chanukahDates.flatMap(choice=>
    customEventsForDate(choice.date)
      .filter(event=>event.label.trim().toLowerCase()===label.toLowerCase())
      .map(event=>({...event,date:choice.date}))
  );

  const chanukahLightings=chanukahEventsByLabel("Menorah Lighting");
  const chanukahParties=chanukahEventsByLabel("Chanukah Party");

  const addChanukahEvent=(label:string,prefix:string)=>{
    const date=chanukahDates[0]?.date;
    if(!date)return;
    setMonthlyCustomEvents(current=>({
      ...current,
      [date]:[
        ...(current[date]||[]),
        {
          id:`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
          label,
          time:""
        }
      ]
    }));
  };

  const updateChanukahEventDate=(currentDate:string,id:string,nextDate:string)=>{
    if(currentDate===nextDate)return;
    setMonthlyCustomEvents(current=>{
      const event=(current[currentDate]||[]).find(item=>item.id===id);
      if(!event)return current;
      return {
        ...current,
        [currentDate]:(current[currentDate]||[]).filter(item=>item.id!==id),
        [nextDate]:[...(current[nextDate]||[]),event]
      };
    });
  };

  const toggleDateCollapsed=(date:string)=>{
    setCollapsedDates(current=>({...current,[date]:!current[date]}));
  };

  const collapseAllDates=()=>{
    setCollapsedDates(Object.fromEntries(monthlyCards.map(card=>[card.date,true])));
  };

  const expandAllDates=()=>{
    setCollapsedDates({});
  };

  const addMonthlyCustomEvent=(date:string,isCholHamoed=false)=>{
    const linked=linkedSpecialEventsForDate(date,{isCholHamoed});
    setMonthlyCustomEvents(current=>({
      ...current,
      [date]:[
        ...(current[date]||[]),
        {
          id:`${date}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
          label:linked[0]?.label||"",
          time:""
        }
      ]
    }));
  };

  const updateMonthlyCustomEvent=(date:string,id:string,field:"label"|"time",value:string)=>{
    setMonthlyCustomEvents(current=>({
      ...current,
      [date]:(current[date]||[]).map(item=>item.id===id?{...item,[field]:value}:item)
    }));
  };

  const removeMonthlyCustomEvent=(date:string,id:string)=>{
    setMonthlyCustomEvents(current=>({
      ...current,
      [date]:(current[date]||[]).filter(item=>item.id!==id)
    }));
  };

  const serviceOverrideValues=(date:string,service:MonthlyService)=>{
    const current=monthlyScheduleOverrides[date]?.[service];
    return current?.length?current:[""];
  };

  const setMonthlyScheduleOverride=(date:string,service:MonthlyService,index:number,value:string)=>{
    setMonthlyScheduleOverrides(current=>{
      const serviceValues=current[date]?.[service]?.length
        ? [...(current[date]?.[service]||[])]
        : [""];
      serviceValues[index]=value;
      return {
        ...current,
        [date]:{
          ...(current[date]||{}),
          [service]:serviceValues
        }
      };
    });
  };

  const addMonthlyScheduleOverride=(date:string,service:MonthlyService)=>{
    setMonthlyScheduleOverrides(current=>{
      const serviceValues=current[date]?.[service]?.length
        ? [...(current[date]?.[service]||[])]
        : [""];
      serviceValues.push("");
      return {
        ...current,
        [date]:{
          ...(current[date]||{}),
          [service]:serviceValues
        }
      };
    });
  };

  const removeMonthlyScheduleOverride=(date:string,service:MonthlyService,index:number)=>{
    setMonthlyScheduleOverrides(current=>{
      const serviceValues=(current[date]?.[service]||[""]).filter((_,i)=>i!==index);
      return {
        ...current,
        [date]:{
          ...(current[date]||{}),
          [service]:serviceValues.length?serviceValues:[""]
        }
      };
    });
  };

  const regularServiceDisplay=(date:string,service:MonthlyService)=>{
    const rows=monthlyRegularServiceRows(
      date,
      service,
      scheduleEntries,
      monthlyZmanim,
      zmanDefaults,
      shabbosEndMinutes
    );
    if(!rows.length)return "Not scheduled in Settings for this weekday";
    return rows.map(row=>row.time).join(" · ");
  };

  const saveMonth=async()=>{
    if(!shulId){
      setMonthlyError("No shul is selected.");
      return;
    }
    if(monthlyLoading){
      setMonthlyError("Monthly times are still loading.");
      return;
    }
    if(!monthlyCards.length&&month!=="Kislev"){
      setStatus(`No special schedule items need setup for ${month}.`);
      return;
    }

    setMonthlySaving(true);
    setMonthlyError("");
    setStatus("");

    try{
      const payload=monthlyCards.map(card=>{
        const rows:Array<{
          title:string;
          event_time:string|null;
          approximate:boolean;
          note:string|null;
          sort_order:number;
        }>=[];

        if(card.replaceSchedule){
          const dow=new Date(`${card.date}T12:00:00`).getDay();
          const dayRules=scheduleEntries.filter(rule=>rule.day_of_week===dow);
          const followsMaariv=dayRules.some(rule=>
            (rule.service_type.toLowerCase()==="maariv"&&rule.timing_source==="follows")||
            (rule.service_type.toLowerCase()==="mincha"&&Boolean(rule.follows_text))
          );
          let sortOrder=10;

          for(const service of MONTHLY_SERVICES){
            const overrides=(monthlyScheduleOverrides[card.date]?.[service]||[])
              .filter(Boolean);
            const hasExplicitMaariv=(monthlyScheduleOverrides[card.date]?.Maariv||[])
              .some(Boolean);

            if(overrides.length){
              for(const override of overrides){
                const title=service==="Mincha"&&followsMaariv&&!hasExplicitMaariv
                  ?"Mincha / Maariv"
                  :service;
                rows.push({
                  title,
                  event_time:override,
                  approximate:false,
                  note:null,
                  sort_order:sortOrder
                });
                sortOrder+=10;
              }
              continue;
            }

            if(service==="Maariv"&&followsMaariv)continue;

            const serviceRules=dayRules.filter(rule=>
              rule.service_type.toLowerCase()===service.toLowerCase()
            );

            for(const rule of serviceRules){
              if(rule.timing_source==="none"||rule.timing_source==="follows")continue;
              const raw=focusedResolveRuleTime(
                card.date,
                rule,
                scheduleEntries,
                monthlyZmanim,
                zmanDefaults,
                shabbosEndMinutes
              );
              if(!raw)continue;
              let label=rule.display_name||service;
              if(service==="Mincha"&&followsMaariv){
                label=label.replace(/\s*\/\s*Maariv$/i,"")+" / Maariv";
              }
              rows.push({
                title:label,
                event_time:raw,
                approximate:false,
                note:null,
                sort_order:sortOrder
              });
              sortOrder+=10;
            }
          }
        }

        if(monthlyIsFast(card.title)){
          const automatic=monthlyFastAutomaticTimes(
            card.date,
            card.title,
            monthlyZmanim,
            zmanDefaults,
            shabbosEndMinutes
          );
          const override=fastOverrides[card.date]||{};
          const begin=override.start||automatic.beginRaw;
          const end=override.end||automatic.endRaw;
          if(begin)rows.push({title:"Fast Begins",event_time:begin,approximate:false,note:null,sort_order:80});
          if(end)rows.push({title:"Fast Ends",event_time:end,approximate:false,note:null,sort_order:90});
        }

        let additionalSort=100;
        card.additional.forEach(field=>{
          for(const value of additionalValues(card.date,field.key).filter(Boolean)){
            rows.push({
              title:field.label,
              event_time:value,
              approximate:false,
              note:null,
              sort_order:additionalSort
            });
            additionalSort+=10;
          }
        });

        for(const customEvent of customEventsForDate(card.date)){
          const label=customEvent.label.trim();
          if(!label||!customEvent.time)continue;
          rows.push({
            title:label,
            event_time:customEvent.time,
            approximate:false,
            note:"monthly_custom_event",
            sort_order:additionalSort
          });
          additionalSort+=10;
        }

        return {
          event_date:card.date,
          title:card.title,
          replace_normal_schedule:card.replaceSchedule,
          rows
        };
      });

      const missingReplacement=payload.find(item=>
        item.replace_normal_schedule&&!item.rows.some(row=>
          !["Fast Begins","Fast Ends"].includes(row.title)
        )
      );
      if(missingReplacement){
        throw new Error(`Regular schedule times are not available yet for ${monthlyEnglishDate(missingReplacement.event_date)}. Please wait for the automatic times to finish loading.`);
      }

      if(payload.length){
        const {error}=await supabase.rpc("confirm_special_schedule_group",{
          p_shul_id:shulId,
          p_dates:payload
        });
        if(error)throw error;
      }

      if(month==="Kislev"&&chanukahDates.length===8){
        const chanukahEventRows=[
          ...chanukahLightings.map(item=>({...item,title:"Menorah Lighting"})),
          ...chanukahParties.map(item=>({...item,title:"Chanukah Party"}))
        ]
          .filter(item=>item.time)
          .map((item,index)=>({
            event_date:item.date,
            title:item.title,
            event_time:item.time,
            approximate:false,
            sort_order:100+index*10
          }));

        const {error:chanukahEventsSaveError}=await supabase.rpc("save_monthly_custom_events",{
          p_shul_id:shulId,
          p_start_date:chanukahDates[0].date,
          p_end_date:chanukahDates[chanukahDates.length-1].date,
          p_rows:chanukahEventRows
        });
        if(chanukahEventsSaveError)throw chanukahEventsSaveError;
      }

      setStatus(`${month} saved. Special schedules were applied to the correct Hebrew dates.`);
      onSpecialSchedulesChanged?.();
    }catch(error){
      const message=
        error instanceof Error
          ?error.message
          :typeof error==="object"&&error&&"message" in error
            ?String((error as {message?:unknown}).message||"")
            :String(error||"");
      setMonthlyError(message||"Could not save monthly setup.");
    }finally{
      setMonthlySaving(false);
    }
  };

  const setFastOverride=(key:string,field:"start"|"end",value:string)=>{
    setFastOverrides(v=>({...v,[key]:{...v[key],[field]:value}}));
  };

  useEffect(()=>{
    if(!focusGroup)return;
    const focusedEvent=specialCalendarEvents
      .filter(event=>event.group_key===focusGroup)
      .sort((a,b)=>a.date.localeCompare(b.date))[0];

    if(focusedEvent){
      const parts=hebrewPartsForDate(new Date(`${focusedEvent.date}T12:00:00`));
      const targetMonth=normalizeHebrewMonthName(parts.month);
      const eventYear=Number(parts.year);
      const thisHebrewYear=currentHebrewYear();
      if(jewishMonthTemplates.some(item=>item.month===targetMonth)){
        setMonth(targetMonth);
      }
      if(Number.isFinite(eventYear)){
        setPlanNextYear(eventYear===thisHebrewYear+1);
      }
    }

    onClearFocus?.();
  },[focusGroup,specialCalendarEvents]);

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Guided setup</span>
          <h1>Monthly Setup</h1>
          <p>Set month-specific special times and overrides. Automatic zmanim and location rules are managed in Settings.</p>
        </div>
      </div>

      <div className="panel monthlyMonthPanel">
        <div className="panelHead monthlyMonthPicker">
          <div>
            <span className="eyebrow">Jewish month</span>
            <h2>Choose the Month You’re Working On</h2>
            <p className="helperText">Monthly Setup defaults to the current Hebrew year. Use Plan Next Year only when you intentionally want to prepare the following year.</p>
          </div>
          <div className="monthlyPeriodControls">
            <div className="monthlyMonthSelect">
              <span>Month</span>
              <div className="monthlyMonthDropdown">
                <button
                  type="button"
                  className="monthlyMonthDropdownButton"
                  aria-haspopup="listbox"
                  aria-expanded={monthPickerOpen}
                  onClick={()=>setMonthPickerOpen(open=>!open)}
                >
                  <span className="monthlyMonthEnglish" dir="ltr">{month}</span>
                  <span className="monthlyMonthDash">-</span>
                  <span className="monthlyMonthHebrew" dir="rtl">{monthlyHebrewMonthText(month)}</span>
                  <span className="monthlyMonthCaret" aria-hidden="true">▾</span>
                </button>
                {monthPickerOpen&&(
                  <div className="monthlyMonthDropdownMenu" role="listbox" aria-label="Jewish month">
                    {jewishMonthTemplates.map(item=>(
                      <button
                        type="button"
                        role="option"
                        aria-selected={item.month===month}
                        className={item.month===month?"monthlyMonthOption active":"monthlyMonthOption"}
                        key={item.month}
                        onClick={()=>{
                          setMonth(item.month);
                          setMonthPickerOpen(false);
                          setStatus("");
                          setCollapsedDates({});
                        }}
                      >
                        <span className="monthlyMonthEnglish" dir="ltr">{item.month}</span>
                        <span className="monthlyMonthDash">-</span>
                        <span className="monthlyMonthHebrew" dir="rtl">{monthlyHebrewMonthText(item.month)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="monthlyYearPicker">
              <span>Year</span>
              <div className="monthlyYearChoices">
                <button
                  type="button"
                  className={!planNextYear?"choice active":"choice"}
                  onClick={()=>{setPlanNextYear(false);setStatus("");setCollapsedDates({});}}
                >
                  Current Year · {currentHebrewYear()}
                </button>
                <button
                  type="button"
                  className={planNextYear?"choice active":"choice"}
                  onClick={()=>{setPlanNextYear(true);setStatus("");setCollapsedDates({});}}
                >
                  Plan Next Year · {currentHebrewYear()+1}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="monthlyMonthCurrent">
          <span>{planNextYear?"Planning next year":"Current Hebrew year"}</span>
          <strong>{month} {activeHebrewYear}</strong>
          {monthOccurrence&&<small>{monthlyEnglishDate(monthOccurrence.start)} – {monthlyEnglishDate(monthOccurrence.end)}</small>}
        </div>

        {monthlyError&&(
          <div className="monthlySetupError">
            <strong>Couldn’t load Monthly Setup:</strong> {monthlyError}
          </div>
        )}

        {!monthlyLoading&&month==="Kislev"&&chanukahDates.length===8&&(
          <div className="monthlyKislevSpecialEvents">
            <div className="monthlyMonthSpecialEvent">
              <div className="monthlyAdditionalHead">
                <div>
                  <span className="eyebrow">Special event</span>
                  <strong>Menorah Lighting</strong>
                </div>
                <span>Choose any of the eight Chanukah dates when the shul will hold a lighting. Add as many dates or times as needed.</span>
              </div>

              {chanukahLightings.length>0&&(
                <div className="monthlyChanukahLightingList">
                  {chanukahLightings.map(lighting=>(
                    <div className="monthlyChanukahLightingRow" key={lighting.id}>
                      <label>
                        <span>Date</span>
                        <select
                          value={lighting.date}
                          onChange={e=>updateChanukahEventDate(lighting.date,lighting.id,e.target.value)}
                        >
                          {chanukahDates.map(choice=>(
                            <option key={choice.date} value={choice.date}>
                              {`${choice.hebrewLabel} - ${choice.englishLabel}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Time</span>
                        <input
                          type="time"
                          value={lighting.time}
                          onChange={e=>updateMonthlyCustomEvent(lighting.date,lighting.id,"time",e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="secondary monthlyRemoveTime"
                        onClick={()=>removeMonthlyCustomEvent(lighting.date,lighting.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="secondary monthlyAddTime monthlyAddSpecialEvent"
                onClick={()=>addChanukahEvent("Menorah Lighting","menorah")}
              >
                + Add Menorah Lighting
              </button>
            </div>

            <div className="monthlyMonthSpecialEvent">
              <div className="monthlyAdditionalHead">
                <div>
                  <span className="eyebrow">Special event</span>
                  <strong>Chanukah Party</strong>
                </div>
                <span>Choose any of the eight Chanukah dates when the shul will hold a party. Add multiple parties or times if needed.</span>
              </div>

              {chanukahParties.length>0&&(
                <div className="monthlyChanukahLightingList">
                  {chanukahParties.map(party=>(
                    <div className="monthlyChanukahLightingRow" key={party.id}>
                      <label>
                        <span>Date</span>
                        <select
                          value={party.date}
                          onChange={e=>updateChanukahEventDate(party.date,party.id,e.target.value)}
                        >
                          {chanukahDates.map(choice=>(
                            <option key={choice.date} value={choice.date}>
                              {`${choice.hebrewLabel} - ${choice.englishLabel}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Time</span>
                        <input
                          type="time"
                          value={party.time}
                          onChange={e=>updateMonthlyCustomEvent(party.date,party.id,"time",e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="secondary monthlyRemoveTime"
                        onClick={()=>removeMonthlyCustomEvent(party.date,party.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="secondary monthlyAddTime monthlyAddSpecialEvent"
                onClick={()=>addChanukahEvent("Chanukah Party","chanukah-party")}
              >
                + Add Chanukah Party
              </button>
            </div>
          </div>
        )}

        {monthlyLoading ? (
          <div className="monthlySetupLoading">
            <strong>Loading {month} dates and regular shul times…</strong>
            <span>Using the shul’s current schedule and Automatic Zmanim settings.</span>
          </div>
        ) : monthlyCards.length===0 ? (
          <div className="emptyMonthSetup">
            {month==="Kislev"
              ?"No other standard special-date setup is needed for Kislev."
              :`No standard special-date setup is needed for ${month}.`}
          </div>
        ) : (
          <div className="monthlyDateList">
            <div className="monthlyCollapseBar">
              <span>{monthlyCards.length} special date{monthlyCards.length===1?"":"s"} in {month}</span>
              <div>
                <button type="button" className="secondary" onClick={collapseAllDates}>Collapse All</button>
                <button type="button" className="secondary" onClick={expandAllDates}>Expand All</button>
              </div>
            </div>

            {monthlyCards.map(card=>{
              const isFast=monthlyIsFast(card.title);
              const fastAuto=isFast
                ?monthlyFastAutomaticTimes(card.date,card.title,monthlyZmanim,zmanDefaults,shabbosEndMinutes)
                :null;
              const fastOverride=fastOverrides[card.date]||{};
              const isCollapsed=Boolean(collapsedDates[card.date]);

              return (
                <section className="monthlyDateCard" key={card.date}>
                  <div
                    className="monthlyDateHead"
                    role="button"
                    tabIndex={0}
                    aria-expanded={!isCollapsed}
                    onClick={()=>toggleDateCollapsed(card.date)}
                    onKeyDown={e=>{
                      if(e.key!=="Enter"&&e.key!==" ")return;
                      e.preventDefault();
                      toggleDateCollapsed(card.date);
                    }}
                  >
                    <div className="monthlyHebrewDate" dir="rtl">
                      <strong>{monthlyHebrewDayText(card.hebrewDay)}</strong>
                      <span>{monthlyHebrewMonthText(month)}</span>
                    </div>
                    <div className="monthlyDateTitle">
                      <span className="eyebrow">{monthlyEnglishDate(card.date)}</span>
                      <h3>{card.title}</h3>
                      {!isCollapsed&&(
                        <p className="helperText">
                          {card.replaceSchedule
                            ?"Blank special-schedule fields keep the regular shul time shown beside them."
                            :"This adds a special time without changing the regular Shacharis, Mincha or Maariv schedule."}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="secondary monthlyCollapseToggle"
                      onClick={e=>{
                        e.stopPropagation();
                        toggleDateCollapsed(card.date);
                      }}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed?"Expand":"Collapse"}
                    </button>
                  </div>

                  {!isCollapsed&&(
                    <div className="monthlyDateBody">
                  {card.replaceSchedule&&(
                    <div className="monthlyServiceGrid">
                      <div className="monthlyServiceGridHead">
                        <span>Service</span>
                        <span>Regular schedule</span>
                        <span>Special schedule</span>
                      </div>
                      {MONTHLY_SERVICES.map(service=>{
                        const serviceValues=serviceOverrideValues(card.date,service);
                        const enteredCount=serviceValues.filter(Boolean).length;
                        return (
                          <div className="monthlyServiceRow" key={service}>
                            <strong>{service}</strong>
                            <div className="monthlyRegularValue">
                              <strong>{regularServiceDisplay(card.date,service)}</strong>
                              <small>What would normally run on this date</small>
                            </div>
                            <div className="monthlySpecialTimes">
                              {serviceValues.map((value,index)=>(
                                <div className="monthlySpecialTimeRow" key={index}>
                                  <input
                                    type="time"
                                    value={value}
                                    onChange={e=>setMonthlyScheduleOverride(card.date,service,index,e.target.value)}
                                    aria-label={card.title+" "+service+" special time "+(index+1)}
                                  />
                                  {serviceValues.length>1&&(
                                    <button
                                      type="button"
                                      className="secondary monthlyRemoveTime"
                                      onClick={()=>removeMonthlyScheduleOverride(card.date,service,index)}
                                      aria-label={"Remove "+service+" time "+(index+1)}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))}
                              <div className="monthlyTimeActions">
                                <small>{enteredCount ? enteredCount+" special time"+(enteredCount===1?"":"s")+" entered" : "Blank = keep regular schedule"}</small>
                                <button
                                  type="button"
                                  className="secondary monthlyAddTime"
                                  onClick={()=>addMonthlyScheduleOverride(card.date,service)}
                                >
                                  + Add {service} Time
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isFast&&fastAuto&&(
                    <div className="monthlyAdditionalBlock monthlyFastBlock">
                      <div className="monthlyAdditionalHead">
                        <strong>Fast times</strong>
                        <span>Automatic Zmanim are shown first. Enter an override only if this fast should use a different time.</span>
                      </div>
                      <div className="monthlyAdditionalGrid">
                        <label className="monthlyAdditionalField">
                          <span>Fast begins</span>
                          <div className="monthlyGeneratedValue">
                            <strong>{fastOverride.start?displayTime(fastOverride.start):fastAuto.beginDisplay}</strong>
                            <small>{fastOverride.start?"Manual override":"Automatic Zmanim"}</small>
                          </div>
                          <input
                            type="time"
                            value={fastOverride.start||""}
                            onChange={e=>setFastOverride(card.date,"start",e.target.value)}
                            aria-label={`${card.title} fast begins override`}
                          />
                        </label>
                        <label className="monthlyAdditionalField">
                          <span>Fast ends</span>
                          <div className="monthlyGeneratedValue">
                            <strong>{fastOverride.end?displayTime(fastOverride.end):fastAuto.endDisplay}</strong>
                            <small>{fastOverride.end?"Manual override":"Automatic Zmanim"}</small>
                          </div>
                          <input
                            type="time"
                            value={fastOverride.end||""}
                            onChange={e=>setFastOverride(card.date,"end",e.target.value)}
                            aria-label={`${card.title} fast ends override`}
                          />
                        </label>
                      </div>
                      {(fastOverride.start||fastOverride.end)&&(
                        <button
                          className="secondary monthlyUseAutomatic"
                          onClick={()=>setFastOverrides(current=>{
                            const next={...current};
                            delete next[card.date];
                            return next;
                          })}
                        >
                          Use Automatic Fast Times
                        </button>
                      )}
                    </div>
                  )}

                  {card.isCholHamoed&&(
                    <div className="monthlyAdditionalBlock monthlySpecialEventsBlock">
                      <div className="monthlyAdditionalHead">
                        <strong>Special events</strong>
                        <span>Add an event that happens on this Chol Hamoed date without changing the davening schedule.</span>
                      </div>

                      {customEventsForDate(card.date).length>0&&(
                        <div className="monthlyCustomEventList">
                          {customEventsForDate(card.date).map(event=>(
                            <div className="monthlyCustomEventRow" key={event.id}>
                              <label>
                                <span>Event</span>
                                <input
                                  value={event.label}
                                  placeholder="Special event"
                                  onChange={e=>updateMonthlyCustomEvent(card.date,event.id,"label",e.target.value)}
                                />
                              </label>
                              <label>
                                <span>Time</span>
                                <input
                                  type="time"
                                  value={event.time}
                                  onChange={e=>updateMonthlyCustomEvent(card.date,event.id,"time",e.target.value)}
                                />
                              </label>
                              <button
                                type="button"
                                className="secondary monthlyRemoveTime"
                                onClick={()=>removeMonthlyCustomEvent(card.date,event.id)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        className="secondary monthlyAddTime monthlyAddSpecialEvent"
                        onClick={()=>addMonthlyCustomEvent(card.date,card.isCholHamoed)}
                      >
                        + Add Special Event
                      </button>

                    </div>
                  )}

                  {card.additional.length>0&&(
                    <div className="monthlyAdditionalBlock">
                      <div className="monthlyAdditionalHead">
                        <strong>Additional times</strong>
                        <span>These are separate from the regular davening schedule.</span>
                      </div>
                      <div className="monthlyAdditionalGrid">
                        {card.additional.map(field=>{
                          const fieldValues=additionalValues(card.date,field.key);
                          return (
                            <div className="monthlyAdditionalField" key={field.key}>
                              <span>{field.label}</span>
                              {fieldValues.map((value,index)=>(
                                <div className="monthlySpecialTimeRow" key={index}>
                                  <input
                                    type="time"
                                    value={value}
                                    onChange={e=>setAdditionalValue(card.date,field.key,index,e.target.value)}
                                    aria-label={field.label+" time "+(index+1)}
                                  />
                                  {field.allowMultiple&&fieldValues.length>1&&(
                                    <button
                                      type="button"
                                      className="secondary monthlyRemoveTime"
                                      onClick={()=>removeAdditionalValue(card.date,field.key,index)}
                                      aria-label={"Remove "+field.label+" time "+(index+1)}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))}
                              {field.allowMultiple&&(
                                <button
                                  type="button"
                                  className="secondary monthlyAddTime monthlyAddAdditionalTime"
                                  onClick={()=>addAdditionalValue(card.date,field.key)}
                                >
                                  + Add Another {field.label} Time
                                </button>
                              )}
                              {field.helpText&&<small>{field.helpText}</small>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <div className="monthlySetupActions monthlySetupSaveBar">
          <span>{status||"Review the month, change only what is different, then save once."}</span>
          <button
            className="primary"
            disabled={monthlySaving||monthlyLoading}
            onClick={()=>void saveMonth()}
          >
            {monthlySaving?"Saving…":`Save ${month} Setup`}
          </button>
        </div>
      </div>
    </>
  );
}

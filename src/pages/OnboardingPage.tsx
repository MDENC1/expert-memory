import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Props = {
  onCancel: () => void;
  onComplete: (shulId:string) => void;
  mode?: "create" | "edit";
  shulId?: string;
};

type Service = "Shacharis" | "Mincha" | "Maariv";
type RuleMode = "fixed" | "zman" | "follows" | "none";
type ZmanSource =
  | "dawn_72fix" | "dawn_benish"
  | "sunrise_default"
  | "shema_gra" | "shema_benish" | "shema_ma72fix"
  | "midday" | "midday_benish"
  | "mincha_gra" | "mincha_benish" | "mincha_ma72fix"
  | "ketana_gra" | "ketana_benish" | "ketana_ma72fix"
  | "plag_gra" | "plag_benish" | "plag_ma72fix"
  | "sunset_default"
  | "night_gra180" | "night_benish" | "night_72fix";
type RoundMode = "exact" | "earlier" | "later";
type GroupPeriod = "individual" | "week_earliest" | "month_earliest";
type ZmanFamilyKey = "dawn" | "sunrise" | "shema" | "midday" | "mincha_gedolah" | "mincha_ketana" | "plag" | "sunset" | "nightfall";
type ZmanDefaultCategory = "dawn" | "shema" | "midday" | "mincha" | "nightfall";
type ZmanDefaults = Record<ZmanDefaultCategory,string>;

type VerifiedLocation = {
  locationId:string;
  timezone:string;
  place:{
    name:string|null;
    city:string|null;
    state:string|null;
    country:string|null;
    postal_code:string|null;
  };
};

type MinyanRule = {
  id:string;
  service:Service;
  name:string;
  days:number[];
  mode:RuleMode;
  fixedTime:string;
  source:ZmanSource;
  offset:number;
  direction:"before"|"after";
  roundMode:RoundMode;
  groupPeriod:GroupPeriod;
  followsText:string;
  zmanFamily:ZmanFamilyKey|"";
  useShulDefault:boolean;
};

const DAYS=[
  {value:0,label:"Sun",full:"Sunday"},
  {value:1,label:"Mon",full:"Monday"},
  {value:2,label:"Tue",full:"Tuesday"},
  {value:3,label:"Wed",full:"Wednesday"},
  {value:4,label:"Thu",full:"Thursday"},
  {value:5,label:"Fri",full:"Friday"},
  {value:6,label:"Shabbos",full:"Shabbos"}
] as const;

const SERVICES:Service[]=["Shacharis","Mincha","Maariv"];

type ZmanFamilyOption = {
  key:ZmanFamilyKey;
  label:string;
  methods:Array<{key:ZmanSource;label:string;method:string}>;
};

const ZMAN_OPTIONS:Record<Service,ZmanFamilyOption[]>={
  Shacharis:[
    {key:"dawn",label:"Alos / Dawn",methods:[
      {key:"dawn_72fix",label:"72 minutes before sunrise",method:"72fix"},
      {key:"dawn_benish",label:"Ben Ish",method:"ben_ish"}
    ]},
    {key:"sunrise",label:"Sunrise / Netz",methods:[
      {key:"sunrise_default",label:"Standard sunrise",method:"standard"}
    ]},
    {key:"shema",label:"Latest Shema",methods:[
      {key:"shema_gra",label:"GRA",method:"gra"},
      {key:"shema_benish",label:"Ben Ish",method:"ben_ish"},
      {key:"shema_ma72fix",label:"Magen Avraham — 72-minute day",method:"ma72"}
    ]},
    {key:"midday",label:"Chatzos / Midday",methods:[
      {key:"midday",label:"Standard Chatzos",method:"standard"},
      {key:"midday_benish",label:"Ben Ish",method:"ben_ish"}
    ]}
  ],
  Mincha:[
    {key:"mincha_gedolah",label:"Earliest Mincha / Mincha Gedolah",methods:[
      {key:"mincha_gra",label:"GRA",method:"gra"},
      {key:"mincha_benish",label:"Ben Ish",method:"ben_ish"},
      {key:"mincha_ma72fix",label:"Magen Avraham — 72-minute day",method:"ma72"}
    ]},
    {key:"mincha_ketana",label:"Mincha Ketana",methods:[
      {key:"ketana_gra",label:"GRA",method:"gra"},
      {key:"ketana_benish",label:"Ben Ish",method:"ben_ish"},
      {key:"ketana_ma72fix",label:"Magen Avraham — 72-minute day",method:"ma72"}
    ]},
    {key:"plag",label:"Plag HaMincha",methods:[
      {key:"plag_gra",label:"GRA",method:"gra"},
      {key:"plag_benish",label:"Ben Ish",method:"ben_ish"},
      {key:"plag_ma72fix",label:"Magen Avraham — 72-minute day",method:"ma72"}
    ]},
    {key:"sunset",label:"Sunset / Shkia",methods:[
      {key:"sunset_default",label:"Standard Shkia",method:"standard"}
    ]}
  ],
  Maariv:[
    {key:"nightfall",label:"Nightfall / Tzeis",methods:[
      {key:"night_gra180",label:"GRA",method:"gra"},
      {key:"night_benish",label:"Ben Ish",method:"ben_ish"},
      {key:"night_72fix",label:"Rabbeinu Tam — 72 minutes after sunset",method:"rt72"}
    ]}
  ]
};

const DEFAULT_CATEGORY_BY_FAMILY:Partial<Record<ZmanFamilyKey,ZmanDefaultCategory>>={
  dawn:"dawn",
  shema:"shema",
  midday:"midday",
  mincha_gedolah:"mincha",
  mincha_ketana:"mincha",
  plag:"mincha",
  nightfall:"nightfall"
};

const DEFAULT_CHOICES:Record<ZmanDefaultCategory,Array<{value:string;label:string}>>={
  dawn:[
    {value:"72fix",label:"72 minutes before sunrise"},
    {value:"ben_ish",label:"Ben Ish"}
  ],
  shema:[
    {value:"gra",label:"GRA"},
    {value:"ben_ish",label:"Ben Ish"},
    {value:"ma72",label:"Magen Avraham — 72-minute day"}
  ],
  midday:[
    {value:"standard",label:"Standard Chatzos"},
    {value:"ben_ish",label:"Ben Ish"}
  ],
  mincha:[
    {value:"gra",label:"GRA"},
    {value:"ben_ish",label:"Ben Ish"},
    {value:"ma72",label:"Magen Avraham — 72-minute day"}
  ],
  nightfall:[
    {value:"gra",label:"GRA"},
    {value:"ben_ish",label:"Ben Ish"},
    {value:"rt72",label:"Rabbeinu Tam — 72 minutes after sunset"}
  ]
};

function familyForSource(service:Service,source:ZmanSource){
  return ZMAN_OPTIONS[service].find(f=>f.methods.some(m=>m.key===source)) || ZMAN_OPTIONS[service][0];
}

function defaultSourceForFamily(family:ZmanFamilyOption,defaults:ZmanDefaults){
  const category=DEFAULT_CATEGORY_BY_FAMILY[family.key];
  if(!category)return family.methods[0].key;
  const wanted=defaults[category];
  return family.methods.find(method=>method.method===wanted)?.key || family.methods[0].key;
}

function defaultLabelForFamily(family:ZmanFamilyOption,defaults:ZmanDefaults){
  const category=DEFAULT_CATEGORY_BY_FAMILY[family.key];
  if(!category)return family.methods[0].label;
  const wanted=defaults[category];
  return family.methods.find(method=>method.method===wanted)?.label || family.methods[0].label;
}

function methodLabel(service:Service,source:ZmanSource){
  for(const family of ZMAN_OPTIONS[service]){
    const method=family.methods.find(item=>item.key===source);
    if(method)return method.label;
  }
  return source;
}
const pad=(n:number)=>String(n).padStart(2,"0");
const newId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function parseFriendlyTime(value:string){
  const clean=value.trim().toUpperCase().replace(/\./g,"").replace(/\s+/g,"");
  const suffix=clean.match(/(AM|PM)$/)?.[1];
  if(!suffix)return "";
  const numeric=clean.slice(0,-suffix.length);
  let hour:number;
  let minute:number;
  if(numeric.includes(":")){
    const parts=numeric.split(":");
    if(parts.length!==2)return "";
    hour=Number(parts[0]);
    minute=Number(parts[1]);
  }else if(/^\d{1,4}$/.test(numeric)){
    if(numeric.length<=2){hour=Number(numeric);minute=0;}
    else{hour=Number(numeric.slice(0,-2));minute=Number(numeric.slice(-2));}
  }else return "";
  if(hour<1||hour>12||minute<0||minute>59)return "";
  let h=hour;
  if(suffix==="PM"&&h!==12)h+=12;
  if(suffix==="AM"&&h===12)h=0;
  return `${pad(h)}:${pad(minute)}`;
}

function normalizeFriendlyTime(value:string){
  const t=parseFriendlyTime(value);
  if(!t)return value;
  const [h,m]=t.split(":").map(Number);
  const suffix=h>=12?"PM":"AM";
  return `${h%12||12}:${pad(m)} ${suffix}`;
}

function dbTimeToFriendly(value:string|null|undefined){
  if(!value)return "";
  const match=String(value).match(/^(\d{1,2}):(\d{2})/);
  if(!match)return "";
  const hour=Number(match[1]);
  const minute=Number(match[2]);
  const suffix=hour>=12?"PM":"AM";
  return `${hour%12||12}:${pad(minute)} ${suffix}`;
}

function fallbackSourceForService(service:Service):ZmanSource{
  if(service==="Shacharis")return "sunrise_default";
  if(service==="Mincha")return "sunset_default";
  return "night_gra180";
}

function rulesFromScheduleRows(rows:any[]):MinyanRule[]{
  const groups=new Map<string,any[]>();

  for(const row of rows){
    const fallbackKey=[
      row.service_type,
      row.display_name,
      row.sort_order,
      row.timing_source,
      row.service_time,
      row.timing_offset_minutes,
      row.round_to_minutes,
      row.round_direction,
      row.group_period,
      row.zman_family,
      row.use_shul_zman_default,
      row.follows_text
    ].join("|");
    const key=String(row.rule_group_id||row.weekly_group||fallbackKey);
    groups.set(key,[...(groups.get(key)||[]),row]);
  }

  const serviceOrder:Record<Service,number>={Shacharis:0,Mincha:1,Maariv:2};

  return Array.from(groups.entries()).map(([groupId,group])=>{
    const first=group[0];
    const service=(SERVICES.includes(first.service_type as Service)?first.service_type:"Shacharis") as Service;
    const timingSource=String(first.timing_source||"fixed");
    const mode:RuleMode=timingSource==="fixed"
      ?"fixed"
      :timingSource==="follows"
        ?"follows"
        :timingSource==="none"
          ?"none"
          :"zman";

    const validSource=ZMAN_OPTIONS[service].some(family=>family.methods.some(method=>method.key===timingSource));
    const source=(validSource?timingSource:fallbackSourceForService(service)) as ZmanSource;
    const signedOffset=Number(first.timing_offset_minutes||0);
    const roundMode:RoundMode=!first.round_to_minutes
      ?"exact"
      :first.round_direction==="up"
        ?"later"
        :"earlier";

    const family=(mode==="zman"
      ? (first.zman_family || familyForSource(service,source).key)
      : "") as ZmanFamilyKey|"";

    return {
      id:groupId||newId(),
      service,
      name:first.display_name || (mode==="none"?`NO ${service.toUpperCase()}`:service),
      days:Array.from(new Set(group.map(row=>Number(row.day_of_week)))).sort((a,b)=>a-b),
      mode,
      fixedTime:mode==="fixed"?dbTimeToFriendly(first.service_time):"",
      source,
      offset:Math.abs(signedOffset),
      direction:signedOffset>0?"after":"before",
      roundMode,
      groupPeriod:(first.group_period|| (first.use_weekly_earliest?"week_earliest":"individual")) as GroupPeriod,
      followsText:first.follows_text||"",
      zmanFamily:family,
      useShulDefault:Boolean(first.use_shul_zman_default),
      _sortOrder:Number(first.sort_order||0)
    } as MinyanRule & {_sortOrder:number};
  }).sort((a:any,b:any)=>{
    const serviceDiff=serviceOrder[a.service]-serviceOrder[b.service];
    return serviceDiff || a._sortOrder-b._sortOrder;
  }).map((rule:any)=>{
    const {_sortOrder,...clean}=rule;
    return clean as MinyanRule;
  });
}

const initialRules:MinyanRule[]=[
  {
    id:"weekday-shacharis",service:"Shacharis",name:"Weekday Shacharis",days:[1,2,3,4,5],
    mode:"fixed",fixedTime:"6:45 AM",source:"sunset_default",offset:0,direction:"before",
    roundMode:"exact",groupPeriod:"individual",followsText:"",zmanFamily:"",useShulDefault:false
  },
  {
    id:"sunday-shacharis",service:"Shacharis",name:"Sunday Shacharis",days:[0],
    mode:"fixed",fixedTime:"9:30 AM",source:"sunset_default",offset:0,direction:"before",
    roundMode:"exact",groupPeriod:"individual",followsText:"",zmanFamily:"",useShulDefault:false
  },
  {
    id:"shabbos-shacharis",service:"Shacharis",name:"Shabbos Shacharis",days:[6],
    mode:"fixed",fixedTime:"9:00 AM",source:"sunset_default",offset:0,direction:"before",
    roundMode:"exact",groupPeriod:"individual",followsText:"",zmanFamily:"",useShulDefault:false
  },
  {
    id:"early-mincha",service:"Mincha",name:"Early Mincha",days:[0,1,2,3,4],
    mode:"zman",fixedTime:"",source:"plag_gra",offset:10,direction:"before",
    roundMode:"earlier",groupPeriod:"week_earliest",followsText:"",zmanFamily:"plag",useShulDefault:true
  },
  {
    id:"late-mincha",service:"Mincha",name:"Late Mincha",days:[0,1,2,3,4],
    mode:"zman",fixedTime:"",source:"sunset_default",offset:10,direction:"before",
    roundMode:"earlier",groupPeriod:"week_earliest",followsText:"",zmanFamily:"sunset",useShulDefault:false
  },
  {
    id:"friday-mincha",service:"Mincha",name:"Friday Mincha",days:[5],
    mode:"zman",fixedTime:"",source:"sunset_default",offset:10,direction:"before",
    roundMode:"earlier",groupPeriod:"individual",followsText:"",zmanFamily:"sunset",useShulDefault:false
  },
  {
    id:"shabbos-early-mincha",service:"Mincha",name:"Shabbos Early Mincha",days:[6],
    mode:"fixed",fixedTime:"2:15 PM",source:"sunset_default",offset:0,direction:"before",
    roundMode:"exact",groupPeriod:"individual",followsText:"",zmanFamily:"",useShulDefault:false
  },
  {
    id:"shabbos-late-mincha",service:"Mincha",name:"Shabbos Late Mincha",days:[6],
    mode:"zman",fixedTime:"",source:"sunset_default",offset:10,direction:"before",
    roundMode:"earlier",groupPeriod:"individual",followsText:"",zmanFamily:"sunset",useShulDefault:false
  },
  {
    id:"weekday-maariv",service:"Maariv",name:"Weekday Maariv",days:[0,1,2,3,4,5],
    mode:"follows",fixedTime:"",source:"night_gra180",offset:0,direction:"after",
    roundMode:"exact",groupPeriod:"individual",followsText:"Follows Mincha",zmanFamily:"",useShulDefault:false
  },
  {
    id:"shabbos-maariv",service:"Maariv",name:"Shabbos Maariv",days:[6],
    mode:"zman",fixedTime:"",source:"night_gra180",offset:0,direction:"after",
    roundMode:"exact",groupPeriod:"individual",followsText:"",zmanFamily:"nightfall",useShulDefault:true
  }
];

function defaultNewRule(service:Service,index:number):MinyanRule{
  if(service==="Shacharis"){
    return {
      id:newId(),service,name:`Shacharis Minyan ${index}`,days:[],
      mode:"fixed",fixedTime:"7:00 AM",source:"sunset_default",offset:0,direction:"before",
      roundMode:"exact",groupPeriod:"individual",followsText:"",zmanFamily:"",useShulDefault:false
    };
  }
  if(service==="Mincha"){
    return {
      id:newId(),service,name:`Mincha Minyan ${index}`,days:[],
      mode:"zman",fixedTime:"",source:"sunset_default",offset:10,direction:"before",
      roundMode:"earlier",groupPeriod:"individual",followsText:"",zmanFamily:"sunset",useShulDefault:false
    };
  }
  return {
    id:newId(),service,name:`Maariv Minyan ${index}`,days:[],
    mode:"follows",fixedTime:"",source:"night_gra180",offset:0,direction:"after",
    roundMode:"exact",groupPeriod:"individual",followsText:"Follows Mincha",zmanFamily:"",useShulDefault:false
  };
}

function sourceLabel(service:Service,source:ZmanSource){
  const family=familyForSource(service,source);
  return `${family.label} · ${methodLabel(service,source)}`;
}

export default function OnboardingPage({onCancel,onComplete,mode="create",shulId=""}:Props){
  const isEdit=mode==="edit";
  const [step,setStep]=useState<1|2>(isEdit?2:1);
  const [authMode,setAuthMode]=useState<"signup"|"signin">("signup");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [accountStatus,setAccountStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [loadingExisting,setLoadingExisting]=useState(isEdit);
  const [error,setError]=useState("");
  const [saveMessage,setSaveMessage]=useState("");

  const [name,setName]=useState("");
  const [country,setCountry]=useState("US");
  const [zip,setZip]=useState("");
  const [shabbosEndMinutes,setShabbosEndMinutes]=useState(60);
  const [shabbosEndPreset,setShabbosEndPreset]=useState<"42"|"60"|"72"|"manual">("60");
  const [zmanDefaults,setZmanDefaults]=useState<ZmanDefaults>({
    dawn:"72fix",
    shema:"gra",
    midday:"standard",
    mincha:"gra",
    nightfall:"gra"
  });
  const [locationStatus,setLocationStatus]=useState<"idle"|"checking"|"verified"|"error">("idle");
  const [verifiedLocation,setVerifiedLocation]=useState<VerifiedLocation|null>(null);
  const [verifiedKey,setVerifiedKey]=useState("");
  const [locationError,setLocationError]=useState("");
  const [rules,setRules]=useState<MinyanRule[]>(initialRules);

  useEffect(()=>{
    if(isEdit){
      setStep(2);
      return;
    }
    supabase.auth.getSession().then(({data})=>{
      if(data.session){
        setAccountStatus(data.session.user.email||"Signed in");
        setStep(2);
      }
    });
  },[isEdit]);

  useEffect(()=>{
    if(!isEdit||!shulId)return;

    let cancelled=false;
    async function loadExistingSetup(){
      setLoadingExisting(true);
      setError("");

      const [shulRes,zmanimRes,scheduleRes]=await Promise.all([
        supabase.from("shuls")
          .select("id,name,country_code,postal_code,timezone")
          .eq("id",shulId)
          .maybeSingle(),
        supabase.from("zmanim_settings")
          .select("country_code,postal_code,myzmanim_location_id,shabbos_yom_tov_end_minutes,zman_defaults,location_metadata")
          .eq("shul_id",shulId)
          .maybeSingle(),
        supabase.from("schedule_entries")
          .select("*")
          .eq("shul_id",shulId)
          .eq("active",true)
          .order("service_type")
          .order("sort_order")
          .order("day_of_week")
      ]);

      if(cancelled)return;

      const loadError=shulRes.error||zmanimRes.error||scheduleRes.error;
      if(loadError||!shulRes.data){
        setError(loadError?.message||"Could not load this shul setup.");
        setLoadingExisting(false);
        return;
      }

      const nextCountry=String(shulRes.data.country_code||zmanimRes.data?.country_code||"US");
      const nextZip=String(shulRes.data.postal_code||zmanimRes.data?.postal_code||"");
      const nextTimezone=String(shulRes.data.timezone||"");
      const nextLocationId=String(zmanimRes.data?.myzmanim_location_id||"");
      const metadata=(zmanimRes.data?.location_metadata||{}) as any;
      const endMinutes=Number(zmanimRes.data?.shabbos_yom_tov_end_minutes||60);

      setName(String(shulRes.data.name||""));
      setCountry(nextCountry);
      setZip(nextZip);
      setShabbosEndMinutes(endMinutes);
      setShabbosEndPreset(
        endMinutes===42?"42":endMinutes===60?"60":endMinutes===72?"72":"manual"
      );
      setZmanDefaults({
        dawn:String(zmanimRes.data?.zman_defaults?.dawn||"72fix"),
        shema:String(zmanimRes.data?.zman_defaults?.shema||"gra"),
        midday:String(zmanimRes.data?.zman_defaults?.midday||"standard"),
        mincha:String(zmanimRes.data?.zman_defaults?.mincha||"gra"),
        nightfall:String(zmanimRes.data?.zman_defaults?.nightfall||"gra")
      });
      setRules(scheduleRes.data?.length?rulesFromScheduleRows(scheduleRes.data):initialRules);

      if(nextLocationId&&nextTimezone){
        const key=`${nextCountry}|${nextZip.trim().toUpperCase()}`;
        setVerifiedKey(key);
        setVerifiedLocation({
          locationId:nextLocationId,
          timezone:nextTimezone,
          place:{
            name:metadata.name||null,
            city:metadata.city||null,
            state:metadata.state||null,
            country:metadata.country||null,
            postal_code:metadata.postal_code||nextZip||null
          }
        });
        setLocationStatus("verified");
      }

      setLoadingExisting(false);
    }

    void loadExistingSetup();
    return()=>{cancelled=true;};
  },[isEdit,shulId]);

  useEffect(()=>{
    if(loadingExisting)return;

    const postal=zip.trim();
    const currentKey=`${country}|${postal.toUpperCase()}`;
    if(verifiedLocation&&verifiedKey===currentKey){
      setLocationStatus("verified");
      setLocationError("");
      return;
    }

    setVerifiedLocation(null);
    setVerifiedKey("");
    setLocationError("");
    setLocationStatus("idle");

    const minimumLength=country==="US"?5:country==="GB"?5:country==="IL"?5:3;
    if(postal.length<minimumLength)return;

    let cancelled=false;
    const timer=window.setTimeout(async()=>{
      setLocationStatus("checking");
      const {data,error}=await supabase.functions.invoke("myzmanim",{
        body:{
          action:"resolve_location",
          country_code:country,
          postal_code:postal
        }
      });

      if(cancelled)return;

      if(error||!data?.success||!data?.verified||!data?.location_id||!data?.timezone){
        setVerifiedLocation(null);
        setLocationStatus("error");
        setLocationError(data?.error||error?.message||"MyZmanim could not verify that location.");
        return;
      }

      setVerifiedLocation({
        locationId:String(data.location_id),
        timezone:String(data.timezone),
        place:{
          name:data.place?.name||null,
          city:data.place?.city||null,
          state:data.place?.state||null,
          country:data.place?.country||null,
          postal_code:data.place?.postal_code||null
        }
      });
      setVerifiedKey(currentKey);
      setLocationStatus("verified");
      setLocationError("");
    },550);

    return()=>{
      cancelled=true;
      window.clearTimeout(timer);
    };
  },[country,zip,loadingExisting,verifiedKey,verifiedLocation]);

  const coverage=useMemo(()=>{
    const matrix=DAYS.map(day=>({
      day:day.value,
      label:day.full,
      status:Object.fromEntries(SERVICES.map(service=>{
        const matching=rules.filter(rule=>rule.service===service&&rule.days.includes(day.value));
        const minyanCount=matching.filter(rule=>rule.mode!=="none").length;
        const noMinyan=matching.some(rule=>rule.mode==="none");
        return [service,{minyanCount,noMinyan,covered:minyanCount>0||noMinyan,conflict:minyanCount>0&&noMinyan}];
      })) as Record<Service,{minyanCount:number;noMinyan:boolean;covered:boolean;conflict:boolean}>
    }));
    const count=matrix.reduce((sum,row)=>sum+SERVICES.filter(service=>row.status[service].covered).length,0);
    const hasConflict=matrix.some(row=>SERVICES.some(service=>row.status[service].conflict));
    return {matrix,count,complete:count===21&&!hasConflict,hasConflict};
  },[rules]);

  const invalidFixedRule=rules.find(rule=>rule.mode==="fixed"&&!parseFriendlyTime(rule.fixedTime));
  const emptyDayRule=rules.find(rule=>rule.days.length===0);

  const handleAccount=async()=>{
    setBusy(true);setError("");setAccountStatus("");
    if(!email.trim()||password.length<6){
      setError("Enter an email and a password of at least 6 characters.");
      setBusy(false);return;
    }

    const result=authMode==="signup"
      ? await supabase.auth.signUp({email:email.trim(),password})
      : await supabase.auth.signInWithPassword({email:email.trim(),password});

    if(result.error){
      setError(result.error.message);
      setBusy(false);return;
    }

    const {data:{session}}=await supabase.auth.getSession();
    if(!session){
      setAccountStatus("Account created. Confirm the email, then return here and sign in.");
      setAuthMode("signin");
      setBusy(false);return;
    }

    setAccountStatus(session.user.email||email.trim());
    setStep(2);
    setBusy(false);
  };

  const patchRule=(id:string,patch:Partial<MinyanRule>)=>{
    setRules(current=>current.map(rule=>rule.id===id?{...rule,...patch}:rule));
  };

  const toggleDay=(id:string,day:number)=>{
    setRules(current=>current.map(rule=>{
      if(rule.id!==id)return rule;
      const days=rule.days.includes(day)
        ? rule.days.filter(value=>value!==day)
        : [...rule.days,day].sort((a,b)=>a-b);
      return {...rule,days};
    }));
  };

  const addRule=(service:Service)=>{
    const count=rules.filter(rule=>rule.service===service).length+1;
    setRules(current=>[...current,defaultNewRule(service,count)]);
  };

  const deleteRule=(id:string)=>{
    setRules(current=>current.filter(rule=>rule.id!==id));
  };

  const saveSetup=async()=>{
    setError("");
    setSaveMessage("");
    if(!name.trim()){setError("Enter the shul name.");return;}
    if(!zip.trim()){setError("Enter a ZIP / postal code.");return;}
    if(locationStatus!=="verified"||!verifiedLocation){
      setError("Wait for the location to be verified with MyZmanim before saving.");
      return;
    }
    if(coverage.hasConflict){setError("A day cannot have both NO MINYAN and a configured minyan for the same tefillah.");return;}
    if(!coverage.complete){setError("Finish the weekly coverage first. Each day needs either a minyan or NO MINYAN for Shacharis, Mincha, and Maariv.");return;}
    if(emptyDayRule){setError(`${emptyDayRule.name} does not apply to any day. Select a day or delete that minyan.`);return;}
    if(invalidFixedRule){setError(`Enter a valid time for ${invalidFixedRule.name}.`);return;}

    setBusy(true);

    const serviceBase:Record<Service,number>={Shacharis:10,Mincha:30,Maariv:60};
    const rows:any[]=[];

    SERVICES.forEach(service=>{
      const serviceRules=rules.filter(rule=>rule.service===service);
      serviceRules.forEach((rule,index)=>{
        const fixedTime=rule.mode==="fixed" ? parseFriendlyTime(rule.fixedTime) : "";
        const signedOffset=rule.direction==="before" ? -Math.abs(rule.offset) : Math.abs(rule.offset);
        const family=rule.mode==="zman"
          ? (ZMAN_OPTIONS[service].find(item=>item.key===rule.zmanFamily) || familyForSource(service,rule.source))
          : null;
        const effectiveSource=rule.mode==="zman" && family && rule.useShulDefault
          ? defaultSourceForFamily(family,zmanDefaults)
          : rule.source;
        rule.days.forEach(day=>{
          rows.push({
            day_of_week:day,
            service_type:service,
            service_time:fixedTime,
            timing_source:rule.mode==="fixed"?"fixed":rule.mode==="follows"?"follows":rule.mode==="none"?"none":effectiveSource,
            timing_offset_minutes:rule.mode==="zman"?signedOffset:0,
            display_name:rule.mode==="none"?`NO ${service.toUpperCase()}`:rule.name,
            sort_order:serviceBase[service]+index,
            active:true,
            round_to_minutes:rule.mode==="zman"&&rule.roundMode!=="exact"?5:null,
            round_direction:rule.mode==="zman"&&rule.roundMode==="earlier"?"down":rule.mode==="zman"&&rule.roundMode==="later"?"up":null,
            use_weekly_earliest:rule.mode==="zman"&&rule.groupPeriod==="week_earliest",
            weekly_group:rule.mode==="zman"&&rule.groupPeriod!=="individual"?`${service.toLowerCase()}-${rule.id}`:"",
            follows_text:rule.mode==="follows"?(rule.followsText||"Follows Mincha"):"",
            group_period:rule.mode==="zman"?rule.groupPeriod:"individual",
            zman_family:rule.mode==="zman"?(family?.key||""):"",
            use_shul_zman_default:rule.mode==="zman"&&rule.useShulDefault,
            rule_group_id:rule.id
          });
        });
      });
    });

    const commonArgs={
      p_name:name.trim(),
      p_country_code:country,
      p_postal_code:zip.trim(),
      p_timezone:verifiedLocation.timezone,
      p_myzmanim_location_id:verifiedLocation.locationId,
      p_location_metadata:{
        ...verifiedLocation.place,
        timezone:verifiedLocation.timezone,
        location_id:verifiedLocation.locationId,
        verified_by:"MyZmanim"
      },
      p_shabbos_end_minutes:shabbosEndMinutes,
      p_zman_defaults:zmanDefaults,
      p_schedule_rows:rows
    };

    const {data,error:rpcError}=isEdit
      ? await supabase.rpc("update_shul_setup",{p_shul_id:shulId,...commonArgs})
      : await supabase.rpc("create_shul_onboarding",commonArgs);

    if(rpcError){
      setError(rpcError.message);
      setBusy(false);return;
    }

    const savedShulId=String(data||shulId||"");
    if(!savedShulId){
      setError(isEdit?"The setup could not be saved.":"The shul was created but no shul ID was returned.");
      setBusy(false);return;
    }

    localStorage.setItem("magnets.currentShulId",savedShulId);
    setBusy(false);
    setSaveMessage(isEdit?"Setup saved.":"");
    onComplete(savedShulId);
  };

  const renderRule=(rule:MinyanRule)=>{
    const canFollow=rule.service==="Maariv";
    const currentFamily=ZMAN_OPTIONS[rule.service].find(item=>item.key===rule.zmanFamily) || familyForSource(rule.service,rule.source);
    const hasShulDefault=Boolean(DEFAULT_CATEGORY_BY_FAMILY[currentFamily.key]);
    return (
      <div className="minyanRuleCard" key={rule.id}>
        <div className="minyanRuleHeader">
          <input
            className="minyanNameInput"
            value={rule.name}
            onChange={e=>patchRule(rule.id,{name:e.target.value})}
            aria-label={`${rule.service} minyan name`}
          />
          <button type="button" className="iconDangerButton" onClick={()=>deleteRule(rule.id)} aria-label={`Delete ${rule.name}`}>
            <Trash2 size={16}/>
          </button>
        </div>

        <div className="minyanApplies">
          <span>Applies</span>
          <div className="dayChoiceRow">
            {DAYS.map(day=>(
              <label className={rule.days.includes(day.value)?"dayChoice active":"dayChoice"} key={day.value}>
                <input
                  type="checkbox"
                  checked={rule.days.includes(day.value)}
                  onChange={()=>toggleDay(rule.id,day.value)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="timingEditor">
          <label>
            <span>Timing</span>
            <select
              value={rule.mode}
              onChange={e=>{
                const mode=e.target.value as RuleMode;
                const sourceIsValidForService=ZMAN_OPTIONS[rule.service]
                  .some(family=>family.methods.some(method=>method.key===rule.source));
                const firstFamily=ZMAN_OPTIONS[rule.service][0];
                const nextFamily=sourceIsValidForService
                  ? (ZMAN_OPTIONS[rule.service].find(family=>family.methods.some(method=>method.key===rule.source)) || firstFamily)
                  : firstFamily;
                const inherit=Boolean(DEFAULT_CATEGORY_BY_FAMILY[nextFamily.key]);
                patchRule(rule.id,{
                  mode,
                  zmanFamily:mode==="zman"?nextFamily.key:rule.zmanFamily,
                  useShulDefault:mode==="zman"?inherit:rule.useShulDefault,
                  source:mode==="zman"
                    ? (inherit?defaultSourceForFamily(nextFamily,zmanDefaults):nextFamily.methods[0].key)
                    : rule.source,
                  followsText:mode==="follows"?"Follows Mincha":rule.followsText
                });
              }}
            >
              <option value="fixed">Set time</option>
              <option value="zman">Based on a zman</option>
              {canFollow&&<option value="follows">Follows Mincha</option>}
              <option value="none">NO MINYAN</option>
            </select>
          </label>

          {rule.mode==="fixed"&&(
            <label>
              <span>Time</span>
              <input
                className="friendlyTimeInput"
                value={rule.fixedTime}
                onFocus={e=>e.currentTarget.select()}
                onChange={e=>patchRule(rule.id,{fixedTime:e.target.value})}
                onBlur={e=>patchRule(rule.id,{fixedTime:normalizeFriendlyTime(e.currentTarget.value)})}
                placeholder="6:45 AM"
              />
            </label>
          )}

          {rule.mode==="zman"&&(
            <>
              <label>
                <span>Minutes</span>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={rule.offset}
                  onChange={e=>patchRule(rule.id,{offset:Number(e.target.value)})}
                />
              </label>
              <label>
                <span>Direction</span>
                <select value={rule.direction} onChange={e=>patchRule(rule.id,{direction:e.target.value as "before"|"after"})}>
                  <option value="before">before</option>
                  <option value="after">after</option>
                </select>
              </label>
              <label>
                <span>Zman</span>
                <select
                  value={currentFamily.key}
                  onChange={e=>{
                    const family=ZMAN_OPTIONS[rule.service].find(item=>item.key===e.target.value)!;
                    const inherit=Boolean(DEFAULT_CATEGORY_BY_FAMILY[family.key]);
                    patchRule(rule.id,{
                      zmanFamily:family.key,
                      useShulDefault:inherit,
                      source:inherit?defaultSourceForFamily(family,zmanDefaults):family.methods[0].key
                    });
                  }}
                >
                  {ZMAN_OPTIONS[rule.service].map(family=>(
                    <option key={family.key} value={family.key}>{family.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Calculation Method</span>
                <select
                  value={rule.useShulDefault&&hasShulDefault?"__default__":rule.source}
                  onChange={e=>{
                    if(e.target.value==="__default__"){
                      patchRule(rule.id,{
                        useShulDefault:true,
                        source:defaultSourceForFamily(currentFamily,zmanDefaults)
                      });
                    }else{
                      patchRule(rule.id,{useShulDefault:false,source:e.target.value as ZmanSource});
                    }
                  }}
                >
                  {hasShulDefault&&(
                    <option value="__default__">Use shul default — {defaultLabelForFamily(currentFamily,zmanDefaults)}</option>
                  )}
                  {currentFamily.methods.map(method=>(
                    <option key={method.key} value={method.key}>{method.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {rule.mode==="follows"&&(
            <div className="followsGroupingNote">
              <strong>Grouped display</strong>
              <span>Each Mincha on the selected day will display as “Mincha / Maariv” at that Mincha time. No separate Maariv row will be shown.</span>
            </div>
          )}
        </div>

        {rule.mode==="zman"&&(
          <div className="ruleOptions ruleSelectOptions">
            <label>
              <span>5-minute rounding</span>
              <select value={rule.roundMode} onChange={e=>patchRule(rule.id,{roundMode:e.target.value as RoundMode})}>
                <option value="exact">Exact calculated time (9:13 → 9:13)</option>
                <option value="earlier">Round to prior 5-min increment (9:13 → 9:10)</option>
                <option value="later">Round to next 5-min increment (9:13 → 9:15)</option>
              </select>
            </label>
            {rule.days.length>1&&(
              <label>
                <span>Keep selected days consistent</span>
                <select value={rule.groupPeriod} onChange={e=>patchRule(rule.id,{groupPeriod:e.target.value as GroupPeriod})}>
                  <option value="individual">Calculate each day separately</option>
                  <option value="week_earliest">Same time for each week — use that week's earliest time</option>
                  <option value="month_earliest">Same time for the month — use that month's earliest time</option>
                </select>
                <small>“Earliest” checks the calculated zman-based time across the selected days in that week or month.</small>
              </label>
            )}
          </div>
        )}

        <div className="ruleSentence">
          {rule.mode==="fixed"&&<span>{rule.fixedTime || "Set a time"}</span>}
          {rule.mode==="zman"&&<span>{rule.offset} minutes {rule.direction} {currentFamily.label} · {rule.useShulDefault&&hasShulDefault?`Shul default — ${defaultLabelForFamily(currentFamily,zmanDefaults)}`:methodLabel(rule.service,rule.source)}</span>}
          {rule.mode==="follows"&&<span>{rule.followsText||"Follows Mincha"}</span>}
          {rule.mode==="none"&&<span>NO MINYAN</span>}
        </div>
      </div>
    );
  };

  if(isEdit&&loadingExisting){
    return (
      <div className="onboardingPage">
        <div className="panel onboardingCard">
          <strong>Loading shul setup…</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="onboardingPage">
      <div className="onboardingTop">
        <button className="secondary" onClick={onCancel}><ArrowLeft size={16}/> Back</button>
        <div>
          <span className="eyebrow">{isEdit?"Shul setup":"New shul onboarding"}</span>
          <h1>{isEdit?"Edit shul setup":"Get to a live dashboard in under 5 minutes"}</h1>
          <p>{isEdit
            ?"Update the shul profile, zmanim defaults, and normal weekly minyan schedule."
            :"Create the account, then describe the shul's normal weekly minyanim."}</p>
        </div>
        {!isEdit&&(
          <div className="onboardingProgress">
            <span className={step>=1?"done":""}>1 Account</span>
            <span className={step>=2?"done":""}>2 Normal Schedule</span>
          </div>
        )}
      </div>

      {step===1 ? (
        <div className="panel onboardingCard">
          <div className="panelHead">
            <div>
              <span className="eyebrow">Step 1 of 2 · target: under 1 minute</span>
              <h2>{authMode==="signup"?"Create your admin account":"Sign in to your admin account"}</h2>
              <p className="helperText">
                {authMode==="signup"
                  ?"Use the email you'll use to manage this shul."
                  :"Use the same email and password you used when you created the account."}
              </p>
            </div>
          </div>
          <form onSubmit={e=>{e.preventDefault();void handleAccount();}}>
            <div className="onboardForm">
              <label className="onboardField">
                <span>Email</span>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" autoFocus placeholder="you@example.com"/>
              </label>
              <label className="onboardField">
                <span>Password</span>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={authMode==="signup"?"new-password":"current-password"} placeholder="6+ characters"/>
                <small>At least 6 characters.</small>
              </label>
            </div>
            {error&&<div className="onboardError">{error}</div>}
            {accountStatus&&<div className="daySaveMessage">{accountStatus}</div>}
            <div className="onboardActions">
              <button type="button" className="secondary" onClick={()=>{setAuthMode(v=>v==="signup"?"signin":"signup");setError("");setAccountStatus("");}}>
                {authMode==="signup"?"Already have an account? Sign in":"Need an account? Create one"}
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy?"Working...":authMode==="signup"?"Create Account & Continue":"Sign In & Continue"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="panel onboardingCard setupBasicsCard">
            <div className="panelHead">
              <div>
                <span className="eyebrow">{isEdit?"Normal weekly setup":"Step 2 of 2 · normal weekly schedule"}</span>
                <h2>{isEdit?"Edit what normally happens each week":"Tell us what normally happens each week"}</h2>
                <p className="helperText">Add as many minyanim as the shul has. Each minyan can use a fixed time or a zman-based rule.</p>
              </div>
              {!isEdit&&accountStatus&&<span className="sourceBadge"><CheckCircle2 size={14}/> {accountStatus}</span>}
            </div>

            <div className="onboardGrid fourBasics">
              <label className="onboardField">
                <span>Shul name</span>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Example Shul" autoFocus/>
              </label>
              <label className="onboardField">
                <span>Country</span>
                <select value={country} onChange={e=>setCountry(e.target.value)}>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="IL">Israel</option>
                </select>
              </label>
              <label className="onboardField">
                <span>ZIP / Postal code</span>
                <input value={zip} onChange={e=>setZip(e.target.value.toUpperCase())} placeholder={country==="US"?"44118":country==="GB"?"NW11 8AU":"9100000"}/>
              </label>
              <label className="onboardField">
                <span>Shabbos / Yom Tov ends</span>
                <div className="endTimeSetting">
                  <select
                    value={shabbosEndPreset}
                    onChange={e=>{
                      const value=e.target.value as "42"|"60"|"72"|"manual";
                      setShabbosEndPreset(value);
                      if(value!=="manual")setShabbosEndMinutes(Number(value));
                    }}
                  >
                    <option value="42">42 minutes after sunset</option>
                    <option value="60">60 minutes after sunset</option>
                    <option value="72">72 minutes after sunset</option>
                    <option value="manual">Manual</option>
                  </select>
                  {shabbosEndPreset==="manual"&&(
                    <div className="manualEndMinutes">
                      <input type="number" min="1" max="180" value={shabbosEndMinutes} onChange={e=>setShabbosEndMinutes(Number(e.target.value))}/>
                      <b>minutes</b>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className={`locationVerifyBox ${locationStatus}`}>
              {locationStatus==="idle"&&(
                <>
                  <strong>Location verification</strong>
                  <span>Enter Country and ZIP / Postal code. We’ll verify the location with MyZmanim automatically.</span>
                </>
              )}
              {locationStatus==="checking"&&(
                <>
                  <strong>Checking location with MyZmanim…</strong>
                  <span>Confirming the place and correct time zone.</span>
                </>
              )}
              {locationStatus==="verified"&&verifiedLocation&&(
                <>
                  <strong><CheckCircle2 size={15}/> Location verified with MyZmanim</strong>
                  <span>
                    {[verifiedLocation.place.city||verifiedLocation.place.name,verifiedLocation.place.state,verifiedLocation.place.country]
                      .filter(Boolean).join(", ")}
                  </span>
                  <small>Time zone: {verifiedLocation.timezone}</small>
                </>
              )}
              {locationStatus==="error"&&(
                <>
                  <strong>Location could not be verified</strong>
                  <span>Check the selected country and ZIP / Postal code.</span>
                  {locationError&&<small>{locationError}</small>}
                </>
              )}
            </div>

            <div className="zmanDefaultsBlock">
              <div className="zmanDefaultsHead">
                <div>
                  <h3>Zmanim Defaults</h3>
                  <p>Used automatically wherever that calculation applies. Any individual minyan can override the shul default below.</p>
                </div>
              </div>
              <div className="zmanDefaultsGrid">
                <label className="onboardField">
                  <span>Alos / Dawn</span>
                  <select value={zmanDefaults.dawn} onChange={e=>setZmanDefaults(v=>({...v,dawn:e.target.value}))}>
                    {DEFAULT_CHOICES.dawn.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
                <label className="onboardField">
                  <span>Latest Shema</span>
                  <select value={zmanDefaults.shema} onChange={e=>setZmanDefaults(v=>({...v,shema:e.target.value}))}>
                    {DEFAULT_CHOICES.shema.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
                <label className="onboardField">
                  <span>Chatzos / Midday</span>
                  <select value={zmanDefaults.midday} onChange={e=>setZmanDefaults(v=>({...v,midday:e.target.value}))}>
                    {DEFAULT_CHOICES.midday.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
                <label className="onboardField">
                  <span>Mincha Zmanim</span>
                  <select value={zmanDefaults.mincha} onChange={e=>setZmanDefaults(v=>({...v,mincha:e.target.value}))}>
                    {DEFAULT_CHOICES.mincha.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
                <label className="onboardField">
                  <span>Tzeis / Maariv</span>
                  <select value={zmanDefaults.nightfall} onChange={e=>setZmanDefaults(v=>({...v,nightfall:e.target.value}))}>
                    {DEFAULT_CHOICES.nightfall.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="scheduleWizardLayout">
            <div className="scheduleBuilder">
              <div className="scheduleInfoBox">
                <strong>Set times or use zmanim — it's up to you.</strong>
                <span>You can have multiple minyanim for each tefillah, and different rules for different days.</span>
              </div>

              {SERVICES.map(service=>(
                <section className={`serviceRuleSection ${service.toLowerCase()}`} key={service}>
                  <div className="serviceRuleHead">
                    <div>
                      <h3>{service}</h3>
                      <span>{rules.filter(rule=>rule.service===service).length} minyan{rules.filter(rule=>rule.service===service).length===1?"":"im"} configured</span>
                    </div>
                    <button type="button" className="primary compactAddButton" onClick={()=>addRule(service)}>
                      <Plus size={16}/> Add {service} Minyan
                    </button>
                  </div>
                  <div className="serviceRuleList">
                    {rules.filter(rule=>rule.service===service).map(renderRule)}
                  </div>
                </section>
              ))}
            </div>

            <aside className="coveragePanel">
              <div className="panel coverageCard">
                <div className="coverageTitle">
                  <CheckCircle2 size={20}/>
                  <div>
                    <h3>Weekly Coverage</h3>
                    <span>{coverage.count} of 21 day/service combinations are set.</span>
                  </div>
                </div>

                <div className={coverage.complete?"coverageStatus complete":"coverageStatus"}>
                  <strong>{coverage.complete?"All days are covered!":"A few schedule gaps remain"}</strong>
                  <span>{coverage.complete
                    ?(isEdit?"Everything is covered and ready to save.":"You're ready to create the shul.")
                    :"Fill every blank before continuing."}</span>
                </div>

                <div className="coverageTable">
                  <div className="coverageHeader"><span></span>{SERVICES.map(service=><b key={service}>{service}</b>)}</div>
                  {coverage.matrix.map(row=>(
                    <div className="coverageRow" key={row.day}>
                      <strong>{row.label}</strong>
                      {SERVICES.map(service=>(
                        <span className={row.status[service].covered?"coverageDot yes":"coverageDot no"} key={service}>
                          {row.status[service].conflict
                            ? "!"
                            : row.status[service].noMinyan
                              ? "NO"
                              : row.status[service].minyanCount>0
                                ? String(row.status[service].minyanCount)
                                : "—"}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>

                {error&&<div className="onboardError">{error}</div>}
                {saveMessage&&<div className="daySaveMessage">{saveMessage}</div>}

                <button
                  className="primary createShulButton"
                  disabled={busy||!coverage.complete||locationStatus!=="verified"}
                  onClick={saveSetup}
                >
                  {busy
                    ?(isEdit?"Saving changes...":"Creating shul...")
                    :(isEdit?"Save Changes":"Create Shul & Open Dashboard")}
                </button>
                <button
                  className="secondary fullWidthButton"
                  onClick={()=>isEdit?onCancel():setStep(1)}
                >
                  {isEdit?"Cancel":"Back to Account"}
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

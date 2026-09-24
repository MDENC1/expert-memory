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
import { PILOT_SHUL_ID, supabase } from "./lib/supabase";

type Tab = "dashboard" | "calendar" | "monthly" | "notices" | "devices" | "settings" | "super";

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
};

type SpecialScheduleDay = {
  event_date:string;
  title:string|null;
  replace_normal_schedule:boolean;
};

type SpecialScheduleEntry = {
  event_date:string;
  title:string;
  event_time:string|null;
  approximate:boolean;
  note:string|null;
  sort_order:number;
};

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

function hebrewParts(date:Date){
  const parts=new Intl.DateTimeFormat("en-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).formatToParts(date);
  return {
    day:parts.find(p=>p.type==="day")?.value || "",
    month:parts.find(p=>p.type==="month")?.value || "",
    year:parts.find(p=>p.type==="year")?.value || ""
  };
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
  specialEntries:SpecialScheduleEntry[]
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
    isShabbos:dow===6,
    isRoshChodesh:h.day==="1" || h.day==="30",
    holiday:specialDay?.title || undefined,
    template:specialDay?.title || (dow===6 ? "Shabbos" : "Regular")
  };

  if(specialDay?.replace_normal_schedule && specialEntries.length){
    const times=(needle:string)=>specialEntries
      .filter(e=>e.title.toLowerCase().includes(needle))
      .filter(e=>e.event_time)
      .map(e=>prettyTime(e.event_time))
      .filter(Boolean);
    const shacharis=times("shacharis");
    const mincha=times("mincha");
    const maariv=times("maariv");
    return {
      ...base,
      shacharis:shacharis.join(" · ") || undefined,
      mincha:mincha.join(" · ") || undefined,
      maariv:maariv.join(" · ") || undefined,
      event:specialDay.title || undefined
    };
  }

  const todayRules=schedule.filter(r=>r.day_of_week===dow);
  const fixed=(service:string)=>todayRules
    .filter(r=>(r.service_type||"").toLowerCase()===service && r.service_time)
    .map(r=>prettyTime(r.service_time))
    .filter(Boolean);
  const ruleBased=(service:string)=>todayRules
    .filter(r=>(r.service_type||"").toLowerCase()===service && !r.service_time)
    .map(r=>{
      const source=(r.timing_source||"rule").replaceAll("_"," ");
      const off=r.timing_offset_minutes||0;
      return `${source}${off ? ` ${off>0?"+":""}${off}m` : ""}`;
    });

  return {
    ...base,
    shacharis:[...fixed("shacharis"),...ruleBased("shacharis")].join(" · ") || undefined,
    mincha:[...fixed("mincha"),...ruleBased("mincha")].join(" · ") || undefined,
    maariv:[...fixed("maariv"),...ruleBased("maariv")].join(" · ") || undefined
  };
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(seedDays);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [shulName,setShulName] = useState("Loading shul…");
  const [postalCode,setPostalCode] = useState("");
  const [devices,setDevices] = useState<LiveDevice[]>([]);
  const [scheduleEntries,setScheduleEntries] = useState<LiveScheduleEntry[]>([]);
  const [specialDay,setSpecialDay] = useState<SpecialScheduleDay|undefined>();
  const [specialEntries,setSpecialEntries] = useState<SpecialScheduleEntry[]>([]);
  const [pushesUsed,setPushesUsed] = useState(0);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState("");

  const remainingPushes = Math.max(0, 2 - pushesUsed);
  const activeDevices = devices.filter(d=>d.active);
  const healthyDevices = activeDevices.filter(d=>String(d.status).toLowerCase()==="healthy");
  const livePreviewDay=useMemo(
    ()=>buildLiveDay(scheduleEntries,specialDay,specialEntries),
    [scheduleEntries,specialDay,specialEntries]
  );

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
    async function loadLiveData(){
      setLoading(true); setLoadError("");
      const today = localIsoDate();
      const [shulRes,deviceRes,noticeRes,scheduleRes,pushRes,specialDayRes,specialEntryRes] = await Promise.all([
        supabase.from("shuls").select("id,name,postal_code,timezone").eq("id",PILOT_SHUL_ID).single(),
        supabase.from("magnets").select("*").eq("shul_id",PILOT_SHUL_ID).order("device_code"),
        supabase.from("notices_events").select("*").eq("shul_id",PILOT_SHUL_ID).is("archived_at",null).order("display_start"),
        supabase.from("schedule_entries").select("*").eq("shul_id",PILOT_SHUL_ID).eq("active",true).order("day_of_week").order("sort_order"),
        supabase.from("immediate_pushes").select("id",{count:"exact",head:true}).eq("shul_id",PILOT_SHUL_ID).eq("sent_on",today),
        supabase.from("special_schedule_days").select("event_date,title,replace_normal_schedule").eq("shul_id",PILOT_SHUL_ID).eq("event_date",today).maybeSingle(),
        supabase.from("special_schedule_entries").select("event_date,title,event_time,approximate,note,sort_order").eq("shul_id",PILOT_SHUL_ID).eq("event_date",today).eq("active",true).order("sort_order")
      ]);
      if(cancelled) return;
      const firstError = shulRes.error || deviceRes.error || noticeRes.error || scheduleRes.error || pushRes.error || specialDayRes.error || specialEntryRes.error;
      if(firstError){
        setLoadError(firstError.message);
      } else {
        setShulName(shulRes.data?.name || "Shul");
        setPostalCode(shulRes.data?.postal_code || "");
        setDevices((deviceRes.data || []) as LiveDevice[]);
        setNotices((noticeRes.data || []).map(mapNotice));
        setScheduleEntries((scheduleRes.data || []) as LiveScheduleEntry[]);
        setSpecialDay((specialDayRes.data || undefined) as SpecialScheduleDay|undefined);
        setSpecialEntries((specialEntryRes.data || []) as SpecialScheduleEntry[]);
        setPushesUsed(pushRes.count || 0);
      }
      setLoading(false);
    }
    loadLiveData();

    const channel=supabase.channel("pilot-live-admin")
      .on("postgres_changes",{event:"*",schema:"public",table:"magnets",filter:`shul_id=eq.${PILOT_SHUL_ID}`},()=>loadLiveData())
      .on("postgres_changes",{event:"*",schema:"public",table:"notices_events",filter:`shul_id=eq.${PILOT_SHUL_ID}`},()=>loadLiveData())
      .on("postgres_changes",{event:"*",schema:"public",table:"schedule_entries",filter:`shul_id=eq.${PILOT_SHUL_ID}`},()=>loadLiveData())
      .on("postgres_changes",{event:"*",schema:"public",table:"special_schedule_days",filter:`shul_id=eq.${PILOT_SHUL_ID}`},()=>loadLiveData())
      .on("postgres_changes",{event:"*",schema:"public",table:"special_schedule_entries",filter:`shul_id=eq.${PILOT_SHUL_ID}`},()=>loadLiveData())
      .subscribe();

    return ()=>{cancelled=true; supabase.removeChannel(channel);};
  },[]);

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
            <button key={id} className={tab === id ? "navBtn active" : "navBtn"} onClick={() => setTab(id)}>
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
            onGoCalendar={() => setTab("calendar")}
            onAddNotice={() => setTab("notices")}
            shulName={shulName}
            activeMagnets={activeDevices.length}
            healthyMagnets={healthyDevices.length}
            scheduleEntries={scheduleEntries}
            loading={loading}
          />
        )}

        {tab === "calendar" && (
          <CalendarPage
            days={calendarDays}
            setDays={setCalendarDays}
            notices={notices}
            setNotices={setNotices}
          />
        )}

        {tab === "monthly" && <MonthlySetupPage days={calendarDays} setDays={setCalendarDays} />}

        {tab === "notices" && (
          <NoticesPage
            notices={notices}
            setNotices={setNotices}
            remainingPushes={remainingPushes}
            usePush={() => setPushesUsed(v => Math.min(2, v + 1))}
          />
        )}

        {tab === "devices" && <DevicesPage devices={devices} />}

        {tab === "settings" && (
          <>
            <div className="pageHeader">
              <div><span className="eyebrow">Organization</span><h1>Settings</h1><p>Live settings for this shul.</p></div>
            </div>
            <div className="settingsGrid">
              <div className="panel"><h2>Shul Profile</h2><p>{shulName}</p><p className="helperText">ZIP {postalCode || "—"} · Connected to Supabase.</p></div>
              <div className="panel"><h2>Administrators</h2><p>Pilot access</p><p className="helperText">Proper user accounts are on the pre-launch list.</p></div>
              <div className="panel"><h2>Integrations</h2><p>MyZmanim fallback mode</p><p className="helperText">Live MyZmanim is not connected yet.</p></div>
            </div>
          </>
        )}

        {tab === "super" && <SuperAdminPage />}
      </main>
    </div>
  );
}

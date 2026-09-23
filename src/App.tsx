import { useMemo, useState } from "react";
import { CalendarDays, Bell, MonitorSmartphone, Settings, ShieldCheck, LayoutDashboard, WandSparkles } from "lucide-react";
import { organization, calendarDays as seedDays, notices as seedNotices } from "./data/mock";
import type { CalendarDay, Notice } from "./types";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import MonthlySetupPage from "./pages/MonthlySetupPage";
import NoticesPage from "./pages/NoticesPage";
import DevicesPage from "./pages/DevicesPage";
import SuperAdminPage from "./pages/SuperAdminPage";

type Tab = "dashboard" | "calendar" | "monthly" | "notices" | "devices" | "settings" | "super";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(seedDays);
  const [notices, setNotices] = useState<Notice[]>(seedNotices);
  const [pushesUsed, setPushesUsed] = useState(1);

  const remainingPushes = Math.max(0, 2 - pushesUsed);

  const nav = useMemo(() => [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["calendar", "Calendar", CalendarDays],
    ["monthly", "Monthly Setup", WandSparkles],
    ["notices", "Notices", Bell],
    ["devices", "Magnets", MonitorSmartphone],
    ["settings", "Settings", Settings]
  ] as const, []);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">M</div>
          <div><strong>Magnets</strong><span>Organization Admin</span></div>
        </div>

        <div className="orgCard">
          <div className="orgLogo">{organization.logoText}</div>
          <div><strong>{organization.shortName}</strong><small>{organization.deviceCount} magnets</small></div>
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
        {tab === "dashboard" && (
          <Dashboard
            days={calendarDays}
            notices={notices}
            remainingPushes={remainingPushes}
            onGoCalendar={() => setTab("calendar")}
            onAddNotice={() => setTab("notices")}
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

        {tab === "devices" && <DevicesPage />}

        {tab === "settings" && (
          <>
            <div className="pageHeader">
              <div><span className="eyebrow">Organization</span><h1>Settings</h1><p>Branding, users, location, integrations and display defaults.</p></div>
            </div>
            <div className="settingsGrid">
              <div className="panel"><h2>Shul Profile</h2><p>Young Israel of Example</p><p className="helperText">Logo, display name, address, timezone and contact information.</p></div>
              <div className="panel"><h2>Administrators</h2><p>3 people have access</p><p className="helperText">Invite admins or limit someone to content editing only.</p></div>
              <div className="panel"><h2>Integrations</h2><p>MyZmanim connected</p><p className="helperText">Additional integrations can be added here later.</p></div>
            </div>
          </>
        )}

        {tab === "super" && <SuperAdminPage />}
      </main>
    </div>
  );
}

import { useMemo, useState } from "react";
import { CalendarDays, Bell, MonitorSmartphone, Settings, ShieldCheck, LayoutDashboard } from "lucide-react";
import { organization, calendarDays as seedDays, notices as seedNotices } from "./data/mock";
import type { CalendarDay, Notice } from "./types";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import NoticesPage from "./pages/NoticesPage";
import DevicesPage from "./pages/DevicesPage";
import SuperAdminPage from "./pages/SuperAdminPage";

type Tab = "dashboard" | "calendar" | "notices" | "devices" | "settings" | "super";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(seedDays);
  const [notices, setNotices] = useState<Notice[]>(seedNotices);
  const [pushesUsed, setPushesUsed] = useState(1);

  const remainingPushes = Math.max(0, 2 - pushesUsed);

  const nav = useMemo(() => [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["calendar", "Calendar", CalendarDays],
    ["notices", "Notices", Bell],
    ["devices", "Magnets", MonitorSmartphone],
    ["settings", "Settings", Settings]
  ] as const, []);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">M</div>
          <div>
            <strong>Magnets</strong>
            <span>Organization Admin</span>
          </div>
        </div>

        <div className="orgCard">
          <div className="orgLogo">{organization.logoText}</div>
          <div>
            <strong>{organization.shortName}</strong>
            <small>{organization.deviceCount} magnets</small>
          </div>
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
        {tab === "calendar" && <CalendarPage days={calendarDays} setDays={setCalendarDays} />}
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
          <div className="panel">
            <h2>Settings</h2>
            <p>Branding, timezone, users, zmanim defaults, integrations, and organization preferences will live here.</p>
          </div>
        )}
        {tab === "super" && <SuperAdminPage />}
      </main>
    </div>
  );
}

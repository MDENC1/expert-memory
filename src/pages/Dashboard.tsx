import type { CalendarDay, Notice } from "../types";
import MagnetPreview from "../components/MagnetPreview";

export default function Dashboard({
  days, notices, remainingPushes, onGoCalendar, onAddNotice
}: {
  days: CalendarDay[];
  notices: Notice[];
  remainingPushes: number;
  onGoCalendar: () => void;
  onAddNotice: () => void;
}) {
  const today = days[8];

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Wednesday, September 23, 2026</span>
          <h1>Good afternoon</h1>
          <p>Here’s what your congregation’s magnets are scheduled to show next.</p>
        </div>
        <button className="primary" onClick={onAddNotice}>+ Add Notice</button>
      </div>

      <div className="statsGrid">
        <div className="stat"><span>Active magnets</span><strong>247</strong><small>243 checked in normally</small></div>
        <div className="stat"><span>Next regular update</span><strong>12:15 AM</strong><small>Tonight</small></div>
        <div className="stat"><span>Immediate updates</span><strong>{remainingPushes} / 2</strong><small>remaining today</small></div>
        <div className="stat"><span>Scheduled notices</span><strong>{notices.filter(n => n.status === "scheduled").length}</strong><small>upcoming</small></div>
      </div>

      <div className="twoCol">
        <div className="panel">
          <div className="panelHead">
            <div><span className="eyebrow">October 2026</span><h2>Monthly schedule</h2></div>
            <button className="secondary" onClick={onGoCalendar}>Open Calendar</button>
          </div>
          <div className="miniSchedule">
            <div><b>Regular weekdays</b><span>Shacharis 6:30 / 7:30 · Mincha 6:25 · Maariv 8:15</span></div>
            <div><b>Friday</b><span>Shacharis 6:30 / 7:30 · Mincha 6:15</span></div>
            <div><b>Shabbos</b><span>Shacharis 9:00 · Mincha 6:10 · Maariv 7:35</span></div>
          </div>
        </div>
        <MagnetPreview day={today} notice={notices.find(n => n.status === "live")} />
      </div>
    </>
  );
}

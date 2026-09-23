import { useState } from "react";
import type { CalendarDay } from "../types";
import { templates } from "../data/mock";

export default function CalendarPage({days,setDays}:{days:CalendarDay[];setDays:(d:CalendarDay[])=>void}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("Regular Weekday");

  const selectedCount = selected.length;
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Shabbos"];
  const blankCount = 4;

  const toggle = (date:string) => {
    setSelected(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const applyTemplate = () => {
    const tpl = templates.find(t => t.name === templateName)!;
    setDays(days.map(day => selected.includes(day.date)
      ? {...day, shacharis:tpl.shacharis, mincha:tpl.mincha, maariv:tpl.maariv, template:tpl.name}
      : day
    ));
    setSelected([]);
  };

  const selectWeekdays = () => {
    setSelected(days.filter(d => !d.isShabbos).map(d => d.date));
  };

  return (
    <>
      <div className="pageHeader">
        <div><span className="eyebrow">Schedule Manager</span><h1>October 2026</h1><p>Tishrei – Cheshvan 5787</p></div>
        <div className="headerActions">
          <button className="secondary" onClick={selectWeekdays}>Select non-Shabbos days</button>
          <button className="primary" disabled={!selectedCount} onClick={applyTemplate}>Apply Template</button>
        </div>
      </div>

      <div className="bulkBar">
        <strong>{selectedCount ? `${selectedCount} days selected` : "Select one or more days"}</strong>
        <span>Apply a schedule to a whole date range instead of editing each day.</span>
        <select value={templateName} onChange={e=>setTemplateName(e.target.value)}>
          {templates.map(t => <option key={t.name}>{t.name}</option>)}
        </select>
      </div>

      <div className="calendar">
        {weekdays.map(w => <div key={w} className="weekday">{w}</div>)}
        {Array.from({length:blankCount}).map((_,i)=><div key={`blank-${i}`} className="dayCell empty" />)}
        {days.map(day => (
          <button key={day.date} className={`dayCell ${selected.includes(day.date) ? "selected" : ""} ${day.isShabbos ? "shabbos" : ""}`} onClick={()=>toggle(day.date)}>
            <div className="dateTop"><strong>{day.englishDay}</strong><span>{day.hebrewDate} {day.hebrewMonth}</span></div>
            <span className="templateTag">{day.template}</span>
            <div className="times">
              <span>Shach. {day.shacharis}</span>
              <span>Min. {day.mincha}</span>
              <span>Maariv {day.maariv}</span>
            </div>
            {day.event && <div className="eventTag">{day.event}</div>}
          </button>
        ))}
      </div>
    </>
  );
}

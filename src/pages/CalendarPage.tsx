import { useMemo, useState } from "react";
import type { CalendarDay } from "../types";
import { jewishMonthTemplates, templates } from "../data/mock";

type SpecialValues = Record<string,string>;

export default function CalendarPage({days,setDays}:{days:CalendarDay[];setDays:(d:CalendarDay[])=>void}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("Regular Weekday");
  const [setupMonth, setSetupMonth] = useState("Tishrei");
  const [specialValues, setSpecialValues] = useState<SpecialValues>({
    shofar: "10:30",
    yk_yizkor: "11:15",
    yk_neilah: "17:45",
    hakafos_night: "19:45",
    hakafos_day: "10:45",
    hoshana_rabbah: "06:30",
    shemini_yizkor: "10:45",
    sukkos_shacharis: "09:00",
    selichos: "06:00",
    rh_shacharis: "08:00",
    yk_kol_nidrei: "18:25",
    yk_shacharis: "08:30"
  });

  const selectedCount = selected.length;
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Shabbos"];
  const blankCount = 4;
  const monthTemplate = useMemo(
    () => jewishMonthTemplates.find(m => m.month === setupMonth) ?? jewishMonthTemplates[0],
    [setupMonth]
  );

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

  const toDisplayTime = (value:string) => {\n    const [h,m] = value.split(":").map(Number);\n    if (!Number.isFinite(h) || !Number.isFinite(m)) return value;\n    const suffix = h >= 12 ? "PM" : "AM";\n    const hour = h % 12 || 12;\n    return `${hour}:${String(m).padStart(2,"0")} ${suffix}`;\n  };\n\n  const saveMonthlySetup = () => {
    setDays(days.map(day => {
      const generatedKeys = new Set(["hoshana_rabbah","shemini_yizkor","hakafos_day"]);\n      const specialTimes = (day.specialTimes ?? []).filter(item => !generatedKeys.has(item.key));

      if (day.holiday === "Hoshana Rabbah" && specialValues.hoshana_rabbah) {
        specialTimes.push({key:"hoshana_rabbah",label:"Hoshana Rabbah Shacharis",time:toDisplayTime(specialValues.hoshana_rabbah),importance:"prominent"});
      }
      if (day.holiday === "Shemini Atzeres" && specialValues.shemini_yizkor) {
        specialTimes.push({key:"shemini_yizkor",label:"Yizkor",time:toDisplayTime(specialValues.shemini_yizkor),importance:"prominent"});
      }
      if (day.holiday === "Simchas Torah" && specialValues.hakafos_day) {
        specialTimes.push({key:"hakafos_day",label:"Hakafos",time:toDisplayTime(specialValues.hakafos_day),importance:"prominent"});
      }

      return {...day, specialTimes};
    }));
  };

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Schedule Manager</span>
          <h1>October 2026</h1>
          <p>Tishrei – Cheshvan 5787 · Jewish dates and Rosh Chodesh are automatic.</p>
        </div>
        <div className="headerActions">
          <button className="secondary" onClick={selectWeekdays}>Select non-Shabbos days</button>
          <button className="primary" disabled={!selectedCount} onClick={applyTemplate}>Apply Template</button>
        </div>
      </div>

      <div className="monthlySetup panel">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Monthly guided setup</span>
            <h2>Set special times once</h2>
            <p className="helperText">The portal knows the Jewish dates. Enter the shul's times once and it places them on the correct Jewish dates automatically, even when a Jewish month spans two Gregorian months.</p>
          </div>
          <select value={setupMonth} onChange={e=>setSetupMonth(e.target.value)}>
            {jewishMonthTemplates.map(m => <option key={m.month}>{m.month}</option>)}
          </select>
        </div>

        {monthTemplate.specialItems.length ? (
          <>
            <div className="specialSetupGrid">
              {monthTemplate.specialItems.map(item => (
                <label key={item.key} className="specialSetupField">
                  <span>{item.label}</span>
                  <small>{item.appliesTo}</small>
                  <input
                    type="time"
                    value={specialValues[item.key] && /^\d{2}:\d{2}$/.test(specialValues[item.key]) ? specialValues[item.key] : ""}
                    onChange={e=>setSpecialValues(v=>({...v,[item.key]:e.target.value}))}
                  />
                  {item.helpText && <small>{item.helpText}</small>}
                </label>
              ))}
            </div>
            <div className="monthlySetupActions">
              <span>Only the relevant Jewish dates receive each item.</span>
              <button className="primary" onClick={saveMonthlySetup}>Save {setupMonth} Special Times</button>
            </div>
          </>
        ) : (
          <div className="emptyMonthSetup">
            No standard special-time fields are required for {setupMonth}. The shul can still add notices or custom events.
          </div>
        )}
      </div>

      <div className="bulkBar">
        <strong>{selectedCount ? `${selectedCount} days selected` : "Optional manual editing"}</strong>
        <span>Use this for exceptions. Normal Jewish-calendar events should not require manual date selection.</span>
        <select value={templateName} onChange={e=>setTemplateName(e.target.value)}>
          {templates.map(t => <option key={t.name}>{t.name}</option>)}
        </select>
      </div>

      <div className="calendar">
        {weekdays.map(w => <div key={w} className="weekday">{w}</div>)}
        {Array.from({length:blankCount}).map((_,i)=><div key={`blank-${i}`} className="dayCell empty" />)}
        {days.map(day => (
          <button
            key={day.date}
            className={`dayCell ${selected.includes(day.date) ? "selected" : ""} ${day.isShabbos ? "shabbos" : ""} ${day.isRoshChodesh ? "roshChodesh" : ""}`}
            onClick={()=>toggle(day.date)}
          >
            <div className="dateTop">
              <strong>{day.englishDay}</strong>
              <span>{day.hebrewDate} {day.hebrewMonth}</span>
            </div>

            <div className="dayTags">
              {day.isRoshChodesh && <span className="jewishTag">Rosh Chodesh</span>}
              {day.holiday && <span className="jewishTag">{day.holiday}</span>}
              {!day.holiday && <span className="templateTag">{day.template}</span>}
            </div>

            <div className="times">
              <span>Shach. {day.shacharis}</span>
              <span>Min. {day.mincha}</span>
              <span>Maariv {day.maariv}</span>
            </div>

            {day.specialTimes?.map(item => (
              <div className="keyCalendarTime" key={item.key}>
                <b>{item.label}</b>
                <strong>{item.time}</strong>
              </div>
            ))}

            {day.event && <div className="eventTag">{day.event}</div>}
          </button>
        ))}
      </div>
    </>
  );
}

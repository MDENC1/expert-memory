import { useMemo, useState } from "react";
import type { CalendarDay } from "../types";
import { jewishMonthTemplates, templates } from "../data/mock";

type SpecialValues = Record<string,string>;
type FastEndRule = 42 | 60 | 72;

export default function CalendarPage({days,setDays}:{days:CalendarDay[];setDays:(d:CalendarDay[])=>void}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("Regular Weekday");
  const [setupMonth, setSetupMonth] = useState("Tishrei");
  const [postalCode, setPostalCode] = useState("44124");
  const [fastEndRule, setFastEndRule] = useState<FastEndRule>(42);
  const [savedZmanim, setSavedZmanim] = useState(true);
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

  const toDisplayTime = (value:string) => {
    const [h,m] = value.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2,"0")} ${suffix}`;
  };

  const saveZmanimSettings = () => {
    setSavedZmanim(true);
  };

  const saveMonthlySetup = () => {
    setDays(days.map(day => {
      const generatedKeys = new Set(["hoshana_rabbah","shemini_yizkor","hakafos_day"]);
      const specialTimes = (day.specialTimes ?? []).filter(item => !generatedKeys.has(item.key));

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

      <div className="panel zmanimSettings">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Automatic zmanim</span>
            <h2>MyZmanim Settings</h2>
            <p className="helperText">
              Candle lighting, Shabbos/Yom Tov ending, fast-day start and fast-day end times are generated automatically for this location.
            </p>
          </div>
          <span className="sourceBadge">Source: MyZmanim</span>
        </div>

        <div className="zmanimSettingsGrid">
          <label>
            <span>Shul ZIP code</span>
            <input
              value={postalCode}
              inputMode="numeric"
              maxLength={5}
              onChange={e => {
                setPostalCode(e.target.value.replace(/\D/g,"").slice(0,5));
                setSavedZmanim(false);
              }}
            />
            <small>Admin only · never shown on the magnet</small>
          </label>

          <label>
            <span>Fast begins</span>
            <div className="readOnlySetting">MyZmanim Alos / dawn</div>
            <small>Calculated separately for every fast date.</small>
          </label>

          <label>
            <span>Fast ends</span>
            <select
              value={fastEndRule}
              onChange={e => {
                setFastEndRule(Number(e.target.value) as FastEndRule);
                setSavedZmanim(false);
              }}
            >
              <option value={42}>42 minutes after sunset</option>
              <option value={60}>60 minutes after sunset</option>
              <option value={72}>72 minutes after sunset</option>
            </select>
            <small>Uses MyZmanim sunset + your shul's selected rule.</small>
          </label>

          <div className="zmanimSave">
            <strong>Annual auto-population</strong>
            <span>
              Save once and all applicable fast days in the Jewish year are recalculated. Individual dates can still be overridden.
            </span>
            <button className="primary" onClick={saveZmanimSettings}>
              {savedZmanim ? "Settings Saved" : "Save & Recalculate Year"}
            </button>
          </div>
        </div>

        <div className="sourceLine">
          <strong>MyZmanim</strong>
          <span>ZIP {postalCode || "—"}</span>
          <span>Fast end rule: {fastEndRule} minutes after sunset</span>
          <span>Manual overrides allowed per date</span>
        </div>
      </div>

      <div className="monthlySetup panel">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Monthly guided setup</span>
            <h2>Set special shul times once</h2>
            <p className="helperText">
              The portal knows the Jewish dates. Enter only the shul-specific times; zmanim-derived items stay automatic.
            </p>
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
            No standard shul-entered special times are required for {setupMonth}. Automatic zmanim still populate normally.
          </div>
        )}
      </div>

      <div className="bulkBar">
        <strong>{selectedCount ? `${selectedCount} days selected` : "Optional manual editing"}</strong>
        <span>Use this for exceptions. Automatic Jewish-calendar events and zmanim do not require date selection.</span>
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
              <span><b>Shach.</b> {day.shacharis}</span>
              <span><b>Min.</b> {day.mincha}</span>
              <span><b>Maariv</b> {day.maariv}</span>
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

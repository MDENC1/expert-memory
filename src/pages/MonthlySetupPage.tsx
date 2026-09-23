import { useMemo, useState } from "react";
import type { CalendarDay } from "../types";
import { jewishMonthTemplates } from "../data/mock";

type SpecialValues = Record<string,string>;
type FastEndRule = 42 | 60 | 72;

export default function MonthlySetupPage({days,setDays}:{days:CalendarDay[];setDays:(d:CalendarDay[])=>void}) {
  const [month,setMonth] = useState("Tishrei");
  const [postalCode,setPostalCode] = useState("44124");
  const [fastEndRule,setFastEndRule] = useState<FastEndRule>(42);
  const [status,setStatus] = useState("MyZmanim settings are current.");
  const [values,setValues] = useState<SpecialValues>({
    selichos:"06:00",
    rh_shacharis:"08:00",
    shofar:"10:30",
    yk_kol_nidrei:"18:25",
    yk_shacharis:"08:30",
    yk_yizkor:"11:15",
    yk_neilah:"17:45",
    sukkos_shacharis:"09:00",
    hoshana_rabbah:"06:30",
    shemini_yizkor:"10:45",
    hakafos_night:"19:45",
    hakafos_day:"10:45"
  });

  const template = useMemo(
    () => jewishMonthTemplates.find(item => item.month === month) ?? jewishMonthTemplates[0],
    [month]
  );

  const displayTime = (value:string) => {
    const [h,m] = value.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  const saveMonth = () => {
    setDays(days.map(day => {
      const generatedKeys = new Set(["hoshana_rabbah","shemini_yizkor","hakafos_day"]);
      const specialTimes = (day.specialTimes ?? []).filter(item => !generatedKeys.has(item.key));

      if (month === "Tishrei") {
        if (day.holiday === "Hoshana Rabbah" && values.hoshana_rabbah) {
          specialTimes.push({key:"hoshana_rabbah",label:"Hoshana Rabbah Shacharis",time:displayTime(values.hoshana_rabbah),importance:"prominent"});
        }
        if (day.holiday === "Shemini Atzeres" && values.shemini_yizkor) {
          specialTimes.push({key:"shemini_yizkor",label:"Yizkor",time:displayTime(values.shemini_yizkor),importance:"prominent"});
        }
        if (day.holiday === "Simchas Torah" && values.hakafos_day) {
          specialTimes.push({key:"hakafos_day",label:"Hakafos",time:displayTime(values.hakafos_day),importance:"prominent"});
        }
      }
      return {...day,specialTimes};
    }));
    setStatus(`${month} special times saved and applied to the correct Jewish dates.`);
  };

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Guided setup</span>
          <h1>Monthly Setup</h1>
          <p>Enter the shul's special times once. The calendar handles the dates.</p>
        </div>
      </div>

      <div className="panel zmanimSettings">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Automatic zmanim</span>
            <h2>MyZmanim</h2>
            <p className="helperText">These settings populate candle lighting, Shabbos/Yom Tov ending and fast-day times throughout the year.</p>
          </div>
          <span className="sourceBadge">Connected</span>
        </div>

        <div className="zmanimSettingsGrid">
          <label>
            <span>ZIP code</span>
            <input value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,"").slice(0,5))} />
            <small>Shown only to admins.</small>
          </label>

          <label>
            <span>Fast begins</span>
            <div className="readOnlySetting">MyZmanim Alos / dawn</div>
            <small>Automatically calculated by date.</small>
          </label>

          <label>
            <span>Fast ends</span>
            <select value={fastEndRule} onChange={e=>setFastEndRule(Number(e.target.value) as FastEndRule)}>
              <option value={42}>42 minutes after sunset</option>
              <option value={60}>60 minutes after sunset</option>
              <option value={72}>72 minutes after sunset</option>
            </select>
            <small>Uses MyZmanim sunset plus the shul rule.</small>
          </label>

          <div className="zmanimSave">
            <strong>Yearly rule</strong>
            <span>Individual dates can still be overridden later.</span>
            <button className="primary" onClick={()=>setStatus(`MyZmanim updated for ZIP ${postalCode} using the ${fastEndRule}-minute rule.`)}>Save MyZmanim Settings</button>
          </div>
        </div>

        <div className="sourceLine">
          <strong>Times from MyZmanim</strong>
          <span>ZIP {postalCode || "—"}</span>
          <span>{fastEndRule}-minute fast-end rule</span>
        </div>
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Jewish month</span>
            <h2>{month} Special Times</h2>
            <p className="helperText">Only fields that are likely to matter for this month are shown.</p>
          </div>
          <select value={month} onChange={e=>setMonth(e.target.value)}>
            {jewishMonthTemplates.map(item=><option key={item.month}>{item.month}</option>)}
          </select>
        </div>

        {template.specialItems.length ? (
          <div className="specialSetupGrid">
            {template.specialItems.map(item=>(
              <label key={item.key} className="specialSetupField">
                <span>{item.label}</span>
                <small>{item.appliesTo}</small>
                <input type="time" value={values[item.key] || ""} onChange={e=>setValues(v=>({...v,[item.key]:e.target.value}))} />
                {item.helpText && <small>{item.helpText}</small>}
              </label>
            ))}
          </div>
        ) : (
          <div className="emptyMonthSetup">No standard shul-entered special times are needed for {month}.</div>
        )}

        <div className="monthlySetupActions">
          <span>{status}</span>
          <button className="primary" onClick={saveMonth}>Save & Auto-Populate {month}</button>
        </div>
      </div>
    </>
  );
}

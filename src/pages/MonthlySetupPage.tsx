import { useMemo, useState } from "react";
import type { CalendarDay } from "../types";
import { jewishMonthTemplates } from "../data/mock";

type SpecialValues = Record<string,string>;
type FastEndRule = 42 | 60 | 72;
type FastOverride = {start?:string;end?:string};

const fastDays = [
  {key:"gedalia",name:"Tzom Gedalia",startSource:"MyZmanim Alos",autoStart:"5:34 AM",sunsetMinutes:19*60+1},
  {key:"yom_kippur",name:"Yom Kippur",startSource:"MyZmanim sunset / candle-lighting",autoStart:"6:43 PM",sunsetMinutes:18*60+58},
  {key:"teves",name:"Asarah B'Teves",startSource:"MyZmanim Alos",autoStart:"6:12 AM",sunsetMinutes:17*60+7},
  {key:"esther",name:"Taanis Esther",startSource:"MyZmanim Alos",autoStart:"5:31 AM",sunsetMinutes:18*60+39},
  {key:"tammuz",name:"17 Tammuz",startSource:"MyZmanim Alos",autoStart:"4:31 AM",sunsetMinutes:20*60+51},
  {key:"tisha_bav",name:"Tisha B'Av",startSource:"MyZmanim sunset",autoStart:"8:48 PM",sunsetMinutes:20*60+45}
];

function formatMinutes(total:number) {
  const normalized=((total%1440)+1440)%1440;
  const h24=Math.floor(normalized/60);
  const minute=normalized%60;
  const suffix=h24>=12?"PM":"AM";
  return `${h24%12 || 12}:${String(minute).padStart(2,"0")} ${suffix}`;
}

export default function MonthlySetupPage({days,setDays}:{days:CalendarDay[];setDays:(d:CalendarDay[])=>void}) {
  const [month,setMonth] = useState("Tishrei");
  const [postalCode,setPostalCode] = useState("44124");
  const [fastEndRule,setFastEndRule] = useState<FastEndRule>(42);
  const [status,setStatus] = useState("MyZmanim settings are current.");
  const [fastOverrides,setFastOverrides] = useState<Record<string,FastOverride>>({});
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

  const setFastOverride=(key:string,field:"start"|"end",value:string)=>{
    setFastOverrides(v=>({...v,[key]:{...v[key],[field]:value}}));
  };

  const saveAndRecalculate=()=>{
    setStatus(`MyZmanim recalculated for ZIP ${postalCode}. All automatic fast-end times now use ${fastEndRule} minutes after sunset; manual overrides were preserved.`);
  };

  return (
    <>
      <div className="pageHeader">
        <div>
          <span className="eyebrow">Guided setup</span>
          <h1>Monthly Setup</h1>
          <p>Set shul-specific times and annual zmanim rules once. The calendar handles the dates.</p>
        </div>
      </div>

      <div className="panel zmanimSettings">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Automatic zmanim</span>
            <h2>MyZmanim</h2>
            <p className="helperText">Candle lighting, Shabbos/Yom Tov endings and fast-day times are generated from MyZmanim for the shul's location.</p>
          </div>
          <span className="sourceBadge">Connected</span>
        </div>

        <div className="zmanimSettingsGrid">
          <label>
            <span>ZIP code</span>
            <input value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,"").slice(0,5))} />
            <small>Admin only · never shown on the magnet.</small>
          </label>

          <label>
            <span>Minor fast begins</span>
            <div className="readOnlySetting">MyZmanim Alos / dawn</div>
            <small>Calculated separately for each fast date.</small>
          </label>

          <label>
            <span>Default fast-end rule</span>
            <select value={fastEndRule} onChange={e=>setFastEndRule(Number(e.target.value) as FastEndRule)}>
              <option value={42}>42 minutes after sunset</option>
              <option value={60}>60 minutes after sunset</option>
              <option value={72}>72 minutes after sunset</option>
            </select>
            <small>Changing this immediately recalculates all automatic fast-end times below.</small>
          </label>

          <div className="zmanimSave">
            <strong>Yearly default</strong>
            <span>Save the rule for the Jewish year while preserving individual overrides.</span>
            <button className="primary" onClick={saveAndRecalculate}>Save & Recalculate Year</button>
          </div>
        </div>

        <div className="sourceLine">
          <strong>Times from MyZmanim</strong>
          <span>ZIP {postalCode || "—"}</span>
          <span>{fastEndRule}-minute default fast-end rule</span>
          <span>Manual overrides allowed</span>
        </div>
      </div>

      <div className="panel fastDaysPanel">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Fast days</span>
            <h2>Fast Start & End Times</h2>
            <p className="helperText">Automatic times below recalculate from the selected MyZmanim rule. Override any individual fast without affecting the rest.</p>
          </div>
        </div>

        <div className="fastDayList">
          {fastDays.map(fast=>{
            const override=fastOverrides[fast.key] ?? {};
            const automaticEnd=formatMinutes(fast.sunsetMinutes+fastEndRule);
            return (
              <div className="fastDayRow" key={fast.key}>
                <div className="fastName">
                  <strong>{fast.name}</strong>
                  <small>{fast.startSource} · ZIP {postalCode}</small>
                </div>

                <label>
                  <span>Fast begins</span>
                  <div className="generatedTime">
                    {override.start ? displayTime(override.start) : fast.autoStart}
                    <small>{override.start ? "Manual override" : "MyZmanim generated"}</small>
                  </div>
                  <input type="time" value={override.start || ""} onChange={e=>setFastOverride(fast.key,"start",e.target.value)} aria-label={`Override ${fast.name} start`} />
                </label>

                <label>
                  <span>Fast ends</span>
                  <div className="generatedTime">
                    {override.end ? displayTime(override.end) : automaticEnd}
                    <small>{override.end ? "Manual override" : `MyZmanim sunset + ${fastEndRule} min`}</small>
                  </div>
                  <input type="time" value={override.end || ""} onChange={e=>setFastOverride(fast.key,"end",e.target.value)} aria-label={`Override ${fast.name} end`} />
                </label>

                <button className="secondary" onClick={()=>setFastOverrides(v=>{const next={...v};delete next[fast.key];return next;})}>Use Automatic</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <span className="eyebrow">Jewish month</span>
            <h2>{month} Special Times</h2>
            <p className="helperText">Only fields likely to matter for this month are shown. Zmanim-generated fields remain automatic unless overridden above.</p>
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

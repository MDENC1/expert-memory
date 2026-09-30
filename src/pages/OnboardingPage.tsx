import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Props = {
  onCancel: () => void;
  onComplete: (shulId:string) => void;
};

const pad=(n:number)=>String(n).padStart(2,"0");

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

function fixedRow(day:number,label:string,time:string,sort=10){
  return {
    day_of_week:day,service_type:label.includes("Mincha")?"Mincha":label.includes("Maariv")?"Maariv":"Shacharis",
    service_time:time,timing_source:"fixed",timing_offset_minutes:0,display_name:label,
    sort_order:sort,active:true,use_weekly_earliest:false
  };
}

function ruleRow(day:number,label:string,source:"plag"|"sunset",offset:number,sort:number,weekly:boolean,group:string,follows?:string){
  return {
    day_of_week:day,service_type:label.includes("Maariv")&& !label.includes("Mincha")?"Maariv":"Mincha",
    service_time:"",timing_source:source,timing_offset_minutes:offset,display_name:label,
    sort_order:sort,active:true,round_to_minutes:5,round_direction:"down",
    use_weekly_earliest:weekly,weekly_group:group,follows_text:follows||""
  };
}

export default function OnboardingPage({onCancel,onComplete}:Props){
  const [step,setStep]=useState<1|2>(1);
  const [authMode,setAuthMode]=useState<"signup"|"signin">("signup");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [accountStatus,setAccountStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const [name,setName]=useState("");
  const [zip,setZip]=useState("");
  const [sundayShacharis,setSundayShacharis]=useState("9:30 AM");
  const [weekdayShacharis,setWeekdayShacharis]=useState("6:45 AM");
  const [shabbosShacharis,setShabbosShacharis]=useState("9:00 AM");
  const [shabbosEarlyMincha,setShabbosEarlyMincha]=useState("2:15 PM");
  const [earlyOffset,setEarlyOffset]=useState(10);
  const [lateOffset,setLateOffset]=useState(10);
  const [fridayOffset,setFridayOffset]=useState(10);
  const [shabbosLateOffset,setShabbosLateOffset]=useState(10);
  const [shabbosEndMinutes,setShabbosEndMinutes]=useState(60);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      if(data.session){
        setAccountStatus(data.session.user.email||"Signed in");
        setStep(2);
      }
    });
  },[]);

  const parsedTimes=useMemo(()=>({
    sunday:parseFriendlyTime(sundayShacharis),
    weekday:parseFriendlyTime(weekdayShacharis),
    shabbos:parseFriendlyTime(shabbosShacharis),
    shabbosEarly:parseFriendlyTime(shabbosEarlyMincha)
  }),[sundayShacharis,weekdayShacharis,shabbosShacharis,shabbosEarlyMincha]);

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
      setAccountStatus("Account created. Confirm the email if Supabase asks you to, then return here and sign in.");
      setAuthMode("signin");
      setBusy(false);return;
    }

    setAccountStatus(session.user.email||email.trim());
    setStep(2);
    setBusy(false);
  };

  const createShul=async()=>{
    setError("");
    if(!name.trim()){setError("Enter the shul name.");return;}
    if(!/^\d{5}$/.test(zip)){setError("Enter a 5-digit ZIP code.");return;}
    if(Object.values(parsedTimes).some(v=>!v)){setError("One of the fixed davening times is not valid.");return;}

    setBusy(true);
    const rows:any[]=[];

    rows.push(fixedRow(0,"Shacharis",parsedTimes.sunday,10));
    rows.push(ruleRow(0,"Early Mincha / Maariv","plag",-earlyOffset,20,true,"early_mincha","Maariv follows"));
    rows.push(ruleRow(0,"Late Mincha / Maariv","sunset",-lateOffset,30,true,"late_mincha","Maariv follows"));

    for(let day=1;day<=4;day++){
      rows.push(fixedRow(day,"Shacharis",parsedTimes.weekday,10));
      rows.push(ruleRow(day,"Early Mincha / Maariv","plag",-earlyOffset,20,true,"early_mincha","Maariv follows"));
      rows.push(ruleRow(day,"Late Mincha / Maariv","sunset",-lateOffset,30,true,"late_mincha","Maariv follows"));
    }

    rows.push(fixedRow(5,"Shacharis",parsedTimes.weekday,10));
    rows.push(ruleRow(5,"Mincha / Maariv","sunset",-fridayOffset,20,false,"friday_mincha","Maariv follows"));

    rows.push(fixedRow(6,"Shacharis",parsedTimes.shabbos,10));
    rows.push(fixedRow(6,"Early Mincha",parsedTimes.shabbosEarly,20));
    rows.push(ruleRow(6,"Late Mincha","sunset",-shabbosLateOffset,30,false,"shabbos_late_mincha"));
    rows.push({
      day_of_week:6,service_type:"Maariv",service_time:"",timing_source:"sunset",
      timing_offset_minutes:shabbosEndMinutes,display_name:"Maariv",sort_order:40,active:true,
      use_weekly_earliest:false,weekly_group:"shabbos_maariv",follows_text:"After Shabbos"
    });

    const {data,error:rpcError}=await supabase.rpc("create_shul_onboarding",{
      p_name:name.trim(),
      p_postal_code:zip,
      p_timezone:"America/New_York",
      p_shabbos_end_minutes:shabbosEndMinutes,
      p_schedule_rows:rows
    });

    if(rpcError){
      setError(rpcError.message);
      setBusy(false);return;
    }

    const shulId=String(data||"");
    if(!shulId){
      setError("The shul was created but no shul ID was returned.");
      setBusy(false);return;
    }

    localStorage.setItem("magnets.currentShulId",shulId);
    setBusy(false);
    onComplete(shulId);
  };

  const timeField=(label:string,value:string,setValue:(v:string)=>void,help?:string)=>(
    <label className="onboardField">
      <span>{label}</span>
      <input
        value={value}
        onFocus={e=>e.currentTarget.select()}
        onChange={e=>setValue(e.target.value)}
        onBlur={e=>setValue(normalizeFriendlyTime(e.currentTarget.value))}
        placeholder="6:45 AM"
      />
      {help&&<small>{help}</small>}
    </label>
  );

  return (
    <div className="onboardingPage">
      <div className="onboardingTop">
        <button className="secondary" onClick={onCancel}><ArrowLeft size={16}/> Back</button>
        <div>
          <span className="eyebrow">New shul onboarding</span>
          <h1>Get to a live dashboard in under 5 minutes</h1>
          <p>Two short steps: create your admin login, then confirm the shul's standard schedule.</p>
        </div>
        <div className="onboardingProgress">
          <span className={step>=1?"done":""}>1 Account</span>
          <span className={step>=2?"done":""}>2 Shul & Schedule</span>
        </div>
      </div>

      {step===1 ? (
        <div className="panel onboardingCard">
          <div className="panelHead">
            <div>
              <span className="eyebrow">Step 1 of 2 · target: under 1 minute</span>
              <h2>{authMode==="signup"?"Create your admin account":"Sign in to your admin account"}</h2>
              <p className="helperText">
                {authMode==="signup"
                  ?"Use the email you'll use to manage this shul. That's all we need for the account."
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
                <small>{authMode==="signup"?"At least 6 characters. You can press Enter to continue.":"Press Enter to continue."}</small>
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
        <div className="panel onboardingCard">
          <div className="panelHead">
            <div>
              <span className="eyebrow">Step 2 of 2</span>
              <h2>Shul & Standard Schedule</h2>
              <p className="helperText">These become the automatic weekly rules. Individual dates can still be overridden later in Calendar.</p>
            </div>
            {accountStatus&&<span className="sourceBadge"><CheckCircle2 size={14}/> {accountStatus}</span>}
          </div>

          <div className="onboardSection">
            <h3>Shul basics</h3>
            <div className="onboardGrid two">
              <label className="onboardField"><span>Shul name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Example Shul"/></label>
              <label className="onboardField"><span>ZIP code</span><input value={zip} inputMode="numeric" onChange={e=>setZip(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="44118"/><small>Used for automatic zmanim.</small></label>
            </div>
          </div>

          <div className="onboardSection">
            <h3>Fixed davening times</h3>
            <div className="onboardGrid four">
              {timeField("Sunday Shacharis",sundayShacharis,setSundayShacharis)}
              {timeField("Mon–Fri Shacharis",weekdayShacharis,setWeekdayShacharis)}
              {timeField("Shabbos Shacharis",shabbosShacharis,setShabbosShacharis)}
              {timeField("Shabbos Early Mincha",shabbosEarlyMincha,setShabbosEarlyMincha)}
            </div>
          </div>

          <div className="onboardSection">
            <h3>Automatic weekly rules</h3>
            <div className="onboardRuleGrid">
              <label><span>Sun–Thu Early Mincha</span><div><b>Plag minus</b><input type="number" min="0" max="120" value={earlyOffset} onChange={e=>setEarlyOffset(Number(e.target.value))}/><b>min</b></div><small>Same time for the whole week · round earlier to 5 min.</small></label>
              <label><span>Sun–Thu Late Mincha</span><div><b>Sunset minus</b><input type="number" min="0" max="120" value={lateOffset} onChange={e=>setLateOffset(Number(e.target.value))}/><b>min</b></div><small>Same time for the whole week · round earlier to 5 min.</small></label>
              <label><span>Friday Mincha</span><div><b>Sunset minus</b><input type="number" min="0" max="120" value={fridayOffset} onChange={e=>setFridayOffset(Number(e.target.value))}/><b>min</b></div><small>Calculated for that Friday.</small></label>
              <label><span>Shabbos Late Mincha</span><div><b>Sunset minus</b><input type="number" min="0" max="120" value={shabbosLateOffset} onChange={e=>setShabbosLateOffset(Number(e.target.value))}/><b>min</b></div><small>Calculated for that Shabbos.</small></label>
              <label><span>Shabbos/Yom Tov end threshold</span><div><b>Sunset plus</b><input type="number" min="1" max="180" value={shabbosEndMinutes} onChange={e=>setShabbosEndMinutes(Number(e.target.value))}/><b>min</b></div><small>Used for Shabbos Ends and after-nightfall Yom Tov transitions.</small></label>
            </div>
          </div>

          {error&&<div className="onboardError">{error}</div>}
          <div className="onboardActions">
            <button className="secondary" onClick={()=>setStep(1)}>Back to Account</button>
            <button className="primary onboardingFinish" disabled={busy} onClick={createShul}>{busy?"Creating shul...":"Create Shul & Open Dashboard"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type Props = {
  onCancel: () => void;
  onComplete: (shulId:string) => void;
};

type Service = "Shacharis" | "Mincha" | "Maariv";
type RuleMode = "fixed" | "zman" | "follows";
type ZmanSource = "plag" | "sunset";

type MinyanRule = {
  id:string;
  service:Service;
  name:string;
  days:number[];
  mode:RuleMode;
  fixedTime:string;
  source:ZmanSource;
  offset:number;
  direction:"before"|"after";
  roundToFive:boolean;
  sameTimeAcrossDays:boolean;
  followsText:string;
};

const DAYS=[
  {value:0,label:"Sun",full:"Sunday"},
  {value:1,label:"Mon",full:"Monday"},
  {value:2,label:"Tue",full:"Tuesday"},
  {value:3,label:"Wed",full:"Wednesday"},
  {value:4,label:"Thu",full:"Thursday"},
  {value:5,label:"Fri",full:"Friday"},
  {value:6,label:"Shabbos",full:"Shabbos"}
] as const;

const SERVICES:Service[]=["Shacharis","Mincha","Maariv"];
const pad=(n:number)=>String(n).padStart(2,"0");
const newId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

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

const initialRules:MinyanRule[]=[
  {
    id:"weekday-shacharis",service:"Shacharis",name:"Weekday Shacharis",days:[1,2,3,4,5],
    mode:"fixed",fixedTime:"6:45 AM",source:"sunset",offset:0,direction:"before",
    roundToFive:false,sameTimeAcrossDays:false,followsText:""
  },
  {
    id:"sunday-shacharis",service:"Shacharis",name:"Sunday Shacharis",days:[0],
    mode:"fixed",fixedTime:"9:30 AM",source:"sunset",offset:0,direction:"before",
    roundToFive:false,sameTimeAcrossDays:false,followsText:""
  },
  {
    id:"shabbos-shacharis",service:"Shacharis",name:"Shabbos Shacharis",days:[6],
    mode:"fixed",fixedTime:"9:00 AM",source:"sunset",offset:0,direction:"before",
    roundToFive:false,sameTimeAcrossDays:false,followsText:""
  },
  {
    id:"early-mincha",service:"Mincha",name:"Early Mincha",days:[0,1,2,3,4],
    mode:"zman",fixedTime:"",source:"plag",offset:10,direction:"before",
    roundToFive:true,sameTimeAcrossDays:true,followsText:""
  },
  {
    id:"late-mincha",service:"Mincha",name:"Late Mincha",days:[0,1,2,3,4],
    mode:"zman",fixedTime:"",source:"sunset",offset:10,direction:"before",
    roundToFive:true,sameTimeAcrossDays:true,followsText:""
  },
  {
    id:"friday-mincha",service:"Mincha",name:"Friday Mincha",days:[5],
    mode:"zman",fixedTime:"",source:"sunset",offset:10,direction:"before",
    roundToFive:true,sameTimeAcrossDays:false,followsText:""
  },
  {
    id:"shabbos-early-mincha",service:"Mincha",name:"Shabbos Early Mincha",days:[6],
    mode:"fixed",fixedTime:"2:15 PM",source:"sunset",offset:0,direction:"before",
    roundToFive:false,sameTimeAcrossDays:false,followsText:""
  },
  {
    id:"shabbos-late-mincha",service:"Mincha",name:"Shabbos Late Mincha",days:[6],
    mode:"zman",fixedTime:"",source:"sunset",offset:10,direction:"before",
    roundToFive:true,sameTimeAcrossDays:false,followsText:""
  },
  {
    id:"weekday-maariv",service:"Maariv",name:"Weekday Maariv",days:[0,1,2,3,4,5],
    mode:"follows",fixedTime:"",source:"sunset",offset:0,direction:"after",
    roundToFive:false,sameTimeAcrossDays:false,followsText:"Follows Mincha"
  },
  {
    id:"shabbos-maariv",service:"Maariv",name:"Shabbos Maariv",days:[6],
    mode:"zman",fixedTime:"",source:"sunset",offset:60,direction:"after",
    roundToFive:false,sameTimeAcrossDays:false,followsText:""
  }
];

function defaultNewRule(service:Service,index:number):MinyanRule{
  if(service==="Shacharis"){
    return {
      id:newId(),service,name:`Shacharis Minyan ${index}`,days:[],
      mode:"fixed",fixedTime:"7:00 AM",source:"sunset",offset:0,direction:"before",
      roundToFive:false,sameTimeAcrossDays:false,followsText:""
    };
  }
  if(service==="Mincha"){
    return {
      id:newId(),service,name:`Mincha Minyan ${index}`,days:[],
      mode:"zman",fixedTime:"",source:"sunset",offset:10,direction:"before",
      roundToFive:true,sameTimeAcrossDays:false,followsText:""
    };
  }
  return {
    id:newId(),service,name:`Maariv Minyan ${index}`,days:[],
    mode:"follows",fixedTime:"",source:"sunset",offset:0,direction:"after",
    roundToFive:false,sameTimeAcrossDays:false,followsText:"Follows Mincha"
  };
}

function sourceLabel(source:ZmanSource){
  return source==="plag" ? "Plag" : "Sunset (Shkia)";
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
  const [shabbosEndMinutes,setShabbosEndMinutes]=useState(60);
  const [rules,setRules]=useState<MinyanRule[]>(initialRules);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      if(data.session){
        setAccountStatus(data.session.user.email||"Signed in");
        setStep(2);
      }
    });
  },[]);

  const coverage=useMemo(()=>{
    const matrix=DAYS.map(day=>({
      day:day.value,
      label:day.full,
      covered:Object.fromEntries(SERVICES.map(service=>[
        service,
        rules.some(rule=>rule.service===service&&rule.days.includes(day.value))
      ])) as Record<Service,boolean>
    }));
    const count=matrix.reduce((sum,row)=>sum+SERVICES.filter(service=>row.covered[service]).length,0);
    return {matrix,count,complete:count===21};
  },[rules]);

  const invalidFixedRule=rules.find(rule=>rule.mode==="fixed"&&!parseFriendlyTime(rule.fixedTime));
  const emptyDayRule=rules.find(rule=>rule.days.length===0);

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
      setAccountStatus("Account created. Confirm the email, then return here and sign in.");
      setAuthMode("signin");
      setBusy(false);return;
    }

    setAccountStatus(session.user.email||email.trim());
    setStep(2);
    setBusy(false);
  };

  const patchRule=(id:string,patch:Partial<MinyanRule>)=>{
    setRules(current=>current.map(rule=>rule.id===id?{...rule,...patch}:rule));
  };

  const toggleDay=(id:string,day:number)=>{
    setRules(current=>current.map(rule=>{
      if(rule.id!==id)return rule;
      const days=rule.days.includes(day)
        ? rule.days.filter(value=>value!==day)
        : [...rule.days,day].sort((a,b)=>a-b);
      return {...rule,days};
    }));
  };

  const addRule=(service:Service)=>{
    const count=rules.filter(rule=>rule.service===service).length+1;
    setRules(current=>[...current,defaultNewRule(service,count)]);
  };

  const deleteRule=(id:string)=>{
    setRules(current=>current.filter(rule=>rule.id!==id));
  };

  const createShul=async()=>{
    setError("");
    if(!name.trim()){setError("Enter the shul name.");return;}
    if(!/^\d{5}$/.test(zip)){setError("Enter a 5-digit ZIP code.");return;}
    if(!coverage.complete){setError("Finish the weekly coverage first. Every day needs Shacharis, Mincha, and Maariv.");return;}
    if(emptyDayRule){setError(`${emptyDayRule.name} does not apply to any day. Select a day or delete that minyan.`);return;}
    if(invalidFixedRule){setError(`Enter a valid time for ${invalidFixedRule.name}.`);return;}

    setBusy(true);

    const serviceBase:Record<Service,number>={Shacharis:10,Mincha:30,Maariv:60};
    const rows:any[]=[];

    SERVICES.forEach(service=>{
      const serviceRules=rules.filter(rule=>rule.service===service);
      serviceRules.forEach((rule,index)=>{
        const fixedTime=rule.mode==="fixed" ? parseFriendlyTime(rule.fixedTime) : "";
        const signedOffset=rule.direction==="before" ? -Math.abs(rule.offset) : Math.abs(rule.offset);
        rule.days.forEach(day=>{
          rows.push({
            day_of_week:day,
            service_type:service,
            service_time:fixedTime,
            timing_source:rule.mode==="fixed"?"fixed":rule.mode==="follows"?"follows":rule.source,
            timing_offset_minutes:rule.mode==="zman"?signedOffset:0,
            display_name:rule.name,
            sort_order:serviceBase[service]+index,
            active:true,
            round_to_minutes:rule.mode==="zman"&&rule.roundToFive?5:null,
            round_direction:rule.mode==="zman"&&rule.roundToFive?"down":null,
            use_weekly_earliest:rule.mode==="zman"?rule.sameTimeAcrossDays:false,
            weekly_group:rule.mode==="zman"&&rule.sameTimeAcrossDays?`${service.toLowerCase()}-${rule.id}`:"",
            follows_text:rule.mode==="follows"?(rule.followsText||"Follows Mincha"):""
          });
        });
      });
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

  const renderRule=(rule:MinyanRule)=>{
    const canFollow=rule.service==="Maariv";
    return (
      <div className="minyanRuleCard" key={rule.id}>
        <div className="minyanRuleHeader">
          <input
            className="minyanNameInput"
            value={rule.name}
            onChange={e=>patchRule(rule.id,{name:e.target.value})}
            aria-label={`${rule.service} minyan name`}
          />
          <button type="button" className="iconDangerButton" onClick={()=>deleteRule(rule.id)} aria-label={`Delete ${rule.name}`}>
            <Trash2 size={16}/>
          </button>
        </div>

        <div className="minyanApplies">
          <span>Applies</span>
          <div className="dayChoiceRow">
            {DAYS.map(day=>(
              <label className={rule.days.includes(day.value)?"dayChoice active":"dayChoice"} key={day.value}>
                <input
                  type="checkbox"
                  checked={rule.days.includes(day.value)}
                  onChange={()=>toggleDay(rule.id,day.value)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="timingEditor">
          <label>
            <span>Timing</span>
            <select
              value={rule.mode}
              onChange={e=>{
                const mode=e.target.value as RuleMode;
                patchRule(rule.id,{
                  mode,
                  followsText:mode==="follows"?"Follows Mincha":rule.followsText
                });
              }}
            >
              <option value="fixed">Set time</option>
              <option value="zman">Based on a zman</option>
              {canFollow&&<option value="follows">Follows Mincha</option>}
            </select>
          </label>

          {rule.mode==="fixed"&&(
            <label>
              <span>Time</span>
              <input
                className="friendlyTimeInput"
                value={rule.fixedTime}
                onFocus={e=>e.currentTarget.select()}
                onChange={e=>patchRule(rule.id,{fixedTime:e.target.value})}
                onBlur={e=>patchRule(rule.id,{fixedTime:normalizeFriendlyTime(e.currentTarget.value)})}
                placeholder="6:45 AM"
              />
            </label>
          )}

          {rule.mode==="zman"&&(
            <>
              <label>
                <span>Minutes</span>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={rule.offset}
                  onChange={e=>patchRule(rule.id,{offset:Number(e.target.value)})}
                />
              </label>
              <label>
                <span>Direction</span>
                <select value={rule.direction} onChange={e=>patchRule(rule.id,{direction:e.target.value as "before"|"after"})}>
                  <option value="before">before</option>
                  <option value="after">after</option>
                </select>
              </label>
              <label>
                <span>Zman</span>
                <select value={rule.source} onChange={e=>patchRule(rule.id,{source:e.target.value as ZmanSource})}>
                  <option value="plag">Plag</option>
                  <option value="sunset">Sunset (Sikia)</option>
                </select>
              </label>
            </>
          )}

          {rule.mode==="follows"&&(
            <label className="followsField">
              <span>Display</span>
              <input
                value={rule.followsText}
                onChange={e=>patchRule(rule.id,{followsText:e.target.value})}
                placeholder="Follows Mincha"
              />
            </label>
          )}
        </div>

        {rule.mode==="zman"&&(
          <div className="ruleOptions">
            <label>
              <input
                type="checkbox"
                checked={rule.roundToFive}
                onChange={e=>patchRule(rule.id,{roundToFive:e.target.checked})}
              />
              <span>Round earlier to the nearest 5 minutes</span>
            </label>
            {rule.days.length>1&&(
              <label>
                <input
                  type="checkbox"
                  checked={rule.sameTimeAcrossDays}
                  onChange={e=>patchRule(rule.id,{sameTimeAcrossDays:e.target.checked})}
                />
                <span>Use the same time for all selected days</span>
              </label>
            )}
          </div>
        )}

        <div className="ruleSentence">
          {rule.mode==="fixed"&&<span>{rule.fixedTime || "Set a time"}</span>}
          {rule.mode==="zman"&&<span>{rule.offset} minutes {rule.direction} {sourceLabel(rule.source)}</span>}
          {rule.mode==="follows"&&<span>{rule.followsText||"Follows Mincha"}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="onboardingPage">
      <div className="onboardingTop">
        <button className="secondary" onClick={onCancel}><ArrowLeft size={16}/> Back</button>
        <div>
          <span className="eyebrow">New shul onboarding</span>
          <h1>Get to a live dashboard in under 5 minutes</h1>
          <p>Create the account, then describe the shul's normal weekly minyanim.</p>
        </div>
        <div className="onboardingProgress">
          <span className={step>=1?"done":""}>1 Account</span>
          <span className={step>=2?"done":""}>2 Normal Schedule</span>
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
                  ?"Use the email you'll use to manage this shul."
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
                <small>At least 6 characters.</small>
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
        <>
          <div className="panel onboardingCard setupBasicsCard">
            <div className="panelHead">
              <div>
                <span className="eyebrow">Step 2 of 2 · normal weekly schedule</span>
                <h2>Tell us what normally happens each week</h2>
                <p className="helperText">Add as many minyanim as the shul has. Each minyan can use a fixed time or a zman-based rule.</p>
              </div>
              {accountStatus&&<span className="sourceBadge"><CheckCircle2 size={14}/> {accountStatus}</span>}
            </div>

            <div className="onboardGrid three">
              <label className="onboardField">
                <span>Shul name</span>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Example Shul" autoFocus/>
              </label>
              <label className="onboardField">
                <span>ZIP code</span>
                <input value={zip} inputMode="numeric" onChange={e=>setZip(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="44118"/>
                <small>Used for automatic zmanim.</small>
              </label>
              <label className="onboardField">
                <span>Shabbos / Yom Tov ends</span>
                <div className="minutesSetting">
                  <input type="number" min="1" max="180" value={shabbosEndMinutes} onChange={e=>setShabbosEndMinutes(Number(e.target.value))}/>
                  <b>minutes after sunset</b>
                </div>
              </label>
            </div>
          </div>

          <div className="scheduleWizardLayout">
            <div className="scheduleBuilder">
              <div className="scheduleInfoBox">
                <strong>Set times or use zmanim — it's up to you.</strong>
                <span>You can have multiple minyanim for each tefillah, and different rules for different days.</span>
              </div>

              {SERVICES.map(service=>(
                <section className={`serviceRuleSection ${service.toLowerCase()}`} key={service}>
                  <div className="serviceRuleHead">
                    <div>
                      <h3>{service}</h3>
                      <span>{rules.filter(rule=>rule.service===service).length} minyan{rules.filter(rule=>rule.service===service).length===1?"":"im"} configured</span>
                    </div>
                    <button type="button" className="primary compactAddButton" onClick={()=>addRule(service)}>
                      <Plus size={16}/> Add {service} Minyan
                    </button>
                  </div>
                  <div className="serviceRuleList">
                    {rules.filter(rule=>rule.service===service).map(renderRule)}
                  </div>
                </section>
              ))}
            </div>

            <aside className="coveragePanel">
              <div className="panel coverageCard">
                <div className="coverageTitle">
                  <CheckCircle2 size={20}/>
                  <div>
                    <h3>Weekly Coverage</h3>
                    <span>{coverage.count} of 21 day/service combinations are set.</span>
                  </div>
                </div>

                <div className={coverage.complete?"coverageStatus complete":"coverageStatus"}>
                  <strong>{coverage.complete?"All days are covered!":"A few schedule gaps remain"}</strong>
                  <span>{coverage.complete?"You're ready to create the shul.":"Fill every blank before continuing."}</span>
                </div>

                <div className="coverageTable">
                  <div className="coverageHeader"><span></span>{SERVICES.map(service=><b key={service}>{service}</b>)}</div>
                  {coverage.matrix.map(row=>(
                    <div className="coverageRow" key={row.day}>
                      <strong>{row.label}</strong>
                      {SERVICES.map(service=>(
                        <span className={row.covered[service]?"coverageDot yes":"coverageDot no"} key={service}>
                          {row.covered[service]?"✓":"—"}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>

                {error&&<div className="onboardError">{error}</div>}

                <button
                  className="primary createShulButton"
                  disabled={busy||!coverage.complete}
                  onClick={createShul}
                >
                  {busy?"Creating shul...":"Create Shul & Open Dashboard"}
                </button>
                <button className="secondary fullWidthButton" onClick={()=>setStep(1)}>Back to Account</button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

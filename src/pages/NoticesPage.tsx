import { useState } from "react";
import type { Notice, NoticeType } from "../types";

const noticeTypes: NoticeType[] = ["Yahrtzeit","Sponsorship","Mazel Tov","Condolence / Shiva","Schedule Change","Event","General Notice"];

export default function NoticesPage({
  notices,setNotices,remainingPushes,usePush
}:{
  notices:Notice[];
  setNotices:(n:Notice[])=>void;
  remainingPushes:number;
  usePush:()=>void;
}) {
  const [showForm,setShowForm] = useState(false);
  const [type,setType] = useState<NoticeType>("General Notice");
  const [headline,setHeadline] = useState("");
  const [details,setDetails] = useState("");

  const publish = (mode:"scheduled"|"immediate") => {
    if (mode==="immediate" && remainingPushes<=0) return;

    const newNotice:Notice = {
      id:`notice_${Date.now()}`,
      type,
      headline:headline || type,
      details,
      startAt:"2026-09-23",
      endAt:"2026-09-25",
      priority:"normal",
      publishMode:mode,
      status: mode==="immediate" ? "live" : "scheduled"
    };

    setNotices([newNotice,...notices]);
    if(mode==="immediate") usePush();
    setHeadline("");
    setDetails("");
    setShowForm(false);
  };

  return (
    <>
      <div className="pageHeader">
        <div><span className="eyebrow">Special communications</span><h1>Notices</h1><p>Yahrtzeits, sponsorships, urgent changes, lifecycle notices, and community announcements.</p></div>
        <button className="primary" onClick={()=>setShowForm(true)}>+ Add Notice</button>
      </div>

      <div className="pushBanner">
        <div><strong>Immediate updates today</strong><span>{remainingPushes} of 2 remaining</span></div>
        <p>Regular overnight updates do not count against this limit.</p>
      </div>

      {showForm && (
        <div className="panel formPanel">
          <h2>Add Notice</h2>
          <label>Notice type<select value={type} onChange={e=>setType(e.target.value as NoticeType)}>{noticeTypes.map(n=><option key={n}>{n}</option>)}</select></label>
          <label>Headline<input value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="Short headline" /></label>
          <label>Details<textarea value={details} onChange={e=>setDetails(e.target.value)} placeholder="What should members see?" /></label>
          <div className="formActions">
            <button className="secondary" onClick={()=>publish("scheduled")}>Save for 12:15 AM update</button>
            <button className="primary" disabled={remainingPushes<=0} onClick={()=>publish("immediate")}>Send to Magnets Now ({remainingPushes} left)</button>
          </div>
        </div>
      )}

      <div className="noticeList">
        {notices.map(n=>(
          <div className="noticeRow" key={n.id}>
            <span className="typeBadge">{n.type}</span>
            <div><strong>{n.headline}</strong><p>{n.details}</p></div>
            <div className="noticeMeta"><span>{n.startAt} → {n.endAt}</span><b>{n.status}</b></div>
          </div>
        ))}
      </div>
    </>
  );
}

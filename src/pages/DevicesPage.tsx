import type { LiveDevice } from "../App";

function checkInText(value:string|null){
  if(!value) return "Never";
  const d=new Date(value);
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
}

export default function DevicesPage({devices}:{devices:LiveDevice[]}){
  return <>
    <div className="pageHeader">
      <div>
        <span className="eyebrow">Fleet · LIVE SUPABASE</span>
        <h1>Magnets</h1>
        <p>These are the actual device records currently stored for this shul.</p>
      </div>
    </div>
    <div className="panel tablePanel">
      <table>
        <thead>
          <tr><th>Device</th><th>Label</th><th>Battery</th><th>Last Check-in</th><th>Status</th><th>Contact</th></tr>
        </thead>
        <tbody>
          {devices.map(d=><tr key={d.id}>
            <td>{d.device_code}</td>
            <td>{d.household_label}</td>
            <td>{d.battery_percent ?? "—"}%</td>
            <td>{checkInText(d.last_check_in)}</td>
            <td>{d.active ? d.status : "Inactive"}</td>
            <td>{d.contact_name || d.contact_email || d.contact_phone || "—"}</td>
          </tr>)}
          {devices.length===0 && <tr><td colSpan={6}>No device records found.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}

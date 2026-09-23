const devices = [
  ["MAG-000241","Kitchen - Cohen","92%","Today 12:17 AM","Healthy"],
  ["MAG-000242","Kitchen - Levy","78%","Today 12:18 AM","Healthy"],
  ["MAG-000243","Household 243","61%","Yesterday 12:19 AM","Attention"],
  ["MAG-000244","Household 244","88%","Today 12:16 AM","Healthy"],
  ["MAG-000245","Household 245","35%","Today 12:17 AM","Low battery"]
];

export default function DevicesPage(){
  return <>
    <div className="pageHeader">
      <div>
        <span className="eyebrow">Fleet</span>
        <h1>Magnets</h1>
        <p>See device status without overwhelming the shul administrator.</p>
      </div>
    </div>
    <div className="panel tablePanel">
      <table>
        <thead>
          <tr><th>Device</th><th>Label</th><th>Battery</th><th>Last Check-in</th><th>Status</th></tr>
        </thead>
        <tbody>
          {devices.map(d=><tr key={d[0]}>{d.map((v,i)=><td key={i}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  </>;
}

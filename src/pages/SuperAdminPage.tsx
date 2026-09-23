const orgs = [
  ["Young Israel of Example","247","243","4","12:15 AM"],
  ["Congregation Beth Shalom","186","184","2","12:15 AM"],
  ["Sample Shul North","312","305","7","12:15 AM"]
];

export default function SuperAdminPage(){
  return <>
    <div className="pageHeader">
      <div>
        <span className="eyebrow">Company-only</span>
        <h1>Super Admin</h1>
        <p>Manage every organization and deployed device from one place.</p>
      </div>
      <button className="primary">+ New Organization</button>
    </div>

    <div className="statsGrid">
      <div className="stat"><span>Organizations</span><strong>3</strong><small>pilot accounts</small></div>
      <div className="stat"><span>Deployed devices</span><strong>745</strong><small>across all fleets</small></div>
      <div className="stat"><span>Healthy</span><strong>732</strong><small>98.3%</small></div>
      <div className="stat"><span>Needs attention</span><strong>13</strong><small>device/support queue</small></div>
    </div>

    <div className="panel tablePanel">
      <div className="panelHead">
        <div><span className="eyebrow">Customers</span><h2>Organizations</h2></div>
      </div>
      <table>
        <thead>
          <tr><th>Organization</th><th>Devices</th><th>Healthy</th><th>Attention</th><th>Daily Update</th><th></th></tr>
        </thead>
        <tbody>
          {orgs.map(o=>
            <tr key={o[0]}>
              {o.map((v,i)=><td key={i}>{v}</td>)}
              <td><button className="secondary">View Organization</button></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </>;
}

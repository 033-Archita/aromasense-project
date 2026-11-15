import Explain from '../components/Explain.jsx';
import SensorChart from '../components/SensorChart.jsx';

export default function MonitoringPage({ telemetry, device, sessions }) {
  return <>
    <header className="page-heading"><h1>Live monitoring</h1><p>Follow the simulated sensor channels and review exposure sessions recorded in this browser.</p></header>
    <section className="status-row monitor-status" aria-label="Current simulated session">
      <p><b>Device state</b><span>{device.phase[0].toUpperCase() + device.phase.slice(1)}, simulated</span></p>
      <p><b>Selected sample</b><span>{device.sample}</span></p>
      <p><b>Readings shown</b><span>{telemetry.length} of the latest 60</span></p>
    </section>
    <section className="plain-section chart-list focal-panel"><h2>Sensor channels</h2>
      <SensorChart data={telemetry} channel="mq2" title="MQ-2 gas response" unit=" a.u." color="var(--wine)"/>
      <SensorChart data={telemetry} channel="temperature" title="Temperature" unit=" °C" color="var(--deep-blue)"/>
      <SensorChart data={telemetry} channel="humidity" title="Humidity" unit=" %" color="var(--green)"/>
      {!telemetry.length && <p className="empty-box">The simulator will add the first reading in about one second.</p>}
    </section>
    <section className="plain-section"><h2>Session history</h2>
      {sessions.length ? <div className="table-scroll"><table><thead><tr><th>Sample</th><th>Started</th><th>Result</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td>{session.sample}, simulated</td><td>{session.started}</td><td>{session.status}</td></tr>)}</tbody></table></div> : <p className="empty-box">No sessions yet. Start a sample in the Virtual electronic nose page.</p>}
      <p className="quiet">This session log is kept in browser memory only.</p>
    </section>
    <Explain>Each chart has its own scale because the gas response, temperature and humidity use different units and ranges. The lines show software-generated readings, not physical measurements. Session history stays in this browser’s memory and clears when the app reloads.</Explain>
  </>;
}

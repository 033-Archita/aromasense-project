import Explain from '../components/Explain.jsx';
import FlowDiagram from '../components/FlowDiagram.jsx';
import SensorChart from '../components/SensorChart.jsx';

const phases = ['standby', 'exposure', 'recovery'];
const phaseName = (phase) => phase[0].toUpperCase() + phase.slice(1);

export default function VirtualNosePage({ device, telemetry, onSample, onStart, onStop, onReset }) {
  const running = device.phase !== 'standby';
  return <>
    <header className="page-heading"><h1>Virtual electronic nose</h1><p>Run a browser simulation of a sensor chamber and watch the readings rise and recover.</p></header>
    <section className="plain-section"><h2>How simulated readings travel</h2>
      <FlowDiagram label="Sample vapour passes through simulated MQ-2, temperature and humidity sensors, then a virtual ESP32 to this dashboard" items={ [['Sample vapour', 'Selected in this page'], ['Sensors', 'MQ-2 gas, temperature and humidity'], ['Virtual ESP32', 'Would read once per second'], ['This dashboard', 'Displays simulated values']] }/>
    </section>
    <section className="plain-section nose-controls"><h2>Run a sample</h2>
      <div className="control-line">
        <label htmlFor="sample">Choose a simulated sample</label>
        <select id="sample" value={device.sample} disabled={running} onChange={(event) => onSample(event.target.value)}><option>Citrus peel</option><option>Floral</option><option>Woody vapour</option></select>
        <button className="button" onClick={() => onStart(device.sample)} disabled={device.phase !== 'standby'}>Start exposure</button>
        <button className="button secondary" onClick={onStop} disabled={device.phase !== 'exposure'}>Stop exposure</button>
        <button className="button secondary" onClick={onReset}>Reset readings</button>
      </div>
      <p className="quiet">Stop ends exposure and lets readings recover. Reset returns them to baseline now and clears the charts, while keeping the session log.</p>
    </section>
    <section className="plain-section"><h2>Sampling state</h2>
      <ol className="phase-list">{phases.map((phase) => <li key={phase} className={device.phase === phase ? 'current' : ''} aria-current={device.phase === phase ? 'step' : undefined}><b>{phaseName(phase)}</b>{device.phase === phase && <span>{phase === 'standby' ? 'Waiting for a sample' : device.secondsLeft + ' seconds remaining'}</span>}</li>)}</ol>
      <div className="chamber" aria-label={'Simulated sensing chamber, current state ' + device.phase}>
        <span className="chamber-inlet">Sample inlet</span><span className="vapour-dots" aria-hidden="true"><i/><i/><i/><i/><i/></span>
        <div className="chamber-core"><b>MQ-2</b><span>simulated sensor</span></div><span className="chamber-outlet">Virtual ESP32</span>
      </div>
    </section>
    <section className="plain-section reading-section"><h2>Current simulated readings</h2>
      <p className="quiet">These numbers are generated for demonstration and are not real measurements.</p>
      <div className="reading-list">
        <p className="reading-gas"><b>MQ-2 gas response</b><strong>{device.channels.mq2.toFixed(0)}</strong><small>arbitrary units, simulated</small></p>
        <p className="reading-temperature"><b>Temperature</b><strong>{device.channels.temperature.toFixed(1)} °C</strong><small>simulated</small></p>
        <p className="reading-humidity"><b>Humidity</b><strong>{device.channels.humidity.toFixed(1)}%</strong><small>simulated</small></p>
      </div>
      {telemetry.length ? <SensorChart compact data={telemetry} channel="mq2" title="MQ-2 response" unit=" a.u." color="var(--wine)"/> : <p className="empty-box">The simulator will add a reading in about one second.</p>}
    </section>
    <Explain>This is a browser simulation, not a real ESP32 or a physical measurement. Standby waits, exposure moves the response toward its sample target, and recovery brings it back toward baseline. A real ESP32 would read an analogue sensor voltage through its ADC; this software generates the values instead. Simulated readings never enter the molecular model.</Explain>
  </>;
}

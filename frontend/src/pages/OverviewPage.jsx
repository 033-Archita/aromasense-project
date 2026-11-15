import Explain from '../components/Explain.jsx';

export default function OverviewPage({ api, modelLoaded, summary, summaryError, device, sessions, moleculeHistory, navigate }) {
  const activity = [
    ...moleculeHistory.map((item) => ({ time: item.at, createdAt: item.createdAt, text: 'Predicted odour words for ' + item.molecule.name })),
    ...sessions.map((item) => ({ time: item.started, createdAt: item.createdAt, text: item.status + ' virtual ' + item.sample + ' sensor session' })),
  ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  return <>
    <header className="page-heading"><h1>AromaSense</h1><p>A project that explores odour in two ways: by predicting words from molecule structures and by simulating an electronic nose.</p></header>
    <Explain>Start with <b>How it works</b> for the short tour. Then try the Molecular odour lab to see a real model prediction, or open the virtual nose to watch simulated sensor readings.</Explain>
    {summaryError && <p className="error-box" role="alert">{summaryError}</p>}
    <section className="status-row" aria-label="Project status">
      <p className="status-api"><b>Prediction API</b><span>{api === 'connected' ? 'Connected' : api === 'checking' ? 'Checking' : 'Not reachable'}</span><i/></p>
      <p className="status-model"><b>Model</b><span>{api === 'checking' ? 'Checking' : api !== 'connected' ? 'Unavailable' : modelLoaded ? 'Loaded' : 'Not loaded'}</span><i/></p>
      <p className="status-device"><b>Virtual device</b><span>{device.phase[0].toUpperCase() + device.phase.slice(1)}, simulated</span><i/></p>
    </section>
    <section className="pathway-list">
      <article className="plain-panel pathway-molecule"><h2>Part 1: Molecular odour lab</h2>
        <p>Choose a named molecule. The app sends its structure code to the backend, which returns a ranked list of model-estimated odour words.</p>
        <p className="flow-line">Molecule → fingerprint → model → ranked odour words</p>
        <button className="button" onClick={() => navigate('molecular')}>Open the Molecular odour lab</button>
      </article>
      <article className="plain-panel pathway-nose"><h2>Part 2: Virtual electronic nose</h2>
        <p>Choose a sample and watch software-generated gas, temperature and humidity readings respond over time.</p>
        <p className="flow-line">Sample → simulated sensors → virtual ESP32 → dashboard</p>
        <button className="button secondary" onClick={() => navigate('nose')}>Open the Virtual electronic nose</button>
      </article>
    </section>
    <p className="separation-note">These parts do not share data. The sensor readings are made by the simulator and never go into the molecular model.</p>
    <section className="plain-section"><h2>Recent activity</h2>
      {activity.length ? <ol className="activity-list">{activity.map((entry, i) => <li key={i}><span>{entry.text}</span><time>{entry.time}</time></li>)}</ol> : <p>No activity yet. Run a prediction or start a virtual nose session to add an entry.</p>}
    </section>
    <p className="quiet">Dataset: {summary?.dataset_rows?.toLocaleString() || '—'} molecules, {summary?.descriptor_count || '—'} odour descriptors</p>
  </>;
}

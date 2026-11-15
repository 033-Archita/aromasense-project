import { useEffect, useState } from 'react';
import { getHealth, getModelSummary } from './api.js';
import OverviewPage from './pages/OverviewPage.jsx';
import HowItWorksPage from './pages/HowItWorksPage.jsx';
import MoleculeLabPage from './pages/MoleculeLabPage.jsx';
import VirtualNosePage from './pages/VirtualNosePage.jsx';
import MonitoringPage from './pages/MonitoringPage.jsx';
import ModelInsightsPage from './pages/ModelInsightsPage.jsx';
import useMoleculeLab from './hooks/useMoleculeLab.js';
import useVirtualNose from './hooks/useVirtualNose.js';

const tabs = [
  ['overview', 'Overview'], ['how', 'How it works'], ['molecular', 'Molecular odour lab'],
  ['nose', 'Virtual electronic nose'], ['monitoring', 'Live monitoring'], ['insights', 'Model insights'],
];

export default function App() {
  const [page, setPage] = useState('overview');
  const [api, setApi] = useState('checking');
  const [modelLoaded, setModelLoaded] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const lab = useMoleculeLab();
  const nose = useVirtualNose();

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const health = await getHealth();
        if (mounted) {
          setApi(health.status === 'ok' ? 'connected' : 'unreachable');
          setModelLoaded(Boolean(health.model_loaded));
        }
      } catch { if (mounted) setApi('unreachable'); }
      try {
        const modelSummary = await getModelSummary();
        if (mounted) { setSummary(modelSummary); setSummaryError(''); }
      } catch (error) {
        if (mounted) { setSummary(null); setSummaryError(error.message); }
      }
    };
    check();
    const timer = window.setInterval(check, 10000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  const pages = {
    overview: <OverviewPage api={api} modelLoaded={modelLoaded} summary={summary} summaryError={summaryError} device={nose.device} sessions={nose.sessions} moleculeHistory={lab.history} navigate={setPage}/>,
    how: <HowItWorksPage summary={summary} error={summaryError} navigate={setPage}/>,
    molecular: <MoleculeLabPage lab={lab}/>,
    nose: <VirtualNosePage device={nose.device} telemetry={nose.telemetry} onSample={nose.chooseSample} onStart={nose.startExposure} onStop={nose.stopExposure} onReset={nose.resetExposure}/>,
    monitoring: <MonitoringPage telemetry={nose.telemetry} device={nose.device} sessions={nose.sessions}/>,
    insights: <ModelInsightsPage summary={summary} error={summaryError}/>,
  };
  const apiLabel = api === 'connected' ? 'Prediction API connected' : api === 'checking' ? 'Prediction API checking' : 'Prediction API not reachable';
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('overview'); }}>AromaSense</a>
      <nav aria-label="Main navigation" className="tabs">{tabs.map(([id, title]) => <button key={id} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}>{title}</button>)}</nav>
      <div className={'api-badge ' + api} role="status"><i aria-hidden="true"/>{apiLabel}</div>
    </header>
    <main className={'main-content page-' + page}>
      {pages[page]}
    </main>
    <footer className="site-footer">Model scores are estimates of dataset labels. Electronic-nose readings are simulated.</footer>
  </div>;
}

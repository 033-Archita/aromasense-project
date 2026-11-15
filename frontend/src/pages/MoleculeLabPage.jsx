import Explain from '../components/Explain.jsx';
import { molecules } from '../data/molecules.js';

const stages = [
  ['Molecule chosen', 'You picked a familiar name.'],
  ['Structure', 'RDKit chemistry software builds and draws it.'],
  ['Fingerprint', '2,048 bits record atom patterns.'],
  ['Model', '138 classifiers score odour words.'],
  ['Ranking', 'The strongest scores appear first.'],
];

function predictionSummary(name, predictions, threshold) {
  if (!predictions?.length) return 'The API did not return descriptor scores for this molecule.';
  const leaders = predictions.slice(0, 3).map((item) => item.descriptor + ' (' + Math.round(item.probability * 100) + '%)');
  const passed = predictions.filter((item) => item.probability >= threshold).length;
  const opening = 'For ' + name + ', the model’s strongest matches are ' + leaders.join(', ') + '. ';
  if (passed === 0) return opening + 'None reached the ' + Math.round(threshold * 100) + '% cutoff, so these are weaker guesses.';
  if (passed === 1) return opening + 'One shown score reached the ' + Math.round(threshold * 100) + '% cutoff; the rest are weaker guesses.';
  return opening + passed + ' shown scores reached the ' + Math.round(threshold * 100) + '% cutoff; the rest are weaker guesses.';
}

export default function MoleculeLabPage({ lab }) {
  const { selected, result, busy, error, history, analyse } = lab;
  const threshold = result?.threshold ?? 0.6;
  const passed = result?.predictions?.filter((item) => item.probability >= threshold).length ?? 0;
  return <>
    <header className="page-heading"><h1>Molecular odour lab</h1><p>Choose a molecule by name to see how the trained model ranks odour words.</p></header>
    <div className="lab-layout">
      <div className="lab-left">
        <section className="plain-panel molecule-panel"><h2>Choose a molecule</h2><p>Select a name to send its structure to the prediction API. The note says where people commonly encounter it.</p>
          <div className="molecule-picker">{molecules.map((molecule) => <button key={molecule.name} className={'molecule-choice' + (selected?.name === molecule.name ? ' selected' : '')} onClick={() => analyse(molecule)} disabled={busy} aria-pressed={selected?.name === molecule.name}>
            <b>{molecule.name}</b><span>{molecule.knownFor}</span>{selected?.name === molecule.name && <small className="selected-tag">Selected</small>}
          </button>)}</div>
        </section>
        <figure className="plain-panel structure-panel">
          <h2>Molecule drawing</h2>
          {result?.structure_svg_base64 ? <img src={'data:image/svg+xml;base64,' + result.structure_svg_base64} alt={'RDKit drawing of ' + selected?.name}/> : <p className="empty-box">{busy ? 'The backend is drawing the selected molecule…' : 'Choose a molecule to see its structure drawing.'}</p>}
          <figcaption>How chemists draw this molecule. Each corner or letter is an atom, each line a bond.</figcaption>
          {result && <p className="smiles-note">Structure code sent to the backend: <code>{result.smiles}</code></p>}
        </figure>
      </div>
      <div className="lab-right">
        <section className="plain-panel result-panel"><h2>{selected ? 'Odour prediction for ' + selected.name : 'Ranked odour words'}</h2>
          {error && <p className="error-box" role="alert">{error}</p>}
          {busy && <p className="loading-box" role="status">Building the molecule fingerprint and requesting model scores…</p>}
          {!result && !busy && !error && <p className="empty-box">Choose one of the named molecules to request its prediction.</p>}
          {result && <div className="result-bars">
            <p className="cutoff-legend"><span className="cutoff-key"/> The line marks the {Math.round(threshold * 100)}% cutoff. All returned scores remain visible.</p>
            <div className="prediction-list">{result.predictions.map((item, index) => <div className={'prediction-row' + (item.probability >= threshold ? ' likely-row' : '')} key={item.descriptor}>
              <b>{item.descriptor}</b>
              <div className="prediction-track"><span className="prediction-fill" style={{ width: Math.max(item.probability * 100, 0.5) + '%', background: item.probability >= threshold ? 'var(--wine)' : 'var(--sage)' }}/><i className="cutoff-line" style={{ left: threshold * 100 + '%' }}/></div>
              <strong className="prediction-score">{Math.round(item.probability * 100)}%</strong>
              <small className={item.probability >= threshold ? 'likely' : 'below'}>{item.probability >= threshold ? 'Likely' : 'Below cutoff'}</small>
              {index === 0 && <span className="top-score-note">Top score</span>}
            </div>)}</div>
            <p className="model-summary">{predictionSummary(selected.name, result.predictions, threshold)}</p>
            <p className="honesty-note">Famous molecules like these may have appeared in the model’s training data, so their scores may look better than scores for a new molecule. Test results on Model insights are the fairer measure.</p>
          </div>}
        </section>
        <section className="plain-panel pipeline-panel"><h2>Prediction steps</h2>
          <ol className="pipeline">{stages.map(([title, description], index) => <li className={busy ? 'running' : result ? 'done' : ''} key={title}><b>{index + 1}. {title}</b><span>{description}</span></li>)}</ol>
        </section>
      </div>
    </div>
    <Explain>The model score is an estimate, not a human smell measurement. RDKit turns nearby atoms, up to two bonds away, into a Morgan fingerprint with 2,048 bits. The 138 Extra Trees classifiers each average 20 decision trees to score one odour word; several words can apply at once. {passed} of the {result?.predictions?.length || 10} displayed scores reached the 0.60 “Likely” cutoff.</Explain>
    <section className="plain-section"><h2>Recent molecule predictions</h2>{history.length ? <ol className="activity-list">{history.map((entry, index) => <li key={entry.at + index}><button className="text-button" onClick={() => analyse(entry.molecule)} disabled={busy}>{entry.molecule.name}</button><time>{entry.at}</time></li>)}</ol> : <p>No molecules analysed yet. Choose a name above to start.</p>}</section>
  </>;
}

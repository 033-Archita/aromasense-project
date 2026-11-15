import Explain from '../components/Explain.jsx';

const measures = [
  ['Macro precision', 'macro_precision', 'For each odour word given equal weight, how often a predicted label was correct.'],
  ['Macro recall', 'macro_recall', 'For each odour word given equal weight, how many known labels the model found.'],
  ['Macro F1', 'macro_f1', 'The balance between macro precision and macro recall.'],
  ['Micro F1', 'micro_f1', 'The precision and recall balance across all molecule and descriptor decisions together.'],
  ['ROC-AUC', 'macro_roc_auc', 'How well scores rank positive examples above negative ones over many cutoffs.'],
  ['PR-AUC', 'macro_pr_auc', 'How well precision holds as recall rises; useful when positive labels are uncommon.'],
];
const metricValue = (value, error) => typeof value === 'number' ? value.toFixed(3) : error ? 'Unavailable' : 'Loading from API';

export default function ModelInsightsPage({ summary, error }) {
  const common = summary?.common_descriptors || [];
  const maxCount = common[0]?.positive_count || 1;
  return <>
    <header className="page-heading"><h1>Model insights</h1><p>See what data the model learned from and how it performed on examples held aside for evaluation.</p></header>
    {error && <p className="error-box" role="alert">{error}</p>}
    <section className="status-row dataset-summary" aria-label="Dataset summary">
      <p><b>Molecules</b><span>{summary?.dataset_rows?.toLocaleString() || (error ? 'Unavailable' : 'Loading')}</span></p>
      <p><b>Odour descriptors</b><span>{summary?.descriptor_count ?? (error ? 'Unavailable' : 'Loading')}</span></p>
      <p><b>Training and test split</b><span>3,986 training, 997 test</span></p>
      <p><b>Split method</b><span>Random split</span></p>
    </section>
    <section className="plain-panel focal-panel metrics-panel"><h2>Held-out test results</h2>
      <p>The frozen model uses the 0.60 cutoff selected using validation data. ROC-AUC and PR-AUC use ranked scores across cutoffs.</p>
      <div className="table-scroll"><table><thead><tr><th>Measure</th><th>Score from API</th><th>What it means</th></tr></thead><tbody>{measures.map(([label, key, meaning]) => <tr key={key}><th scope="row">{label}</th><td>{metricValue(summary?.metrics?.[key], error)}</td><td>{meaning}</td></tr>)}</tbody></table></div>
      <p className="quiet">For precision, recall and F1, values closer to 1 are stronger, but there is no universal pass score for this dataset. ROC-AUC of 0.5 is chance ranking; higher values mean better ranking.</p>
    </section>
    <section className="plain-panel descriptor-panel"><h2>Most common descriptors</h2><p>Bar lengths compare how many molecules in the dataset carry each label.</p>
      {common.length ? <ol className="common-list">{common.slice(0, 12).map((item) => <li key={item.descriptor}><b>{item.descriptor}</b><span className="common-track"><i style={{ width: (item.positive_count / maxCount * 100) + '%' }}/></span><span>{item.positive_count.toLocaleString()}</span></li>)}</ol> : <p>{error ? 'Descriptor counts are unavailable because the model summary could not be loaded.' : 'Descriptor counts will appear when the model summary API responds.'}</p>}
    </section>
    <Explain>Scores range from 0 to 1, and higher values usually mean better performance. These are results on the held-out test set, not a promise about a new molecule. Rare odour words have fewer examples and are harder to predict.</Explain>
    <section className="plain-section"><h2>How the model works</h2><ol className="numbered-steps"><li>RDKit reads the molecule’s SMILES structure code and checks it is valid.</li><li>It makes a 2,048-bit Morgan fingerprint from atom neighbourhoods up to two bonds away.</li><li>138 Extra Trees classifiers score the odour descriptors; each uses 20 decision trees.</li><li>The app ranks scores and applies a 0.60 cutoff to add a separate “Likely” flag.</li></ol></section>
    <section className="plain-panel limitation-panel"><h2>Limitations</h2><ul><li>A random split may put close chemical relatives in both training and test sets.</li><li>Human odour labels can be subjective and incomplete.</li><li>Rare descriptors have fewer examples and are harder to predict.</li><li>Scores are not calibrated probabilities of human perception.</li><li>The virtual sensor simulator is separate and does not feed the model.</li></ul></section>
    <section className="plain-section"><h2>References</h2><ul><li><a href="https://github.com/BioMachineLearning/openpom" target="_blank" rel="noreferrer">OpenPOM-associated dataset and project</a></li><li><a href="https://www.rdkit.org/docs/" target="_blank" rel="noreferrer">RDKit documentation</a></li><li><a href="https://scikit-learn.org/stable/" target="_blank" rel="noreferrer">scikit-learn documentation</a></li><li>See MODEL_METHODOLOGY.md in the project folder for methodology details.</li></ul></section>
  </>;
}

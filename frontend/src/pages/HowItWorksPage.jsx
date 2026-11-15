import Explain from '../components/Explain.jsx';
import FlowDiagram from '../components/FlowDiagram.jsx';

function TimelineStep({ number, title, facts, children, className = '' }) {
  return <section className={'timeline-step ' + className}>
    <span className="timeline-marker" aria-hidden="true">{number}</span>
    <div className="timeline-content">
      <h2>{title}</h2>
      <div className="timeline-copy">{children}</div>
      <p className="key-facts"><b>Key facts</b> {facts}</p>
    </div>
  </section>;
}

function metric(value) {
  return typeof value === 'number' ? value.toFixed(3) : 'Loading from the prediction API';
}

export default function HowItWorksPage({ summary, error, navigate }) {
  return <>
    <header className="page-heading"><h1>How the project works</h1><p>Follow how AromaSense was built, from its dataset to its two separate demonstrations.</p></header>
    <Explain>This page tells the project story in order. Odour scores are model estimates, and the sensor readings are simulated.</Explain>
    {error && <p className="error-box" role="alert">{error}</p>}
    <div className="project-timeline">
      <TimelineStep number="1" title="The goal" facts="Two demonstrations, one project.">
        <p>Predict odour words from a molecule’s structure with a small CPU-friendly machine-learning model. Separately, demonstrate how an ESP32 electronic nose could sense a sample, using simulation rather than real hardware.</p>
      </TimelineStep>

      <TimelineStep number="2" title="The data" facts="4,983 molecules, 138 descriptors, no missing, invalid or duplicate SMILES in the audit.">
        <p>The project uses the OpenPOM-associated curated GS/LF merged dataset. Its source is the <a href="https://raw.githubusercontent.com/ARY2260/openpom/main/openpom/data/curated_datasets/curated_GS_LF_merged_4983.csv" target="_blank" rel="noreferrer">curated GS/LF dataset file</a>, referenced by the <a href="https://github.com/BioMachineLearning/openpom" target="_blank" rel="noreferrer">OpenPOM project</a>.</p>
        <p>Each row represents one molecule, its structure code, and a yes-or-no value for each odour descriptor.</p>
      </TimelineStep>

      <TimelineStep number="3" title="Preparing the data" facts="Morgan radius 2, 2,048 bits; 3,986 training rows and 997 held-out test rows.">
        <p>RDKit checks each molecule’s structure. It then turns nearby atom patterns into a Morgan fingerprint: 2,048 zeroes and ones, using a radius of 2 bonds.</p>
        <p>The data was split at random. A separate 997-row validation split came from the training pool for model setting selection; the final test set stayed untouched.</p>
      </TimelineStep>

      <TimelineStep number="4" title="The model" facts="138 classifiers, 20 trees each; settings and the 0.60 cutoff selected on validation data.">
        <p>The model uses one class-balanced Extra Trees classifier for each odour word, so rare words still affect training. Its selected feature setting was “sqrt” with a minimum leaf size of 2.</p>
        <p>Multi-label classification means one molecule can receive several odour-word estimates at the same time.</p>
      </TimelineStep>

      <TimelineStep number="5" title="How well it worked" facts="Held-out test set: 997 molecules; the cutoff was not selected on test data.">
        <p>Macro F1 is <b>{metric(summary?.metrics?.macro_f1)}</b>, macro ROC-AUC is <b>{metric(summary?.metrics?.macro_roc_auc)}</b>, and macro PR-AUC is <b>{metric(summary?.metrics?.macro_pr_auc)}</b>. F1 balances precision and recall; ROC-AUC and PR-AUC describe how useful the ranked scores are across cutoffs.</p>
        <p>This lightweight baseline has room to improve, and rare descriptors are harder to learn. <button className="text-button" onClick={() => navigate('insights')}>See the full results in Model insights</button>.</p>
      </TimelineStep>

      <TimelineStep number="6" title="The prediction service" facts="The prediction API returns ranked scores and an RDKit structure drawing.">
        <p>FastAPI loads the saved model. When you choose a molecule, the backend uses RDKit to rebuild and draw it, computes its fingerprint, runs the 138 classifiers and returns ranked scores.</p>
        <FlowDiagram label="Browser sends a molecule to FastAPI, RDKit and the trained model; ranked scores return to the browser" items={ [['Browser', 'Sends the selected molecule'], ['FastAPI', 'Routes the prediction request'], ['RDKit', 'Builds the fingerprint and drawing'], ['Trained model', 'Scores 138 odour words'], ['Browser', 'Displays the ranked estimates']] }/>
      </TimelineStep>

      <TimelineStep number="7" title="The virtual electronic nose" facts="The dashboard simulator runs in the browser; its readings are generated, not measured.">
        <p>The demonstration models an ESP32 reading an MQ-2 gas sensor, temperature and humidity once per second through exposure and recovery. In the dashboard, a built-in software simulator moves readings along a rise-and-fall curve toward a target for the chosen sample.</p>
        <p className="hardware-note">The hardware demonstration is a separate simulated circuit.</p>
      </TimelineStep>

      <TimelineStep number="8" title="Why the two parts are separate" facts="The virtual readings never enter the molecular prediction model.">
        <p>The simulator invents its values, so it cannot teach or test the molecular model. Each part is its own demonstration: one starts from a molecule’s structure, the other from generated sensor readings.</p>
      </TimelineStep>

      <TimelineStep number="9" title="The dashboard" facts="The prediction API and virtual simulator keep their data paths separate.">
        <p>The Overview introduces the project and shows API and device status. The five other views each answer a different question:</p>
        <ul className="dashboard-views">
          <li><b>How it works</b> tells the project story and explains its terms.</li>
          <li><b>Molecular odour lab</b> predicts odour words for a named molecule.</li>
          <li><b>Virtual electronic nose</b> runs the browser-based sensor simulation.</li>
          <li><b>Live monitoring</b> charts the simulated channels and session history.</li>
          <li><b>Model insights</b> shows dataset counts, descriptor frequency and evaluation.</li>
        </ul>
      </TimelineStep>

      <TimelineStep number="10" title="Limits and next steps" facts="These results describe dataset labels, not a person’s smell.">
        <p>Scores are estimates, odour labels are subjective, and a random split can make performance look better when close chemical relatives appear on both sides. Rare descriptors are difficult, and all virtual sensor values are simulated.</p>
        <p>Next steps could test molecules from a different source, explore a graph neural network, or connect real sensor hardware.</p>
      </TimelineStep>
    </div>
  </>;
}

import { useState } from 'react';
import { predictOdour } from '../api.js';

// Keep prediction results and name-based history when the reader changes pages.
export default function useMoleculeLab() {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  async function analyse(molecule) {
    setSelected(molecule);
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await predictOdour(molecule.smiles, 10);
      setResult(response);
      setHistory((items) => [{ molecule, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), createdAt: Date.now() }, ...items].slice(0, 12));
    } catch (err) {
      setError(err.message || 'Prediction could not be completed.');
      setResult(null);
    } finally { setBusy(false); }
  }

  return { selected, result, busy, error, history, analyse };
}

const API_ROOT = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request(path, options) {
  try {
    const response = await fetch(API_ROOT + path, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'The server returned ' + response.status + '.');
    return body;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('The prediction server is not reachable. Start it with: python -m uvicorn backend.main:app --port 8000');
    throw error;
  }
}

export const getHealth = () => request('/api/health');
export const getModelSummary = () => request('/api/model/summary');
export const predictOdour = (smiles, top_k = 10) => request('/api/predict', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ smiles, top_k }),
});

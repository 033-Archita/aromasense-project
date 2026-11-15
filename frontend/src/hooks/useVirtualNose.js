import { useEffect, useRef, useState } from 'react';

const BASE = { mq2: 130, temperature: 24.2, humidity: 43 };
const TARGETS = {
  'Citrus peel': { mq2: 420, temperature: 25.9, humidity: 48.2 },
  Floral: { mq2: 335, temperature: 25.5, humidity: 47.1 },
  'Woody vapour': { mq2: 515, temperature: 24.9, humidity: 46.4 },
};
const clockTime = () => new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
const freshState = () => ({ phase: 'standby', sample: 'Citrus peel', channels: { ...BASE }, secondsLeft: 0, readings: 0 });

// Software generates these values; the simulator never sends them to the prediction API.
export default function useVirtualNose() {
  const sim = useRef({ ...freshState(), response: 0, elapsed: 0, sessions: [], activeId: null, sample: 'Citrus peel' });
  const [device, setDevice] = useState(freshState);
  const [telemetry, setTelemetry] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = sim.current;
      if (state.phase === 'exposure') {
        state.elapsed += 1;
        if (state.elapsed >= 14) {
          state.phase = 'recovery';
          state.secondsLeft = 10;
          const session = state.sessions.find((item) => item.id === state.activeId);
          if (session) session.status = 'Complete';
        } else state.secondsLeft = 14 - state.elapsed;
      } else if (state.phase === 'recovery') {
        state.elapsed += 1;
        state.secondsLeft = Math.max(0, 24 - state.elapsed);
        if (state.elapsed >= 24) state.phase = 'standby';
      }
      const goal = state.phase === 'exposure' ? 1 : 0;
      state.response += (goal - state.response) * (goal ? 0.21 : 0.23);
      const target = TARGETS[state.sample] || TARGETS['Citrus peel'];
      const n = state.readings++;
      state.channels = {
        mq2: BASE.mq2 + (target.mq2 - BASE.mq2) * state.response + Math.sin(n * 0.7) * 2,
        temperature: BASE.temperature + (target.temperature - BASE.temperature) * state.response + Math.sin(n * 0.5) * 0.025,
        humidity: BASE.humidity + (target.humidity - BASE.humidity) * state.response + Math.cos(n * 0.4) * 0.08,
      };
      setTelemetry((rows) => [...rows.slice(-59), { time: clockTime(), ...state.channels, id: Date.now() + '-' + n }]);
      if (state.phase === 'standby') {
        state.channels = { ...BASE }; state.response = 0; state.secondsLeft = 0; state.activeId = null;
      }
      setDevice({ phase: state.phase, sample: state.sample, channels: { ...state.channels }, secondsLeft: state.secondsLeft, readings: state.readings });
      setSessions([...state.sessions]);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function chooseSample(sample) {
    if (sim.current.phase !== 'standby') return;
    sim.current.sample = sample;
    setDevice((d) => ({ ...d, sample }));
  }
  function startExposure(sample) {
    const state = sim.current;
    if (state.phase !== 'standby') return;
    const id = Date.now();
    state.sample = sample; state.phase = 'exposure'; state.elapsed = 0; state.secondsLeft = 14; state.activeId = id; state.response = 0;
    state.sessions.unshift({ id, sample, started: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now(), status: 'Running' });
    state.sessions = state.sessions.slice(0, 30);
    setSessions([...state.sessions]);
    setDevice({ phase: state.phase, sample, channels: { ...state.channels }, secondsLeft: 14, readings: state.readings });
  }
  function stopExposure() {
    const state = sim.current;
    if (state.phase !== 'exposure') return;
    const session = state.sessions.find((item) => item.id === state.activeId);
    if (session) session.status = 'Stopped';
    state.phase = 'recovery'; state.elapsed = 14; state.secondsLeft = 10;
    setSessions([...state.sessions]);
    setDevice((d) => ({ ...d, phase: 'recovery', secondsLeft: state.secondsLeft }));
  }
  function resetExposure() {
    const state = sim.current;
    if (state.activeId) {
      const session = state.sessions.find((item) => item.id === state.activeId);
      if (session && session.status === 'Running') session.status = 'Stopped';
    }
    state.phase = 'standby'; state.response = 0; state.elapsed = 0; state.secondsLeft = 0; state.activeId = null; state.channels = { ...BASE };
    setDevice({ phase: 'standby', sample: state.sample, channels: { ...BASE }, secondsLeft: 0, readings: state.readings });
    setTelemetry([]); setSessions([...state.sessions]);
  }
  return { device, telemetry, sessions, chooseSample, startExposure, stopExposure, resetExposure };
}

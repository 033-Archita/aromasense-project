import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function SensorChart({ data, channel, title, unit, color, compact = false }) {
  const lastReading = data.length ? data[data.length - 1][channel] : null;
  const latest = lastReading === null ? 'Waiting for a reading' : Number(lastReading).toFixed(unit === ' a.u.' ? 0 : 1) + unit;
  return <section className={'chart-panel' + (compact ? ' compact' : '')}>
    <div className="chart-heading"><div><h3>{title}</h3><span>Simulated readings</span></div><div className="latest-reading"><span>Latest value</span><strong>{latest}</strong></div></div>
    <div className="chart-area"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 14, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis unit={unit} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={62} />
        <Tooltip formatter={(value) => [Number(value).toFixed(unit === ' a.u.' ? 0 : 1) + unit, title]} contentStyle={{ border: '1px solid var(--border)', borderRadius: 5, color: 'var(--brown)', fontFamily: 'var(--font-body)', fontSize: 12 }} />
        <Line type="monotone" dataKey={channel} name={title} stroke={color} strokeWidth={3} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer></div>
  </section>;
}

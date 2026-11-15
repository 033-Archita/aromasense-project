export default function FlowDiagram({ items, label }) {
  return <div className="flow-diagram" role="img" aria-label={label}>
    {items.map(([title, description], index) => <div className="flow-box" key={title + index}>
      <b>{title}</b><span>{description}</span>
    </div>)}
  </div>;
}

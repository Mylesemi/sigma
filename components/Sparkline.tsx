interface Props {
  data: number[];
  baseline: number | null;
  up: boolean;
}

const W = 120;
const H = 36;

export default function Sparkline({ data, baseline, up }: Props) {
  if (data.length < 2) return <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden />;

  const values = baseline != null ? [...data, baseline] : data;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - 2 - ((v - min) / range) * (H - 4);

  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${W},${H}L0,${H}Z`;
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      {baseline != null && (
        <line x1="0" x2={W} y1={y(baseline)} y2={y(baseline)} className="spark-base" />
      )}
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "../utils/translate";

// SVG stays responsive; a range input gives touch and keyboard access to every point.
const EMPTY_POINTS = [];
function EnergyChart({
  points = EMPTY_POINTS,
  forecast = EMPTY_POINTS,
  unit = "kWh",
  title,
  type = "line",
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);
  const container = useRef(null);
  const [chartWidth, setChartWidth] = useState(720);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.max(300, Math.round(entry.contentRect.width)));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const id = useId().replace(/:/g, "");
  const all = useMemo(
    () => [
      ...points.map((p) => ({ ...p, forecast: false })),
      ...forecast.map((p) => ({ ...p, forecast: true })),
    ],
    [points, forecast],
  );
  const width = chartWidth,
    height = chartWidth < 500 ? 190 : 230,
    left = 52,
    right = 15,
    top = 22,
    bottom = 34;
  const max = useMemo(
    () =>
      all.reduce(
        (peak, point) => Math.max(peak, Number(point.value) || 0),
        0.01,
      ) * 1.15,
    [all],
  );
  const x = (i) =>
    left +
    (all.length === 1 ? 0.5 : i / (all.length - 1)) * (width - left - right);
  const y = (v) =>
    height - bottom - (Math.max(0, Number(v)) / max) * (height - top - bottom);
  const path = (items, offset = 0) =>
    items
      .map((p, i) => `${i ? "L" : "M"} ${x(i + offset)} ${y(p.value)}`)
      .join(" ");
  const index = Math.min(selected ?? all.length - 1, all.length - 1),
    point = all[index];
  const format = (value) =>
    Number(value).toLocaleString(undefined, {
      maximumFractionDigits: unit === "MWh" ? 3 : 2,
    });
  const paths = useMemo(
    () => ({
      observed: path(points),
      area: points.length
        ? `${path(points)} L ${x(points.length - 1)} ${height - bottom} L ${x(0)} ${height - bottom} Z`
        : "",
      forecast: path(
        points.length ? [points.at(-1), ...forecast] : forecast,
        Math.max(0, points.length - 1),
      ),
    }),
    [points, forecast, all.length, max, width, height],
  );
  const chartLabel = useMemo(
    () =>
      `${title}. ${all.map((p) => `${p.label}: ${format(p.value)} ${unit}`).join("; ")}`,
    [title, all, unit],
  );
  if (!all.length)
    return (
      <div ref={container} className="chart-empty">
        {t("noReadingsFound")}
      </div>
    );
  return (
    <div ref={container} className="chart">
      <div className="chart-readout" aria-live="polite">
        <span>
          {point.label} · {t(point.forecast ? "predicted" : "measuredEnergy")}
        </span>
        <strong>
          {format(point.value)} <small>{unit}</small>
        </strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={chartLabel}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const position =
            ((event.clientX - bounds.left) / bounds.width) * width;
          setSelected(
            Math.max(
              0,
              Math.min(
                all.length - 1,
                Math.round(
                  ((position - left) / (width - left - right)) *
                    (all.length - 1),
                ),
              ),
            ),
          );
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--primary)" stopOpacity=".24" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={left}
              x2={width - right}
              y1={y(max * f)}
              y2={y(max * f)}
              className="chart-grid"
            />
            <text x={left - 10} y={y(max * f) + 4} textAnchor="end">
              {format(max * f)}
            </text>
          </g>
        ))}
        {type === "bar" ? (
          all.map((p, i) => (
            <rect
              key={i}
              x={x(i) - Math.min(18, (width - left - right) / all.length / 3)}
              y={y(p.value)}
              width={Math.min(36, ((width - left - right) / all.length) * 0.6)}
              height={Math.max(0, height - bottom - y(p.value))}
              rx="4"
              fill={
                p.forecast
                  ? "var(--violet-light)"
                  : i === index
                    ? "var(--cyan)"
                    : "var(--primary)"
              }
              opacity={i === index ? 1 : 0.65}
            />
          ))
        ) : (
          <>
            {points.length > 0 && (
              <>
                <path d={paths.area} fill={`url(#${id})`} />
                <path d={paths.observed} className="chart-line" />
              </>
            )}
            {forecast.length > 0 && (
              <path d={paths.forecast} className="chart-forecast" />
            )}
          </>
        )}
        <line
          x1={x(index)}
          x2={x(index)}
          y1={top}
          y2={height - bottom}
          stroke="var(--muted)"
          strokeDasharray="3 5"
          opacity=".45"
        />
        <circle
          cx={x(index)}
          cy={y(point.value)}
          r="5"
          fill="var(--cyan)"
          stroke="var(--surface)"
          strokeWidth="3"
        />
        {[
          0,
          ...(all.length > 3 ? [Math.floor((all.length - 1) / 2)] : []),
          ...(all.length > 1 ? [all.length - 1] : []),
        ].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 7}
            textAnchor={
              i === 0 ? "start" : i === all.length - 1 ? "end" : "middle"
            }
          >
            {all[i].label}
          </text>
        ))}
      </svg>
      <input
        className="chart-scrubber"
        type="range"
        min="0"
        max={Math.max(0, all.length - 1)}
        value={index}
        onChange={(e) => setSelected(Number(e.target.value))}
        aria-label={t("exploreChart")}
        aria-valuetext={`${point.label}: ${format(point.value)} ${unit}`}
      />
      <div className="chart-legend">
        <span>
          <i />
          {t("measuredEnergy")}
        </span>
        {forecast.length > 0 && (
          <span>
            <i className="violet" />
            {t("predicted")}
          </span>
        )}
        <small>{t("exploreChart")}</small>
      </div>
    </div>
  );
}
export default memo(EnergyChart);

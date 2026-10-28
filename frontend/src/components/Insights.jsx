import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  getAlerts,
  getPredictions,
  getUsageAnomaly,
  getUsageSummary,
  getDailyUsage,
} from "../api";
import { useMeter } from "../hooks/useMeter";
import { useTranslation, useUnit } from "../utils/translate";
import { dailyPoints, dateText, energyText, isDemo } from "../utils/energy";
import EnergyChart from "./EnergyChart";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  MeterSelect,
  PageHeader,
  Stat,
} from "./ui";
import { TextLink } from "./ui";

export default function Insights() {
  const { t, currentLanguage } = useTranslation(),
    { unit } = useUnit(),
    meter = useMeter();
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!meter.id) return;
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all([
      getAlerts(),
      getUsageSummary(meter.id, "7D"),
      getPredictions(meter.id, "7D"),
      getUsageAnomaly(meter.id),
      getDailyUsage(meter.id),
    ])
      .then(([alerts, summary, forecast, anomaly, daily]) => {
        if (active) setData({ alerts, summary, forecast, anomaly, daily });
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [meter.id, revision]);
  const risk =
    data?.alerts.status === "exceeded"
      ? "high"
      : data?.alerts.status === "warning" || data?.alerts.predicted_will_exceed
        ? "moderate"
        : "low";
  const observed = dailyPoints(data?.daily || []).slice(-7);
  const points = observed.map((p) => ({
    label: dateText(p.label, currentLanguage).replace(/\s\d{4}$/, ""),
    value: p.value / (unit === "MWh" ? 1000 : 1),
  }));
  const forecast = observed.length
    ? (data?.forecast.predicted || []).map((value, i) => ({
        label: `+${i + 1} ${t("day")}`,
        value: Number(value) / (unit === "MWh" ? 1000 : 1),
      }))
    : [];
  const recommendations =
    risk === "high"
      ? ["tipCooling", "tipTimers", "tipReview"]
      : risk === "moderate"
        ? ["tipReview", "tipCooling", "tipTimers"]
        : ["tipTimers", "tipReview", "tipCooling"];
  return (
    <>
      <PageHeader
        eyebrow={t("insights")}
        title={t("aiCoach")}
        description={t("analysisDescription")}
        action={
          <MeterSelect
            devices={meter.devices}
            value={meter.id}
            onChange={meter.setId}
          />
        }
      />
      {isDemo(meter.device) && (
        <div className="demo-banner">
          <Sparkles size={16} />
          {t("demoNote")}
        </div>
      )}
      {meter.error || error ? (
        <ErrorState
          onRetry={() => {
            meter.reload();
            setRevision((v) => v + 1);
          }}
        />
      ) : meter.loading || loading ? (
        <LoadingState />
      ) : !meter.id ? (
        <EmptyState
          title={t("noDeviceFound")}
          description={t("noMeterDescription")}
          action={<TextLink to="/devices">{t("connectMeter")}</TextLink>}
        />
      ) : !observed.length ? (
        <EmptyState
          title={t("moreData")}
          description={t("noReadingsDescription")}
        />
      ) : (
        data && (
          <>
            <div className="split-grid">
              <Card className="insight-hero">
                <div className="insight-head">
                  <div className="empty-icon">
                    <BrainCircuit size={26} />
                  </div>
                  <div>
                    <p className="small-label">
                      {t("usageRisk")} · {t("allMeters")}
                    </p>
                    <h2>{t(risk)}</h2>
                  </div>
                  <Badge
                    tone={
                      risk === "high"
                        ? "red"
                        : risk === "moderate"
                          ? "amber"
                          : "green"
                    }
                  >
                    {Number(data.alerts.usage_percent).toFixed(1)}%
                  </Badge>
                </div>
                <p className="note">
                  {energyText(data.alerts.current_usage, unit)} /{" "}
                  {energyText(data.alerts.monthly_limit, unit)}
                </p>
                <div className="nav-divider" />
                <p className="muted text-xs leading-relaxed">
                  {t("recommendationNote")}
                </p>
              </Card>
              <Card>
                <CardTitle
                  icon={
                    data.anomaly.status === "anomaly"
                      ? TriangleAlert
                      : ShieldCheck
                  }
                  title={t("anomaly")}
                />
                <Badge
                  tone={
                    data.anomaly.status === "anomaly"
                      ? "amber"
                      : data.anomaly.status === "insufficient_data"
                        ? "neutral"
                        : "green"
                  }
                >
                  {t(
                    data.anomaly.status === "insufficient_data"
                      ? "moreData"
                      : data.anomaly.status === "anomaly"
                        ? "anomalyDetected"
                        : "anomalyNormal",
                  )}
                </Badge>
                <p className="note">
                  {t("records")}: {data.anomaly.sample_size ?? "—"}
                </p>
                <p className="note">{t("confidenceNote")}</p>
              </Card>
            </div>
            <Card className="mt-5">
              <CardTitle
                icon={Sparkles}
                title={t("forecast")}
                action={<Badge tone="violet">{t("nextSeven")}</Badge>}
              />
              <EnergyChart
                points={points}
                forecast={forecast}
                unit={unit}
                title={t("forecast")}
              />
              <div className="gauge-footer">
                <div>
                  <span>{t("latestRecords")}</span>
                  <strong>{energyText(data.summary.total_energy, unit)}</strong>
                </div>
                <div>
                  <span>
                    {t("nextSeven")} · {t("usageScope")}
                  </span>
                  <strong>
                    {energyText(
                      data.forecast.predicted.reduce(
                        (sum, n) => sum + Number(n),
                        0,
                      ),
                      unit,
                    )}
                  </strong>
                </div>
              </div>
              <p className="note">
                {t("forecastMethod")} {t("forecastNote")}
              </p>
            </Card>
            <Card className="mt-5">
              <CardTitle icon={Lightbulb} title={t("recommendations")} />
              {recommendations.map((key, i) => (
                <details key={key} className="recommendation" open={i === 0}>
                  <summary>
                    <Lightbulb size={18} />
                    {t(key)}
                  </summary>
                  <p>{t("recommendationNote")}</p>
                </details>
              ))}
            </Card>
          </>
        )
      )}
    </>
  );
}

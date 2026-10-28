import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  ChartNoAxesCombined,
  Gauge,
  Lightbulb,
} from "lucide-react";
import {
  getPredictions,
  getUsageSummary,
  getDailyUsage,
  getAlerts,
} from "../api";
import { useMeter } from "../hooks/useMeter";
import { useTranslation, useUnit } from "../utils/translate";
import { dailyPoints, dateText, energyText, isDemo } from "../utils/energy";
import EnergyChart from "./EnergyChart";
import { AlertSummary } from "./Alerts";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  MeterSelect,
  PageHeader,
  Segmented,
  TextLink,
} from "./ui";

export default function Analysis() {
  const recentSummary = useRef(null);
  const { t, currentLanguage } = useTranslation(),
    { unit } = useUnit(),
    meter = useMeter();
  const [range, setRange] = useState("7D"),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!meter.id) return;
    let active = true;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setLoading(true);
    setError(false);
    const cached = recentSummary.current;
    const reuse =
      cached?.id === meter.id &&
      cached.revision === revision &&
      Date.now() - cached.at < 60000;
    Promise.all([
      getUsageSummary(meter.id, range, options),
      getPredictions(meter.id, range, options),
      reuse ? cached.daily : getDailyUsage(meter.id, { ...options, limit: 90 }),
      reuse ? cached.alerts : getAlerts(options),
    ])
      .then(([summary, forecast, daily, alerts]) => {
        if (active) {
          if (!reuse)
            recentSummary.current = {
              id: meter.id,
              revision,
              at: Date.now(),
              daily,
              alerts,
            };
          setData({ summary, forecast, daily, alerts });
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [meter.id, range, revision]);
  const observed = dailyPoints(data?.daily || []).slice(
    -Math.min({ "24H": 1, "7D": 7, "30D": 30, "90D": 90 }[range], 60),
  );
  const points = observed.map((p) => ({
    label: dateText(p.label, currentLanguage).replace(/\s\d{4}$/, ""),
    value: p.value / (unit === "MWh" ? 1000 : 1),
  }));
  const predicted = observed.length
    ? (data?.forecast.predicted || []).map((value, i) => ({
        label: `+${i + 1} ${t("day")}`,
        value: Number(value) / (unit === "MWh" ? 1000 : 1),
      }))
    : [];
  return (
    <>
      <PageHeader
        title={t("usageTrends")}
        action={
          <MeterSelect
            devices={meter.devices}
            value={meter.id}
            onChange={meter.setId}
          />
        }
      />
      {isDemo(meter.device) && (
        <div className="demo-banner">{t("demoNote")}</div>
      )}
      <div className="toolbar">
        <Segmented
          label={t("period")}
          value={range}
          onChange={setRange}
          options={[
            ["24H", t("day")],
            ["7D", t("week")],
            ["30D", t("month")],
            ["90D", t("quarter")],
          ]}
        />
        <Badge>{t("latestRecords")}</Badge>
      </div>
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
      ) : (
        data && (
          <>
            <Card>
              <CardTitle
                icon={ChartNoAxesCombined}
                title={t("totalConsumption")}
                action={<Badge tone="blue">{range}</Badge>}
              />
              <div className="large-number">
                {energyText(data.summary.total_energy, unit)}
              </div>
              <EnergyChart
                points={points}
                forecast={predicted}
                unit={unit}
                title={t("forecast")}
              />
              <p className="note">
                {t("recordsNote")} {t("forecastNote")}
              </p>
            </Card>
            <div className="split-grid mt-5">
              <Card>
                <CardTitle icon={Gauge} title={t("monthlyLimit")} />
                <p className="small-label mb-4">{t("allMeters")}</p>
                <AlertSummary alerts={data.alerts} />
                <TextLink to="/profile">{t("limitSettings")}</TextLink>
              </Card>
              <Card className="insight-hero">
                <CardTitle icon={BrainCircuit} title={t("generalTips")} />
                {["tipTimers", "tipCooling", "tipReview"].map((key) => (
                  <div className="alert-card mb-3" key={key}>
                    <Lightbulb size={18} />
                    <p>{t(key)}</p>
                  </div>
                ))}
                <TextLink to="/insights">{t("aiCoach")}</TextLink>
              </Card>
            </div>
          </>
        )
      )}
    </>
  );
}

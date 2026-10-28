import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  List,
  TrendingUp,
  Zap,
} from "lucide-react";
import { getDailyUsage } from "../api";
import { useMeter } from "../hooks/useMeter";
import { useTranslation, useUnit } from "../utils/translate";
import {
  dailyPoints,
  dateText,
  energyText,
  isDemo,
  localDate,
} from "../utils/energy";
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
  Segmented,
  Stat,
  TextLink,
} from "./ui";

export default function History() {
  const { t, currentLanguage } = useTranslation(),
    { unit } = useUnit(),
    meter = useMeter();
  const [records, setRecords] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [period, setPeriod] = useState("30"),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!meter.id) return;
    let active = true;
    setLoading(true);
    setError(false);
    getDailyUsage(meter.id)
      .then((rows) => {
        if (active) setRecords(dailyPoints(rows));
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
  const end = localDate(),
    start = new Date(end + "T12:00:00");
  start.setDate(start.getDate() - Number(period) + 1);
  const cutoff = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const visible = records.filter((p) => p.label >= cutoff && p.label <= end),
    sum = visible.reduce((n, p) => n + p.value, 0);
  const fmt = (value) => energyText(value, unit);
  const chartPoints = visible.map((p) => ({
    label: dateText(p.label, currentLanguage).replace(/\s\d{4}$/, ""),
    value: p.value / (unit === "MWh" ? 1000 : 1),
  }));
  return (
    <>
      <PageHeader
        eyebrow={t("measuredEnergy")}
        title={t("history")}
        description={t("historyDescription")}
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
        <>
          <div className="toolbar">
            <Segmented
              label={t("period")}
              options={[
                ["1", t("day")],
                ["7", t("week")],
                ["30", t("month")],
                ["90", t("quarter")],
              ]}
              value={period}
              onChange={setPeriod}
            />
            <Badge>{t("usageScope")}</Badge>
          </div>
          {!visible.length ? (
            <EmptyState
              title={t("noReadingsFound")}
              description={t("historyPeriodNote")}
            />
          ) : (
            <>
              <div className="stats-grid">
                <Stat
                  label={t("totalConsumption")}
                  value={fmt(sum)}
                  icon={Zap}
                />
                <Stat
                  label={t("dailyAvg")}
                  value={fmt(sum / visible.length)}
                  icon={ChartNoAxesCombined}
                  hint={t("latestRecords")}
                />
                <Stat
                  label={t("highestDay")}
                  value={fmt(Math.max(...visible.map((p) => p.value)))}
                  icon={TrendingUp}
                  tone="amber"
                />
                <Stat
                  label={t("records")}
                  value={visible.length}
                  icon={List}
                  tone="violet"
                />
              </div>
              <Card>
                <CardTitle
                  icon={ChartNoAxesCombined}
                  title={t("totalConsumption")}
                />
                <EnergyChart
                  points={chartPoints}
                  unit={unit}
                  title={t("history")}
                  type="bar"
                />
                <p className="note">{t("historyPeriodNote")}</p>
              </Card>
              <Card className="mt-5">
                <CardTitle icon={CalendarDays} title={t("dailyRecords")} />
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("date")}</th>
                        <th>{t("unitsConsumed")}</th>
                        <th>{t("status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...visible].reverse().map((row) => {
                        const index = records.findIndex(
                            (r) => r.label === row.label,
                          ),
                          previous = records[index - 1];
                        const trend = !previous
                          ? null
                          : row.value > previous.value
                            ? "higher"
                            : row.value < previous.value
                              ? "lower"
                              : "equal";
                        return (
                          <tr key={row.label}>
                            <td>{dateText(row.label, currentLanguage)}</td>
                            <td>
                              <strong>{fmt(row.value)}</strong>
                            </td>
                            <td>
                              <span
                                className={
                                  trend === "higher"
                                    ? "trend-up"
                                    : trend === "lower"
                                      ? "trend-down"
                                      : "muted"
                                }
                                title={
                                  !previous
                                    ? t("noComparison")
                                    : `${t("date")}: ${previous.label}`
                                }
                              >
                                {trend ? t(trend) : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Cpu,
  Gauge,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { useTranslation, useUnit } from "../utils/translate";
import {
  createDemoData,
  getDevices,
  getReadings,
  getAlerts,
  getDailyUsage,
} from "../api";
import { useAuth } from "../AuthContext";
import { energyText, isDemo, localDate, numeric } from "../utils/energy";
import { AlertSummary } from "./Alerts";
import EnergyChart from "./EnergyChart";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  EnergyGauge,
  ErrorState,
  LoadingState,
  PageHeader,
  Stat,
  TextLink,
} from "./ui";

export default function HomeDashboard() {
  const { t } = useTranslation(),
    { unit } = useUnit(),
    { user } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState(false),
    [demoBusy, setDemoBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true,
      pending = false;
    async function load() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const [devices, alerts] = await Promise.all([
          getDevices(),
          getAlerts(),
        ]);
        const [readings, daily] = devices.length
          ? await Promise.all([
              getReadings(devices[0].id),
              getDailyUsage(devices[0].id),
            ])
          : [[], []];
        if (active) {
          setData({ devices, alerts, readings, daily });
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        pending = false;
      }
    }
    load();
    const interval = window.setInterval(load, 15000);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", load);
    };
  }, [version]);
  async function loadDemo() {
    setDemoBusy(true);
    try {
      await createDemoData();
      setVersion((v) => v + 1);
    } catch {
      setError(true);
    } finally {
      setDemoBusy(false);
    }
  }
  const fmt = (value) => energyText(value, unit);
  const firstName = (
    user?.appUser?.full_name ||
    user?.firebaseUser?.displayName ||
    ""
  ).split(" ")[0];
  const device = data?.devices[0],
    alerts = data?.alerts;
  const today = data?.daily.find(
    (row) => row.date === localDate(user?.appUser?.timezone),
  );
  const power = [...(data?.readings || [])]
    .slice(0, 24)
    .reverse()
    .filter((r) => numeric(r.power) !== null)
    .map((r) => ({
      label: new Date(r.recorded_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      value: Number(r.power) / 1000,
    }));
  return (
    <>
      <PageHeader
        eyebrow={t("overview")}
        title={`${t("greeting")}${firstName ? `, ${firstName}` : ""}.`}
        description={t("dashboardDescription")}
        action={
          <Link className="button secondary" to="/devices">
            <Cpu size={16} />
            {t("devices")}
          </Link>
        }
      />
      {error && <ErrorState onRetry={() => setVersion((v) => v + 1)} />}
      {!data && !error ? (
        <LoadingState />
      ) : (
        data && (
          <>
            {data.devices.some(isDemo) && (
              <div className="demo-banner">
                <Sparkles size={16} />
                <span>{t("demoNote")}</span>
              </div>
            )}
            {!device ? (
              <EmptyState
                icon={Zap}
                title={t("noDeviceFound")}
                description={t("noMeterDescription")}
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link className="button" to="/devices">
                      <Cpu size={16} />
                      {t("connectMeter")}
                    </Link>
                    <button
                      className="button secondary"
                      disabled={demoBusy}
                      onClick={loadDemo}
                    >
                      {demoBusy ? t("sampleDataLoading") : t("sampleData")}
                    </button>
                  </div>
                }
              />
            ) : (
              <>
                <div className="dashboard-grid">
                  <Card className="energy-card">
                    <CardTitle
                      icon={Zap}
                      title={t("thisMonth")}
                      action={
                        <Badge
                          tone={
                            alerts.status === "exceeded"
                              ? "red"
                              : alerts.status === "warning"
                                ? "amber"
                                : "green"
                          }
                        >
                          {t(
                            alerts.status === "exceeded"
                              ? "alertExceeded"
                              : alerts.status === "warning"
                                ? "alertWarning"
                                : "alertOk",
                          )}
                        </Badge>
                      }
                    />
                    <EnergyGauge
                      value={alerts.current_usage}
                      limit={alerts.monthly_limit}
                      format={fmt}
                      label={t("totalConsumption")}
                    />
                    <div className="gauge-footer">
                      <div>
                        <span>{t("monthlyLimit")}</span>
                        <strong>{fmt(alerts.monthly_limit)}</strong>
                      </div>
                      <div>
                        <span>{t("remaining")}</span>
                        <strong>{fmt(alerts.remaining)}</strong>
                      </div>
                    </div>
                    <p className="note text-center">{t("allMeters")}</p>
                  </Card>
                  <div className="stack">
                    <Card>
                      <CardTitle
                        icon={Activity}
                        title={t("recentPower")}
                        action={
                          <Badge
                            tone={
                              isDemo(device)
                                ? "amber"
                                : device.status === "online"
                                  ? "green"
                                  : "neutral"
                            }
                          >
                            {isDemo(device)
                              ? t("demo")
                              : t(
                                  ["online", "offline"].includes(device.status)
                                    ? device.status
                                    : "unknown",
                                )}
                          </Badge>
                        }
                      />
                      <p className="small-label">{device.device_name}</p>
                      {power.length ? (
                        <EnergyChart
                          points={power}
                          title={t("recentPower")}
                          unit="kW"
                        />
                      ) : (
                        <div className="chart-empty">
                          {t("noReadingsFound")}
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="section-label">{t("quickActions")}</p>
                  <div className="action-grid quick-actions">
                    {[
                      ["/history", "history", CalendarDays],
                      ["/profile", "limitSettings", Gauge],
                      ["/devices", "connectMeter", Cpu],
                    ].map(([to, key, Icon]) => (
                      <Link className="action-tile" key={to} to={to}>
                        <Icon />
                        <span>{t(key)}</span>
                        <ArrowUpRight size={14} className="ml-auto" />
                      </Link>
                    ))}
                    <button
                      className="action-tile"
                      onClick={loadDemo}
                      disabled={demoBusy}
                    >
                      <Sparkles />
                      <span>
                        {demoBusy ? t("sampleDataLoading") : t("sampleData")}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="stats-grid">
                  <Stat
                    icon={Zap}
                    label={t("todaysUsage")}
                    value={fmt(today?.total_energy)}
                    hint={device.device_name}
                  />
                  <Stat
                    icon={CalendarDays}
                    tone="green"
                    label={t("thisMonth")}
                    value={fmt(alerts.current_usage)}
                    hint={t("allMeters")}
                  />
                  <Stat
                    icon={ChartNoAxesCombined}
                    tone="violet"
                    label={t("nextSeven")}
                    value={fmt(alerts.predicted_next_7d_total)}
                    hint={t("predicted")}
                  />
                  <Stat
                    icon={Wallet}
                    tone="amber"
                    label={t("costEstimate")}
                    value="—"
                    hint={t("tariffMissing")}
                  />
                </div>
                <div className="split-grid">
                  <Card>
                    <CardTitle
                      icon={Bell}
                      title={t("usageAlerts")}
                      action={<TextLink to="/alerts">{t("viewAll")}</TextLink>}
                    />
                    <AlertSummary alerts={alerts} />
                  </Card>
                  <Card className="insight-hero">
                    <CardTitle icon={Sparkles} title={t("aiCoach")} />
                    <p className="small-label">{t("projectedTotal")}</p>
                    <p className="large-number">
                      {fmt(alerts.projected_month_total)}
                    </p>
                    <p className="muted text-xs leading-relaxed">
                      {t("forecastNote")}
                    </p>
                    <TextLink to="/insights">{t("insights")}</TextLink>
                    <div className="nav-divider" />
                    <p className="note">{t("tariffNote")}</p>
                  </Card>
                </div>
              </>
            )}
          </>
        )
      )}
    </>
  );
}

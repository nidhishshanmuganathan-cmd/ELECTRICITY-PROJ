import { useMemo } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { meterStatus } from "../utils/meterStatus";
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

import { useAuth } from "../AuthContext";
import {
  dateText,
  energyText,
  isDemo,
  localDate,
  numeric,
} from "../utils/energy";
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
  const { t, currentLanguage } = useTranslation(),
    { unit } = useUnit(),
    { user } = useAuth();
  const { data, error, summaryError, offline, now, refresh } = useDashboardData(
    user?.firebaseUser?.uid,
  );
  const fmt = (value) => energyText(value, unit);
  const device = data?.device,
    alerts = data?.alerts;
  const today = data?.daily?.find(
    (row) => row.date === localDate(user?.appUser?.timezone),
  );
  const connectionState = meterStatus(device, data?.readings?.[0], now);
  const power = useMemo(
    () =>
      [...(data?.readings || [])]
        .slice(0, 24)
        .reverse()
        .filter((r) => numeric(r.power) !== null)
        .map((r) => ({
          label: new Date(r.recorded_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          value: Number(r.power) / 1000,
        })),
    [data?.readings],
  );
  return (
    <>
      <PageHeader
        title={t("dashboardDescription")}
        action={
          <Link className="button secondary" to="/devices">
            <Cpu size={16} />
            {t("devices")}
          </Link>
        }
      />
      {(error || offline) && (
        <ErrorState
          message={t(
            offline ? "offlinePreview" : data ? "refreshFailed" : "retryHint",
          )}
          onRetry={refresh}
        />
      )}
      {summaryError && (
        <ErrorState message={t("summaryFailed")} onRetry={refresh} />
      )}
      {!data && !error && !offline ? (
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
                        alerts && (
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
                        )
                      }
                    />
                    {alerts ? (
                      <EnergyGauge
                        value={alerts?.current_usage}
                        limit={alerts?.monthly_limit}
                        format={fmt}
                        label={t("totalConsumption")}
                      />
                    ) : (
                      <p className="summary-placeholder" role="status">
                        {t(summaryError ? "summaryUnavailable" : "loadingData")}
                      </p>
                    )}
                    <div className="gauge-footer">
                      <div>
                        <span>{t("monthlyLimit")}</span>
                        <strong>{fmt(alerts?.monthly_limit)}</strong>
                      </div>
                      <div>
                        <span>{t("remaining")}</span>
                        <strong>{fmt(alerts?.remaining)}</strong>
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
                              connectionState === "connected"
                                ? "green"
                                : connectionState === "staleReadings"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {t(connectionState)}
                          </Badge>
                        }
                      />
                      <p className="small-label">{device.device_name}</p>
                      <div className="meter-summary">
                        <div>
                          <span className="small-label">
                            {t("latestReading")}
                          </span>
                          <br />
                          <strong>
                            {numeric(data.readings?.[0]?.power) === null
                              ? "—"
                              : `${(Number(data.readings[0].power) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} kW`}
                          </strong>
                        </div>
                        <small>
                          {t("lastReadingReceived")}:{" "}
                          {dateText(
                            data.readings?.[0]?.recorded_at,
                            currentLanguage,
                          )}
                          {data.readings?.[0]?.recorded_at
                            ? ` · ${new Date(data.readings?.[0]?.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </small>
                      </div>
                      {connectionState === "staleReadings" && (
                        <p className="note mb-3">{t("staleHint")}</p>
                      )}
                      {connectionState === "disconnected" && (
                        <TextLink to="/devices">{t("checkMeter")}</TextLink>
                      )}
                      {!data.readingsLoaded && !error ? (
                        <p className="chart-empty" role="status">
                          {t("loadingData")}
                        </p>
                      ) : power.length ? (
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
                    tone="violet"
                    label={t("thisMonth")}
                    value={fmt(alerts?.current_usage)}
                    hint={t("allMeters")}
                  />
                  <Stat
                    icon={ChartNoAxesCombined}
                    tone="violet"
                    label={t("nextSeven")}
                    value={fmt(alerts?.predicted_next_7d_total)}
                    hint={t("predicted")}
                  />
                  <Stat
                    icon={Wallet}
                    tone="violet"
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
                    {alerts ? (
                      <AlertSummary alerts={alerts} />
                    ) : (
                      <p className="note">
                        {t(summaryError ? "summaryUnavailable" : "loadingData")}
                      </p>
                    )}
                  </Card>
                  <Card className="insight-hero">
                    <CardTitle icon={Sparkles} title={t("aiCoach")} />
                    <p className="small-label">{t("projectedTotal")}</p>
                    <p className="large-number">
                      {fmt(alerts?.projected_month_total)}
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

import { useEffect, useState } from "react";
import { Bell, ShieldCheck, TrendingUp, TriangleAlert } from "lucide-react";
import { getAlerts } from "../api";
import { useTranslation, useUnit } from "../utils/translate";
import { energyText } from "../utils/energy";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  TextLink,
} from "./ui";

export function AlertSummary({ alerts }) {
  const { t } = useTranslation(),
    { unit } = useUnit();
  if (!alerts?.devices?.length)
    return (
      <EmptyState
        icon={Bell}
        title={t("noDeviceFound")}
        description={t("noMeterDescription")}
        action={<TextLink to="/devices">{t("connectMeter")}</TextLink>}
      />
    );
  const status = alerts.status,
    title =
      status === "exceeded"
        ? "alertExceeded"
        : status === "warning"
          ? "alertWarning"
          : "alertOk";
  const Icon = status === "ok" ? ShieldCheck : TriangleAlert;
  return (
    <div className="stack">
      <div className={`alert-card ${status}`}>
        <Icon size={23} />
        <div className="flex-1 min-w-0">
          <div className="split-heading">
            <h3>{t(title)}</h3>
            <Badge
              tone={
                status === "exceeded"
                  ? "red"
                  : status === "warning"
                    ? "amber"
                    : "green"
              }
            >
              {Number(alerts.usage_percent).toFixed(1)}%
            </Badge>
          </div>
          <p>
            {energyText(alerts.current_usage, unit)} /{" "}
            {energyText(alerts.monthly_limit, unit)}
          </p>
          <div className="progress-track">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, Number(alerts.usage_percent) || 0))}%`,
                ...(status === "exceeded"
                  ? { background: "var(--red)" }
                  : status === "warning"
                    ? { background: "var(--amber)" }
                    : {}),
              }}
            />
          </div>
          <div className="budget-details">
            <span>{t("remaining")}</span>
            <strong>{energyText(alerts.remaining, unit)}</strong>
          </div>
        </div>
      </div>
      {alerts.predicted_will_exceed && (
        <div className="alert-card warning">
          <TrendingUp size={22} />
          <div>
            <h3>{t("forecastBreach")}</h3>
            <p>
              {t("projectedTotal")}:{" "}
              {energyText(alerts.projected_month_total, unit)}
            </p>
            <p>{t("forecastNote")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Alerts() {
  const { t } = useTranslation();
  const [data, setData] = useState(null),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    getAlerts()
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [version]);
  return (
    <>
      <PageHeader
        eyebrow={t("smartEnergy")}
        title={t("usageAlerts")}
        description={t("alertsDescription")}
        action={<TextLink to="/profile">{t("pushSettings")}</TextLink>}
      />
      {error ? (
        <ErrorState onRetry={() => setVersion((v) => v + 1)} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div className="split-grid">
          <Card>
            <CardTitle icon={Bell} title={t("usageAlerts")} />
            <p className="note mb-5">{t("currentSnapshot")}</p>
            <AlertSummary alerts={data} />
          </Card>
          <Card>
            <CardTitle icon={ShieldCheck} title={t("notifications")} />
            <p className="muted text-sm leading-relaxed">
              {t("notificationHelp")}
            </p>
            <TextLink to="/profile">{t("pushSettings")}</TextLink>
          </Card>
        </div>
      )}
    </>
  );
}

import { meterStatus } from "../utils/meterStatus";
import { useEffect, useState } from "react";
import { Check, Copy, Cpu, Plus, Radio, Sparkles } from "lucide-react";
import { addDevice, getDevices, provisionDeviceToken } from "../api";
import { useTranslation } from "../utils/translate";
import { dateText, isDemo } from "../utils/energy";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "./ui";

const initialForm = {
  device_name: "",
  device_code: "",
  location: "",
  wifi_ssid: "",
  firmware_version: "",
};
export default function Devices() {
  const { t, currentLanguage } = useTranslation();
  const [devices, setDevices] = useState([]),
    [form, setForm] = useState(initialForm),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(null),
    [token, setToken] = useState(null),
    [copied, setCopied] = useState(false),
    [pendingId, setPendingId] = useState(null);
  async function loadDevices() {
    setLoading(true);
    try {
      setDevices(await getDevices());
    } catch {
      setError(t("apiError"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadDevices();
  }, []);
  const update = (e) =>
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  async function provision(id) {
    const result = await provisionDeviceToken(id);
    setToken(result.device_token);
    setCopied(false);
    setPendingId(null);
  }
  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => [k, v.trim()]),
      );
      const device = await addDevice(payload);
      setPendingId(device.id);
      setForm(initialForm);
      try {
        await provision(device.id);
      } catch {
        setError(t("provisioningFailed"));
      }
      await loadDevices();
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }
  async function retryProvision() {
    setSaving(true);
    try {
      await provision(pendingId);
      setError(null);
    } catch {
      setError(t("provisioningFailed"));
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setError(t("copyFailed"));
    }
  }
  return (
    <>
      <PageHeader
        title={t("yourMeters")}
        action={
          <Badge tone="blue">
            <Cpu size={13} />
            {devices.length} {t("devices")}
          </Badge>
        }
      />
      {error && (
        <ErrorState
          message={error}
          onRetry={pendingId ? retryProvision : loadDevices}
        />
      )}
      {token && (
        <Card className="mb-5">
          <CardTitle
            icon={Check}
            title={t("registered")}
            action={<Badge tone="green">{t("deviceCode")}</Badge>}
          />
          <p className="muted text-xs leading-relaxed">
            {t("tokenInstructions")}
          </p>
          <code className="token-block">{token}</code>
          <button className="button secondary" onClick={copy}>
            <Copy size={15} />
            {copied ? t("copied") : t("copyToken")}
          </button>
        </Card>
      )}
      <div className="split-grid">
        <Card>
          <CardTitle icon={Plus} title={t("newMeter")} />
          <p className="note mb-5">{t("meterInstructions")}</p>
          <form onSubmit={submit}>
            <label className="form-field">
              {t("meterName")}
              <input
                name="device_name"
                required
                maxLength="100"
                autoComplete="off"
                value={form.device_name}
                onChange={update}
              />
            </label>
            <label className="form-field">
              {t("deviceCode")}
              <input
                name="device_code"
                required
                minLength="3"
                pattern="[A-Za-z0-9_-]+"
                maxLength="20"
                autoComplete="off"
                autoCapitalize="none"
                value={form.device_code}
                onChange={update}
              />
            </label>
            <label className="form-field">
              {t("location")} · {t("optional")}
              <input
                name="location"
                maxLength="100"
                value={form.location}
                onChange={update}
              />
            </label>
            <button disabled={saving || !!pendingId} className="button full">
              <Plus size={16} />
              {saving ? t("saving") : t("connectMeter")}
            </button>
          </form>
          {pendingId && (
            <button
              className="button secondary full mt-3"
              disabled={saving}
              onClick={retryProvision}
            >
              {t("retryProvision")}
            </button>
          )}
        </Card>
        <Card>
          <CardTitle icon={Radio} title={t("yourMeters")} />
          {loading ? (
            <LoadingState />
          ) : devices.length ? (
            <div className="device-list">
              {devices.map((d) => (
                <div className="device-row" key={d.id}>
                  <div className="device-row-header">
                    <h3>{d.device_name}</h3>
                    <Badge
                      tone={
                        isDemo(d)
                          ? "neutral"
                          : meterStatus(d) === "connected"
                            ? "green"
                            : "neutral"
                      }
                    >
                      {isDemo(d) ? t("demo") : t(meterStatus(d))}
                    </Badge>
                  </div>
                  <p>
                    {d.device_code}
                    {d.location ? ` · ${d.location}` : ""}
                  </p>
                  <p>
                    {t("lastSeen")}: {dateText(d.last_seen, currentLanguage)}
                    {d.last_seen
                      ? ` · ${new Date(d.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                  {isDemo(d) && <p className="muted">{t("demoNote")}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Cpu}
              title={t("noDeviceFound")}
              description={t("noMeterDescription")}
            />
          )}
        </Card>
      </div>
    </>
  );
}

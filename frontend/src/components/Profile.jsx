import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Cpu,
  Gauge,
  LogOut,
  Minus,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../AuthContext";
import { sendPushTest, updateUserProfile } from "../api";
import {
  enablePushNotifications,
  disablePushNotifications,
  pushEnabled,
} from "../notifications";
import {
  useTranslation,
  setLanguage,
  useUnit,
  setEnergyUnit,
} from "../utils/translate";
import { energyText } from "../utils/energy";
import { Badge, Card, CardTitle, Modal, PageHeader, Segmented } from "./ui";

export default function Profile() {
  const { user, updateAppUser } = useAuth(),
    { t, currentLanguage } = useTranslation(),
    { unit } = useUnit();
  const [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(null),
    [formError, setFormError] = useState(null);
  const [notifications, setNotifications] = useState(pushEnabled()),
    [notifBusy, setNotifBusy] = useState(false),
    [notifError, setNotifError] = useState(null);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("wattwatcher_theme") !== "light",
  );
  const monthlyLimit = Number(user?.appUser?.monthly_limit ?? 500);
  const [tempLimit, setTempLimit] = useState(monthlyLimit),
    [tempPrefs, setTempPrefs] = useState({ language: currentLanguage, unit });
  const personalInfo = {
    fullName: user?.appUser?.full_name || user?.firebaseUser?.displayName || "",
    email: user?.appUser?.email || user?.firebaseUser?.email || "",
    phone: user?.appUser?.phone || "",
    address: user?.appUser?.address || "",
  };
  const [tempInfo, setTempInfo] = useState(personalInfo);
  useEffect(() => {
    if (!modal) setTempInfo(personalInfo);
  }, [user?.appUser]);
  useEffect(() => {
    setTempLimit(monthlyLimit);
  }, [monthlyLimit]);
  function open(name) {
    setFormError(null);
    setTempInfo(personalInfo);
    setTempLimit(monthlyLimit);
    setTempPrefs({ language: currentLanguage, unit });
    setModal(name);
  }
  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("wattwatcher_theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("themeChange"));
  }
  async function handlePushTest() {
    if (notifBusy) return;
    setNotifBusy(true);
    setNotifError(null);
    try {
      const registration = await enablePushNotifications();
      if (!registration.ok) throw new Error(registration.message);
      const result = await sendPushTest();
      if (result.status !== "accepted_by_fcm" || !result.message_id)
        throw new Error(t("pushUnconfirmed"));
      setNotifications(true);
      setNotifError(t("pushAccepted"));
    } catch (error) {
      setNotifError(error.message || t("pushFailed"));
    } finally {
      setNotifBusy(false);
    }
  }
  async function handleToggleNotifications() {
    if (notifBusy) return;
    if (notifications) {
      setNotifBusy(true);
      try {
        await disablePushNotifications();
        setNotifications(false);
        setNotifError(null);
      } catch {
        setNotifError(t("disableFailed"));
      } finally {
        setNotifBusy(false);
      }
      return;
    }
    if (!user?.appUser?.phone) {
      open("personal");
      setNotifError(t("savePhoneFirst"));
      return;
    }
    setNotifBusy(true);
    setNotifError(null);
    const result = await enablePushNotifications();
    setNotifBusy(false);
    setNotifications(result.ok);
    if (!result.ok) setNotifError(result.message);
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      if (modal === "personal") {
        const updated = await updateUserProfile({
          full_name: tempInfo.fullName,
          phone: tempInfo.phone || null,
          address: tempInfo.address || null,
        });
        updateAppUser({
          full_name: updated.full_name,
          phone: updated.phone,
          address: updated.address,
        });
        setMessage(t("profileSaved"));
      } else if (modal === "limit") {
        const updated = await updateUserProfile({
          monthly_limit: Number(tempLimit),
        });
        updateAppUser({ monthly_limit: updated.monthly_limit });
        setMessage(t("limitSaved"));
      } else {
        setLanguage(tempPrefs.language);
        setEnergyUnit(tempPrefs.unit);
        setMessage(t("settingsSaved"));
      }
      setModal(null);
    } catch {
      setFormError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      if (pushEnabled()) await disablePushNotifications();
      await signOut(auth);
    } catch {
      setMessage(t("signOutFailed"));
    } finally {
      setBusy(false);
    }
  }
  const settings = [
    {
      icon: UserRound,
      title: t("personalInfo"),
      description: t("fullName") + ", " + t("phone"),
      action: () => open("personal"),
    },
    {
      icon: Gauge,
      title: t("monthlyLimit"),
      description: energyText(monthlyLimit, unit),
      action: () => open("limit"),
    },
    {
      icon: darkMode ? Moon : Sun,
      title: t("darkMode"),
      description: t(darkMode ? "enabled" : "disabled"),
      action: toggleDarkMode,
      toggle: darkMode,
    },
    {
      icon: Settings,
      title: t("preferences"),
      description: `${currentLanguage} · ${unit}`,
      action: () => open("preferences"),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={t("account")}
        title={t("profile")}
        description={t("profileDescription")}
      />
      {message && (
        <div className="toast mb-5" role="status">
          <Check size={18} />
          <span className="flex-1">{message}</span>
          <button className="button subtle" onClick={() => setMessage(null)}>
            {t("dismiss")}
          </button>
        </div>
      )}
      <div className="split-grid profile-layout">
        <div className="stack self-start">
          <Card className="profile-identity">
            <div className="avatar">
              {(personalInfo.fullName || "W").charAt(0).toUpperCase()}
            </div>
            <h2>{personalInfo.fullName}</h2>
            <p>{personalInfo.email}</p>
            <Badge tone="blue">
              <ShieldCheck size={13} />
              {t("authSecurity")}
            </Badge>
          </Card>
          <Link className="button secondary full" to="/devices">
            <Cpu size={18} />
            {t("devices")}
          </Link>
          <button
            onClick={logout}
            disabled={busy}
            className="button danger full"
          >
            <LogOut size={17} />
            {t("signOut")}
          </button>
        </div>
        <div className="stack">
          <Card>
            <CardTitle icon={Settings} title={t("appSettings")} />
            {settings.map(
              ({ icon: Icon, title, description, action, toggle }) => (
                <button
                  key={title}
                  className="settings-row"
                  onClick={action}
                  role={toggle !== undefined ? "switch" : undefined}
                  aria-checked={toggle}
                  aria-label={title}
                >
                  <span className="settings-icon">
                    <Icon size={19} />
                  </span>
                  <span className="settings-copy">
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  {toggle !== undefined ? (
                    <span
                      aria-hidden="true"
                      className={`switch-track ${toggle ? "on" : ""}`}
                    >
                      <i />
                    </span>
                  ) : (
                    <ChevronRight size={17} className="muted" />
                  )}
                </button>
              ),
            )}
          </Card>
          <Card>
            <CardTitle icon={Bell} title={t("notifications")} />
            <button
              className="settings-row"
              role="switch"
              aria-checked={notifications}
              disabled={notifBusy}
              onClick={handleToggleNotifications}
              aria-label={t("notifications")}
            >
              <span className="settings-icon">
                <Bell size={19} />
              </span>
              <span className="settings-copy">
                <strong>{t("enableNotifications")}</strong>
                <small>{t(notifications ? "enabled" : "disabled")}</small>
              </span>
              <span
                className={`switch-track ${notifications ? "on" : ""}`}
                aria-hidden="true"
              >
                <i />
              </span>
            </button>
            <p className="note">{t("notificationHelp")}</p>
            {notifError && (
              <p className="note" role="status">
                {notifError}
              </p>
            )}
            {notifications && (
              <button
                className="button secondary full mt-5"
                disabled={notifBusy}
                onClick={handlePushTest}
              >
                <Bell size={16} />
                {notifBusy ? t("sending") : t("testPush")}
              </button>
            )}
          </Card>
        </div>
      </div>
      {modal && (
        <Modal
          title={t(
            modal === "personal"
              ? "personalInfo"
              : modal === "limit"
                ? "setMonthlyLimit"
                : "preferences",
          )}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form onSubmit={save}>
            {modal === "personal" ? (
              <>
                {[
                  ["fullName", "fullName", "text", "name"],
                  ["email", "email", "email", "email"],
                  ["phone", "phone", "tel", "tel"],
                  ["address", "address", "text", "street-address"],
                ].map(([key, label, type, autoComplete]) => (
                  <label className="form-field" key={key}>
                    {t(label)}
                    <input
                      type={type}
                      autoComplete={autoComplete}
                      value={tempInfo[key]}
                      readOnly={key === "email"}
                      required={key === "fullName"}
                      maxLength={
                        key === "fullName" ? 100 : key === "phone" ? 20 : 255
                      }
                      onChange={(e) =>
                        setTempInfo({ ...tempInfo, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </>
            ) : modal === "limit" ? (
              <>
                <p className="note">{t("adjustLimitDesc")}</p>
                <div className="limit-control">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setTempLimit(Math.max(50, Number(tempLimit) - 50))
                    }
                    aria-label={`${t("monthlyLimit")} −50 kWh`}
                  >
                    <Minus size={20} />
                  </button>
                  <div>
                    <strong>{tempLimit}</strong>
                    <small>kWh</small>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setTempLimit(Math.min(100000, Number(tempLimit) + 50))
                    }
                    aria-label={`${t("monthlyLimit")} +50 kWh`}
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <label className="form-field">
                  {t("monthlyLimit")} (kWh)
                  <input
                    type="number"
                    required
                    min="1"
                    max="100000"
                    step="any"
                    value={tempLimit}
                    onChange={(e) => setTempLimit(e.target.value)}
                  />
                </label>
                <input
                  type="range"
                  aria-label={t("monthlyLimit")}
                  min="50"
                  max={Math.max(2000, Number(tempLimit) || 2000)}
                  step="10"
                  value={tempLimit}
                  onChange={(e) => setTempLimit(Number(e.target.value))}
                />
                <Segmented
                  label={t("monthlyLimit")}
                  options={[200, 500, 750, 1000].map((n) => [n, String(n)])}
                  value={Number(tempLimit)}
                  onChange={setTempLimit}
                />
              </>
            ) : (
              <>
                <label className="form-field">
                  {t("language")}
                  <select
                    value={tempPrefs.language}
                    onChange={(e) =>
                      setTempPrefs({ ...tempPrefs, language: e.target.value })
                    }
                  >
                    {["English", "Hindi", "Tamil", "Telugu"].map((lang) => (
                      <option key={lang}>{lang}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  {t("energyUnit")}
                  <select
                    value={tempPrefs.unit}
                    onChange={(e) =>
                      setTempPrefs({ ...tempPrefs, unit: e.target.value })
                    }
                  >
                    {["kWh", "MWh", "Units"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {formError && (
              <p className="field-error mt-4" role="alert">
                {formError}
              </p>
            )}
            <button disabled={busy} className="button full mt-6">
              <Check size={17} />
              {busy
                ? t("saving")
                : t(
                    modal === "limit"
                      ? "saveLimit"
                      : modal === "preferences"
                        ? "savePreferences"
                        : "saveChanges",
                  )}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

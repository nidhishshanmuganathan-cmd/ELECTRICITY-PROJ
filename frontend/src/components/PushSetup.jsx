import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { useAuth } from "../AuthContext";
import { updateUserProfile } from "../api";
import { enablePushNotifications, pushEnabled } from "../notifications";
import { useTranslation } from "../utils/translate";

export default function PushSetup() {
  const { user, updateAppUser } = useAuth(),
    { t } = useTranslation();
  const [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  if (!user || done || pushEnabled()) return null;
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await updateUserProfile({ phone });
      updateAppUser(updated);
      setMessage(t("phoneSaved"));
    } catch {
      setMessage(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function enable() {
    setBusy(true);
    const result = await enablePushNotifications();
    setBusy(false);
    if (result.ok) setDone(true);
    else setMessage(result.message);
  }
  return (
    <details className="push-setup">
      <summary>
        <Bell size={18} />
        {t("notificationSetup")}
        <ChevronDown size={16} className="ml-auto" />
      </summary>
      <p>{t("installHint")}</p>
      {!user.appUser?.phone ? (
        <form onSubmit={save}>
          <label className="form-field mt-4">
            {t("phone")}
            <input
              required
              type="tel"
              autoComplete="tel"
              pattern="\+?[0-9 ()-]{10,20}"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button disabled={busy} className="button secondary">
            {busy ? t("saving") : t("savePhone")}
          </button>
        </form>
      ) : (
        <button className="button mt-3" disabled={busy} onClick={enable}>
          {busy ? t("saving") : t("enableNotifications")}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}

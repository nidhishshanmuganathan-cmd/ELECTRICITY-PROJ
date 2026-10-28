// Store a canonical Indian mobile number. This does not enable SMS or push.
export function normalizeIndianPhone(value, { required = false } = {}) {
  const input = value.trim();
  if (!input && !required) return null;
  const compact = input.replace(/[ ()-]/g, "");
  const match = compact.match(/^(?:\+?91)?([6-9][0-9]{9})$/);
  if (value.length > 30 || !/^[+0-9 ()-]+$/.test(input) || !match) {
    throw Object.assign(new Error("Invalid Indian mobile number"), { code: "invalidPhone" });
  }
  return "+91" + match[1];
}

export function confirmSavedPhone(updated, expected) {
  if (!updated || updated.phone !== expected) {
    throw Object.assign(new Error("The server did not confirm the saved phone number"), {
      code: "saveUnconfirmed",
    });
  }
}

export function profileSaveError(error, t) {
  if (["invalidPhone", "saveUnconfirmed"].includes(error.code)) return t(error.code);
  if (error.status === 401 || error.status === 403) return t("saveSignInAgain");
  if (error.status === 409 && error.message === "This phone number cannot be used for this account.") return t("phoneConflict");
  if (error.status === 422 && error.fields?.includes("phone")) return t("invalidPhone");
  if (error instanceof TypeError) return t("saveNetworkError");
  return t("saveFailed");
}

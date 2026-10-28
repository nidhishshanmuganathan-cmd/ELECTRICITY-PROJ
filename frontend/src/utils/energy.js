export const finite = (value) =>
  value !== null && value !== "" && Number.isFinite(Number(value));
export const numeric = (value) => (finite(value) ? Number(value) : null);
export const energyText = (value, unit = "kWh") =>
  !finite(value)
    ? "—"
    : `${(Number(value) / (unit === "MWh" ? 1000 : 1)).toLocaleString(undefined, { maximumFractionDigits: unit === "MWh" ? 3 : 2 })} ${unit}`;
export const dailyPoints = (rows) =>
  [...rows]
    .filter((row) => finite(row.total_energy))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ label: row.date, value: Number(row.total_energy) }));
export const isDemo = (device) =>
  !!device?.device_code?.startsWith("DEMO-");
export function localDate(timeZone = "Asia/Kolkata") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
export function dateText(value, language = "English") {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(
    { English: "en-IN", Hindi: "hi-IN", Tamil: "ta-IN", Telugu: "te-IN" }[
      language
    ],
    { day: "numeric", month: "short", year: "numeric" },
  );
}

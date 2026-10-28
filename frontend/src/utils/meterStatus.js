export const STALE_AFTER_MS = 120000;
// Stale means no recent telemetry, not proof that the hardware disconnected.
export function meterStatus(device, reading, now = Date.now()) {
  if (!device) return "noDeviceFound";
  if (device.device_code?.startsWith("DEMO-")) return "demo";
  if (device.status === "offline") return "disconnected";
  const lastSeen = Date.parse(device.last_seen);
  const recorded = Date.parse(reading?.recorded_at);
  const stamp = reading ? recorded : lastSeen;
  if (!Number.isFinite(stamp) || stamp > now + 60000) return "unknown";
  if (
    now - stamp > STALE_AFTER_MS ||
    (Number.isFinite(lastSeen) && now - lastSeen > STALE_AFTER_MS)
  )
    return "staleReadings";
  return device.status === "online" &&
    Number.isFinite(lastSeen) &&
    lastSeen <= now + 60000
    ? "connected"
    : "unknown";
}

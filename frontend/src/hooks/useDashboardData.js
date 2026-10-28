import { useEffect, useRef, useState } from "react";
import { getDevices, getReadings, getDailyUsage, getAlerts } from "../api";
import { preferredMeter } from "../utils/energy";
import { startVisiblePolling } from "../utils/polling";

// REST ingestion updates last_seen on each upload. There is no streaming API.
export function useDashboardData(
  userId,
  { intervalMs = 15000, summaryMs = 60000 } = {},
) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [offline, setOffline] = useState(navigator.onLine === false);
  const [now, setNow] = useState(Date.now);
  const core = useRef(),
    summaries = useRef();
  useEffect(() => {
    let stopped = false,
      lastDevice,
      lastSeen,
      lastRead = 0;
    setData(null);
    setError(false);
    const connection = () => {
      setOffline(navigator.onLine === false);
      setNow(Date.now());
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    core.current = startVisiblePolling(
      async (signal) => {
        setNow(Date.now());
        const devices = await getDevices({ signal });
        if (signal.aborted || stopped) return;
        const device = preferredMeter(devices);
        const changed = device?.id !== lastDevice;
        setData((previous) => ({
          ...(changed || !previous
            ? {
                readings: [],
                readingsLoaded: false,
                daily: null,
                alerts: previous?.alerts ?? null,
              }
            : previous),
          devices,
          device,
        }));
        if (
          device &&
          (changed ||
            !lastRead ||
            device.last_seen !== lastSeen ||
            Date.now() - lastRead >= summaryMs)
        ) {
          const readings = await getReadings(device.id, { limit: 24, signal });
          if (signal.aborted || stopped) return;
          setData((previous) => ({
            ...previous,
            readings,
            readingsLoaded: true,
          }));
          lastRead = Date.now();
        }
        lastDevice = device?.id;
        lastSeen = device?.last_seen;
        setError(false);
      },
      {
        intervalMs,
        onError: () => {
          if (!stopped) {
            setError(true);
            setNow(Date.now());
          }
        },
      },
    );
    return () => {
      stopped = true;
      core.current.stop();
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [userId, intervalMs, summaryMs]);

  const deviceId = data?.device?.id;
  useEffect(() => {
    if (!deviceId) return;
    let stopped = false;
    setSummaryError(false);
    summaries.current = startVisiblePolling(
      async (signal) => {
        // Forecasts and rollups must not block the latest meter reading.
        const results = await Promise.allSettled([
          getAlerts({ signal }),
          getDailyUsage(deviceId, { limit: 1, signal }),
        ]);
        if (signal.aborted || stopped) {
          if (signal.reason?.name === "TimeoutError") throw signal.reason;
          return;
        }
        setData((previous) =>
          previous?.device?.id === deviceId
            ? {
                ...previous,
                ...(results[0].status === "fulfilled"
                  ? { alerts: results[0].value }
                  : {}),
                ...(results[1].status === "fulfilled"
                  ? { daily: results[1].value }
                  : {}),
              }
            : previous,
        );
        if (results.some((result) => result.status === "rejected"))
          throw new Error("Summary refresh failed");
        setSummaryError(false);
      },
      {
        intervalMs: summaryMs,
        onError: () => {
          if (!stopped) setSummaryError(true);
        },
      },
    );
    return () => {
      stopped = true;
      summaries.current.stop();
    };
  }, [deviceId, userId, summaryMs]);
  return {
    data,
    error,
    summaryError,
    offline,
    now,
    refresh: () => {
      core.current?.refresh();
      summaries.current?.refresh();
    },
  };
}

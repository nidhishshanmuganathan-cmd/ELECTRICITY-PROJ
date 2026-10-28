import { useEffect, useState } from "react";
import { getDevices } from "../api";
import { preferredMeter } from "../utils/energy";

export function useMeter() {
  const [devices, setDevices] = useState([]),
    [id, setId] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setLoading(true);
    setError(false);
    getDevices(options)
      .then((rows) => {
        if (active) {
          setDevices(rows);
          setId((previous) =>
            rows.some((d) => d.id === previous)
              ? previous
              : preferredMeter(rows)?.id || "",
          );
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);
  return {
    devices,
    id,
    setId,
    loading,
    error,
    reload: () => setRevision((n) => n + 1),
    device: devices.find((d) => d.id === id),
  };
}

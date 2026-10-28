import { useEffect, useState } from "react";
import { getDevices } from "../api";

export function useMeter() {
  const [devices, setDevices] = useState([]),
    [id, setId] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getDevices()
      .then((rows) => {
        if (active) {
          setDevices(rows);
          setId((previous) =>
            rows.some((d) => d.id === previous) ? previous : rows[0]?.id || "",
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

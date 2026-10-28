// Completion-based polling: one request group at a time, bounded waits and
// no background traffic. The environment is injectable for deterministic tests.
export function startVisiblePolling(
  task,
  {
    intervalMs = 15000,
    timeoutMs = 30000,
    onError = () => {},
    environment = {
      document,
      window,
      navigator,
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
    },
  } = {},
) {
  const env = environment;
  let timer,
    controller,
    pending = false,
    stopped = false,
    queued = false,
    failures = 0;
  const ready = () =>
    !stopped && !env.document.hidden && env.navigator.onLine !== false;
  const clear = () => env.clearTimeout(timer);
  async function refresh() {
    clear();
    if (!ready()) return;
    if (pending) {
      queued = true;
      return;
    }
    pending = true;
    queued = false;
    controller = new AbortController();
    const signal = controller.signal;
    const timeout = env.setTimeout(
      () =>
        controller.abort(new DOMException("Refresh timed out", "TimeoutError")),
      timeoutMs,
    );
    try {
      await task(signal);
      failures = 0;
    } catch (error) {
      if (
        ready() &&
        (!signal.aborted || signal.reason?.name === "TimeoutError")
      ) {
        failures++;
        onError(error);
      }
    } finally {
      env.clearTimeout(timeout);
      pending = false;
      if (ready()) {
        const delay = queued
          ? 0
          : Math.min(intervalMs * 2 ** Math.min(failures, 2), 60000);
        timer = env.setTimeout(refresh, delay);
      }
    }
  }
  function changed() {
    clear();
    if (ready()) refresh();
    else {
      queued = false;
      controller?.abort();
    }
  }
  env.document.addEventListener("visibilitychange", changed);
  env.window.addEventListener("online", changed);
  env.window.addEventListener("offline", changed);
  refresh();
  return {
    refresh,
    stop() {
      stopped = true;
      clear();
      controller?.abort();
      env.document.removeEventListener("visibilitychange", changed);
      env.window.removeEventListener("online", changed);
      env.window.removeEventListener("offline", changed);
    },
  };
}

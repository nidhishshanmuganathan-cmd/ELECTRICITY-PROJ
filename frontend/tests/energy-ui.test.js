import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailyPoints,
  energyText,
  numeric,
  isDemo,
  dateText,
  preferredMeter,
} from "../src/utils/energy.js";
import { uiTranslations } from "../src/utils/uiTranslations.js";

test("energy formatting converts kWh to MWh and distinguishes missing data from zero", () => {
  assert.equal(energyText(null), "—");
  assert.equal(energyText(undefined), "—");
  assert.equal(energyText(""), "—");
  assert.equal(energyText(0), "0 kWh");
  assert.equal(energyText(1250, "MWh"), "1.25 MWh");
  assert.equal(energyText("5.3", "Units"), "5.3 Units");
  assert.equal(numeric("invalid"), null);
});

test("history sorts real dates and preserves gaps without filling invented readings", () => {
  const rows = [
    { date: "2026-10-05", total_energy: "2.5" },
    { date: "2026-10-01", total_energy: 0 },
    { date: "2026-10-03", total_energy: null },
  ];
  assert.deepEqual(dailyPoints(rows), [
    { label: "2026-10-01", value: 0 },
    { label: "2026-10-05", value: 2.5 },
  ]);
  assert.equal(rows[0].date, "2026-10-05");
  assert.equal(dateText("bad-date"), "—");
});

test("sample devices use the verified backend demo code convention", () => {
  assert.equal(isDemo({ device_code: "DEMO-12345678" }), true);
  assert.equal(
    isDemo({ device_code: "ESP32-1", device_name: "Demo Energy Meter" }),
    false,
  );
  assert.equal(isDemo(null), false);
});

test("default meter favors real hardware while retaining sample-only and empty states", () => {
  const sample = { id: "sample", device_code: "DEMO-1", status: "online" };
  const offline = { id: "offline", device_code: "ESP32-1", status: "offline" };
  const online = { id: "online", device_code: "ESP32-2", status: "online" };
  const devices = [sample, offline, online];
  assert.equal(preferredMeter(devices), online);
  assert.equal(preferredMeter([sample, offline]), offline);
  assert.equal(preferredMeter([sample]), sample);
  assert.equal(preferredMeter([]), undefined);
  assert.deepEqual(devices, [sample, offline, online]);
});

test("all added interface keys exist in each supported language", () => {
  for (const lang of ["Hindi", "Tamil", "Telugu"]) {
    assert.deepEqual(
      Object.keys(uiTranslations[lang]).sort(),
      Object.keys(uiTranslations.English).sort(),
      lang,
    );
    for (const [key, text] of Object.entries(uiTranslations[lang]))
      assert.ok(text && text !== key, `${lang}: ${key}`);
  }
  for (const key of ["alertExceeded", "currentUsage", "forecastBreach"])
    assert.ok(uiTranslations.English[key]);
});

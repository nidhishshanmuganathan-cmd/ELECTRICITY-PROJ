/* Test-only fixtures intercepted by Playwright. Never imported by the application.
 * Run against the local Vite server with PLAYWRIGHT_MODULE pointing to an
 * externally installed Playwright package. No production requests are made.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const output =
  process.env.UI_SCREENSHOT_DIR ||
  path.join(require("node:os").tmpdir(), "wattwatcher-ui-screens");
fs.mkdirSync(output, { recursive: true });
const api = `
const call = (name, payload) => { (window.__calls ||= []).push({name,payload}); if(window.__scenario === 'error') throw new Error('Test API unavailable') }
const now = new Date(); const date = i => { const d=new Date(now); d.setDate(d.getDate()-i); return d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}) };
const devices=[{id:'qa-meter',device_name:'Sample Home Meter',device_code:'DEMO-QA',location:'Demo apartment',status:'online',last_seen:now.toISOString()},{id:'qa-second',device_name:'Second meter',device_code:'SECOND',status:'offline'}];
export async function getDevices(){call('getDevices');return window.__scenario==='empty'?[]:devices.map(d=>d.id==='qa-second'?{...d,status:window.__meterStatus||'online',last_seen:new Date(+now+(window.__readingVersion||0)*1000).toISOString()}:d)}
export async function getReadings(id,options={}){call('getReadings',id);(window.__limits||=[]).push({kind:'readings',limit:options.limit});return window.__scenario==='no-readings'?[]:Array.from({length:Math.min(options.limit||1000,1000)},(_,i)=>({recorded_at:new Date(+now+(window.__readingVersion||0)*1000-i*900000-(window.__readingAgeMs||0)).toISOString(),power:200+(window.__readingVersion||0)*100+i*35,energy:.1}))}
export async function getDailyUsage(id,options={}){call('getDailyUsage',id);(window.__limits||=[]).push({kind:'daily',limit:options.limit});return window.__scenario==='no-readings'?[]:Array.from({length:Math.min(options.limit||35,35)},(_,i)=>({date:date(i),total_energy:8+i%7}))}
export async function getAlerts(){call('getAlerts');if(window.__summaryError)throw Error('Test summary error');return {month:date(0).slice(0,7),devices:window.__scenario==='empty'?[]:devices,current_usage:326.8,monthly_limit:500,remaining:173.2,usage_percent:65.36,status:'ok',predicted_next_7d_total:86.2,projected_month_total:413,predicted_will_exceed:false}}
export async function getUsageSummary(id,range){call('getUsageSummary',{id,range});return {total_energy:window.__scenario==='no-readings'?0:86.2,range}}
export async function getPredictions(id,range){call('getPredictions',{id,range});return {actual:window.__scenario==='no-readings'?[]:[8,9,11,10,13,12,14],predicted:[12,14,13,16,15,17,18]}}
export async function getUsageAnomaly(){call('getUsageAnomaly');return {status:'normal',score:.23,sample_size:35}}
export async function updateUserProfile(payload){call('updateUserProfile',payload);return {...window.__qaProfile,...payload}}
export async function createDemoData(){call('createDemoData');window.__scenario='normal';return devices[0]}
export async function addDevice(payload){call('addDevice',payload);return {id:'qa-new',...payload}}
export async function provisionDeviceToken(id){call('provisionDeviceToken',id);return {device_token:'TEST-ONLY-PROVISIONING-VALUE'}}
export async function sendPushTest(){call('sendPushTest');return {status:'accepted_by_fcm',message_id:'TEST-ONLY-MESSAGE-ID'}}
export async function syncUser(){call('syncUser');return window.__qaProfile}
export async function registerDeviceToken(){call('registerDeviceToken')}
export async function unregisterDeviceToken(){call('unregisterDeviceToken')}
`;
const authContext = `import React from '/node_modules/.vite/deps/react.js'; const {createContext,useContext,useEffect,useState}=React;
const context=createContext(null); export function AuthProvider({children}){ const [profile,setProfile]=useState(window.__qaProfile); const [signed,setSigned]=useState(!['/signin','/create-account'].includes(location.pathname));useEffect(()=>{const change=()=>setSigned(true);window.addEventListener('qa-auth',change);return()=>window.removeEventListener('qa-auth',change)},[]); const user=signed?{firebaseUser:{uid:'test-user',displayName:profile.full_name,email:profile.email},appUser:profile}:null;return React.createElement(context.Provider,{value:{user,loading:false,updateAppUser:p=>setProfile(prev=>({...prev,...p}))}},children)}; export const useAuth=()=>useContext(context);`;
const authSDK = `export function getAuth(){return {currentUser:{uid:'test-user'}}}; export class GoogleAuthProvider{};
const sign=async(name,args)=>{(window.__calls||=[]).push({name,email:args[1]});if(window.__authError)throw {code:window.__authError};window.dispatchEvent(new Event('qa-auth'));return {user:{uid:'test-user'}}};
export const signInWithPopup=(...args)=>sign('signInWithPopup',args);export const signInWithEmailAndPassword=(...args)=>sign('signInWithEmailAndPassword',args);export const createUserWithEmailAndPassword=(...args)=>sign('createUserWithEmailAndPassword',args);export async function updateProfile(){(window.__calls||=[]).push({name:'updateProfile'})};export async function sendPasswordResetEmail(){(window.__calls||=[]).push({name:'sendPasswordResetEmail'})};export async function signOut(){(window.__calls||=[]).push({name:'signOut'})};`;
const notifications = `export const pushEnabled=()=>window.__pushEnabled||false;export async function ensureForegroundListener(){};export async function enablePushNotifications(){(window.__calls||=[]).push({name:'enablePushNotifications'});window.__pushEnabled=true;return {ok:true}};export async function disablePushNotifications(){(window.__calls||=[]).push({name:'disablePushNotifications'});window.__pushEnabled=false}`;

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    window.__qaProfile = {
      full_name: "Nidhi",
      email: "ui-test@example.com",
      phone: "+910000000000",
      monthly_limit: 500,
      timezone: "Asia/Kolkata",
    };
    window.__calls = [];
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    let body =
      url.pathname === "/src/AuthContext.jsx"
        ? authContext
        : url.pathname === "/src/api.js"
          ? api
          : url.pathname === "/src/notifications.js"
            ? notifications
            : url.pathname.endsWith("/firebase_auth.js")
              ? authSDK
              : null;
    if (url.pathname === "/src/AuthContext.jsx") {
      const response = await route.fetch();
      const source = await response.text();
      const reactPath = source.match(
        /\/node_modules\/\.vite\/deps\/react\.js\?v=[a-z0-9]+/,
      )?.[0];
      if (reactPath)
        body = body.replace("/node_modules/.vite/deps/react.js", reactPath);
    }
    return body !== null
      ? route.fulfill({ contentType: "application/javascript", body })
      : route.continue();
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser test error:", e.message);
  });
  const routes = [
    "/",
    "/history",
    "/analysis",
    "/insights",
    "/alerts",
    "/devices",
    "/profile",
    "/signin",
    "/create-account",
  ];
  let layouts = 0;
  for (const width of [320, 360, 390, 430, 768, 1440, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    for (const route of routes) {
      await page.goto("http://127.0.0.1:5174" + route);
      await page.locator("h1").waitFor();
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(
        overflow,
        false,
        `Horizontal overflow on ${route} at ${width}`,
      );
      const raw = await page.locator("body").innerText();
      assert.ok(
        !/alertExceeded|currentUsage|forecastBreach|NaN|undefined/.test(raw),
        `Raw value on ${route}`,
      );
      if (
        (width === 390 || width === 1440) &&
        ["/", "/signin", "/profile", "/insights"].includes(route)
      )
        await page.screenshot({
          path: path.join(output, `${route.slice(1) || "home"}-${width}.png`),
          fullPage: true,
        });
      assert.equal(
        await page
          .getByRole("button", {
            name: /(?:load|upload|generate|insert).*(?:sample|demo)/i,
          })
          .count(),
        0,
      );
      layouts++;
    }
  }
  await page.goto("http://127.0.0.1:5174/");
  await page.waitForFunction(() =>
    window.__calls.some(
      (c) => c.name === "getReadings" && c.payload === "qa-second",
    ),
  );
  await page.getByText("Latest reading", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5174/profile");
  await page
    .getByRole("button", { name: "Personal information", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Full name", { exact: true }).fill("Updated UI name");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("heading", { name: "Updated UI name" }).waitFor();
  await page
    .getByRole("button", { name: "Monthly limit", exact: true })
    .click();
  await page.getByRole("spinbutton").fill("650");
  await page.getByRole("button", { name: "Save limit", exact: true }).click();
  assert.ok(
    await page.evaluate(() =>
      window.__calls.some(
        (c) =>
          c.name === "updateUserProfile" && c.payload.monthly_limit === 650,
      ),
    ),
  );
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("switch", { name: "Dark mode", exact: true }).click();
  assert.ok(
    await page.evaluate(() => document.body.classList.contains("light-theme")),
  );
  await page.screenshot({
    path: path.join(output, "profile-light.png"),
    fullPage: true,
  });
  await page
    .getByRole("switch", { name: "Notifications", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Send test notification", exact: true })
    .click();
  await page.getByText(/Firebase accepted the test/).waitFor();
  const pushCalls = await page.evaluate(() =>
    window.__calls
      .filter((c) => /Push|Notification/.test(c.name))
      .map((c) => c.name),
  );
  assert.deepEqual(pushCalls, [
    "enablePushNotifications",
    "enablePushNotifications",
    "sendPushTest",
  ]);
  await page
    .getByRole("switch", { name: "Notifications", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  assert.ok(
    await page.evaluate(() => window.__calls.some((c) => c.name === "signOut")),
  );
  await page.goto("http://127.0.0.1:5174/devices");
  await page.getByLabel("Meter name", { exact: true }).fill("Test kitchen");
  await page.getByLabel("Device code", { exact: true }).fill("QA-002");
  await page
    .getByRole("button", { name: "Connect meter", exact: true })
    .click();
  await page.getByText("TEST-ONLY-PROVISIONING-VALUE").waitFor();
  await page.goto("http://127.0.0.1:5174/analysis");
  await page.locator('.chart').waitFor();
  const summaryCallsBeforeRange = await page.evaluate(() => window.__calls.filter(c => ['getDailyUsage', 'getAlerts'].includes(c.name)).length);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.waitForFunction(() =>
    window.__calls.some(
      (c) => c.name === "getPredictions" && c.payload.range === "30D",
    ),
  );
  assert.equal(await page.evaluate(() => window.__calls.filter(c => ['getDailyUsage', 'getAlerts'].includes(c.name)).length), summaryCallsBeforeRange);
  await page.getByLabel("Select meter").selectOption("qa-meter");
  await page.waitForFunction(() =>
    window.__calls.some(
      (c) => c.name === "getPredictions" && c.payload.id === "qa-meter",
    ),
  );
  await page.goto("http://127.0.0.1:5174/signin");
  await page.evaluate(
    () => (window.__authError = "auth/network-request-failed"),
  );
  await page
    .getByLabel("Email address", { exact: true })
    .fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByText(
      "Unable to connect. Check your internet connection and try again.",
    )
    .waitFor();
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  page.on("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await page.evaluate(() => (window.__authError = null));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:5174/");
  await page.goto("http://127.0.0.1:5174/signin");
  await page.getByRole("button", { name: "Google", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:5174/");
  await page.goto("http://127.0.0.1:5174/create-account");
  await page.getByLabel("Full name", { exact: true }).fill("Test user");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByLabel("Confirm password", { exact: true }).fill("different");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByText("Passwords do not match").waitFor();
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("test-only-password");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:5174/");
  // Simulated telemetry and browser lifecycle, with no production requests.
  const pollingPage = await context.newPage();
  pollingPage.on("pageerror", (error) => errors.push(error.message));
  const clockStart = new Date();
  await pollingPage.clock.install({ time: clockStart });
  await pollingPage.goto("http://127.0.0.1:5174/");
  await pollingPage
    .locator(".meter-summary strong")
    .filter({ hasText: "0.2 kW" })
    .waitFor();
  await pollingPage.clock.pauseAt(new Date(Date.now() + 1000));
  const counts = () =>
    pollingPage.evaluate(() =>
      Object.fromEntries(
        ["getDevices", "getReadings", "getAlerts", "getDailyUsage"].map(
          (name) => [
            name,
            window.__calls.filter((c) => c.name === name).length,
          ],
        ),
      ),
    );
  const initialCounts = await counts();
  await pollingPage.clock.runFor(16000);
  assert.equal((await counts()).getDevices, initialCounts.getDevices + 1);
  assert.equal((await counts()).getReadings, initialCounts.getReadings);
  assert.equal((await counts()).getAlerts, initialCounts.getAlerts);
  await pollingPage.evaluate(() => (window.__readingVersion = 1));
  await pollingPage.clock.runFor(16000);
  await pollingPage
    .locator(".meter-summary strong")
    .filter({ hasText: "0.3 kW" })
    .waitFor();
  assert.ok(
    await pollingPage.evaluate(() =>
      window.__limits.some(
        (row) => row.kind === "readings" && row.limit === 24,
      ),
    ),
  );
  assert.ok(
    await pollingPage.evaluate(() =>
      window.__limits.some((row) => row.kind === "daily" && row.limit === 1),
    ),
  );
  await pollingPage.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenCounts = await counts();
  await pollingPage.clock.runFor(90000);
  assert.deepEqual(await counts(), hiddenCounts);
  await pollingPage.evaluate(() => {
    window.__readingVersion = 2;
    window.__readingAgeMs = 300000;
    window.__summaryError = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await pollingPage.clock.runFor(100);
  await pollingPage
    .locator(".meter-summary strong")
    .filter({ hasText: "0.4 kW" })
    .waitFor();
  await pollingPage.getByText("Readings are stale", { exact: true }).waitFor();
  await pollingPage
    .getByText(
      "Usage summary could not refresh. Meter readings update separately.",
      { exact: true },
    )
    .waitFor();
  await pollingPage.clock.resume();
  await pollingPage.goto("http://127.0.0.1:5174/profile");
  await pollingPage.locator("h1").waitFor();
  const afterLeave = await counts();
  await pollingPage.clock.runFor(120000);
  assert.deepEqual(await counts(), afterLeave);
  await pollingPage.close();

  for (const language of ["English", "Hindi", "Tamil", "Telugu"]) {
    await page.evaluate((lang) => {
      localStorage.setItem("wattwatcher_lang", lang);
      localStorage.setItem("wattwatcher_theme", "dark");
    }, language);
    await page.setViewportSize({ width: 320, height: 800 });
    for (const route of routes) {
      await page.goto("http://127.0.0.1:5174" + route);
      await page.locator("h1").waitFor();
      await page.waitForTimeout(80);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `Overflow: ${language} ${route}`,
      );
    }
  }
  await page.evaluate(() =>
    localStorage.setItem("wattwatcher_lang", "English"),
  );
  for (const scenario of ["empty", "error", "no-readings"]) {
    await context.addInitScript((value) => {
      window.__scenario = value;
    }, scenario);
    for (const route of ["/", "/history", "/analysis", "/insights"]) {
      await page.goto("http://127.0.0.1:5174" + route);
      await page.waitForTimeout(180);
      assert.equal(
        await page
          .getByRole("button", {
            name: /(?:load|upload|generate|insert).*(?:sample|demo)/i,
          })
          .count(),
        0,
      );
      if (scenario === "empty" && route === "/") {
        await page
          .getByRole("heading", { name: "No meter connected" })
          .waitFor();
        assert.ok(
          await page
            .getByRole("link", { name: "Connect meter", exact: true })
            .count(),
        );
        assert.equal(
          await page.evaluate(() =>
            window.__calls.some((c) => c.name === "createDemoData"),
          ),
          false,
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      layouts,
      screenStates: 12,
      flows: [
        "bounded telemetry refresh",
        "hidden tab pause/resume",
        "summary failure isolation",
        "polling cleanup",
        "profile",
        "limit",
        "theme",
        "modal keyboard",
        "push controls",
        "logout",
        "meter provisioning",
        "analysis ranges",
        "meter selection",
        "email sign-in error/success",
        "Google",
        "reset",
        "signup",
      ],
      pageErrors: errors.length,
      screenshots: output,
    }),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

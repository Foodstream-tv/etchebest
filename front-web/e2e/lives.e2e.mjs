// End-to-end checks of lives through the web front, in a real Chrome with a fake camera, against the
// backend started by docker compose. Needs: make up && make seed, the web front on E2E_WEB_URL, Google
// Chrome (CHROME_PATH), Docker (to read the database and the backend logs).
//
//   npm run test:e2e                       every scenario
//   npm run test:e2e -- replayPlays ...    some of them
//
// Screenshots of failures go to e2e/artifacts/. The run ends with the browser errors and the backend log
// lines worth a look.
import { chromium } from "playwright-core";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const WEB = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const API = process.env.E2E_API_URL ?? "http://localhost:8081";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo1234!";
const HOST = "demo.host@example.com";
const GUEST = "demo.viewer@example.com";
const VIEWER = "demo.e2e.viewer@example.com";
const BACKEND_CONTAINER = "backend-foodstream";
const DB_CONTAINER = "db-foodstream";
const OUT = new URL("./artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const startedAt = new Date();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// --- API -------------------------------------------------------------------------------------------------
async function api(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

async function account(email, username) {
  let r = await api("POST", "/api/login", null, { email, password: PASSWORD });
  if (r.status !== 200) {
    r = await api("POST", "/api/register", null, {
      email, password: PASSWORD, username, firstName: "E2E", lastName: "Viewer", description: "e2e",
      countryNumberPhone: 33, numberPhone: "612345679", ageConfirmed: true,
    });
    if (r.status !== 200) throw new Error(`register ${email}: ${r.status} ${r.text}`);
    r = await api("POST", "/api/verify", null, { userId: r.json.userId, code: r.json.devCode });
    if (r.status !== 200) throw new Error(`verify ${email}: ${r.status} ${r.text}`);
  }
  const token = r.json.token;
  const me = await api("GET", "/api/users/me", token);
  return { email, token, id: me.json.id };
}

function psql(query) {
  return execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "root", "-d", "foodstream", "-tAc", query]).toString();
}

async function endLives(a) {
  const rooms = psql(`select room_id from lives where user_id = '${a.id}' and status in ('live','scheduled')`).split(/\s+/).filter(Boolean);
  for (const room of rooms) await api("POST", `/api/rooms/${room}/disconnect`, a.token);
}

async function createLive(a, title) {
  const r = await api("POST", "/api/rooms", a.token, { name: title, title, status: "live", tags: ["Test"] });
  if (r.status !== 200) throw new Error(`create live: ${r.status} ${r.text}`);
  return { roomId: r.json.roomId, liveId: r.json.liveId };
}

const liveOf = async (roomId) => (await api("GET", `/api/lives/${roomId}`)).json;

async function waitEnded(roomId, within) {
  const deadline = Date.now() + within;
  let l = await liveOf(roomId);
  while (l.status !== "ended" && Date.now() < deadline) { await sleep(1000); l = await liveOf(roomId); }
  return l;
}

// --- Browser ---------------------------------------------------------------------------------------------
let browser;
const problems = [];

async function signedIn(a) {
  const ctx = await browser.newContext({ permissions: ["camera", "microphone"], viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[${a.email} console] ${m.text().slice(0, 220)}`); });
  page.on("pageerror", (e) => problems.push(`[${a.email} pageerror] ${String(e).slice(0, 220)}`));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${WEB}/signin`);
  await page.fill('input[type="email"]', a.email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 15000 });
  return { ctx, page };
}

// playingVideos counts the <video> elements of the page showing a picture that moves.
async function playingVideos(page) {
  return page.evaluate(async () => {
    const vids = [...document.querySelectorAll("video")];
    const before = vids.map((v) => v.currentTime);
    await new Promise((r) => setTimeout(r, 1500));
    return vids.filter((v, i) => v.videoWidth > 0 && v.currentTime - before[i] > 0.3).length;
  });
}

// worstRemoteStall watches the videos received from the server (not the local camera) for ms and returns
// the longest time the picture did not move.
function worstRemoteStall(page, ms) {
  return page.evaluate(async (ms) => {
    const remote = [...document.querySelectorAll("video")].filter((v) => {
      const track = v.srcObject?.getVideoTracks?.()[0];
      return track && !/fake/i.test(track.label) && v.videoWidth > 0;
    });
    if (remote.length === 0) return -1;
    const last = remote.map((v) => v.currentTime);
    const moved = remote.map(() => performance.now());
    let worst = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      await new Promise((r) => setTimeout(r, 100));
      remote.forEach((v, i) => {
        if (v.currentTime !== last[i]) { last[i] = v.currentTime; moved[i] = performance.now(); }
        worst = Math.max(worst, performance.now() - moved[i]);
      });
    }
    return Math.round(worst);
  }, ms);
}

async function waitForPlaying(page, atLeast, within, what) {
  const deadline = Date.now() + within;
  let n = 0;
  while (Date.now() < deadline) {
    n = await playingVideos(page);
    if (n >= atLeast) return n;
    await sleep(1000);
  }
  throw new Error(`${what}: ${n} moving video(s) after ${within / 1000} s, want ${atLeast}`);
}

async function hostGoesLive(host, roomId) {
  const s = await signedIn(host);
  await s.page.goto(`${WEB}/broadcast/${roomId}?mode=host`);
  const launch = s.page.getByRole("button", { name: "Lancer le live" });
  await launch.waitFor({ timeout: 20000 });
  await s.page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Lancer le live") && !b.disabled), null, { timeout: 20000 });
  await launch.click();
  await s.page.getByRole("button", { name: "Arrêter" }).waitFor({ timeout: 20000 });
  return s;
}

async function guestJoins(guest, roomId) {
  const r = await api("POST", `/api/rooms/${roomId}/reserve`, guest.token, { consentToRecording: true });
  if (r.status !== 200) throw new Error(`reserve: ${r.status} ${r.text}`);
  const s = await signedIn(guest);
  await s.page.goto(`${WEB}/broadcast/${roomId}?mode=join`);
  await s.page.getByRole("button", { name: "Quitter le live" }).waitFor({ timeout: 25000 });
  return s;
}

async function shot(page, name) {
  try { await page.screenshot({ path: `${OUT}${name}.png` }); } catch { /* closed */ }
}

// --- Scenarios -------------------------------------------------------------------------------------------
const scenarios = {
  // The co-streamer sees the host and the host sees the co-streamer (the renegotiation after the join).
  async coStreamerVideoBothWays({ host, guest }) {
    const { roomId } = await createLive(host, "e2e both ways");
    const h = await hostGoesLive(host, roomId);
    await sleep(1000); // the co-streamer joins while the host's tracks arrive
    const g = await guestJoins(guest, roomId);
    const onGuest = await waitForPlaying(g.page, 2, 25000, "co-streamer page (own + host)");
    const onHost = await waitForPlaying(h.page, 2, 25000, "host page (own + co-streamer)");
    await shot(h.page, "both-ways-host");
    await shot(g.page, "both-ways-guest");
    await h.ctx.close();
    await g.ctx.close();
    return `co-streamer sees ${onGuest} moving videos, host sees ${onHost}`;
  },

  // The host's tab dies: the co-streamer's page, then the live, end about 90 s later.
  async hostTabClosed({ host, guest }) {
    const { roomId } = await createLive(host, "e2e host gone");
    const h = await hostGoesLive(host, roomId);
    const g = await guestJoins(guest, roomId);
    await waitForPlaying(g.page, 2, 25000, "co-streamer page before");
    const closedAt = Date.now();
    await h.ctx.close();
    let status = "live";
    while (status === "live" && Date.now() - closedAt < 150000) {
      await sleep(3000);
      status = (await liveOf(roomId)).status;
    }
    const took = Math.round((Date.now() - closedAt) / 1000);
    await sleep(5000);
    await shot(g.page, "host-gone-guest");
    const text = (await g.page.locator("body").innerText()).slice(0, 400).replace(/\s+/g, " ");
    const moving = await playingVideos(g.page);
    await g.ctx.close();
    if (status !== "ended") throw new Error(`live still ${status} ${took} s after the host's tab closed`);
    return `live ended ${took} s after the host's tab closed; co-streamer page then shows ${moving} moving video(s): "${text.slice(0, 160)}"`;
  },

  // The live HLS stream is served while the live runs (the web has no live player: checked through the API).
  async liveHLSServed({ host, viewer }) {
    const { roomId } = await createLive(host, "e2e hls");
    const h = await hostGoesLive(host, roomId);
    await sleep(15000);
    const master = await fetch(`${API}/api/hls/${roomId}/master.m3u8`, { headers: { Authorization: `Bearer ${viewer.token}` } });
    const masterText = await master.text();
    const variant = masterText.split("\n").find((l) => l && !l.startsWith("#"));
    if (master.status !== 200 || !variant) throw new Error(`master: ${master.status} ${masterText.slice(0, 200)}`);
    const media = await (await fetch(`${API}/api/hls/${roomId}/${variant}`, { headers: { Authorization: `Bearer ${viewer.token}` } })).text();
    const segments = (media.match(/#EXTINF/g) || []).length;
    await h.ctx.close();
    if (segments === 0) throw new Error(`no segment in ${variant}: ${media.slice(0, 200)}`);
    return `live HLS: ${masterText.split("#EXT-X-STREAM-INF").length - 1} renditions, ${segments} segments in ${variant} after 15 s`;
  },

  // Two lives: ending one does not stall the other (a co-streamer of B watches B's host through the server).
  async endingOneLiveDoesNotStallAnother({ host, guest, viewer }) {
    const a = await createLive(host, "e2e live A");
    const b = await createLive(guest, "e2e live B");
    const ha = await hostGoesLive(host, a.roomId);
    const hb = await hostGoesLive(guest, b.roomId);
    const v = await guestJoins(viewer, b.roomId);
    await waitForPlaying(v.page, 2, 25000, "co-streamer of B before");
    await sleep(8000); // A records a few segments, so its end has a replay to build
    const stall = worstRemoteStall(v.page, 10000);
    await sleep(1000);
    const endedAt = Date.now();
    await ha.page.getByRole("button", { name: "Arrêter" }).click();
    const ending = waitEnded(a.roomId, 20000).then((l) => ({ la: l, took: Math.round((Date.now() - endedAt) / 100) / 10 }));
    const worst = await stall;
    const { la, took } = await ending;
    await v.ctx.close();
    await ha.ctx.close();
    await hb.ctx.close();
    if (worst < 0) throw new Error("no remote video on the co-streamer's page");
    if (worst > 1500) throw new Error(`B froze ${worst} ms on its co-streamer's page while A was ending`);
    return `A ended in ${took} s (replay ${la.has_replay}); meanwhile B's picture never stopped more than ${worst} ms`;
  },

  // The host ends the live; its replay plays.
  async replayPlays({ host, viewer }) {
    const { roomId } = await createLive(host, "e2e replay");
    const h = await hostGoesLive(host, roomId);
    await sleep(20000);
    await h.page.getByRole("button", { name: "Arrêter" }).click();
    await h.page.waitForURL(/\/home/, { timeout: 30000 });
    const l = await waitEnded(roomId, 20000);
    await h.ctx.close();
    if (!l.has_replay) throw new Error(`no replay: ${JSON.stringify(l)}`);
    const v = await signedIn(viewer);
    await v.page.goto(`${WEB}/replays/${roomId}`);
    await v.page.waitForFunction(() => (document.querySelector("video")?.readyState ?? 0) >= 2, null, { timeout: 20000 });
    await v.page.evaluate(() => { const video = document.querySelector("video"); video.muted = true; return video.play(); });
    const n = await waitForPlaying(v.page, 1, 30000, "replay page");
    await shot(v.page, "replay");
    await v.ctx.close();
    return `replay ${l.replay_url} plays (${n} moving video)`;
  },

  // The host stops the live right after launching it: no replay, or one that plays (never an empty one).
  async veryShortLive({ host }) {
    const { roomId } = await createLive(host, "e2e short");
    const h = await hostGoesLive(host, roomId);
    await sleep(1000);
    await h.page.getByRole("button", { name: "Arrêter" }).click();
    const l = await waitEnded(roomId, 20000);
    await h.ctx.close();
    if (!l.has_replay) return "no replay for a 1 s live";
    const master = await (await fetch(API + l.replay_url)).text();
    const renditions = master.split("#EXT-X-STREAM-INF").length - 1;
    if (renditions === 0) throw new Error(`has_replay but its master lists no rendition: ${JSON.stringify(master)}`);
    return `replay with ${renditions} renditions`;
  },

  // The host kicks the co-streamer from the UI.
  async kickFromUI({ host, guest }) {
    const { roomId } = await createLive(host, "e2e kick");
    const h = await hostGoesLive(host, roomId);
    const g = await guestJoins(guest, roomId);
    await waitForPlaying(h.page, 2, 25000, "host page before the kick");
    await h.page.locator('[aria-label^="Flux de"], video').nth(1).hover().catch(() => {});
    await h.page.getByRole("button", { name: /^Exclure / }).first().click({ force: true });
    await sleep(4000);
    await shot(g.page, "kicked-guest");
    const guestText = (await g.page.locator("body").innerText()).replace(/\s+/g, " ");
    const hostMoving = await playingVideos(h.page);
    const again = await api("POST", `/api/rooms/${roomId}/reserve`, guest.token, { consentToRecording: true });
    await h.ctx.close();
    await g.ctx.close();
    if (hostMoving !== 1) throw new Error(`host page still shows ${hostMoving} moving videos after the kick`);
    return `after the kick the host shows ${hostMoving} video; co-streamer page at ${g.page.url()}: "${guestText.slice(0, 120)}"; reserving again: ${again.status}`;
  },
};

// --- Run -------------------------------------------------------------------------------------------------
browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const accounts = { host: await account(HOST), guest: await account(GUEST), viewer: await account(VIEWER, "e2eviewer") };
const wanted = process.argv.slice(2);
let failed = 0;
for (const [name, fn] of Object.entries(scenarios)) {
  if (wanted.length && !wanted.includes(name)) continue;
  for (const a of Object.values(accounts)) await endLives(a);
  log(`RUN  ${name}`);
  try {
    log(`PASS ${name}: ${await fn(accounts)}`);
  } catch (e) {
    failed++;
    log(`FAIL ${name}: ${e.message}`);
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const [i, p] of pages.entries()) {
      await shot(p, `fail-${name}-${i}`);
      log(`  page ${i}: ${p.url()}`);
    }
  }
  for (const c of browser.contexts()) await c.close().catch(() => {});
}
for (const a of Object.values(accounts)) await endLives(a);
await browser.close();

console.log("\n=== browser problems ===");
for (const p of [...new Set(problems)]) console.log(p);
console.log("\n=== backend log lines worth a look ===");
const logs = spawnSync("docker", ["logs", "--since", startedAt.toISOString(), BACKEND_CONTAINER]);
const seen = new Set();
for (const line of (logs.stdout.toString() + logs.stderr.toString()).split("\n")) {
  if (!/panic|error|fail|nothing was encoded/i.test(line)) continue;
  const key = line.slice(20);
  if (!seen.has(key)) { seen.add(key); console.log(line); }
}
process.exit(failed ? 1 : 0);

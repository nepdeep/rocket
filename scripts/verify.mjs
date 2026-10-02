// End-to-end check of Little Rocket: Moon Mail Delivery in a real (headless) browser.
//
//   npm run verify                 -> starts a Vite dev server and tests index.html
//   npm run verify -- --dist       -> tests the built single file dist/index.html via file://
//   npm run verify -- --url <url>  -> tests an already running server
//
// It plays the game through real pointer taps on the WebGL canvas and checks:
// parcel matching, the friendly wrong-house hint, automatic curved travel,
// delivery rewards, the playground, stars, sound/motion toggles and replay.
// Screenshots of each stage are written to verify-output/.

import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'verify-output');
mkdirSync(outDir, { recursive: true });
const args = process.argv.slice(2);
const useDist = args.includes('--dist');
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const SPEED = 3;

let passed = 0;
const failures = [];
function check(cond, msg) {
  if (cond) { passed++; console.log('  ✔ ' + msg); }
  else { failures.push(msg); console.log('  ✘ ' + msg); }
}

async function launchBrowser() {
  const flags = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
  const tries = [];
  if (process.env.CHROME_PATH) tries.push({ executablePath: process.env.CHROME_PATH });
  tries.push({});
  const pwPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwPath && existsSync(pwPath)) {
    for (const d of readdirSync(pwPath).filter((d) => /^chromium-\d+$/.test(d))) {
      const exe = path.join(pwPath, d, 'chrome-linux', 'chrome');
      if (existsSync(exe)) tries.push({ executablePath: exe });
    }
  }
  tries.push({ channel: 'chrome' });
  for (const t of tries) {
    try { return await chromium.launch({ ...t, args: flags }); } catch { /* try the next option */ }
  }
  throw new Error('No Chromium found. Run "npx playwright install chromium" or set CHROME_PATH to a Chrome/Chromium executable.');
}

let server = null;
let baseUrl;
if (useDist) {
  const file = path.join(root, 'dist', 'index.html');
  if (!existsSync(file)) throw new Error('dist/index.html not found - run "npm run build" first.');
  baseUrl = pathToFileURL(file).href;
} else if (urlArg) {
  baseUrl = urlArg;
} else {
  const { createServer } = await import('vite');
  server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  baseUrl = server.resolvedUrls.local[0];
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

const snap = () => page.evaluate(() => window.moonMail.snapshot());
const screenOf = (kind, i = 0) => page.evaluate(([k, n]) => window.moonMail.screen(k, n), [kind, i]);
async function tap(kind, i = 0) { const p = await screenOf(kind, i); await page.mouse.click(p.x, p.y); }
async function waitFor(fn, what, timeout = 30000) {
  const t0 = Date.now();
  for (;;) {
    const s = await snap();
    if (fn(s)) return s;
    if (Date.now() - t0 > timeout) throw new Error('Timed out waiting for: ' + what + ' (phase=' + s.phase + ')');
    await page.waitForTimeout(60);
  }
}
const shot = (name) => page.screenshot({ path: path.join(outDir, name + '.png') });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let maxTotal = 0;
const progressNeverDrops = (s) => { if (s.totalDelivered < maxTotal) failures.push('progress went down'); maxTotal = Math.max(maxTotal, s.totalDelivered); };

async function deliverOnce(label) {
  let s = await waitFor((s) => s.phase === 'choose', 'parcel ready');
  progressNeverDrops(s);
  const before = s.totalDelivered, target = s.target, start = s.rocket;
  check(s.houses[target].symbol === s.parcel, `${label}: parcel symbol (${s.parcel}) matches the house sign it belongs to`);
  check(s.signs[target] === s.parcel && s.signs.filter((x) => x === s.parcel).length === 1, `${label}: exactly one house shows the matching sign`);

  await tap('house', target);
  s = await waitFor((s) => s.phase === 'flying', 'take-off');
  // Sample the automatic flight path
  const path3 = [start];
  let skipStep = -1; // the screenshot pauses sampling, so ignore that one gap
  while (s.phase === 'flying') {
    path3.push(s.rocket);
    if (path3.length === 30) { await shot(label.replace(/\W+/g, '-') + '-flight'); skipStep = path3.length; }
    await page.waitForTimeout(40); s = await snap();
  }
  path3.push(s.rocket);
  const end = s.pads[target];
  const chordY = Math.max(start[1], end[1]);
  const peak = Math.max(...path3.map((p) => p[1]));
  check(path3.length > 5, `${label}: rocket moved by itself (${path3.length} samples)`);
  check(peak > chordY + 2, `${label}: flight is a smooth curve that arcs up (peak ${peak.toFixed(1)} vs ${chordY.toFixed(1)})`);
  const steps = path3.slice(1).map((p, i) => (i + 1 === skipStep ? 0 : dist(p, path3[i])));
  check(Math.max(...steps) < 3.5, `${label}: no teleport jumps along the path (max step ${Math.max(...steps).toFixed(2)})`);
  s = await waitFor((s) => s.rocketAt === target || s.totalDelivered > before, 'landing');
  check(dist(s.rocket, s.pads[target]) < 0.4, `${label}: rocket landed on the matching moon's pad`);
  s = await waitFor((s) => s.totalDelivered === before + 1, 'delivery');
  progressNeverDrops(s);
  const filled = await page.locator('#progress .slot.filled').count();
  check(filled === s.roundDelivered, `${label}: progress slot filled (${filled}/3)`);
  s = await waitFor((s) => s.surprises.length > 0 && s.surprises.at(-1).house === target && s.surprises.length >= s.totalDelivered, 'surprise');
  const sur = s.surprises.at(-1).type;
  check(s.surprisesVisible[target] === sur, `${label}: surprise "${sur}" appeared at that house`);
  await shot(label.replace(/\W+/g, '-') + '-surprise');
  return sur;
}

try {
  console.log('Loading ' + baseUrl);
  await page.goto(baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'speed=' + SPEED);
  await page.waitForFunction(() => window.moonMail, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  console.log('\nTutorial');
  check(await page.locator('#intro').isVisible(), 'picture tutorial is shown first');
  check((await page.locator('#intro canvas').count()) === 4, 'tutorial has 4 picture panels');
  const introText = (await page.locator('#intro').innerText()).trim();
  check(introText === '', 'tutorial contains no words to read');
  await shot('01-tutorial');
  await page.click('#playBtn', { force: true });

  console.log('\nRound 1');
  let s = await waitFor((s) => s.phase === 'choose', 'first parcel');
  const round1Symbols = s.houses.map((h) => h.symbol);
  const round1Decor = s.houses.map((h) => h.roofStyle + ':' + h.decor.join('+') + ':' + h.roof);
  check(!(await page.locator('#parcelCard').getAttribute('class')).includes('away'), 'big parcel card is visible');
  await page.waitForTimeout(700);
  check(await page.locator('#hand.show').count() === 1, 'first parcel shows the tapping-hand hint');
  await shot('02-first-parcel');

  // Wrong house: friendly wave + pointing, nothing lost
  const wrong = [0, 1, 2].find((i) => i !== s.target);
  const hintsBefore = s.hints;
  await tap('house', wrong);
  s = await waitFor((s) => s.hints === hintsBefore + 1, 'friendly hint');
  check(s.lastHint.from === wrong && s.lastHint.to === s.target, 'tapping another house gives a hint pointing to the matching house');
  check(s.alienPose[wrong] === 'wave', 'that resident waves');
  s = await waitFor((s) => s.alienPose[wrong] === 'point', 'resident points');
  check(true, 'then points toward the matching house');
  await shot('03-wrong-house-hint');
  check(s.phase === 'choose' && s.totalDelivered === 0 && s.parcel === round1Symbols[s.target], 'no progress lost, same parcel still waiting');

  const types = [];
  for (let k = 1; k <= 3; k++) types.push(await deliverOnce(`Round 1 delivery ${k}`));
  check(new Set(types).size === 3 && ['puppy', 'flower', 'hat'].every((t) => types.includes(t)), 'each delivery revealed a different surprise: ' + types.join(', '));

  console.log('\nPlayground');
  s = await waitFor((s) => s.phase === 'playground' && s.nextVisible, 'playground', 40000);
  check(s.playgroundVisible && s.roundsDone === 1, 'residents built the space playground after three deliveries');
  check(await page.locator('#rounds canvas').count() === 1, 'a round star sticker was earned');
  await shot('04-playground');
  await tap('tramp'); s = await waitFor((s) => s.play.tramp === 1, 'trampoline'); check(true, 'trampoline bounces');
  await page.waitForTimeout(300); await shot('05-trampoline');
  await tap('slide'); s = await waitFor((s) => s.play.slide === 1, 'slide'); check(true, 'slide ride starts');
  await tap('balloon', 1); s = await waitFor((s) => s.play.balloon === 1, 'balloon'); check(true, 'balloon floats and sings');
  await page.waitForTimeout(400); await shot('06-slide-balloon');

  console.log('\nStars, sound and calm motion');
  const plinks = s.plinks;
  await tap('star', 0); s = await waitFor((s) => s.plinks === plinks + 1, 'star plink'); check(true, 'tapping a star makes a musical plink');
  await page.click('#soundBtn', { force: true }); s = await snap();
  check(s.muted === true && (await page.getAttribute('#soundBtn', 'aria-pressed')) === 'true', 'mute button turns sound off');
  await page.click('#soundBtn', { force: true }); s = await snap();
  check(s.muted === false, 'mute button turns sound back on');
  await page.click('#motionBtn', { force: true }); s = await snap();
  check(s.reduced === true && (await page.getAttribute('#motionBtn', 'aria-pressed')) === 'true', 'calm-motion button turns reduced motion on');

  console.log('\nReplay');
  await page.click('#nextBtn', { force: true });
  s = await waitFor((s) => s.phase === 'choose' && s.round === 2, 'round 2', 40000);
  progressNeverDrops(s);
  check(s.houses.every((h) => !round1Symbols.includes(h.symbol)), `new round uses new parcel symbols (${round1Symbols.join(',')} -> ${s.houses.map((h) => h.symbol).join(',')})`);
  check(s.houses.every((h, i) => h.roofStyle + ':' + h.decor.join('+') + ':' + h.roof !== round1Decor[i]), 'every house got new decorations');
  check(s.signs.every((x, i) => x === s.houses[i].symbol), 'house signs updated to the new symbols');
  check(s.totalDelivered === 3 && s.roundsDone === 1 && s.roundDelivered === 0, 'earlier deliveries are kept (total 3, 1 round star)');
  await shot('07-round-2');
  const t4 = await deliverOnce('Round 2 delivery 1 (calm motion)');
  check(!!t4, 'deliveries still work with calm motion on');
  await page.click('#motionBtn', { force: true });
  s = await waitFor((s) => s.phase === 'choose', 'next parcel');
  check(s.totalDelivered === 4, 'total deliveries keep counting up');

  check(failures.indexOf('progress went down') === -1, 'progress never went down');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
} catch (err) {
  failures.push(String(err && err.message || err));
  console.log('  ✘ ' + (err && err.message || err));
  await shot('zz-failure').catch(() => {});
} finally {
  await browser.close();
  if (server) await server.close();
}

console.log(`\n${passed} checks passed, ${failures.length} failed. Screenshots: ${path.relative(process.cwd(), outDir) || outDir}/`);
process.exit(failures.length ? 1 : 0);

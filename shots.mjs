// Capture the four staged screenshots with the local Playwright Chromium:
// serve game/ on a scratch port, load each ?shot= scene, wait for the game
// to signal it has painted, and save a JPEG that fits the 256 KiB cap by
// stepping down a quality ladder. Console errors and page errors are
// reported, never swallowed.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '/home/hatch/workspace/makefun/shot-tool/node_modules/playwright/index.mjs';

const REPO = '/home/hatch/workspace/makefun/best-game';
const NODE = '/home/hatch/workspace/tools/node22/bin/node';
const PORT = 8123;
const MAX_BYTES = 262144;
const QUALITIES = [88, 75, 60, 45, 30];

const shots = JSON.parse(readFileSync(`${REPO}/shots.json`, 'utf8'));
mkdirSync(`${REPO}/screenshots`, { recursive: true });

const server = spawn(NODE, [`${REPO}/serve.ts`, '--port', String(PORT)], { stdio: 'pipe' });
let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk;
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk;
});

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not start: ${serverLog}`);
}

let failures = 0;
try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    if (message.type() === 'warning') problems.push(`console warning: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    problems.push(`page error: ${error.message}`);
  });

  for (const shot of shots) {
    problems.length = 0;
    await page.goto(`http://127.0.0.1:${PORT}/${shot.query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__shotReady === true', null, { timeout: 15000 });
    const info = await page.evaluate('window.__shotInfo');
    let buffer = null;
    let quality = 0;
    for (const q of QUALITIES) {
      buffer = await page.screenshot({ type: 'jpeg', quality: q });
      quality = q;
      if (buffer.length <= MAX_BYTES) break;
    }
    writeFileSync(`${REPO}/screenshots/${shot.name}`, buffer);
    console.log(`${shot.name}: ${buffer.length} bytes at quality ${quality} — ${JSON.stringify(info)}`);
    for (const problem of problems) console.log(`  !! ${problem}`);
    if (problems.some((p) => p.startsWith('page error') || p.startsWith('console error'))) failures += 1;
  }
  await browser.close();
} finally {
  server.kill();
}

if (failures > 0) {
  console.log(`${failures} shot(s) had errors`);
  process.exit(1);
}
console.log('all shots captured');

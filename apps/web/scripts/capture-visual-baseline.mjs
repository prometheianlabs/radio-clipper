import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as fnDelay } from 'node:timers/promises';
import { spawn } from 'node:child_process';

import { chromium, devices } from 'playwright';

const nServerPort = 4300;
const sBaseUrl = `http://127.0.0.1:${nServerPort}/`;
const sOutputDir = path.resolve(process.cwd(), 'docs/visual-baseline');

// Poll the dev server until it returns any HTTP response.
async function fnWaitForServerReady(sUrl, nMaxAttempts, nWaitMs) {
  for (let nAttempt = 0; nAttempt < nMaxAttempts; nAttempt += 1) {
    try {
      const oResponse = await fetch(sUrl, { method: 'GET' });
      if (oResponse.ok || oResponse.status >= 300) {
        return;
      }
    } catch {
      // Keep retrying while the dev server warms up.
    }

    await fnDelay(nWaitMs);
  }

  throw new Error(`Dev server did not become ready at ${sUrl}`);
}

// Capture the login route for the current viewport profile.
async function fnShotLogin(oContext, sPrefix) {
  const oPage = await oContext.newPage();
  await oPage.goto(sBaseUrl, { waitUntil: 'networkidle' });
  await oPage.screenshot({ path: path.join(sOutputDir, `${sPrefix}-login.png`), fullPage: true });
  await oPage.close();
}

// Capture the producer route by signing in as producer from login.
async function fnShotLiveDesk(oContext, sPrefix) {
  const oPage = await oContext.newPage();
  await oPage.goto(sBaseUrl, { waitUntil: 'networkidle' });
  await oPage.getByRole('button', { name: 'Sign in as producer' }).click();
  await oPage.waitForURL('**/live', { timeout: 10000 });
  await oPage.screenshot({ path: path.join(sOutputDir, `${sPrefix}-live-desk.png`), fullPage: true });
  await oPage.close();
}

// Capture the admin route by signing in as admin from login.
async function fnShotAdmin(oContext, sPrefix) {
  const oPage = await oContext.newPage();
  await oPage.goto(sBaseUrl, { waitUntil: 'networkidle' });
  await oPage.getByRole('button', { name: 'Sign in as admin' }).click();
  await oPage.waitForURL('**/admin', { timeout: 10000 });
  await oPage.screenshot({ path: path.join(sOutputDir, `${sPrefix}-admin.png`), fullPage: true });
  await oPage.close();
}

async function fnCaptureProfile(oBrowser, oContextConfig, sPrefix) {
  const oContext = await oBrowser.newContext(oContextConfig);
  await fnShotLogin(oContext, sPrefix);
  await fnShotLiveDesk(oContext, sPrefix);
  await fnShotAdmin(oContext, sPrefix);
  await oContext.close();
}

async function fnMain() {
  await mkdir(sOutputDir, { recursive: true });

  // Run a dedicated dev server on a fixed alternate port for deterministic captures.
  const oServerProcess = spawn('npm', ['run', 'start', '--', '--port', `${nServerPort}`, '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  oServerProcess.stdout.on('data', (oChunk) => {
    process.stdout.write(oChunk);
  });
  oServerProcess.stderr.on('data', (oChunk) => {
    process.stderr.write(oChunk);
  });

  let oBrowser;

  try {
    await fnWaitForServerReady(sBaseUrl, 120, 500);

    oBrowser = await chromium.launch({ headless: true });

    await fnCaptureProfile(oBrowser, { viewport: { width: 1440, height: 1024 } }, 'desktop');
    await fnCaptureProfile(oBrowser, { ...devices['iPhone 12'] }, 'mobile');

    console.log('Visual baselines refreshed in docs/visual-baseline');
  } finally {
    if (oBrowser) {
      await oBrowser.close();
    }

    oServerProcess.kill('SIGTERM');
  }
}

await fnMain();

// Renders the showreel deterministically: seek(t) -> screenshot, N parallel browsers, then ffmpeg.
// usage: node render.mjs <16x9|9x16> [workers=4] [frames=all]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const aspect = process.argv[2] || '16x9';
const workers = +(process.argv[3] || 4);
const FPS = 30, DURATION = 60;
const total = +(process.argv[4] || FPS * DURATION);
const [W, H] = aspect === '9x16' ? [1080, 1920] : [1920, 1080];
const framesDir = path.join(process.env.FRAMES_DIR || path.join(here, 'out'), `frames_${aspect}`);
fs.mkdirSync(framesDir, { recursive: true });
const chrome = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function worker(id, from, to) {
  const b = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('page error', e.message));
  await p.goto('file://' + path.join(here, 'index.html') + '?a=' + aspect);
  await p.evaluate(() => window.READY);
  for (let f = from; f < to; f++) {
    const file = path.join(framesDir, String(f).padStart(5, '0') + '.jpg');
    if (fs.existsSync(file)) continue;
    await p.evaluate(t => window.seek(t), f / FPS);
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await p.screenshot({ path: file, type: 'jpeg', quality: 96 });
    if (f % 60 === 0) console.log(`[w${id}] frame ${f}/${total}`);
  }
  await b.close();
}

const chunk = Math.ceil(total / workers);
await Promise.all(Array.from({ length: workers }, (_, i) => worker(i, i * chunk, Math.min(total, (i + 1) * chunk))));
console.log('frames done');
const out = path.join(here, 'out', `ESAP-Clinical-AI-showreel-${aspect}.mp4`);
const r = spawnSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(framesDir, '%05d.jpg'), '-i', path.join(here, 'out', 'music.wav'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:a', 'aac', '-b:a', '256k', '-t', String(DURATION), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
console.log('wrote', out);

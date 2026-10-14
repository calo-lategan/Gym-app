// Exports the Android bundle and fails if any module in it calls a Node-only
// `process` function. React Native does not have them, so such a call crashes
// the app on launch, while the web build and Jest (which run on engines that
// do have them) pass. three's old CommonJS entry did exactly this.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NODE_ONLY = /\bprocess\.(emitWarning|cwd|hrtime|exit|binding|umask|memoryUsage|uptime|kill|chdir)\s*\(/;
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const out = mkdtempSync(join(tmpdir(), 'ironwyrm-android-'));
try {
  execFileSync('npx', ['expo', 'export', '-p', 'android', '--source-maps', '--output-dir', out], { stdio: ['ignore', 'ignore', 'inherit'] });
  const dir = join(out, '_expo/static/js/android');
  const mapFile = readdirSync(dir).find((file) => file.endsWith('.map'));
  const map = JSON.parse(readFileSync(join(dir, mapFile), 'utf8'));
  const offenders = map.sources.filter((source, i) => map.sourcesContent?.[i] && NODE_ONLY.test(stripComments(map.sourcesContent[i])));
  if (offenders.length) {
    console.error(`Node-only process calls in the Android bundle, which crash the app on launch:\n  ${offenders.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Android bundle OK: ${map.sources.length} modules, no Node-only process calls.`);
} finally {
  rmSync(out, { recursive: true, force: true });
}

// SOLMARA's entrypoint (Node 22, standard library only).
// It hands the game in: copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json with buildDossier
// from the vendored make.fun library. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      const sub = countTree(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
    }
  }
  return { files, bytes };
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const gameStats = countTree(join(out, 'game'));
const shotStats = countTree(join(out, 'screenshots'));

// The scorer's own caps: only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// The dossier must be exactly what the library writes from the files:
// rebuild it from the output tree and compare byte for byte, the way
// the gate does. A mismatch here is a refused entry. (buildDossier
// returns bytes, so compare the bytes, not the two objects.)
const rebuilt = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
if (!Buffer.from(rebuilt).equals(Buffer.from(dossier))) {
  console.error('dossier mismatch: the rebuilt dossier differs from the written one');
  process.exit(1);
}

console.log(`SOLMARA handed in: game/ ${gameStats.files} files, ${gameStats.bytes} bytes; ` +
  `screenshots/ ${shotStats.files} files, ${shotStats.bytes} bytes; ` +
  `dossier.json ${dossier.length} bytes, sha256 ` +
  createHash('sha256').update(dossier).digest('hex') + '.');

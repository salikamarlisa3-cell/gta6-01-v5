// SOLARA BAY — gta6-01 entry program (Node 22, standard library only).
//
// The game itself is the static site in game/: index.html plus ES modules and
// a vendored three.js, playable offline in a desktop browser with keyboard
// and mouse. This program is only the courier: it copies game/ and
// screenshots/ into the output directory and writes dossier.json there with
// the vendored make.fun library, so the judge receives the game, its four
// screenshots and a source summary in one package.
//
// Run locally the same way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grading container.)

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps below mirror the scorer's gate: the dossier text budget shapes how
// much source the judge reads, and the rest refuse anything the scorer would
// refuse anyway — at most 4 screenshots of 256 KiB each, at most 993 game
// files or 48 MiB of game in total, and no game path over 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Verify the package that just landed: walk the copied game tree and count
// files and bytes, and confirm all four screenshots arrived. A silent short
// copy would otherwise surface only as a baffled judge, so fail loudly here
// instead — and print the same one-line summary a human would check.
function treeStats(dir) {
  let files = 0, bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { const s = treeStats(p); files += s.files; bytes += s.bytes; }
    else { files += 1; bytes += st.size; }
  }
  return { files, bytes };
}
const gameStats = treeStats(join(out, 'game'));
const shotStats = treeStats(join(out, 'screenshots'));
if (shotStats.files !== 4) {
  throw new Error(`expected 4 screenshots in the output, found ${shotStats.files}`);
}
console.log(
  `solara-bay package: ${gameStats.files} game files (${gameStats.bytes} bytes), ` +
  `${shotStats.files} screenshots (${shotStats.bytes} bytes), dossier ${Buffer.byteLength(dossier)} bytes -> ${out}`,
);

// Downloads dragon artwork from https://gotdragonfire.com/dragons/ into
// src/assets/dragons/. Personal-use only — the art belongs to the game's publisher.
//
//   node scripts/fetch-dragon-art.mjs          # skip files that already exist
//   node scripts/fetch-dragon-art.mjs --force  # re-download everything
//
// The listing page ships all dragons in one HTML document (its 3 "pages" are
// client-side), so one fetch gives every slug + portrait thumbnail. Each detail
// page then supplies the transparent cutouts (hero-fg, fullbody-N).

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://gotdragonfire.com';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/dragons');
const FORCE = process.argv.includes('--force');
const UA = { 'User-Agent': 'Mozilla/5.0 (personal asset fetch)' };

// Output folder per image kind, keyed by the suffix the site uses in filenames.
const KINDS = {
  'portrait-thumb': 'portrait', // listing card art (474x560, opaque)
  'portrait-square': 'square', // bio square (729x729, opaque)
  'hero-fg': 'hero', // detail hero cutout (transparent)
  'fullbody-1': 'fullbody', // full-body cutouts (transparent)
  'fullbody-2': 'fullbody',
  'fullbody-3': 'fullbody',
};

const getText = async (url) => {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

const exists = (p) => access(p).then(() => true, () => false);

// Astro hashed asset: /_astro/<slug>-<kind>.<hash>_<variant>.webp
const findAsset = (html, slug, kind) =>
  html.match(new RegExp(`/_astro/${slug}-${kind}\\.[^"\\s,]+?\\.webp`))?.[0];

const outName = (slug, kind) => {
  const n = kind.match(/^fullbody-(\d)$/)?.[1];
  return path.join(OUT, KINDS[kind], n ? `${slug}-${n}.webp` : `${slug}.webp`);
};

async function download(url, dest) {
  if (!FORCE && (await exists(dest))) return 'skip';
  const res = await fetch(ORIGIN + url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

const listing = await getText(`${ORIGIN}/dragons/`);
const slugs = [...new Set([...listing.matchAll(/href="\/dragons\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))].sort();
console.log(`Found ${slugs.length} dragons`);

const missing = [];
for (const slug of slugs) {
  const detail = await getText(`${ORIGIN}/dragons/${slug}/`);
  const results = [];
  for (const kind of Object.keys(KINDS)) {
    const url = findAsset(kind === 'portrait-thumb' ? listing : detail, slug, kind);
    if (!url) {
      // Dragons have 1–3 full-body shots; only a missing first one is notable.
      if (!/^fullbody-[23]$/.test(kind)) missing.push(`${slug}:${kind}`);
      continue;
    }
    results.push(`${kind}=${await download(url, outName(slug, kind))}`);
  }
  console.log(`${slug.padEnd(14)} ${results.join(' ')}`);
}

if (missing.length) console.warn(`\nNot found on site: ${missing.join(', ')}`);

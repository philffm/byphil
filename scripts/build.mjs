#!/usr/bin/env node
// Builds the static, per-language pages from one template + one JSON file per language.
//
//   site-src/index.template.html   markup with {{t:key}} / {{a:key}} placeholders
//   i18n/<code>.json               flat key -> string, one file per language
//   -> index.html (en), de/index.html, sitemap.xml, robots.txt   (committed; nginx serves them as-is)
//
//   node scripts/build.mjs           write the files
//   node scripts/build.mjs --check   exit 1 if committed output is stale or the dictionaries disagree
//
// Add a language: add it to LOCALES, copy i18n/en.json to i18n/<code>.json, translate, build.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://byphil.eu';
const LOCALES = [
  { code: 'en', dir: '', lang: 'en', og: 'en_US' },
  { code: 'de', dir: 'de/', lang: 'de', og: 'de_DE' },
];
// Keys with these prefixes are also shipped to the browser as window.I18N (used by inline JS).
const JS_PREFIXES = ['js.', 'nav.theme'];
const CHECK = process.argv.includes('--check');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const fail = (msg) => { console.error('✖ ' + msg); process.exitCode = 1; };

const template = read('site-src/index.template.html');
const dicts = Object.fromEntries(LOCALES.map((l) => [l.code, JSON.parse(read(`i18n/${l.code}.json`))]));

// ── Validate the dictionaries ────────────────────────────────────────────────
const refKeys = Object.keys(dicts.en);
for (const l of LOCALES) {
  const keys = Object.keys(dicts[l.code]);
  for (const key of refKeys) if (!(key in dicts[l.code])) fail(`${l.code}: missing key "${key}"`);
  for (const key of keys) if (!(key in dicts.en)) fail(`${l.code}: extra key "${key}" (not in en.json)`);
  for (const key of keys) if (typeof dicts[l.code][key] !== 'string' || !dicts[l.code][key].trim()) fail(`${l.code}: empty value for "${key}"`);
}
const usedKeys = new Set([...template.matchAll(/\{\{[ta]:([^}]+)\}\}/g)].map((m) => m[1]));
for (const key of usedKeys) if (!(key in dicts.en)) fail(`template uses unknown key "${key}"`);
for (const key of refKeys) {
  if (JS_PREFIXES.some((p) => key.startsWith(p))) continue;
  if (!usedKeys.has(key)) fail(`key "${key}" is not used in the template`);
}
if (process.exitCode) process.exit(1);

// ── Helpers ──────────────────────────────────────────────────────────────────
const relDir = (from, to) => {
  const rel = path.posix.relative(from.dir || '.', to.dir || '.');
  return rel === '' ? './' : rel + '/';
};
const url = (l) => `${SITE}/${l.dir}`;

function seoBlock(l, dict) {
  const lines = [
    `<link rel="canonical" href="${url(l)}">`,
    ...LOCALES.map((m) => `<link rel="alternate" hreflang="${m.lang}" href="${url(m)}">`),
    `<link rel="alternate" hreflang="x-default" href="${url(LOCALES[0])}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="byphil">`,
    `<meta property="og:title" content="${esc(dict['meta.title'])}">`,
    `<meta property="og:description" content="${esc(dict['meta.description'])}">`,
    `<meta property="og:url" content="${url(l)}">`,
    `<meta property="og:locale" content="${l.og}">`,
    ...LOCALES.filter((m) => m !== l).map((m) => `<meta property="og:locale:alternate" content="${m.og}">`),
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${esc(dict['meta.title'])}">`,
    `<meta name="twitter:description" content="${esc(dict['meta.description'])}">`,
  ];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'byphil', url: `${SITE}/`, founder: { '@type': 'Person', name: 'Phil Wornath' } },
      { '@type': 'WebSite', '@id': `${url(l)}#website`, url: url(l), name: 'byphil', inLanguage: l.lang, publisher: { '@id': `${SITE}/#org` } },
    ],
  };
  lines.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  return lines.join('\n');
}

function render(l) {
  const dict = dicts[l.code];
  const jsDict = Object.fromEntries(Object.entries(dict).filter(([k]) => JS_PREFIXES.some((p) => k.startsWith(p))));
  return template.replace(/\{\{([a-z0-9-]+)(?::([^}]+))?\}\}/g, (all, name, arg) => {
    switch (name) {
      case 't': return dict[arg];
      case 'a': return esc(dict[arg]);
      case 'lang': return l.lang;
      case 'base': return l.dir ? '../' : '';
      case 'href': return arg === 'self' ? './' : relDir(l, LOCALES.find((m) => m.code === arg));
      case 'cur': return String(arg === l.code);
      case 'seo': return seoBlock(l, dict);
      case 'i18n-js': return JSON.stringify(jsDict).replace(/</g, '\\u003c');
      default: throw new Error(`Unknown placeholder ${all}`);
    }
  });
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LOCALES.map((l) => `  <url>
    <loc>${url(l)}</loc>
${LOCALES.map((m) => `    <xhtml:link rel="alternate" hreflang="${m.lang}" href="${url(m)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${url(LOCALES[0])}"/>
  </url>`).join('\n')}
</urlset>
`;
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

const outputs = new Map([
  ...LOCALES.map((l) => [`${l.dir}index.html`, render(l)]),
  ['sitemap.xml', sitemap],
  ['robots.txt', robots],
]);

let stale = 0;
for (const [file, content] of outputs) {
  const abs = path.join(ROOT, file);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (CHECK) {
    if (current !== content) { console.error(`✖ ${file} is out of date — run: npm run build`); stale++; }
  } else {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (current !== content) fs.writeFileSync(abs, content);
    console.log(`${current === content ? '=' : '✔'} ${file}`);
  }
}
if (CHECK) {
  if (stale) process.exit(1);
  console.log(`✔ ${outputs.size} files up to date, ${refKeys.length} keys in ${LOCALES.length} languages`);
}

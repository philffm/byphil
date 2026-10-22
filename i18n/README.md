# byphil.eu translations

`site-src/index.template.html` holds the markup with placeholders; each language is one flat JSON file here.

| Placeholder | Meaning |
| --- | --- |
| `{{t:key}}` | text (HTML allowed, e.g. `<br>`, `<em>`) |
| `{{a:key}}` | same, escaped for use inside an attribute |
| `{{lang}}`, `{{base}}`, `{{href:en}}` … | filled in by the build |

Keys starting with `js.` (and `nav.theme*`) are also exported to the browser as `window.I18N` for the inline script.

```bash
npm run build   # writes index.html, de/index.html, sitemap.xml, robots.txt
npm run check   # fails if output is stale or a language is missing/has extra keys (use in CI)
```

**Add a language:** add an entry to `LOCALES` in `scripts/build.mjs`, copy `en.json` to `<code>.json`, translate, `npm run build`, and add a link to the language switch in the template.

`terms.html` (Privacy, Terms, Refunds, Impressum) is English-only and not part of this build.

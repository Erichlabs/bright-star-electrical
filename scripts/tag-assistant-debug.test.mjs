import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

// Exercise the documented query predicates locally. Live edge headers must also
// be checked after deployment; this is not a substitute for an end-to-end test.
function headersFor(query = '') {
  const params = new URLSearchParams(query);
  const matches = ({ type, key, value }) => {
    assert.equal(type, 'query');
    return params.has(key) && new RegExp(`^(?:${value})$`).test(params.get(key));
  };
  const entries = config.headers.filter(rule =>
    (rule.has || []).every(matches) && (rule.missing || []).every(condition => !matches(condition))
  ).flatMap(rule => rule.headers);
  for (const key of ['Content-Security-Policy', 'Cross-Origin-Opener-Policy']) {
    assert.equal(entries.filter(h => h.key === key).length, 1, `exactly one ${key}`);
  }
  return Object.fromEntries(entries.map(h => [h.key, h.value]));
}

function policy(headers, directive) {
  return headers['Content-Security-Policy'].split(';').map(s => s.trim().split(/\s+/))
    .find(s => s[0] === directive)?.slice(1) || [];
}

test('ordinary visitors keep same-origin popup isolation and existing protections', () => {
  for (const query of ['', 'utm_source=google', 'gtm_debug=', 'gtm_debug=abc', 'gtm_debug=123', 'gtm_debug=179108138776099999']) {
    const h = headersFor(query);
    assert.equal(h['Cross-Origin-Opener-Policy'], 'same-origin');
    assert.equal(h['X-Frame-Options'], 'DENY');
    assert.equal(h['X-Content-Type-Options'], 'nosniff');
    assert.deepEqual(policy(h, 'frame-ancestors'), ["'none'"]);
    assert.equal(policy(h, 'script-src').includes('https://tagmanager.google.com'), false);
    assert.equal(h['Cache-Control'], undefined);
  }
});

test('valid opt-in debug requests permit the popup channel without disabling CSP', () => {
  const h = headersFor('gtm_debug=1791081387760');
  assert.equal(h['Cross-Origin-Opener-Policy'], 'unsafe-none');
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.equal(h['Permissions-Policy'], 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  assert.deepEqual(policy(h, 'frame-ancestors'), ["'none'"]);
  assert.deepEqual(policy(h, 'object-src'), ["'none'"]);
  assert.ok(policy(h, 'connect-src').includes('https://exciting-egret-676.convex.site'));
});

test('debug CSP permits only the additional documented Google preview resources', () => {
  const regular = headersFor(), debug = headersFor('gtm_debug=1791081387760');
  const additions = {
    'script-src': ['https://tagmanager.google.com'],
    'style-src': ['https://www.googletagmanager.com', 'https://tagmanager.google.com'],
    'img-src': ['https://ssl.gstatic.com', 'https://www.gstatic.com'],
    'font-src': ['data:'],
  };
  for (const directive of ['default-src','base-uri','object-src','frame-ancestors','form-action','img-src','font-src','style-src','script-src','connect-src','frame-src']) {
    const before = policy(regular, directive), after = policy(debug, directive);
    for (const value of before) assert.ok(after.includes(value));
    assert.deepEqual(after.filter(value => !before.includes(value)), additions[directive] || []);
  }
});

test('neither regular nor debug pages allow arbitrary inline or eval scripts', () => {
  for (const h of [headersFor(), headersFor('gtm_debug=1791081387760')]) {
    const script = policy(h, 'script-src');
    assert.equal(script.includes("'unsafe-inline'"), false);
    assert.equal(script.includes("'unsafe-eval'"), false);
    assert.equal(script.includes('*'), false);
    assert.ok(script.includes("'sha256-9IrW8K/ZzUgVACN3CO/ZIVJiGVEpTmz2KB/gQuJQId0='"));
  }
});

test('debug responses opt out of browser and Vercel edge caching', () => {
  const h = headersFor('gtm_debug=1791081387760');
  assert.equal(h['Cache-Control'], 'no-store');
  assert.equal(h['Vercel-CDN-Cache-Control'], 'no-store');
});

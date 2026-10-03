import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { addGoogleTag, instrumentSite, TAG_ID, TAG_SNIPPET, INLINE_SCRIPT, CSP_HASH } from './add-google-tag.mjs';

const html = '<!doctype html>\n<html><head>\n<meta charset="utf-8"><title>Original</title></head><body><form id="website-quote-form">Unchanged</form><script src="site.js"></script></body></html>';

test('inserts the exact supplied tag once immediately after head', () => {
  const result = addGoogleTag(html);
  assert.ok(result.includes(`<head>\n${TAG_SNIPPET}\n<meta`));
  assert.equal(result.replace(`\n${TAG_SNIPPET}`, ''), html);
  assert.equal(result.split('gtag/js?id=').length - 1, 1);
  assert.equal(result.split(`gtag('config', '${TAG_ID}')`).length - 1, 1);
  assert.ok(result.indexOf('charset') < 1024);
});
test('running the build twice does not duplicate or rewrite the tag', () => {
  const once = addGoogleTag(html);
  assert.equal(addGoogleTag(once), once);
});
test('rejects existing other Google tags instead of duplicating them', () => {
  assert.throws(() => addGoogleTag(html.replace('<head>', '<head><script src="https://www.googletagmanager.com/gtag/js?id=G-EXAMPLE"></script>')), /existing Google setup/);
  assert.throws(() => addGoogleTag(addGoogleTag(html).replace('</head>', `${TAG_SNIPPET}</head>`)), /duplicate Google tags/);
});
test('rejects incomplete HTML', () => {
  assert.throws(() => addGoogleTag('<html><body>Incomplete</body></html>'), /complete HTML head/);
});
test('queues initialization and only the requested Ads configuration', () => {
  const context = { dataLayer: [['existing', 'preserved']] };
  context.window = context;
  runInNewContext(INLINE_SCRIPT, context);
  assert.deepEqual(context.dataLayer[0], ['existing', 'preserved']);
  assert.equal(context.dataLayer.length, 3);
  assert.equal(context.dataLayer[1][0], 'js');
  assert.equal(context.dataLayer[2][0], 'config');
  assert.equal(context.dataLayer[2][1], TAG_ID);
});
test('covers all current public pages and nested HTML without changing JS', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bse-tag-'));
  try {
    const pages = ['index.html','thanks.html','privacy.html','terms.html','disclaimer.html','cookie-notice.html'];
    for (const path of pages) await writeFile(join(root, path), html);
    await mkdir(join(root, '03_Build'));
    await writeFile(join(root, '03_Build', 'index.html'), html);
    await writeFile(join(root, 'site.js'), '/* enquiry handler stays unchanged */');
    await writeFile(join(root, 'vercel.json'), JSON.stringify({headers:[{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:`script-src 'self' '${CSP_HASH}' https://www.googletagmanager.com;`}]}]}));
    assert.equal(await instrumentSite(root), 7);
    assert.equal(await instrumentSite(root), 7);
    for (const path of [...pages, '03_Build/index.html']) assert.equal(await readFile(join(root, path), 'utf8'), addGoogleTag(html));
    assert.equal(await readFile(join(root, 'site.js'), 'utf8'), '/* enquiry handler stays unchanged */');
  } finally { await rm(root, {recursive:true, force:true}); }
});

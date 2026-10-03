import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TAG_ID = 'AW-16717953662';
export const INLINE_SCRIPT = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-16717953662');
`;
export const TAG_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${TAG_ID}"></script>
<script>${INLINE_SCRIPT}</script>`;
export const CSP_HASH = `sha256-${createHash('sha256').update(INLINE_SCRIPT).digest('base64')}`;

// Insert at build time, so every static page (including future pages) receives
// the same tag. No form handlers, client data, or conversion events are changed.
export function addGoogleTag(html, filename = 'page.html') {
  const existingLoader = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*(?:googletagmanager\.com\/(?:gtag\/js|gtm\.js)|google-analytics\.com\/analytics\.js)[^"']*["'][^>]*>/gi;
  const loaders = html.match(existingLoader) || [];
  if (html.includes(TAG_SNIPPET)) {
    if (loaders.length !== 1 || html.split(TAG_SNIPPET).length !== 2) {
      throw new Error(`${filename}: duplicate Google tags; review before deployment`);
    }
    return html;
  }
  if (loaders.length || /\bgtag\s*\(/.test(html)) {
    throw new Error(`${filename}: existing Google setup requires manual integration; refusing to duplicate it`);
  }
  const heads = html.match(/<head\b[^>]*>/gi) || [];
  if (heads.length !== 1 || !/<\/head\s*>/i.test(html)) {
    throw new Error(`${filename}: expected exactly one complete HTML head`);
  }
  return html.replace(/<head\b[^>]*>/i, (head) => `${head}\n${TAG_SNIPPET}`);
}

export async function instrumentSite(root) {
  const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
  const csp = config.headers?.flatMap((rule) => rule.headers || [])
    .find((header) => header.key.toLowerCase() === 'content-security-policy')?.value;
  const scriptPolicy = csp?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('script-src '));
  if (!scriptPolicy?.includes(`'${CSP_HASH}'`) || !scriptPolicy.includes('https://www.googletagmanager.com')) {
    throw new Error('Google tag CSP hash or loader allowance is missing');
  }
  const pages = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'scripts'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile() && /\.html$/i.test(entry.name)) pages.push(path);
    }
  }
  await collect(root);
  for (const required of ['index.html', 'thanks.html', 'privacy.html', 'terms.html', 'disclaimer.html', 'cookie-notice.html']) {
    if (!pages.includes(join(root, required))) throw new Error(`Missing required public page: ${required}`);
  }
  // Validate the entire site before writing any output. Existing conflicting
  // tags cause a build failure, leaving the previous Production deployment live.
  const changes = await Promise.all(pages.sort().map(async (path) => {
    const original = await readFile(path, 'utf8');
    return { path, original, tagged: addGoogleTag(original, path) };
  }));
  for (const { path, original, tagged } of changes) {
    if (tagged !== original) await writeFile(path, tagged, 'utf8');
  }
  console.log(`${TAG_ID}: verified one Google tag on each of ${pages.length} HTML pages.`);
  return pages.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await instrumentSite(process.cwd());
}

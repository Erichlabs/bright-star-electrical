import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// Runs the actual website handler with synthetic DOM, clock and network boundaries.
// No request leaves this process and no real enquiry/conversion is created.
const source = await readFile(new URL('../site.js', import.meta.url), 'utf8');
const destination = 'AW-16717953662/PLYxCMOr9-EZEP703qM-';

function setup(options = {}) {
  const events = [], requests = [], redirects = [], timers = new Map();
  const button = { disabled: false, textContent: 'Send my quote request' };
  const status = { textContent: '' };
  const fields = {
    name: 'Synthetic Person', phone: 'synthetic-phone', email: 'test@example.invalid',
    suburb: 'Synthetic suburb', address: 'Synthetic address',
    service: 'Electrical enquiry', message: 'Synthetic test only',
  };
  let submit, timerId = 0, sequence = 0;
  const form = {
    reportValidity: () => options.valid !== false,
    addEventListener: (name, handler) => { if (name === 'submit') submit = handler; },
    querySelector: (selector) => ({
      'button[type="submit"]': button, '.form-status': status,
      '#photos': { files: options.files || [] },
    })[selector] || null,
  };
  const window = {
    location: {
      href: options.href || 'https://www.brightstarelectrical.com.au/',
      assign: (url) => redirects.push(url),
    },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  };
  if (options.tag !== 'missing') {
    window.gtag = (...args) => {
      events.push(args);
      if (options.tag === 'throws') throw new Error('Synthetic tag failure');
      if (options.tag !== 'blocked') args[2].event_callback();
    };
  }
  const context = vm.createContext({
    window,
    URL,
    document: {
      querySelector: (selector) => options.form !== false && selector === '#website-quote-form' ? form : null,
      querySelectorAll: () => [],
    },
    FormData: class {
      get(name) { return fields[name]; }
      append() {}
    },
    crypto: { randomUUID: () => `synthetic-submission-${++sequence}` },
    fetch: async (url, init) => {
      requests.push({ url, init });
      if (options.fetch) return options.fetch(url, init);
      if (options.networkError) throw new Error('Synthetic network failure');
      if (url.endsWith('/upload')) return { ok: options.uploadOk !== false, json: async () => ({ storageId: 'synthetic-photo' }) };
      return { ok: options.ok !== false };
    },
  });
  vm.runInContext(source, context, { filename: 'site.js' });
  return {
    events, requests, redirects, timers, button, status,
    submit: () => submit?.({ preventDefault() {} }),
    expire: () => { for (const { callback } of [...timers.values()]) callback(); },
  };
}

test('no conversion, request or redirect on ordinary page load', () => {
  const s = setup();
  assert.equal(s.events.length, 0);
  assert.equal(s.requests.length, 0);
  assert.equal(s.redirects.length, 0);
});

test('no form on direct thank-you/legal pages means no conversion', () => {
  const s = setup({ form: false });
  assert.equal(s.events.length, 0);
  assert.equal(s.requests.length, 0);
});

test('invalid form does not request delivery or record a lead', async () => {
  const s = setup({ valid: false });
  await s.submit();
  assert.equal(s.requests.length, 0);
  assert.equal(s.events.length, 0);
  assert.equal(s.redirects.length, 0);
});

test('waits for server success, then sends only BSE Lead with an opaque ID', async () => {
  let accept;
  const s = setup({ fetch: () => new Promise(resolve => { accept = resolve; }) });
  const pending = s.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.events.length, 0);
  assert.equal(s.redirects.length, 0);
  accept({ ok: true });
  await pending;
  assert.equal(s.events.length, 1);
  const [command, event, payload] = s.events[0];
  assert.equal(command, 'event');
  assert.equal(event, 'conversion');
  assert.equal(payload.send_to, destination);
  const submitted = JSON.parse(s.requests[0].init.body);
  assert.equal(payload.transaction_id, submitted.sessionId);
  assert.deepEqual(Object.keys(payload).sort(), ['event_callback', 'event_timeout', 'send_to', 'transaction_id']);
  for (const privateValue of ['Synthetic Person', 'synthetic-phone', 'test@example.invalid', 'Synthetic address']) {
    assert.equal(JSON.stringify(payload).includes(privateValue), false);
  }
  assert.deepEqual(s.redirects, ['/thanks.html']);
  assert.equal(s.timers.size, 0);
  assert.match(s.status.textContent, /sent successfully/);
});

test('server rejection records no conversion and preserves retry UI', async () => {
  const s = setup({ ok: false });
  await s.submit();
  assert.equal(s.events.length, 0);
  assert.equal(s.redirects.length, 0);
  assert.equal(s.button.disabled, false);
  assert.match(s.status.textContent, /could not send/);
});

test('network failure records no conversion', async () => {
  const s = setup({ networkError: true });
  await s.submit();
  assert.equal(s.events.length, 0);
  assert.equal(s.redirects.length, 0);
  assert.equal(s.button.disabled, false);
});

test('failed photo upload never records a lead', async () => {
  const s = setup({ files: ['synthetic-photo'], uploadOk: false });
  await s.submit();
  assert.equal(s.requests.length, 1);
  assert.equal(s.events.length, 0);
  assert.equal(s.redirects.length, 0);
});

test('successful photo upload and lead delivery record one conversion', async () => {
  const s = setup({ files: ['synthetic-photo'] });
  await s.submit();
  assert.equal(s.requests.length, 2);
  assert.deepEqual(JSON.parse(s.requests[1].init.body).photoStorageIds, ['synthetic-photo']);
  assert.equal(s.events.length, 1);
  assert.deepEqual(s.redirects, ['/thanks.html']);
});

test('missing Google tag cannot block successful enquiry navigation', async () => {
  const s = setup({ tag: 'missing' });
  await s.submit();
  assert.equal(s.events.length, 0);
  assert.deepEqual(s.redirects, ['/thanks.html']);
  assert.equal(s.timers.size, 0);
  assert.match(s.status.textContent, /sent successfully/);
});

test('blocked Google loader falls back after 1500ms; late callbacks do not redirect twice', async () => {
  const s = setup({ tag: 'blocked' });
  await s.submit();
  assert.equal(s.events.length, 1);
  assert.equal(s.redirects.length, 0);
  assert.equal([...s.timers.values()][0].delay, 1500);
  s.expire();
  s.events[0][2].event_callback();
  s.events[0][2].event_callback();
  assert.deepEqual(s.redirects, ['/thanks.html']);
  assert.equal(s.timers.size, 0);
});

test('throwing Google code cannot turn delivered enquiry into a form failure', async () => {
  const s = setup({ tag: 'throws' });
  await s.submit();
  assert.deepEqual(s.redirects, ['/thanks.html']);
  assert.match(s.status.textContent, /sent successfully/);
  assert.equal(s.button.disabled, true);
});

test('different successful submissions have distinct conversion IDs', async () => {
  const s = setup();
  await s.submit();
  await s.submit();
  assert.equal(s.events.length, 2);
  assert.notEqual(s.events[0][2].transaction_id, s.events[1][2].transaction_id);
});

test('no generic Submit lead form or Cordata destination is installed', () => {
  assert.equal(source.includes('Nc_jCM6in9cZEP703qM-'), false);
  assert.equal(source.includes('Ce68CMmA_uEZEP703qM-'), false);
  assert.equal(source.split(destination).length - 1, 1);
});


test('keeps a valid Tag Assistant marker through the confirmed-enquiry redirect only', async () => {
  const s = setup({ href: 'https://www.brightstarelectrical.com.au/?gtm_debug=1791081387760&unrelated=not-copied#quote' });
  assert.equal(s.events.length, 0);
  await s.submit();
  assert.equal(s.events.length, 1);
  assert.deepEqual(s.redirects, ['/thanks.html?gtm_debug=1791081387760']);
  assert.equal(s.events[0][2].send_to, destination);
  assert.equal(s.events[0][2].transaction_id, JSON.parse(s.requests[0].init.body).sessionId);
});

test('invalid or absent debug values do not change the normal thank-you URL', async () => {
  for (const query of ['?utm_source=google', '?gtm_debug=', '?gtm_debug=abc', '?gtm_debug=123', '?gtm_debug=179108138776099999']) {
    const s = setup({ href: 'https://www.brightstarelectrical.com.au/' + query });
    await s.submit();
    assert.deepEqual(s.redirects, ['/thanks.html']);
    assert.equal(s.events.length, 1);
  }
});

test('Tag Assistant debug mode cannot record a rejected enquiry', async () => {
  const s = setup({ href: 'https://www.brightstarelectrical.com.au/?gtm_debug=1791081387760', ok: false });
  await s.submit();
  assert.equal(s.events.length, 0);
  assert.equal(s.redirects.length, 0);
});

test('debug success redirect remains bounded when Google is blocked', async () => {
  const s = setup({ href: 'https://www.brightstarelectrical.com.au/?gtm_debug=1791081387760', tag: 'blocked' });
  await s.submit();
  assert.equal(s.redirects.length, 0);
  s.expire();
  s.events[0][2].event_callback();
  assert.deepEqual(s.redirects, ['/thanks.html?gtm_debug=1791081387760']);
});

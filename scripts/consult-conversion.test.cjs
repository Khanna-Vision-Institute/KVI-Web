const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/js/consult-conversion.js', 'utf8');
function fixture() {
  const storage = new Map(), calls = [];
  const window = {
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' },
    gtag: (...args) => calls.push(args)
  };
  vm.runInNewContext(source, { window, Date, Number, Object, JSON });
  return { window, api: window.KviConsultConversion, storage, calls };
}
test('VIP and SMILE each count a successful request once in GA4 and existing Ads action', () => {
  for (const kind of ['vip', 'smile']) {
    const f = fixture();
    assert.equal(f.api.reportSuccess(kind), false); // direct thank-you visit
    assert.equal(f.api.recordSuccess(kind), true);
    assert.equal(f.api.reportSuccess(kind), true);
    assert.equal(f.api.reportSuccess(kind), false); // reload
    assert.equal(f.calls.filter(c => c[0] === 'event' && c[1] === 'generate_lead').length, 1);
    assert.equal(f.calls.filter(c => c[0] === 'event' && c[1] === 'conversion').length, 1);
    assert.deepEqual(Object.keys(f.calls[0][2]).sort(), ['form_id', 'send_to']);
    assert.equal(f.calls[2][2].transaction_id, '11111111-1111-4111-8111-111111111111');
    assert.equal(f.storage.size, 0);
  }
});
test('expired, malformed, wrong-form and reset receipts never count', () => {
  const f = fixture();
  f.api.recordSuccess('vip');
  assert.equal(f.api.reportSuccess('smile'), false);
  f.api.reset('vip'); assert.equal(f.api.reportSuccess('vip'), false);
  for (const value of ['bad-json', JSON.stringify({at: Date.now() - 301000, receipt: '11111111-1111-4111-8111-111111111111'}), JSON.stringify({at: Date.now(), receipt: 'private@example.invalid'})]) {
    f.storage.set('kvi_consult_success_v1_vip', value);
    assert.equal(f.api.reportSuccess('vip'), false);
  }
  assert.equal(f.api.recordSuccess('__proto__'), false);
  assert.equal(f.calls.length, 0);
});
test('blocked storage or unavailable tags cannot break booking or fabricate conversions', () => {
  const f = fixture();
  f.window.sessionStorage.setItem = () => { throw new Error('blocked'); };
  assert.equal(f.api.recordSuccess('vip'), false);
  assert.equal(f.api.reportSuccess('vip'), false);
  f.window.gtag = undefined;
  assert.equal(f.api.reportSuccess('vip'), false);
  assert.equal(f.calls.length, 0);
});
test('form wiring requires HTTP and explicit success; thank-you pages have no unconditional conversion', () => {
  for (const [kind, form, thanks] of [['vip', 'vip-consult.html', 'vip-consult-thank-you.html'], ['smile', 'smile-book-consultation.html', 'smile-book-consultation-thank-you.html']]) {
    const html = fs.readFileSync(form, 'utf8'), thankYou = fs.readFileSync(thanks, 'utf8');
    assert.match(html, /res.ok && (?:json|out).success === true/);
    assert.ok(html.includes("recordSuccess('" + kind + "')"));
    assert.ok(thankYou.includes("reportSuccess('" + kind + "')"));
    assert.doesNotMatch(thankYou, /gtag\('event', '(?:conversion|generate_lead)'/);
    for (const page of [html, thankYou]) {
      assert.match(page, /src="\/public\/js\/consult-conversion.js"/);
      for (const match of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        if (!match[0].includes('application/ld+json')) assert.doesNotThrow(() => new vm.Script(match[1]));
      }
    }
  }
});

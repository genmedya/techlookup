// K46 — 404 sondası: dil izi yalnız hata sayfasında olan siteler (thy: JSESSIONID, n11: connect.sid; 2026-11-12).
// Ana sayfa iz vermez; olmayan bir yol istenir, yalnız gerçek 4xx/5xx yanıtı ve varsayılan hata sayfası cümlesi okunur.
// `node --test tests/hata-sayfasi.test.mjs`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunucuAc, tara, bulunan, SADE } from './yardimci-sunucu.mjs';

const SONDA = /^\/techlookup-yok-/;
const sondaSayisi = (sayac) => Object.entries(sayac).filter(([y]) => SONDA.test(y)).reduce((a, [, n]) => a + n, 0);

async function vaka(diger, ek, ortam) {
  const s = await sunucuAc({ '/': { govde: SADE } }, diger);
  try {
    const { r, ham } = await tara(`${s.taban}/`, ek, ortam);
    return { r, ham, b: bulunan(r), sonda: sondaSayisi(s.sayac) };
  } finally { s.kapat(); }
}

const KANIT = [
  ['404 çerezi JSESSIONID', { kod: 404, govde: 'Not Found', cerezler: ['JSESSIONID=8F2A1B; Path=/'] }, 'Java'],
  ['404 çerezi connect.sid', { kod: 404, govde: 'Not Found', cerezler: ['connect.sid=s%3AGIZLIDEGER123.imza; Path=/; HttpOnly'] }, 'Express'],
  ['404 çerezi connect.sid (implies)', { kod: 404, govde: 'Not Found', cerezler: ['connect.sid=s%3Aabc; Path=/'] }, 'Node.js'],
  ['ASP.NET hata sayfası', { kod: 404, govde: "<html><body><h1>Server Error in '/' Application.<hr></h1><h2><i>The resource cannot be found.</i></h2></body></html>" }, 'Microsoft ASP.NET'],
  ['IIS hata sayfası', { kod: 404, govde: '<html><head><title>IIS 10.0 Detailed Error - 404.0 - Not Found</title></head><body><h3>HTTP Error 404.0 - Not Found</h3></body></html>' }, 'IIS'],
  ['Spring hata sayfası', { kod: 404, govde: '<html><body><h1>Whitelabel Error Page</h1><p>This application has no explicit mapping for /error</p></body></html>' }, 'Spring'],
  ['Tomcat hata sayfası', { kod: 404, govde: '<html><body><h1>HTTP Status 404 – Not Found</h1><hr class="line" /><h3>Apache Tomcat/9.0.83</h3></body></html>' }, 'Apache Tomcat'],
  ['Express hata sayfası', (yol) => ({ kod: 404, govde: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body><pre>Cannot GET ${yol}</pre></body></html>` }), 'Express'],
];
for (const [ad, diger, tekno] of KANIT) {
  test(`K46 (kanıt) ${ad} → ${tekno}`, async () => {
    const { b, sonda } = await vaka(diger);
    assert.ok(sonda > 0, '404 sondası hiç istek atmadı');
    assert.ok(b.has(tekno), `bulunanlar: ${[...b.keys()].join(', ')}`);
    assert.match(b.get(tekno).kanit.join(' '), /404 sayfası/);
  });
}

test('K46 (koruma) 404 gövdesinde genel "Rails" kelimesi → Ruby on Rails YOK', async () => {
  const { b } = await vaka({ kod: 404, govde: '<h1>Sayfa yok</h1><p>Bu site Ruby on Rails hakkında yazılar yayınlar. Rails Rails.</p>' });
  assert.equal(b.has('Ruby on Rails'), false);
});
test('K46 (koruma) her yola 200 dönen sunucu → 404 kaynaklı bulgu YOK', async () => {
  const { b } = await vaka({ kod: 200, cerezler: ['JSESSIONID=1; Path=/'], govde: '<p>başka içerik</p>' });
  assert.equal(b.has('Java'), false);
});
test('K46 (koruma) 403 yanıtı → 404 kaynaklı bulgu YOK', async () => {
  const { b } = await vaka({ kod: 403, govde: 'Forbidden', cerezler: ['JSESSIONID=1; Path=/'] });
  assert.equal(b.has('Java'), false);
});
test('K46 (koruma) sonda başka sunucuya yönlendirilir → bulgu YOK', async () => {
  const hedef = await sunucuAc({}, { kod: 404, govde: 'Not Found', cerezler: ['JSESSIONID=1; Path=/'] });
  try {
    const { b } = await vaka((yol) => ({ kod: 302, basliklar: { location: `${hedef.taban}${yol}` } }));
    assert.equal(b.has('Java'), false);
  } finally { hedef.kapat(); }
});
test('K46 (koruma) 404 başlıkları güvenlik / çerez / HSTS satırlarına girmez', async () => {
  const { r, b } = await vaka({ kod: 404, govde: 'Not Found', basliklar: { 'strict-transport-security': 'max-age=63072000; includeSubDomains; preload', 'x-frame-options': 'DENY' }, cerezler: ['JSESSIONID=1; Path=/'] });
  assert.ok(b.has('Java'), '404 verisi kullanılmadı — vaka boşa ölçüyor');
  const g = Object.fromEntries((r.guvenlik ?? []).map(([k, , v]) => [k, v]));
  assert.equal(g['strict-transport-security'], false);
  assert.equal(g['x-frame-options'], false);
  assert.match(r.guvenlikEk.hstsOnyukleme.deger, /HSTS başlığı yok/);
  assert.doesNotMatch(r.guvenlikEk.cerezler.deger, /\d+ çerez/);
});
test('K46 (koruma) çerez değeri çıktıya sızmaz', async () => {
  const { ham, b } = await vaka({ kod: 404, govde: 'Not Found', cerezler: ['connect.sid=s%3AGIZLIDEGER123.imza; Path=/'] });
  assert.ok(b.has('Express'));
  assert.equal(ham.split('GIZLIDEGER123').length - 1, 0);
});
test('K46 (koruma) --404-yok ve TECHLOOKUP_404=0 → sunucuya sonda isteği 0', async () => {
  const d = { kod: 404, govde: 'Not Found', cerezler: ['JSESSIONID=1; Path=/'] };
  const bayrak = await vaka(d, ['--404-yok']);
  assert.equal(bayrak.sonda, 0);
  assert.equal(bayrak.b.has('Java'), false);
  const ortam = await vaka(d, [], { TECHLOOKUP_404: '0' });
  assert.equal(ortam.sonda, 0);
});
test('K46 (koruma, birim) 5 MB gövde → okunan ≤ 200 KB', async () => {
  let mod;
  try { mod = await import('../scripts/hata-sayfasi.mjs'); } catch { assert.fail('modül yok: scripts/hata-sayfasi.mjs'); }
  const s = await sunucuAc({}, { kod: 404, govde: 'a'.repeat(5 * 1024 * 1024) });
  try {
    const sonuc = await mod.hataSayfasiTara(s.taban, { anaHtml: 'farklı' });
    assert.ok(sonuc.yanitlar.length > 0, 'yanıt yok');
    for (const y of sonuc.yanitlar) assert.ok(y.govde.length <= 200 * 1024, `gövde ${y.govde.length}`);
  } finally { s.kapat(); }
});

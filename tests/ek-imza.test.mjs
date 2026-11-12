// K45 — bizim ek imzalarımız (scripts/ek-imzalar.mjs) Wappalyzer verisinin üstüne birleşiyor mu?
// Her imza ölçülmüş bir kanıttan gelir (2026-11-12): bau/beykoz Laravel şifreli çerezi, martas x-aspnetmvc-version +
// PleskWin, nuxt.com x-powered-by, mastodon.social / dev.to x-runtime.  `node --test tests/ek-imza.test.mjs`
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sunucuAc, tara, bulunan } from './yardimci-sunucu.mjs';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const LARAVEL = ['XSRF-TOKEN=eyJpdiI6IkFBQUEiLCJ2YWx1ZSI6IkJCQiJ9; path=/; samesite=lax', 'bau_session=eyJpdiI6IkNDQyIsInZhbHVlIjoiREREIn0%3D; path=/; httponly'];
const VAKALAR = [
  // [tür, rota, yanıt, ad, beklenen, sürüm?]
  ['kanıt', '/laravel', { cerezler: LARAVEL }, 'Laravel', true],
  ['kanıt', '/laravel', { cerezler: LARAVEL }, 'PHP', true],
  ['kanıt', '/mvc', { basliklar: { 'x-aspnetmvc-version': '5.2' } }, 'Microsoft ASP.NET', true, '5.2'],
  ['kanıt', '/plesk', { basliklar: { 'x-powered-by-plesk': 'PleskWin' } }, 'Windows Server', true],
  ['kanıt', '/nuxt', { basliklar: { 'x-powered-by': 'Nuxt' } }, 'Nuxt.js', true],
  ['kanıt', '/runtime', { basliklar: { 'x-runtime': '0.074615' } }, 'Ruby', true],
  ['kanıt', '/mastodon', { basliklar: { server: 'Mastodon' } }, 'Ruby on Rails', true],
  ['koruma', '/duz-xsrf', { cerezler: ['XSRF-TOKEN=abc123; path=/'] }, 'Laravel', false],
  ['koruma', '/laravel-eski', { cerezler: ['laravel_session=abc; path=/'] }, 'Laravel', true],
  ['koruma', '/runtime-metin', { basliklar: { 'x-runtime': 'yok' } }, 'Ruby', false],
  ['koruma', '/mvc-kirli', { basliklar: { 'x-aspnetmvc-version': '5.2<b>x' } }, 'Microsoft ASP.NET', true, '5.2'],
];

let s;
before(async () => { s = await sunucuAc(Object.fromEntries(VAKALAR.map(([, rota, y]) => [rota, y]))); });
after(() => s.kapat());

for (const [tur, rota, , ad, beklenen, surum] of VAKALAR) {
  test(`K45 (${tur}) ${rota} → ${ad} ${beklenen ? 'VAR' : 'YOK'}${surum ? ` sürüm ${surum}` : ''}`, async () => {
    const { r } = await tara(`${s.taban}${rota}`);
    const b = bulunan(r);
    assert.equal(b.has(ad), beklenen, `bulunanlar: ${[...b.keys()].join(', ')}`);
    if (surum) assert.equal(b.get(ad).surum, surum);
  });
}

test('K45 (koruma) ek imzadaki her ad veride var, her desen derlenir', async () => {
  let ek;
  try { ek = (await import('../scripts/ek-imzalar.mjs')).default; } catch { assert.fail('modül yok: scripts/ek-imzalar.mjs'); }
  const veri = JSON.parse(readFileSync(join(kok, 'veri', 'teknolojiler.json'), 'utf8'));
  const eksik = Object.keys(ek).filter((ad) => !veri[ad]);
  assert.deepEqual(eksik, [], 'veride olmayan ad');
  const desenler = [];
  for (const t of Object.values(ek)) {
    for (const alan of ['headers', 'cookies', 'meta']) for (const [k, v] of Object.entries(t[alan] ?? {})) desenler.push(k, v);
    for (const alan of ['html', 'hataHtml', 'scriptSrc', 'url']) for (const v of [].concat(t[alan] ?? [])) desenler.push(v);
  }
  for (const d of desenler) assert.doesNotThrow(() => new RegExp(String(d).split('\\;')[0], 'i'), `derlenmeyen desen: ${d}`);
});

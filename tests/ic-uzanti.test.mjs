// K47 — sayfadaki iç bağlantı uzantıları dili gösteriyor mu? (php.net: 197 iç .php bağlantısı, 2026-11-12 —
// webappanalyzer .php desenini yalnız sayfanın KENDİ adresinde arıyor.)  `node --test tests/ic-uzanti.test.mjs`
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sunucuAc, tara, bulunan } from './yardimci-sunucu.mjs';

const sayfa = (linkler) => `<!doctype html><html><head><title>U</title></head><body>${linkler.map((l) => `<a href="${l}">x</a>`).join('')}</body></html>`;
const UZANTI = [
  ['php', 'PHP'], ['aspx', 'Microsoft ASP.NET'], ['asp', 'Microsoft ASP.NET'], ['ashx', 'Microsoft ASP.NET'], ['axd', 'Microsoft ASP.NET'],
  ['jsp', 'Java'], ['jspx', 'Java'], ['do', 'Java'], ['action', 'Java'], ['cfm', 'Adobe ColdFusion'], ['cfc', 'Adobe ColdFusion'],
];
const VAKALAR = [
  ...UZANTI.map(([u, ad]) => ['kanıt', `/${u}`, [`/bir.${u}`, `/alt/iki.${u}?id=3`], ad, true]),
  ['koruma', '/dis', Array.from({ length: 5 }, (_, i) => `https://baska-site.example/s${i}.php`), 'PHP', false],
  ['koruma', '/tek', ['/yalniz.php'], 'PHP', false],
];

let s;
before(async () => { s = await sunucuAc(Object.fromEntries(VAKALAR.map(([, rota, l]) => [rota, { govde: sayfa(l) }]))); });
after(() => s.kapat());

for (const [tur, rota, , ad, beklenen] of VAKALAR) {
  test(`K47 (${tur}) ${rota} → ${ad} ${beklenen ? 'VAR' : 'YOK'}`, async () => {
    const { r } = await tara(`${s.taban}${rota}`);
    const b = bulunan(r);
    assert.equal(b.has(ad), beklenen, `bulunanlar: ${[...b.keys()].join(', ')}`);
    if (beklenen) assert.match(b.get(ad).kanit.join(' '), /iç bağlantı/);
  });
}

// K44 — webappanalyzer verisinde çerez ADI desen olarak yazılmış imzalar ("ASP\.NET_SessionId", "SESS[a-f0-9]{32}")
// eşleşiyor mu? Önce: ad harfi harfine aranıyordu, 13 imza hiçbir sitede çalışmıyordu (martas.com.tr, 2026-11-12).
// `node --test tests/cerez-desen.test.mjs`
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sunucuAc, tara, bulunan } from './yardimci-sunucu.mjs';

const VAKALAR = [
  // [tür, rota, Set-Cookie, ad, beklenen]
  ['kanıt', '/asp', 'ASP.NET_SessionId=ipmhxwfcap0q0x; path=/; HttpOnly', 'Microsoft ASP.NET', true],
  ['kanıt', '/aspxauth', '.ASPXAUTH=ABC123; path=/; HttpOnly', 'Microsoft ASP.NET', true],
  ['kanıt', '/express', 'connect.sid=s%3Aabc.def; Path=/; HttpOnly', 'Express', true],
  ['kanıt', '/drupal', `SESS${'a1'.repeat(16)}=x; path=/`, 'Drupal', true],
  ['koruma', '/benzer', 'xasp.net_sessionid=1; path=/', 'Microsoft ASP.NET', false],
  ['koruma', '/mybb', 'mybb[lastvisit]=1700000000; path=/', 'MyBB', true],
];

let s;
before(async () => {
  s = await sunucuAc(Object.fromEntries(VAKALAR.map(([, rota, cerez]) => [rota, { cerezler: [cerez] }])));
});
after(() => s.kapat());

for (const [tur, rota, cerez, ad, beklenen] of VAKALAR) {
  test(`K44 (${tur}) ${cerez.split('=')[0]} → ${ad} ${beklenen ? 'VAR' : 'YOK'}`, async () => {
    const { r } = await tara(`${s.taban}${rota}`);
    const b = bulunan(r);
    assert.equal(b.has(ad), beklenen, `bulunanlar: ${[...b.keys()].join(', ')}`);
    if (beklenen) assert.match(b.get(ad).kanit.join(' '), /çerez/);
  });
}

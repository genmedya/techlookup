// K41 Cloudflare bulutu (turuncu / gri) — `node --test tests/cloudflare.test.mjs`
// Ölçüldü 2026-11-11: www.acibadem.com.tr → CNAME …cdn.cloudflare.net → 104.20.20.188 / 172.66.171.132, NS Vodafone
// (turuncu, kısmi kurulum); acibadem.com.tr → 31.145.21.10 (Cloudflare değil). 1.1.1.1 bir kez geçici NXDOMAIN verdi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudflareBulut, cloudflareIpMi } from '../scripts/dns.mjs';

const cevap = (durum, ...satirlar) => `;; ->>HEADER<<- opcode: QUERY, status: ${durum}, id: 1\n\n;; ANSWER SECTION:\n${satirlar.join('\n')}\n`;
const kayit = (ad, tur, deger) => `${ad}.\t300\tIN\t${tur}\t${deger}`;
const NS_CF = cevap('NOERROR', kayit('ornek.test', 'NS', 'luke.ns.cloudflare.com.'), kayit('ornek.test', 'NS', 'may.ns.cloudflare.com.'));
const NS_DIS = cevap('NOERROR', kayit('ornek.test', 'NS', 'dnx1.vodafone.net.tr.'));
const YOK = cevap('NXDOMAIN');
const BOS = cevap('NOERROR');

// sahte dig: tablodaki ham çıktı; 'ZAMAN' zaman aşımı; tabloda yoksa boş NOERROR
function sahte(tablo, cagrilar = []) {
  return async (tur, ad) => {
    cagrilar.push(`${tur} ${ad}`);
    const ham = tablo[`${tur} ${ad}`];
    if (ham === 'ZAMAN') return { zamanAsimi: true, stdout: '' };
    return { stdout: ham ?? BOS };
  };
}
const lookupYok = async () => { throw Object.assign(new Error('bulunamadı'), { code: 'ENOTFOUND' }); };
const lookupIp = (ip) => async () => ({ address: ip, family: ip.includes(':') ? 6 : 4 });
const sinif = (r) => Object.fromEntries((r.hostlar ?? []).map((h) => [h.host, h.sinif]));
const sor = (hostlar, tablo, { lookup = lookupYok, cagrilar } = {}) =>
  cloudflareBulut({ kok: 'ornek.test', hostlar }, { calistir: sahte(tablo, cagrilar), yedek: 'yok', lookup });

test('K41 aralık — ölçülmüş tanıklar ve IPv6 ağ maskesiyle eşleşir', () => {
  assert.equal(cloudflareIpMi('104.20.20.188'), true);
  assert.equal(cloudflareIpMi('172.66.171.132'), true);
  assert.equal(cloudflareIpMi('31.145.21.10'), false);
  assert.equal(cloudflareIpMi('2606:4700::1'), true);
  assert.equal(cloudflareIpMi('2001:db8::1'), false);
  assert.equal(cloudflareIpMi('saçma'), false);
  assert.equal(cloudflareIpMi(null), false);
});

test('K41 turuncu — NS Cloudflare, IP Cloudflare', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': NS_CF, 'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '104.20.20.188')) });
  assert.equal(r.durum, 'var');
  assert.equal(r.deger, '🟠 turuncu');
  assert.deepEqual(sinif(r), { 'ornek.test': 'turuncu' });
  assert.match(r.kanit, /104\.20\.20\.188/);
  assert.match(r.kanit, /cloudflare\.com/);
});

test('K41 gri — NS Cloudflare, IP Cloudflare değil', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': NS_CF, 'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '31.145.21.10')) });
  assert.equal(r.durum, 'var');
  assert.match(r.deger, /^⚪ gri/);
  assert.deepEqual(sinif(r), { 'ornek.test': 'gri' });
});

test('K41 DNS başka firmada — kısmi kurulum CNAME kanıtta', async () => {
  const r = await sor(['www.ornek.test'], {
    'NS ornek.test': NS_DIS,
    'CNAME www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'CNAME', 'www.ornek.test.cdn.cloudflare.net.')),
    'A www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'CNAME', 'www.ornek.test.cdn.cloudflare.net.'), kayit('www.ornek.test.cdn.cloudflare.net', 'A', '172.66.171.132')),
  });
  assert.equal(r.durum, 'var');
  assert.equal(r.deger, '🟠 turuncu · DNS başka firmada');
  assert.deepEqual(sinif(r), { 'www.ornek.test': 'dis' });
  assert.match(r.kanit, /cdn\.cloudflare\.net/);
  assert.match(r.kanit, /vodafone/);
});

test('K41 yok — NS başka, IP Cloudflare değil', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': NS_DIS, 'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '31.145.21.10')) });
  assert.equal(r.durum, 'yok');
  assert.equal(r.deger, "➖ Cloudflare'den geçmiyor");
  assert.deepEqual(sinif(r), { 'ornek.test': 'yok' });
});

test('K41 iki host — yönlendiren ad ve sayfa ayrı ayrı yazılır (acibadem deseni)', async () => {
  const r = await sor(['ornek.test', 'www.ornek.test'], {
    'NS ornek.test': NS_DIS,
    'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '31.145.21.10')),
    'CNAME www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'CNAME', 'www.ornek.test.cdn.cloudflare.net.')),
    'A www.ornek.test': cevap('NOERROR', kayit('www.ornek.test.cdn.cloudflare.net', 'A', '104.20.20.188')),
  });
  assert.equal(r.durum, 'var');
  // hücre: sayfa önce, yönlendiren ad simgeyle; ad ad sonuç hostlar'da (raporda tablonun altında)
  assert.equal(r.deger, '🟠 turuncu · DNS başka firmada · yönlendiren ad: ➖');
  assert.deepEqual(r.hostlar.map((h) => [h.host, h.sinif]), [['www.ornek.test', 'dis'], ['ornek.test', 'yok']]);
  assert.match(r.kanit, /IP 104\.20\.20\.188/, 'kanıt sayfanın hostundan değil');
});

test('K41 IPv6 — A boş, AAAA Cloudflare → turuncu', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': NS_CF, 'AAAA ornek.test': cevap('NOERROR', kayit('ornek.test', 'AAAA', '2606:4700::1')) });
  assert.equal(r.deger, '🟠 turuncu');
});

test('K41 K34b — dig NXDOMAIN, sistem çözümleyicisi Cloudflare IP verir → turuncu', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': NS_CF, 'A ornek.test': YOK, 'AAAA ornek.test': YOK }, { lookup: lookupIp('104.20.20.188') });
  assert.equal(r.deger, '🟠 turuncu');
  assert.match(r.kanit, /sistem çözümleyicisi/);
});

test('K41 IP yok — dig NXDOMAIN ve sistem çözümleyicisi boş → ölçülemedi (➖ DEĞİL)', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': NS_DIS, 'A ornek.test': YOK, 'AAAA ornek.test': YOK });
  assert.equal(r.durum, 'olcmedi');
  assert.match(r.deger, /ölçülemedi/);
  assert.doesNotMatch(r.deger, /➖/);
});

test('K41 NS ölçülemedi + Cloudflare dışı IP → ölçülemedi (gri ile "yok" ayrılamaz)', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': 'ZAMAN', 'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '31.145.21.10')) });
  assert.equal(r.durum, 'olcmedi');
  assert.doesNotMatch(r.deger, /➖|gri/);
});

test('K41 NS ölçülemedi ama IP Cloudflare → yine turuncu (IP kesin kanıt)', async () => {
  const r = await sor(['ornek.test'], { 'NS ornek.test': 'ZAMAN', 'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '104.20.20.188')) });
  assert.equal(r.durum, 'var');
  assert.match(r.deger, /🟠 turuncu/);
});

test('K41 yerel / geçersiz son adres — dig çağrılmaz, ölçülemedi', async () => {
  const cagrilar = [];
  const r = await sor(['ornek.test', '127.0.0.1', 'a b'], {
    'NS ornek.test': NS_CF, 'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '104.20.20.188')),
  }, { cagrilar });
  assert.ok(!cagrilar.some((c) => /127\.0\.0\.1|a b/.test(c)), `yerel/geçersiz ada dig gitti: ${cagrilar.join(', ')}`);
  assert.equal(sinif(r)['127.0.0.1'], 'olcmedi');
  assert.equal(sinif(r)['a b'], 'olcmedi');
  assert.equal(sinif(r)['ornek.test'], 'turuncu');
});

test('K41 kayıt metni süzülür — `|` ya da uzun CNAME kanıta ham girmez', async () => {
  const r = await sor(['www.ornek.test'], {
    'NS ornek.test': NS_DIS,
    'CNAME www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'CNAME', 'a|b.')),
    'A www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'A', '104.20.20.188')),
  });
  assert.doesNotMatch(r.kanit, /\|/);
  assert.match(r.kanit, /geçersiz kayıt/);
  const uzun = await sor(['www.ornek.test'], {
    'NS ornek.test': NS_DIS,
    'CNAME www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'CNAME', `${'x'.repeat(50)}.${'y'.repeat(50)}.cdn.cloudflare.net.`)),
    'A www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'A', '104.20.20.188')),
  });
  assert.ok(uzun.kanit.length <= 120, `kanıt ${uzun.kanit.length} karakter`);
});

test('K41 iki host aynı sonuç — hücre tekrar etmez (mediaclick deseni)', async () => {
  const r = await sor(['ornek.test', 'www.ornek.test'], {
    'NS ornek.test': NS_CF,
    'A ornek.test': cevap('NOERROR', kayit('ornek.test', 'A', '104.21.12.89')),
    'A www.ornek.test': cevap('NOERROR', kayit('www.ornek.test', 'A', '172.67.131.247')),
  });
  assert.equal(r.deger, '🟠 turuncu');
  assert.equal(r.hostlar.length, 2, 'ad ad sonuç kayboldu');
});

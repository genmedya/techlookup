// K40 teknoloji tablosu genişliği — terminal (Claude Code) geniş tabloyu tablo olarak çizemiyor.
// Ölçüldü 2026-11-06, agt.com.tr: teknoloji tablosunun doğal genişliği 372 sütun, öteki altı tablo 106–201.
// Bütçe = öteki tabloların en genişi (201) → 200. Bilgi kaybı yok: liste ve sürüm metni raporda kalır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const BUTCE = 200;

// Görünür genişlik: emoji 2 sütun, birleştirici karakterler 0.
const gen = (s) => [...s].reduce((n, c) => n + (/\p{Extended_Pictographic}/u.test(c) ? 2 : /[\u{FE0F}\u{200D}]/u.test(c) ? 0 : 1), 0);

function tablolar(md) {
  const t = {};
  let baslik = '';
  for (const l of md.split('\n')) {
    if (l.startsWith('### ')) baslik = l;
    if (!l.startsWith('|') || /^\|:-:\|/.test(l)) continue;
    (t[baslik] ??= []).push(l.replace(/\\\|/g, '¦').split('|').slice(1, -1).map((x) => x.trim()));
  }
  return t;
}
const genislik = (satirlar) => {
  const n = Math.max(...satirlar.map((s) => s.length));
  return Array.from({ length: n }, (_, i) => Math.max(...satirlar.map((s) => gen(s[i] ?? '')))).reduce((a, x) => a + x + 3, 1);
};

const ALANLAR = ['doubleclick.net', 'facebook.com', 'facebook.net', 'google.com', 'google.com.tr', 'googletagmanager.com', 'gstatic.com', 'jsdelivr.net', 'licdn.com', 'linkedin.com', 'ornek-uzak-alan.example'];
const tekno = (ad, surum, bilgi, kanit) => ({ ad, kategoriler: [], surum, surumBilgi: bilgi, kanit, guven: 100 });
const r = {
  host: 'ornek.test', adres: 'https://ornek.test/', sonAdres: 'https://ornek.test/', notlar: [],
  durum: { statik: 'tamam', tarayici: 'tamam', dns: 'tamam', ssl: 'tamam' },
  kimlik: {},
  grupSirasi: ['Frontend', 'Analytics', 'Reklam pikselleri', 'E-posta altyapısı', 'Doğrulama kayıtları', 'Diğer'],
  olculemeyenGruplar: { 'E-posta altyapısı': 'DNS sorgusu cevap vermedi' },
  gruplar: {
    Frontend: [
      tekno('jQuery', '3.7.0', { durum: 'tamam', yil: '2023', guncel: '4.0.0', guncelYil: '2026' }, ['script: jquery', 'js $.fn.jquery: 3.7.0']),
      tekno('core-js', '3.32.2', { durum: 'tamam', yil: '2023', guncel: '3.51.0', guncelYil: '2026' }, ['js __core-js_shared__: · js __core-js_shared__.versions.0.version: 3.32.2']),
      tekno('FancyBox', '3.5.7', { durum: 'kaynakta yok' }, ['js $.fancybox.version: 3.5.7', 'js jQuery.fancybox.version: 3.5.7']),
    ],
    Analytics: [tekno('Linkedin Insight Tag', null, null, ['script: snap.licdn.com/li.lms-analytics/insight.min.js', 'js _linkedin_data_partner_id: 5404556'])],
    'Reklam pikselleri': [tekno('Facebook Pixel', '2.9.437', { durum: 'kaynakta yok' }, ['script: connect.facebook.net/signals/config/1225288828208941?v=2.9.437&r=stable', 'script: connect.facebook.net/en_US/fbevents.js'])],
    // dns.mjs kanıtı `${alan}: ${k.slice(0, 80)}` — gerçek üst sınır 85 karakter
    'Doğrulama kayıtları': [tekno('Google Search Console', null, null, [`TXT: google-site-verification=${'Ab3'.repeat(17)}x`])],
    Diğer: [{ ad: `Dış alan adları (${ALANLAR.length}): ${ALANLAR.join(', ')}`, kategoriler: [], surum: null, liste: ALANLAR, kanit: ['sayfa kodu + tarayıcı istekleri'] }],
  },
};

test('K40 teknoloji tablosu terminal genişliğini aşmaz, bilgi kaybolmaz', async () => {
  const { markdownYaz } = await import(join(kok, 'scripts', 'techlookup.mjs'));
  const md = markdownYaz(r);
  const t = tablolar(md);
  const tek = t['### 🧩 Teknolojiler'];
  assert.ok(tek?.length > 1, 'teknoloji tablosu yok');
  const w = genislik(tek);
  assert.ok(w <= BUTCE, `teknoloji tablosu ${w} sütun (bütçe ${BUTCE})`);
  // her satır başlıkla aynı sütun sayısında (bozuk satır tabloyu düz metne çevirir)
  for (const s of tek) assert.equal(s.length, tek[0].length, `sütun sayısı tutmuyor: ${s.join(' | ')}`);
  // bilgi kaybı yok: her dış alan adı, sürüm ve güncel sürüm raporda
  for (const a of ALANLAR) assert.ok(md.includes(a), `dış alan adı kayıp: ${a}`);
  for (const v of ['3.7.0 (2023)', '4.0.0 (2026)', '3.32.2 (2023)', '3.51.0 (2026)', 'kaynakta yok', 'DNS sorgusu cevap vermedi']) assert.ok(md.includes(v), `kayıp: ${v}`);
});

// K41-genislik: yeni Cloudflare satırı iki host taşır (yönlendiren ad + sayfa); DNS tablosu da bütçeyi aşmamalı.
test('K41-genislik DNS ve sunucu tablosu iki hostlu Cloudflare satırıyla bütçeyi aşmaz', async () => {
  const { markdownYaz } = await import(join(kok, 'scripts', 'techlookup.mjs'));
  const { cloudflareBulut } = await import(join(kok, 'scripts', 'dns.mjs'));
  const ad = 'ornek-saglik-hastaneleri.com.tr';
  const cevap = (...s) => `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 1\n\n;; ANSWER SECTION:\n${s.join('\n')}\n`;
  const t = {
    [`NS ${ad}`]: cevap(`${ad}.\t300\tIN\tNS\tdnsa1.vodafone-kurumsal-dns.net.tr.`),
    [`A ${ad}`]: cevap(`${ad}.\t300\tIN\tA\t31.145.21.10`),
    [`CNAME www.${ad}`]: cevap(`www.${ad}.\t300\tIN\tCNAME\twww.${ad}.cdn.cloudflare.net.`),
    [`A www.${ad}`]: cevap(`www.${ad}.cdn.cloudflare.net.\t300\tIN\tA\t104.20.20.188`),
  };
  const cloudflare = await cloudflareBulut({ kok: ad, hostlar: [ad, `www.${ad}`] }, {
    calistir: async (tur, a) => ({ stdout: t[`${tur} ${a}`] ?? cevap() }), yedek: 'yok', lookup: async () => { throw new Error('yok'); },
  });
  const s = (durum, deger, kanit = '') => ({ durum, deger, kanit });
  const md = markdownYaz({
    ...r,
    dnsSunucu: {
      dnssec: s('yok', 'kapalı (DS kaydı yok)', 'DNS: NOERROR'),
      caa: s('yok', 'kayıt yok (her sertifika firması verebilir)', 'DNS: NOERROR · 1.1.1.1 üzerinden (yerel çözümleyici cevap vermedi)'),
      soa: s('var', 'birincil: dnx1.vodafone.net.tr · yönetici adresi tanımlı', 'SOA'),
      cloudflare,
      https: s('olcmedi', 'ölçülemedi — DNS SERVFAIL'),
      ulke: s('var', 'Türkiye (TR)', `RIPEstat (MaxMind GeoLite) · ${ad} · IP 31.145.21.10`),
      yesil: s('yok', 'kayıtta yeşil enerji beyanı yok', 'Green Web Foundation'),
    },
  });
  const dns = tablolar(md)['### 🌐 DNS ve sunucu'];
  assert.ok(dns?.some((x) => x[1]?.startsWith('Cloudflare bulutu')), 'Cloudflare satırı yok');
  const w = genislik(dns);
  assert.ok(w <= BUTCE, `DNS tablosu ${w} sütun (bütçe ${BUTCE})`);
  for (const x of dns) assert.equal(x.length, dns[0].length, `sütun sayısı tutmuyor: ${x.join(' | ')}`);
  // bilgi kaybı yok: iki ad da durumu ve IP'siyle tablonun altında
  assert.ok(md.includes(`www.${ad}: 🟠 turuncu · DNS başka firmada (IP 104.20.20.188`), 'sayfa adı alt listede yok');
  assert.ok(md.includes(`· ${ad}: ➖ Cloudflare'den geçmiyor (IP 31.145.21.10`), 'yönlendiren ad alt listede yok');
});

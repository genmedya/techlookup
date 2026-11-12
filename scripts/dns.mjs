// DNS kayıtlarından e-posta altyapısı, doğrulama kayıtları ve DNS/barındırma sağlayıcısı çıkarır.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { satir, sinirliGetir, jsonCoz, sureSiniri, sureMetni } from './ortak.mjs';

const koş = promisify(execFile);

const MX = [
  [/aspmx\.l\.google\.com|googlemail\.com|smtp\.google\.com/i, 'Google Workspace'],
  [/mail\.protection\.outlook\.com|outlook\.com/i, 'Microsoft 365'],
  [/mx\.yandex\.net|yandex\.ru/i, 'Yandex 360'],
  [/zoho\.(com|eu|in)/i, 'Zoho Mail'],
  [/icloud\.com/i, 'iCloud Mail'],
  [/mimecast\.com/i, 'Mimecast'],
  [/pphosted\.com/i, 'Proofpoint'],
  [/barracudanetworks\.com/i, 'Barracuda'],
  [/protonmail\.ch/i, 'Proton Mail'],
  [/secureserver\.net/i, 'GoDaddy Mail'],
  [/mailgun\.org/i, 'Mailgun'],
  [/yaani\.com|turkcell/i, 'Yaani Mail'],
  [/natrohost\.com|natro\.com/i, 'Natro Mail'],
  [/turhost\.com/i, 'Turhost Mail'],
];

// SPF include → toplu/işlem e-postası aracı
const SPF = [
  [/_spf\.google\.com/i, 'Google Workspace'],
  [/spf\.protection\.outlook\.com/i, 'Microsoft 365'],
  [/servers\.mcsv\.net|mailchimp/i, 'Mailchimp'],
  [/mandrillapp\.com/i, 'Mandrill (Mailchimp)'],
  [/sendgrid\.net/i, 'SendGrid'],
  [/amazonses\.com/i, 'Amazon SES'],
  [/mailgun\.org/i, 'Mailgun'],
  [/sendinblue\.com|brevo\.com/i, 'Brevo'],
  [/hubspotemail\.net|hubspot/i, 'HubSpot'],
  [/salesforce\.com|exacttarget\.com/i, 'Salesforce'],
  [/zendesk\.com/i, 'Zendesk'],
  [/freshdesk\.com/i, 'Freshdesk'],
  [/mailjet\.com/i, 'Mailjet'],
  [/sparkpostmail\.com/i, 'SparkPost'],
  [/postmarkapp\.com|mtasv\.net/i, 'Postmark'],
  [/zoho\.(com|eu)/i, 'Zoho'],
  [/_spf\.yandex\.net/i, 'Yandex 360'],
  [/euromsg|relateddigital/i, 'Euromsg (Related Digital)'],
  [/klaviyo/i, 'Klaviyo'],
  [/resend\.com|_spf\.resend/i, 'Resend'],
  [/helpscoutemail\.com/i, 'Help Scout'],
  [/intercom\.io/i, 'Intercom'],
  [/freshemail\.io|freshworks/i, 'Freshworks'],
  [/mailerlite\.com/i, 'MailerLite'],
  [/activecampaign|emsd1\.com/i, 'ActiveCampaign'],
  [/iletimerkezi|iletim/i, 'İleti Merkezi'],
];

// TXT doğrulama kayıtları → hangi servise bağlı
const DOGRULAMA = [
  [/^google-site-verification=/i, 'Google Search Console'],
  [/^facebook-domain-verification=/i, 'Facebook'],
  [/^MS=ms\d+/i, 'Microsoft 365'],
  [/^atlassian-domain-verification=/i, 'Atlassian'],
  [/^apple-domain-verification=/i, 'Apple'],
  [/^yandex-verification:/i, 'Yandex Webmaster'],
  [/^adobe-idp-site-verification=/i, 'Adobe'],
  [/^docusign=/i, 'DocuSign'],
  [/^zoom-domain-verification=/i, 'Zoom'],
  [/^stripe-verification=/i, 'Stripe'],
  [/^hubspot-developer-verification=|^hubspot-domain-verification/i, 'HubSpot'],
  [/^globalsign-domain-verification=/i, 'GlobalSign'],
  [/^_?github-(pages-)?challenge/i, 'GitHub'],
  [/^slack-domain-verification=/i, 'Slack'],
  [/^dropbox-domain-verification=/i, 'Dropbox'],
  [/^openai-domain-verification=/i, 'OpenAI'],
  [/^canva-site-verification=/i, 'Canva'],
  [/^miro-verification=/i, 'Miro'],
  [/^pinterest-site-verification=|^p:/i, 'Pinterest'],
  [/^ahrefs-site-verification_/i, 'Ahrefs'],
  [/^cisco-ci-domain-verification=/i, 'Cisco Webex'],
  [/^onetrust-domain-verification=/i, 'OneTrust'],
  [/^teamviewer-sso-verification=/i, 'TeamViewer'],
  [/^brevo-code:/i, 'Brevo'],
  [/^klaviyo-site-verification=/i, 'Klaviyo'],
];

const NS = [
  [/cloudflare\.com/i, 'Cloudflare'],
  [/awsdns/i, 'Amazon Route 53'],
  [/azure-dns/i, 'Azure DNS'],
  [/googledomains\.com|google\.com/i, 'Google Cloud DNS'],
  [/domaincontrol\.com/i, 'GoDaddy'],
  [/natrohost\.com|natro\.com/i, 'Natro'],
  [/turhost\.com/i, 'Turhost'],
  [/isimtescil\.net|isimtescil/i, 'İsimtescil'],
  [/radorehost|rdns\.com\.tr/i, 'Radore'],
  [/hostinger/i, 'Hostinger'],
  [/digitalocean\.com/i, 'DigitalOcean'],
  [/vercel-dns\.com/i, 'Vercel'],
  [/nsone\.net/i, 'NS1'],
  [/dnsmadeeasy/i, 'DNS Made Easy'],
  [/registrar-servers\.com/i, 'Namecheap'],
  [/hetzner/i, 'Hetzner'],
  [/ultradns/i, 'UltraDNS'],
  [/akam\.net/i, 'Akamai'],
  [/wixdns\.net/i, 'Wix'],
  [/squarespacedns/i, 'Squarespace'],
  [/shopify/i, 'Shopify'],
  [/ikas/i, 'ikas'],
  [/kurumsaldns|veridyen|guzel\.net\.tr/i, 'Güzel Hosting'],
];

function tablodan(tablo, kayitlar, alan, sonuc) {
  for (const k of kayitlar ?? []) {
    for (const [re, ad] of tablo) {
      if (re.test(k) && !sonuc.some((x) => x.ad === ad)) sonuc.push({ ad, kanit: `${alan}: ${k.slice(0, 80)}` });
    }
  }
}

export function dnsYorumla({ mx = [], txt = [], ns = [] }) {
  const eposta = [];
  const dogrulama = [];
  const barindirma = [];
  tablodan(MX, mx, 'MX', eposta);
  if (mx.length && !mx.some((k) => MX.some(([re]) => re.test(k)))) {
    const sunucu = mx[0].split(/\s+/).pop().replace(/\.$/, '');
    eposta.push({ ad: 'Tanınmayan / kendi sunucusu', kanit: `MX: ${sunucu}` });
  }
  const spf = txt.filter((t) => /^v=spf1/i.test(t));
  for (const s of spf) {
    const parcalar = s.split(/\s+/).filter((p) => /^(include|redirect|a|mx):|^redirect=/i.test(p));
    tablodan(SPF, parcalar, 'SPF', eposta);
  }
  tablodan(DOGRULAMA, txt.filter((t) => !/^v=spf1/i.test(t)), 'TXT', dogrulama);
  tablodan(NS, ns, 'NS', barindirma);
  return { eposta, dogrulama, barindirma };
}

// dig'e giden her ad: seçenek (-f, +tcp) ya da SPF makrosu (%{i}) taşıyamaz
export const guvenliAd = (ad) => typeof ad === 'string' && ad.length <= 253 && /^[a-z0-9_]([a-z0-9_.-]*)$/i.test(ad);

async function dig(tur, ad) {
  if (!guvenliAd(ad)) throw new Error(`geçersiz ad: ${String(ad).slice(0, 40)}`);
  const { stdout } = await koş('dig', ['+short', '+time=3', '+tries=1', tur, ad], { timeout: 10_000 });
  return stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith(';;'));
}

// TXT kaydı tırnaklı ve parçalı gelir: "v=spf1 ..." "...devamı"
export const txtBirlestir = (s) => s.replace(/"\s+"/g, '').replace(/^"|"$/g, '');

// alan adının kökü: www.ornek.com.tr → ornek.com.tr (basit kural; iki seviyeli TR uzantıları dahil)
export function kokAlan(host) {
  const p = host.replace(/^www\./i, '').split('.');
  const ikili = /^(com|net|org|gov|edu|bel|k12|av|dr|gen|web|biz|info|tv|co|ac)$/i;
  if (p.length > 2 && ikili.test(p[p.length - 2]) && p[p.length - 1].length === 2) return p.slice(-3).join('.');
  return p.slice(-2).join('.');
}

/** dig ile toplar. Hata → null (ölçülemedi). */
export async function dnsTopla(host) {
  const kok = kokAlan(host);
  try {
    const [mx, txtHam, ns, a, cname] = await Promise.all([
      dig('MX', kok), dig('TXT', kok), dig('NS', kok), dig('A', host), dig('CNAME', host),
    ]);
    const txt = txtHam.map(txtBirlestir);
    const ipler = a.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
    let asn = null;
    if (ipler[0]) {
      try {
        const ters = ipler[0].split('.').reverse().join('.');
        const [kayit] = await dig('TXT', `${ters}.origin.asn.cymru.com`);
        const no = kayit && txtBirlestir(kayit).split('|')[0].trim().split(' ')[0];
        if (no) {
          const [ad] = await dig('TXT', `AS${no}.asn.cymru.com`);
          asn = { no, ad: ad ? txtBirlestir(ad).split('|').pop().trim() : null, ip: ipler[0] };
        }
      } catch {
        asn = null;
      }
    }
    return { kok, mx, txt, ns, a: ipler, cname, asn };
  } catch {
    return null;
  }
}


// ---------- DNS güvenliği (DNSSEC · CAA · SOA · HTTPS kaydı) ----------
// Yerel çözümleyici bazı türlere (CAA, DS, TYPE65) hiç cevap vermeyebiliyor (ev modemi, ölçüldü 2026-10-17):
// zaman aşımında sorgu bir kez yedek çözümleyiciye gider ve kanıtta yazar. TECHLOOKUP_DNS_YEDEK=yok kapatır.
const YEDEK = /^[0-9a-f.:]+$/i.test(process.env.TECHLOOKUP_DNS_YEDEK ?? '') || process.env.TECHLOOKUP_DNS_YEDEK === 'yok'
  ? process.env.TECHLOOKUP_DNS_YEDEK : '1.1.1.1';

async function digAyrintili(tur, ad, { sunucu } = {}) {
  try {
    const arg = [...(sunucu ? [`@${sunucu}`] : []), '+noall', '+comments', '+answer', '+time=3', '+tries=2', '-t', tur, ad];
    const { stdout } = await koş('dig', arg, { timeout: 20_000 });
    return { stdout };
  } catch (e) {
    if (e.code === 'ENOENT') return { digYok: true };
    if (/timed out|no servers/i.test(e.stdout ?? '') || e.killed) return { zamanAsimi: true };
    return { hata: e.message };
  }
}

/** `+noall +comments +answer` çıktısı → durum (NOERROR · NXDOMAIN · SERVFAIL …) + istenen türdeki kayıtlar. */
export function digCoz(stdout, tur) {
  const durum = stdout.match(/status:\s*([A-Z]+)/)?.[1] ?? null;
  const turlar = tur === 'TYPE65' ? ['TYPE65', 'HTTPS'] : [tur];
  const kayitlar = [];
  const digerTurler = [];
  for (const s of stdout.split('\n')) {
    if (!s.trim() || s.startsWith(';')) continue;
    const p = s.trim().split(/\s+/);
    if (p.length < 5) continue;
    if (turlar.includes(p[3].toUpperCase())) kayitlar.push(p.slice(4).join(' '));
    else digerTurler.push(p[3].toUpperCase());
  }
  return { durum, kayitlar, digerTurler };
}

/** Tek DNS sorusu: ad süzülür, zaman aşımında yedek çözümleyici bir kez denenir. */
export async function digSor(tur, ad, { calistir = digAyrintili, yedek = YEDEK } = {}) {
  if (!guvenliAd(ad)) return { durum: 'geçersiz ad', kayitlar: [], digerTurler: [] };
  let r = await calistir(tur, ad);
  let kullanilan = null;
  if (r.zamanAsimi && yedek && yedek !== 'yok') {
    r = await calistir(tur, ad, { sunucu: yedek });
    kullanilan = yedek;
  }
  if (r.digYok) return { durum: 'dig yok', kayitlar: [], digerTurler: [] };
  if (r.zamanAsimi) return { durum: 'zaman aşımı', kayitlar: [], digerTurler: [] };
  if (r.hata) return { durum: 'hata', kayitlar: [], digerTurler: [] };
  return { ...digCoz(r.stdout, tur), yedek: kullanilan };
}

export const yedekNotu = (c) => (c.yedek ? ` · ${c.yedek} üzerinden (yerel çözümleyici cevap vermedi)` : '');

// NOERROR + kayıt → var · NOERROR-boş / NXDOMAIN → yok · SERVFAIL, zaman aşımı, dig yok → ölçülemedi
function dnsSatiri(c, varsa, yoksa) {
  if (c.durum === 'NOERROR' && c.kayitlar.length) return varsa(c.kayitlar, yedekNotu(c));
  if (c.durum === 'NOERROR' || c.durum === 'NXDOMAIN') return satir('yok', yoksa, `DNS: ${c.durum}${yedekNotu(c)}`);
  return satir('olcmedi', `ölçülemedi — DNS ${c.durum ?? 'cevabı çözülemedi'}`);
}

const tirnaksiz = (s) => s.replace(/^"|"$/g, '');

function caaSatiri(kayitlar, not) {
  const issue = [];
  let iodef = false;
  for (const k of kayitlar) {
    const [, etiket, ...deger] = k.split(/\s+/);
    const v = tirnaksiz(deger.join(' ')).split(';')[0].trim();
    if (/^issue(wild)?$/i.test(etiket) && !issue.includes(v || 'hiçbiri')) issue.push(v || 'hiçbiri');
    if (/^iodef$/i.test(etiket)) iodef = true;
  }
  // iodef çoğunlukla e-posta adresidir: yalnız varlığı yazılır
  return satir('var', `sertifika verebilir: ${issue.join(', ') || '—'}${iodef ? ' · olay bildirimi tanımlı' : ''}`, `CAA: ${kayitlar.length} kayıt${not}`, { issue });
}

function soaSatiri(kayitlar, not) {
  const [mname, rname] = kayitlar[0].split(/\s+/);
  const birincil = mname.replace(/\.$/, '');
  // yönetici alanı bir e-posta adresidir (hostmaster.ornek.com = hostmaster@ornek.com): yalnız varlığı yazılır
  return satir('var', `birincil: ${birincil}${rname ? ' · yönetici adresi tanımlı' : ''}`, `SOA${not}`, { birincil });
}

/** HTTPS kaydı (RFC 9460): okunur biçim (`alpn="h3,h2"`) ya da RFC 3597 ham biçim (`\# 61 0001…`). */
export function httpsKaydiCoz(rdata) {
  const ham = rdata.match(/^\\#\s+\d+\s+([0-9a-f\s]+)$/i);
  if (!ham) {
    const p = rdata.split(/\s+/);
    if (!/^\d+$/.test(p[0] ?? '')) return null;
    const alpn = rdata.match(/\balpn="?([^"\s]+)"?/)?.[1]?.split(',') ?? [];
    return { oncelik: Number(p[0]), hedef: p[1], alpn, ech: /\bech=/.test(rdata) };
  }
  const b = Buffer.from(ham[1].replace(/\s+/g, ''), 'hex');
  if (b.length < 3) return null;
  let i = 2;
  const etiketler = [];
  while (i < b.length && b[i] !== 0) { etiketler.push(b.subarray(i + 1, i + 1 + b[i]).toString()); i += b[i] + 1; }
  i++;
  const sonuc = { oncelik: b.readUInt16BE(0), hedef: etiketler.length ? `${etiketler.join('.')}.` : '.', alpn: [], ech: false };
  while (i + 4 <= b.length) {
    const anahtar = b.readUInt16BE(i);
    const uzunluk = b.readUInt16BE(i + 2);
    const deger = b.subarray(i + 4, i + 4 + uzunluk);
    if (anahtar === 1) for (let j = 0; j < deger.length; j += deger[j] + 1) sonuc.alpn.push(deger.subarray(j + 1, j + 1 + deger[j]).toString());
    if (anahtar === 5) sonuc.ech = true;
    i += 4 + uzunluk;
  }
  return sonuc;
}

function httpsSatiri(c) {
  // eski dig "HTTPS" türünü tanımayıp A kaydı döndürebilir: o cevap HTTPS kaydı sayılmaz
  if (c.durum === 'NOERROR' && !c.kayitlar.length && c.digerTurler.some((t) => t === 'A' || t === 'AAAA')) {
    return satir('olcmedi', 'ölçülemedi — dig HTTPS kaydı yerine adres döndürdü');
  }
  return dnsSatiri(c, (kayitlar, not) => {
    const k = kayitlar.map(httpsKaydiCoz).find(Boolean);
    if (!k) return satir('olcmedi', 'ölçülemedi — HTTPS kaydı çözülemedi', `HTTPS kaydı (TYPE65)${not}`);
    if (k.oncelik === 0) return satir('var', `takma ad: ${k.hedef}`, `HTTPS kaydı (TYPE65)${not}`, { alpn: [] });
    return satir('var', `${k.alpn.length ? `alpn: ${k.alpn.join(', ')}` : 'alpn yok'}${k.ech ? ' · ECH var' : ''}`, `HTTPS kaydı (TYPE65)${not}`, { alpn: k.alpn });
  }, 'kayıt yok');
}

/** DNSSEC (kökte DS) · CAA · SOA · HTTPS kaydı. */
export function dnsGuvenlik(kok, host, secenek = {}) {
  const { sure = 25_000 } = secenek;
  return sureSiniri(dnsGuvenlikIc(kok, host, secenek), sure, () => Object.fromEntries(['dnssec', 'caa', 'soa', 'https'].map((k) => [k, satir('olcmedi', sureMetni(sure))])));
}

async function dnsGuvenlikIc(kok, host, secenek) {
  const sor = (tur, ad) => digSor(tur, ad, secenek);
  const [ds, caa, soa, https] = await Promise.all([sor('DS', kok), sor('CAA', kok), sor('SOA', kok), sor('TYPE65', host)]);
  return {
    dnssec: dnsSatiri(ds, (k, not) => satir('var', 'açık (DS kaydı var)', `DS: ${k[0].split(/\s+/).slice(0, 3).join(' ')}${not}`), 'kapalı (DS kaydı yok)'),
    caa: dnsSatiri(caa, caaSatiri, 'kayıt yok (her sertifika firması verebilir)'),
    soa: dnsSatiri(soa, soaSatiri, 'kayıt yok'),
    https: httpsSatiri(https),
  };
}

// ---------- Cloudflare bulutu (turuncu / gri) ----------
// Turuncu: trafik Cloudflare'den geçer (IP Cloudflare aralığında). Gri: Cloudflare yalnız DNS'i tutar (NS Cloudflare,
// IP başka yerde). DNS başka firmadaysa (kısmi kurulum / Pages) gri bir kayıt "Cloudflare'den geçmiyor"dan ayrılamaz.
// kaynak: cloudflare.com/ips-v4 ve cloudflare.com/ips-v6 · 2026-11-11 — güncelleme adımı README "Veri kaynakları"nda.
export const CLOUDFLARE_LISTE_TARIHI = '2026-11-11';
export const CLOUDFLARE_ARALIKLARI = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];
const cfAg = new BlockList();
for (const a of CLOUDFLARE_ARALIKLARI) {
  const [ag, onek] = a.split('/');
  cfAg.addSubnet(ag, Number(onek), ag.includes(':') ? 'ipv6' : 'ipv4');
}

/** IP Cloudflare'in yayımladığı aralıklardan birinde mi (ağ maskesiyle; metin öneki değil). */
export function cloudflareIpMi(ip) {
  const tur = isIP(String(ip ?? ''));
  return tur ? cfAg.check(String(ip), tur === 6 ? 'ipv6' : 'ipv4') : false;
}

const CF_NS = /\.ns\.cloudflare\.com\.?$/i;
const YEREL_HOST = /^(localhost|127\.|\d+\.\d+\.\d+\.\d+$)/;
export const CF_ETIKET = {
  turuncu: '🟠 turuncu',
  dis: '🟠 turuncu · DNS başka firmada',
  gri: '⚪ gri (yalnız DNS)',
  yok: "➖ Cloudflare'den geçmiyor",
  olcmedi: '⚠️ ölçülemedi',
};
// tablo hücresinde ikinci ad yalnız simgeyle yazılır (iki uzun ad hücreye sığmaz, K41-genislik); tam liste tablonun altında
const CF_KISA = { turuncu: '🟠', dis: '🟠', gri: '⚪ gri', yok: '➖', olcmedi: '⚠️' };
const CF_CNAME = /\.cdn\.cloudflare\.net\.?$/i;
// DNS kaydı alan sahibinin yazdığı metindir: ad değilse basılmaz, uzunsa sondan kısaltılır (anlamlı kısım sondadır)
function kayitAdi(k) {
  const ad = String(k ?? '').trim().replace(/\.$/, '');
  if (!guvenliAd(ad)) return '(geçersiz kayıt)';
  return ad.length > 40 ? `…${ad.slice(-39)}` : ad;
}

/**
 * Her host için turuncu · DNS başka firmada · gri · geçmiyor · ölçülemedi.
 * hostlar: [yazılan ad, sayfanın son adresinin hostu]; rapor sayfanın hostunu önce yazar.
 */
export function cloudflareBulut({ hostlar }, secenek = {}) {
  const { sure = 25_000 } = secenek;
  return sureSiniri(cloudflareBulutIc(hostlar, secenek), sure, () => satir('olcmedi', sureMetni(sure)));
}

async function cloudflareBulutIc(hostlar, secenek) {
  const sor = (tur, ad) => digSor(tur, ad, secenek);
  const lookup = secenek.lookup ?? dnsLookup;
  const nsSozleri = new Map();
  const nsBak = (kok) => {
    if (!nsSozleri.has(kok)) {
      nsSozleri.set(kok, sor('NS', kok).then((c) => (c.durum === 'NOERROR' && c.kayitlar.length
        ? { cf: c.kayitlar.some((k) => CF_NS.test(k)), ilk: c.kayitlar[0] }
        : { cf: null, neden: `NS ${c.durum ?? 'ölçülemedi'}` })));
    }
    return nsSozleri.get(kok);
  };

  const hostBak = async (host) => {
    if (!guvenliAd(host) || YEREL_HOST.test(host)) return { host, sinif: 'olcmedi', neden: 'yönlendirme yerel/geçersiz adrese gidiyor' };
    const [a, aaaa, cname, ns] = await Promise.all([sor('A', host), sor('AAAA', host), sor('CNAME', host), nsBak(kokAlan(host))]);
    let ipler = [...a.kayitlar, ...aaaa.kayitlar].filter((x) => isIP(x));
    let ipKaynak = 'dig';
    // dig boş ya da NXDOMAIN dönebiliyor (ölçüldü: K34b, 2026-11-11 acibadem): sayfayı açan yol sistem çözümleyicisidir
    if (!ipler.length) {
      try {
        const l = await lookup(host, { all: true });
        ipler = (Array.isArray(l) ? l : [l]).map((x) => x?.address).filter((x) => isIP(x ?? ''));
        ipKaynak = 'sistem çözümleyicisi';
      } catch { ipler = []; }
    }
    const cnameAdi = cname.kayitlar[0] ? kayitAdi(cname.kayitlar[0]) : null;
    if (!ipler.length) return { host, sinif: 'olcmedi', neden: 'IP adresi alınamadı', cname: cnameAdi, ns };
    const cfIp = ipler.find(cloudflareIpMi);
    const ip = cfIp ?? ipler[0];
    let sinif;
    if (cfIp) sinif = ns.cf === false ? 'dis' : 'turuncu';
    else sinif = ns.cf === true ? 'gri' : ns.cf === false ? 'yok' : 'olcmedi';
    return { host, sinif, ip, cf: Boolean(cfIp), ipKaynak, cname: cnameAdi, ns, ...(sinif === 'olcmedi' ? { neden: `${ns.neden} — gri ile "geçmiyor" ayrılamaz` } : {}) };
  };

  const sonuclar = await Promise.all([...new Set(hostlar)].reverse().map(hostBak));
  const [sayfa, ...digerleri] = sonuclar;
  const ayni = digerleri.every((x) => x.sinif === sayfa.sinif);
  const deger = [CF_ETIKET[sayfa.sinif], ...(ayni ? [] : digerleri.map((x) => `yönlendiren ad: ${CF_KISA[x.sinif]}`))].join(' · ');
  const durum = sonuclar.some((x) => ['turuncu', 'dis', 'gri'].includes(x.sinif)) ? 'var'
    : sonuclar.some((x) => x.sinif === 'olcmedi') ? 'olcmedi' : 'yok';
  // kanıt: sayfanın hostu (ilk satır) — tam liste --json'da
  const s = sayfa;
  const kanit = [
    s.ip ? `IP ${s.ip}${s.ipKaynak === 'sistem çözümleyicisi' ? ' (sistem çözümleyicisi)' : ''}` : null,
    s.cname ? `CNAME ${CF_CNAME.test(s.cname) ? '…cdn.cloudflare.net' : s.cname}` : null,
    s.ns ? (s.ns.ilk ? `NS ${kokAlan(kayitAdi(s.ns.ilk).replace(/^…/, ''))}` : s.ns.neden) : null,
    s.neden && s.sinif === 'olcmedi' && !s.ip ? s.neden : null,
  ].filter(Boolean).join(' · ').slice(0, 80);
  return satir(durum, deger, kanit, {
    hostlar: sonuclar.map(({ host, sinif, ip, cname }) => ({ host, sinif, ip: ip ?? null, cname: cname ?? null })),
  });
}

// ---------- sunucu ülkesi · yeşil enerji ----------
const ulkeAdi = (kod) => { try { return new Intl.DisplayNames(['tr'], { type: 'region' }).of(kod); } catch { return kod; } };

/** RIPEstat (MaxMind GeoLite) ile IP'nin ülkesi; Green Web Foundation ile yeşil enerji kaydı. */
export function sunucuBilgisi(host, ip, { getir = sinirliGetir, sure = 20_000 } = {}) {
  return sureSiniri(sunucuBilgisiIc(host, ip, getir), sure, () => ({ ulke: satir('olcmedi', sureMetni(sure)), yesil: satir('olcmedi', sureMetni(sure)) }));
}

async function sunucuBilgisiIc(host, ip, getir) {
  const ipGecerli = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip ?? '');
  const [ripe, yesil] = await Promise.all([
    ipGecerli ? getir(`https://stat.ripe.net/data/maxmind-geo-lite/data.json?resource=${ip}&sourceapp=techlookup`, { bayt: 64 * 1024 }) : null,
    getir(`https://api.thegreenwebfoundation.org/api/v3/greencheck/${encodeURIComponent(host)}`, { bayt: 64 * 1024 }),
  ]);

  let ulke;
  if (!ripe) ulke = satir('olcmedi', 'ölçülemedi — IP adresi yok');
  else {
    const { veri, hata } = jsonCoz(ripe);
    const kod = veri?.data?.located_resources?.[0]?.locations?.[0]?.country;
    if (hata) ulke = satir('olcmedi', `ölçülemedi — RIPEstat: ${hata}`);
    else if (!kod || kod === '?') ulke = satir('yok', 'belirsiz (anycast / CDN ağı, konum tek ülkeye bağlanmıyor)', `RIPEstat (MaxMind GeoLite) · ${host} · IP ${ip}`);
    else ulke = satir('var', `${ulkeAdi(kod)} (${kod})`, `RIPEstat (MaxMind GeoLite) · ${host} · IP ${ip}`, { kod });
  }

  const g = jsonCoz(yesil);
  const yesilSatir = g.hata
    ? satir('olcmedi', `ölçülemedi — Green Web Foundation: ${g.hata}`)
    : g.veri?.green === true
      ? satir('var', `evet${g.veri.hosted_by ? ` · ${String(g.veri.hosted_by).slice(0, 60)}` : ''}`, 'Green Web Foundation kaydı')
      : satir('yok', 'kayıtta yeşil enerji beyanı yok', 'Green Web Foundation');
  return { ulke, yesil: yesilSatir };
}

/** Sunucu ülkesi için IP: önce dig A; boşsa işletim sisteminin çözümleyicisi (sayfayı açan yol da odur). */
export async function sunucuIp(host, dnsHam, { lookup = dnsLookup } = {}) {
  const ip = dnsHam?.a?.[0];
  if (ip) return { ip, kaynak: 'dig A' };
  try {
    const { address } = await lookup(host, { family: 4 });
    return { ip: address, kaynak: 'sistem çözümleyicisi' };
  } catch {
    return { ip: null };
  }
}

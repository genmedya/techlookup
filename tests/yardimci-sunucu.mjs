// K44–K47 ortak yardımcı: yerel 127.0.0.1 sunucu + gerçek tarama (--statik --json).
// Ölçütler fonksiyonu değil asıl yolu sınar: Set-Cookie / başlık / HTML gerçek HTTP'den gelir.
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const betik = join(kok, 'scripts', 'techlookup.mjs');
const kos = promisify(execFile);
export const SADE = '<!doctype html><html><head><title>Deneme</title></head><body><p>Merhaba</p></body></html>';

/**
 * rotalar: { '/yol': { kod?, basliklar?, cerezler?: ['ad=deger; Path=/'], govde? } }
 * diger: tanımsız yol için aynı biçimde yanıt (varsayılan 404 'yok'); sayac: yola göre istek sayısı.
 */
export async function sunucuAc(rotalar, diger = { kod: 404, govde: 'yok' }) {
  const sayac = {};
  const s = http.createServer((i, c) => {
    const yol = i.url.split('?')[0];
    sayac[yol] = (sayac[yol] ?? 0) + 1;
    const r = rotalar[yol] ?? (typeof diger === 'function' ? diger(yol) : diger);
    const basliklar = { 'content-type': 'text/html; charset=utf-8', ...(r.basliklar ?? {}) };
    if (r.cerezler?.length) basliklar['set-cookie'] = r.cerezler;
    c.writeHead(r.kod ?? 200, basliklar);
    c.end(r.govde ?? SADE);
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { taban: `http://127.0.0.1:${s.address().port}`, kapat: () => s.close(), sayac };
}

export async function tara(adres, ek = [], ortam = {}) {
  const { stdout } = await kos('node', [betik, adres, '--statik', '--json', ...ek], { timeout: 120_000, maxBuffer: 50e6, env: { ...process.env, ...ortam } });
  return { r: JSON.parse(stdout), ham: stdout };
}

/** Rapordaki bütün teknoloji adları → kanıt listesi */
export function bulunan(r) {
  return new Map(Object.values(r.gruplar ?? {}).flat().map((t) => [t.ad, t]));
}

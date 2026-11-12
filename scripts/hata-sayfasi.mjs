// 404 sondası: olmayan bir yol istenir, hata sayfasının başlık + çerez + gövdesi okunur.
// Neden: bazı siteler dil izini yalnız hata sayfasında bırakır (2026-11-12 ölçüldü: thy.com 404'te JSESSIONID,
// n11.com 404'te connect.sid; ana sayfada ikisi de yok). Ölçüt: tests/hata-sayfasi.test.mjs (K46).
// Kurallar: yönlendirme izlenmez (başka adresin verisi sinyal olmaz) · yalnız gerçek 4xx/5xx (403/429 hariç) ·
// gövde ana sayfayla aynıysa kullanılmaz · gövde en fazla 200 KB · bu veri YALNIZ teknoloji eşleştirmesine gider.
import { randomBytes } from 'node:crypto';
import { sinirliGetir, UA_TARAYICI } from './ortak.mjs';

export const SONDA_ONEK = '/techlookup-yok-';
const AZAMI_BAYT = 200 * 1024;

/** @returns {Promise<{yanitlar: Array<{yol, kod, basliklar, cerezler, govde}>, not: string|null}>} */
export async function hataSayfasiTara(origin, { anaHtml = '', sure = 10_000 } = {}) {
  const ad = `${SONDA_ONEK}${randomBytes(5).toString('hex')}`;
  const yollar = [ad, `${ad}.aspx`];
  const sonuclar = await Promise.all(yollar.map(async (yol) => {
    const r = await sinirliGetir(`${origin}${yol}`, { bayt: AZAMI_BAYT, sure, ua: UA_TARAYICI, yonlendirme: 'manual', basliklar: { accept: 'text/html,*/*' } });
    if (r.kod == null) return { yol, ret: r.durum };
    if (r.kod === 403 || r.kod === 429) return { yol, ret: `HTTP ${r.kod}` };
    if (r.kod < 400) return { yol, ret: null }; // 2xx/3xx: site hata sayfası vermiyor — ölçüm hatası değil
    if (anaHtml && r.govde === anaHtml) return { yol, ret: null };
    const basliklar = {};
    r.basliklar.forEach((v, k) => { if (k !== 'set-cookie') basliklar[k] = v; });
    const cerezler = {};
    for (const s of r.basliklar.getSetCookie()) {
      const [cift] = s.split(';');
      const i = cift.indexOf('=');
      if (i > 0) cerezler[cift.slice(0, i).trim().toLowerCase()] = cift.slice(i + 1).trim();
    }
    return { yol, kod: r.kod, basliklar, cerezler, govde: r.govde };
  }));
  const yanitlar = sonuclar.filter((x) => x.kod);
  const retler = sonuclar.filter((x) => x.ret).map((x) => x.ret);
  // yalnız iki istek de ölçülemediyse not düşülür; tek başarısız istek raporu kirletmez
  const not = !yanitlar.length && retler.length === yollar.length ? `404 sondası ölçülemedi (${[...new Set(retler)].join(', ')}); hata sayfasındaki izler okunmadı.` : null;
  return { yanitlar, not };
}

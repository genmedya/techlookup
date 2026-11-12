// Bizim ek parmak izlerimiz — webappanalyzer (veri/teknolojiler.json) biçiminde, yükleme anında onun ÜSTÜNE eklenir
// (eslesme.mjs → ekImzaBirlestir). Wappalyzer kuralı silinmez; veride olmayan ad yeni kayıt açmaz.
// Kural: her imza ölçülmüş bir ham kanıttan gelir; kanıt satırı yanında yazılır. Ölçütü: tests/ek-imza.test.mjs (K45),
// hata sayfası imzaları tests/hata-sayfasi.test.mjs (K46). Sürüm grupları dar ([\d.]+); iç içe niceleyici yok.
// hataHtml: yalnız 404 sondasının gövdesine uygulanır — varsayılan hata sayfasının kendine özgü cümlesi; genel kelime yasak.

export default {
  // bau.edu.tr, beykoz.edu.tr, laravel.com (2026-11-12): XSRF-TOKEN=eyJpdiI6… ve <uygulama>_session=eyJpdiI6…
  // Laravel şifreli çerez biçimi base64 {"iv": … → "eyJpdiI6". Veri yalnız "laravel_session" adını biliyor.
  Laravel: { cookies: { 'XSRF-TOKEN': '^eyJpdiI6', '.+_session': '^eyJpdiI6' } },

  // martas.com.tr: x-aspnetmvc-version: 5.2
  'Microsoft ASP.NET': { headers: { 'X-AspNetMvc-Version': '^([\\d.]+)\\;version:\\1' } },

  // martas.com.tr: x-powered-by-plesk: PleskWin (Plesk'in Windows sürümü)
  'Windows Server': { headers: { 'X-Powered-By-Plesk': 'PleskWin' } },

  // nuxt.com: x-powered-by: Nuxt
  'Nuxt.js': { headers: { 'X-Powered-By': '^Nuxt' } },

  // mastodon.social, dev.to: x-runtime: 0.267512 — Rack::Runtime ara katmanının varsayılan başlığı (Ruby).
  Ruby: { headers: { 'X-Runtime': '^\\d+\\.\\d+$\\;confidence:75' } },

  // mastodon.social: server: Mastodon — Mastodon bir Ruby on Rails uygulaması (veride implies yok)
  Mastodon: { implies: ['Ruby on Rails'] },
};

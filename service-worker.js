const VERSAO = 'v5';
const CACHE_APP = 'app-' + VERSAO;
const CACHE_RT = 'app-runtime-' + VERSAO;
const ARQUIVOS = [
  './', 'index.html', 'css/app.css',
  'js/supabase-client.js', 'js/util.js', 'js/api.js', 'js/dados.js', 'js/perfil.js', 'js/treino.js', 'js/historico.js', 'js/estatisticas.js', 'js/metas.js', 'js/inicio.js', 'js/auth.js', 'js/app.js',
  'img/icon-192.png', 'img/icon-512.png', 'img/login-logo.png', 'img/fundo-splash.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_APP).then((c) => Promise.all(ARQUIVOS.map((a) => c.add(a).catch(() => {})))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE_APP && k !== CACHE_RT).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;            // API e funções: sempre rede

  if (req.mode === 'navigate') {                                 // página: rede primeiro, cache se offline
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE_APP).then((c) => c.put('index.html', cp)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  if (url.origin === location.origin) {                          // arquivos do app: cache + atualiza em segundo plano
    e.respondWith(caches.match(req).then((hit) => {
      const rede = fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE_APP).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
      return hit || rede;
    }));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {  // CDN: cache primeiro
    if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE_RT).then((c) => c.put(req, cp)); }
    return r;
  })));
});

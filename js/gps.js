/* Rastreador por GPS (só funciona com o app aberto e a tela ligada — limite dos navegadores).
   Mede a distância filtrando pontos imprecisos e saltos impossíveis; o trajeto é guardado como polilinha codificada. */
var Gps = {
  ACC_MAX: 35,      // ignora leituras com precisão pior que 35 m
  PASSO_MIN: 4,     // ignora movimentos menores que 4 m (ou 40% da imprecisão)
  VEL_MAX: 20,      // m/s — acima disso é salto de sinal, não movimento
  s: null, watchId: null, wake: null, mapa: null, linha: null, pino: null,
  $: function (id) { return document.getElementById(id); },

  /* ---------- geometria ---------- */
  haversine: function (a, b) {
    var R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  },
  /* Douglas-Peucker (tolerância em metros) para enxugar o trajeto sem mudar a forma */
  simplificar: function (pts, tol) {
    if (pts.length < 3) return pts;
    var lat0 = pts[0].lat * Math.PI / 180, kx = 111320 * Math.cos(lat0), ky = 110540;
    var P = pts.map(function (p) { return { x: p.lng * kx, y: p.lat * ky }; });
    var manter = new Array(pts.length).fill(false); manter[0] = manter[pts.length - 1] = true;
    var pilha = [[0, pts.length - 1]];
    while (pilha.length) {
      var seg = pilha.pop(), a = P[seg[0]], b = P[seg[1]], maior = 0, idx = -1;
      var dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
      for (var i = seg[0] + 1; i < seg[1]; i++) {
        var t = len2 ? Math.max(0, Math.min(1, ((P[i].x - a.x) * dx + (P[i].y - a.y) * dy) / len2)) : 0;
        var d = Math.hypot(P[i].x - (a.x + t * dx), P[i].y - (a.y + t * dy));
        if (d > maior) { maior = d; idx = i; }
      }
      if (maior > tol && idx > 0) { manter[idx] = true; pilha.push([seg[0], idx], [idx, seg[1]]); }
    }
    return pts.filter(function (_, i) { return manter[i]; });
  },

  /* ---------- polilinha codificada (precisão 5); segmentos separados por espaço ---------- */
  _num: function (v) {
    v = v < 0 ? ~(v << 1) : (v << 1); var out = '';
    while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return out + String.fromCharCode(v + 63);
  },
  codificar: function (segmentos) {
    return segmentos.filter(function (s) { return s.length; }).map(function (seg) {
      var la = 0, lo = 0, out = '';
      seg.forEach(function (p) {
        var a = Math.round(p.lat * 1e5), o = Math.round(p.lng * 1e5);
        out += Gps._num(a - la) + Gps._num(o - lo); la = a; lo = o;
      });
      return out;
    }).join(' ');
  },
  decodificar: function (txt) {
    return String(txt || '').split(' ').filter(Boolean).map(function (s) {
      var i = 0, la = 0, lo = 0, pts = [];
      var ler = function () {
        var r = 0, sh = 0, b;
        do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20 && i <= s.length);
        return (r & 1) ? ~(r >> 1) : (r >> 1);
      };
      while (i < s.length) { la += ler(); lo += ler(); pts.push([la / 1e5, lo / 1e5]); }
      return pts;
    });
  },

  /* ---------- estado ---------- */
  novo: function () { return { estado: 'parado', segs: [], dist: 0, acum: 0, t0: 0, inicioReal: null, ultimo: null, status: '' }; },
  ms: function () { var s = Gps.s; return s.acum + (s.estado === 'rodando' ? Date.now() - s.t0 : 0); },
  salvar: function () {
    var s = Gps.s; if (s.estado === 'parado') { Util.ls.set('gps', null); return; }
    Util.ls.set('gps', { estado: s.estado, segs: s.segs, dist: s.dist, acum: Gps.ms(), inicioReal: s.inicioReal, ex: Gps.$('gpsExercicio').value });
  },
  recuperar: function () {
    var r = Util.ls.get('gps', null);
    if (!r || !r.segs || !r.segs.length) return;
    Gps.s = Object.assign(Gps.novo(), r, { estado: 'pausado', t0: 0, ultimo: null, status: 'Rastreamento interrompido (o app foi fechado). Retome ou finalize.' });
  },

  /* ---------- rastreamento ---------- */
  iniciar: function () {
    if (!('geolocation' in navigator)) return Util.toast('Este aparelho não tem GPS disponível no navegador.', 'erro');
    var s = Gps.s;
    if (s.estado === 'parado') { s.segs = [[]]; s.dist = 0; s.acum = 0; s.inicioReal = new Date().toISOString(); }
    else s.segs.push([]);
    s.ultimo = null; s.t0 = Date.now(); s.estado = 'rodando'; s.status = 'Procurando sinal de GPS…';
    Gps.assistir(); Gps.manterTela(); Gps.salvar(); Gps.desenhar(); Gps.criarMapa();
  },
  assistir: function () {
    if (Gps.watchId != null) return;
    Gps.watchId = navigator.geolocation.watchPosition(Gps.aoPosicao, Gps.aoErro, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  },
  soltar: function () { if (Gps.watchId != null) { navigator.geolocation.clearWatch(Gps.watchId); Gps.watchId = null; } Gps.soltarTela(); },
  pausar: function () {
    var s = Gps.s; if (s.estado !== 'rodando') return;
    s.acum += Date.now() - s.t0; s.estado = 'pausado'; s.status = 'Pausado'; Gps.soltar(); Gps.salvar(); Gps.desenhar();
  },
  aoErro: function (e) {
    var s = Gps.s; if (!s || s.estado !== 'rodando') return;
    if (e && e.code === 1) { Gps.pausar(); s.status = 'Permissão de localização negada. Libere nas configurações do navegador.'; Util.toast('Permissão de localização negada.', 'erro'); }
    else s.status = 'Sinal de GPS fraco…';
    Gps.desenhar();
  },
  aoPosicao: function (pos) {
    var s = Gps.s; if (!s || s.estado !== 'rodando') return;
    var c = pos.coords, p = { lat: c.latitude, lng: c.longitude, t: pos.timestamp };
    if (c.accuracy > Gps.ACC_MAX) { s.status = 'Sinal fraco (±' + Math.round(c.accuracy) + ' m)'; Gps.desenhar(); return; }
    var seg = s.segs[s.segs.length - 1];
    if (s.ultimo) {
      var d = Gps.haversine(s.ultimo, p), dt = (p.t - s.ultimo.t) / 1000;
      if (d < Math.max(Gps.PASSO_MIN, c.accuracy * 0.4)) { s.status = 'GPS ativo'; Gps.desenhar(); return; }
      if (dt > 0 && d / dt > Gps.VEL_MAX) return;
      s.dist += d;
    }
    seg.push(p); s.ultimo = p; s.status = 'GPS ativo (±' + Math.round(c.accuracy) + ' m)';
    if (seg.length % 5 === 0) Gps.salvar();
    Gps.desenhar(); Gps.atualizarMapa(p);
  },
  manterTela: async function () {
    try { if (navigator.wakeLock && !Gps.wake) { Gps.wake = await navigator.wakeLock.request('screen'); Gps.wake.addEventListener('release', function () { Gps.wake = null; }); } } catch (e) { /* sem suporte: segue sem */ }
  },
  soltarTela: function () { try { if (Gps.wake) Gps.wake.release(); } catch (e) {} Gps.wake = null; },

  /* ---------- finalizar: vira um exercício do treino + trajeto anexado ---------- */
  finalizar: async function () {
    var s = Gps.s; if (s.estado === 'parado') return;
    if (s.estado === 'rodando') { s.acum += Date.now() - s.t0; s.estado = 'pausado'; }
    Gps.soltar();
    var km = Math.round(s.dist / 10) / 100, seg = Math.round(s.acum / 1000), n = s.segs.reduce(function (a, g) { return a + g.length; }, 0);
    if (n < 2 || s.dist < 30) {
      Util.toast('Distância muito curta para registrar. Rastreamento descartado.', 'info'); Gps.descartar(); return;
    }
    var exId = Gps.$('gpsExercicio').value;
    if (!exId) { Util.toast('Escolha o exercício (ex.: Caminhada ao ar livre).', 'erro'); s.estado = 'pausado'; Gps.desenhar(); return; }
    var simples = s.segs.map(function (g) { return Gps.simplificar(g, 3); });
    var st = Treino.st;
    st.itens.push({ exercicio_id: exId, series: null, reps: null, carga_kg: null, duracao_seg: seg, distancia_km: km, resistencia: null, cadencia_rpm: null, calorias_aparelho: null, tipo_treino: null });
    st.ambiente = 'ar_livre';
    st.trajeto = { rota: Gps.codificar(simples), distancia_km: km };
    if (!Treino.$('trDuracao').value) st.duracao_seg_form = Math.round(seg / 6) / 10;
    if (s.inicioReal && !st.editando) st.inicio = new Date(s.inicioReal);
    Gps.descartar();
    Treino.desenharTudo();
    Util.toast('Percurso adicionado: ' + Dados.fmtNum(km, 2) + ' km em ' + Dados.fmtDur(seg) + '. Salve o treino para guardar o trajeto.', 'ok');
  },
  descartar: function () {
    Gps.soltar(); Gps.s = Gps.novo(); Util.ls.set('gps', null);
    if (Gps.mapa) { Gps.mapa.remove(); Gps.mapa = null; Gps.linha = null; Gps.pino = null; }
    Gps.desenhar();
  },
  removerAnexo: function () { if (Treino.st) { Treino.st.trajeto = null; } Gps.desenharAnexo(); },

  /* ---------- tela ---------- */
  desenhar: function () {
    var s = Gps.s, $ = Gps.$; if (!s || !$('gpsDist')) return;
    var km = s.dist / 1000, ms = Gps.ms(), seg = Math.floor(ms / 1000);
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), x = seg % 60, p = function (n) { return String(n).padStart(2, '0'); };
    $('gpsDist').textContent = Dados.fmtNum(km, 2);
    $('gpsTempo').textContent = (h ? h + ':' : '') + p(m) + ':' + p(x);
    var ritmo = km >= 0.05 ? Dados.fmtRitmo(ms / 1000 / km) : '—';
    $('gpsRitmo').textContent = ritmo;
    $('gpsStatus').textContent = s.estado === 'parado' ? 'Pronto' : s.status;
    var bt = $('btnGpsToggle');
    bt.innerHTML = s.estado === 'rodando' ? '<i class="fa-solid fa-pause me-1"></i>Pausar' : '<i class="fa-solid fa-play me-1"></i>' + (s.estado === 'pausado' ? 'Retomar' : 'Iniciar GPS');
    $('btnGpsFinalizar').classList.toggle('d-none', s.estado === 'parado');
    $('btnGpsDescartar').classList.toggle('d-none', s.estado === 'parado');
    $('gpsMapa').classList.toggle('d-none', s.estado === 'parado');
    Gps.desenharAnexo();
  },
  desenharAnexo: function () {
    var el = Gps.$('gpsAnexo'); if (!el) return;
    var t = Treino.st && Treino.st.trajeto;
    el.classList.toggle('d-none', !t);
    if (t) el.innerHTML = '<i class="fa-solid fa-route me-1"></i>Trajeto GPS anexado (' + Dados.fmtNum(t.distancia_km, 2) + ' km) <button type="button" class="btn btn-link btn-sm p-0 ms-1" id="btnGpsRemover">remover</button>';
  },
  opcoesExercicio: function () {
    var sel = Gps.$('gpsExercicio'); if (!sel) return;
    var atual = sel.value || (Util.ls.get('gps_ex', ''));
    var lista = Dados.ex.filter(function (e) { return e.modo === 'distancia_tempo' && (e.ambientes || []).indexOf('ar_livre') >= 0; });
    sel.innerHTML = lista.map(function (e) { return '<option value="' + e.id + '">' + Util.esc(e.nome) + '</option>'; }).join('');
    if (atual && lista.some(function (e) { return e.id === atual; })) sel.value = atual;
  },
  criarMapa: function () {
    if (Gps.mapa || !window.L) return;
    Gps.$('gpsMapa').classList.remove('d-none');
    Gps.mapa = Mapa.criar('gpsMapa'); if (!Gps.mapa) return;
    Gps.mapa.setView([-20.0, -41.0], 3);
    Gps.linha = L.polyline([], { color: '#8B4A3D', weight: 5, opacity: .9 }).addTo(Gps.mapa);
    var last = Gps.s.segs.reduce(function (a, g) { return a.concat(g); }, []);
    if (last.length) { last.forEach(function (p) { Gps.linha.addLatLng([p.lat, p.lng]); }); Gps.atualizarMapa(last[last.length - 1]); }
    setTimeout(function () { if (Gps.mapa) Gps.mapa.invalidateSize(); }, 300);
  },
  atualizarMapa: function (p) {
    if (!Gps.mapa || !Gps.linha) return;
    Gps.linha.addLatLng([p.lat, p.lng]);
    if (!Gps.pino) Gps.pino = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'gps-pino', html: '<span></span>', iconSize: [18, 18] }) }).addTo(Gps.mapa);
    else Gps.pino.setLatLng([p.lat, p.lng]);
    Gps.mapa.setView([p.lat, p.lng], Math.max(Gps.mapa.getZoom(), 17), { animate: false });
  },

  init: function () {
    var $ = Gps.$;
    Gps.s = Gps.novo();
    $('btnGpsToggle').addEventListener('click', function () { Gps.s.estado === 'rodando' ? Gps.pausar() : Gps.iniciar(); });
    $('btnGpsFinalizar').addEventListener('click', Gps.finalizar);
    $('btnGpsDescartar').addEventListener('click', async function () { if (await Util.confirmar('Descartar este rastreamento? Os dados do percurso serão perdidos.', 'Descartar')) Gps.descartar(); });
    $('gpsExercicio').addEventListener('change', function () { Util.ls.set('gps_ex', this.value); });
    $('gpsAnexo').addEventListener('click', function (e) { if (e.target.closest('#btnGpsRemover')) Gps.removerAnexo(); });
    document.addEventListener('dados:atualizados', Gps.opcoesExercicio);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Gps.s.estado === 'rodando') { Gps.manterTela(); Gps.desenhar(); } });
    setInterval(function () { if (!document.hidden && Gps.s.estado === 'rodando') Gps.desenhar(); }, 1000);
    Gps.desenhar();
  },
  aposLogin: function () { Gps.s = Gps.novo(); Gps.recuperar(); Gps.opcoesExercicio(); Gps.desenhar(); if (Gps.s.estado !== 'parado') Gps.criarMapa(); },
  aoAbrir: function () { Gps.opcoesExercicio(); Gps.desenhar(); }
};

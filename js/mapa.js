/* Mapas (Leaflet + OpenStreetMap): tema escuro por filtro CSS e visualizador de trajetos. */
var Mapa = {
  mapas: [],
  criar: function (id) {
    var el = document.getElementById(id); if (!el || !window.L) return null;
    var m = L.map(el, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    el.classList.toggle('mapa-escuro', Util.tema.get() === 'dark');
    Mapa.mapas.push({ m: m, el: el });
    if (window.ResizeObserver) { var ro = new ResizeObserver(function () { if (m._loaded) m.invalidateSize(); }); ro.observe(el); m.on('unload', function () { ro.disconnect(); }); }
    return m;
  },
  desenharRota: function (m, rota) {
    var segs = Gps.decodificar(rota), todos = [];
    segs.forEach(function (s) { if (s.length > 1) L.polyline(s, { color: '#8B4A3D', weight: 5, opacity: .9 }).addTo(m); todos = todos.concat(s); });
    if (!todos.length) return false;
    var ico = function (cls) { return L.divIcon({ className: 'gps-ponto ' + cls, html: '<span></span>', iconSize: [16, 16] }); };
    L.marker(todos[0], { icon: ico('ini'), title: 'Início' }).addTo(m);
    L.marker(todos[todos.length - 1], { icon: ico('fim'), title: 'Fim' }).addTo(m);
    m.fitBounds(L.latLngBounds(todos), { padding: [24, 24], maxZoom: 18, animate: false });
    return true;
  },
  _atual: null,
  abrirTrajeto: async function (sessaoId) {
    var s = Dados.sessoes.filter(function (x) { return x.id === sessaoId; })[0], t = await Api.db.trajetos.get(sessaoId);
    if (!s || !t) return;
    if (!t.rota) {
      if (!navigator.onLine) return Util.toast('Sem internet: conecte-se para carregar este trajeto.', 'erro');
      var r = await Supa.client.from('sessao_trajetos').select('rota,distancia_km').eq('sessao_id', sessaoId).single();
      if (r.error) return Util.toast('Não foi possível carregar o trajeto.', 'erro');
      t = { id: sessaoId, rota: r.data.rota, distancia_km: Number(r.data.distancia_km), pendente: 0 }; await Api.db.trajetos.put(t);
    }
    var km = t.distancia_km, seg = s.duracao_seg || 0;
    document.getElementById('trjTitulo').textContent = Dados.fmtDataHora(s.inicio);
    document.getElementById('trjInfo').innerHTML = '<span><strong>' + Dados.fmtNum(km, 2) + '</strong> km</span>' + (seg ? '<span><strong>' + Dados.fmtDur(seg) + '</strong></span>' : '') +
      (seg && km >= 0.05 ? '<span>ritmo <strong>' + Dados.fmtRitmo(seg / km) + '</strong></span>' : '');
    var modal = document.getElementById('modalTrajeto'); Mapa._atual = t;
    bootstrap.Modal.getOrCreateInstance(modal).show();
  },
  init: function () {
    var modal = document.getElementById('modalTrajeto'), mapa = null;
    modal.addEventListener('shown.bs.modal', function () {
      if (mapa) { mapa.remove(); mapa = null; }
      mapa = Mapa.criar('trjMapa'); if (!mapa || !Mapa._atual) return;
      mapa.setView([-20, -41], 4); mapa.invalidateSize();
      Mapa.desenharRota(mapa, Mapa._atual.rota);
    });
    modal.addEventListener('hidden.bs.modal', function () { if (mapa) { Mapa.mapas = Mapa.mapas.filter(function (x) { return x.m !== mapa; }); mapa.remove(); mapa = null; } });
    document.addEventListener('tema:mudou', function () { Mapa.mapas.forEach(function (x) { x.el.classList.toggle('mapa-escuro', Util.tema.get() === 'dark'); }); });
  }
};

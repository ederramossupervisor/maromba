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

/* Mapa geral: todos os percursos de GPS juntos, com filtro de período. */
var MapaGeral = {
  mapa: null, camada: null, _carregando: false,
  $: function (id) { return document.getElementById(id); },
  periodo: function () {
    var v = MapaGeral.$('mgPeriodo').value; if (v === 'todos') return null;
    return Estat.addDias(Estat.hoje(), -(Number(v) - 1));
  },
  /* baixa o conteúdo dos trajetos que só existem no servidor (em lotes) */
  completar: async function (ids) {
    var falta = ids.filter(function (id) { var t = Dados.trajetos[id]; return t && !t.rota; });
    if (!falta.length || !navigator.onLine) return falta.length;
    for (var i = 0; i < falta.length; i += 15) {
      var lote = falta.slice(i, i + 15);
      var r = await Supa.client.from('sessao_trajetos').select('sessao_id,rota,distancia_km').in('sessao_id', lote);
      if (r.error) break;
      for (var k = 0; k < r.data.length; k++) await Api.db.trajetos.put({ id: r.data[k].sessao_id, rota: r.data[k].rota, distancia_km: Number(r.data[k].distancia_km), pendente: 0 });
    }
    var fresco = await Api.db.trajetos.toArray(); Dados.trajetos = {}; fresco.forEach(function (t) { Dados.trajetos[t.id] = t; });
    return falta.filter(function (id) { return !Dados.trajetos[id] || !Dados.trajetos[id].rota; }).length;
  },
  desenhar: async function () {
    if (MapaGeral._carregando || !Util.userId) return;
    MapaGeral._carregando = true;
    var $ = MapaGeral.$;
    try {
      if (!MapaGeral.mapa) {
        MapaGeral.mapa = Mapa.criar('mgMapa'); if (!MapaGeral.mapa) return;
        MapaGeral.mapa.setView([-15, -50], 4);
      }
      var m = MapaGeral.mapa, de = MapaGeral.periodo();
      var sess = Dados.sessoes.filter(function (s) { return Dados.trajetos[s.id] && (!de || Estat.dataDe(s) >= de); });
      $('mgStatus').textContent = sess.length ? 'Carregando percursos…' : '';
      var semConteudo = await MapaGeral.completar(sess.map(function (s) { return s.id; }));
      if (MapaGeral.camada) { m.removeLayer(MapaGeral.camada); MapaGeral.camada = null; }
      var grupo = L.featureGroup(), tem = false, km = 0, recente = Estat.addDias(Estat.hoje(), -6);
      sess.forEach(function (s) {
        var t = Dados.trajetos[s.id]; if (!t || !t.rota) return;
        var cor = Estat.dataDe(s) >= recente ? '#8B4A3D' : '#5C6B5A', info = Estat.brAno(Estat.dataDe(s)) + ' · ' + Dados.fmtNum(t.distancia_km, 2) + ' km';
        Gps.decodificar(t.rota).forEach(function (seg) {
          if (seg.length < 2) return;
          var ln = L.polyline(seg, { color: cor, weight: 4, opacity: .75 }).bindTooltip(info, { sticky: true });
          ln.on('click', function () { Mapa.abrirTrajeto(s.id); });
          ln.addTo(grupo); tem = true;
        });
        km += t.distancia_km || 0;
      });
      MapaGeral.camada = grupo.addTo(m);
      m.invalidateSize();
      if (tem) m.fitBounds(grupo.getBounds(), { padding: [24, 24], maxZoom: 16, animate: false });
      $('mgResumo').innerHTML = '<span><strong>' + sess.length + '</strong> ' + (sess.length === 1 ? 'percurso' : 'percursos') + '</span><span><strong>' + Dados.fmtNum(km, 1) + '</strong> km no total</span>';
      $('mgStatus').textContent = !sess.length ? 'Nenhum percurso com GPS neste período. Registre um treino usando “Rastrear com GPS”.'
        : (semConteudo ? semConteudo + (semConteudo === 1 ? ' percurso' : ' percursos') + ' sem internet para carregar.' : 'Toque em uma linha para ver os detalhes. Vermelho: últimos 7 dias.');
    } catch (e) { MapaGeral.$('mgStatus').textContent = 'Não foi possível carregar o mapa.'; }
    finally { MapaGeral._carregando = false; }
  },
  init: function () {
    MapaGeral.$('mgPeriodo').addEventListener('change', MapaGeral.desenhar);
  },
  aoAbrir: function () { setTimeout(MapaGeral.desenhar, 50); }
};

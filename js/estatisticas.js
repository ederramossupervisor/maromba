/* Estatísticas e gráficos. Todas as datas usam o fuso America/Sao_Paulo (strings AAAA-MM-DD). */
var Estat = {
  charts: {},
  DIA: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  DIA_LONGO: ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
  COR: { p: '#5C6B5A', a: '#B79C6B', r: '#8B4A3D', c: '#8B7D6B', v: '#7A8B5E' },
  $: function (id) { return document.getElementById(id); },

  /* ---------- datas ---------- */
  hoje: function () { return Dados.tzData(Date.now()); },
  addDias: function (d, n) { return new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10); },
  dow: function (d) { return new Date(d + 'T12:00:00Z').getUTCDay(); },
  segunda: function (d) { return Estat.addDias(d, -((Estat.dow(d) + 6) % 7)); },
  dif: function (a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); },
  br: function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); },
  brAno: function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4); },
  hora: function (iso) {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));
  },
  dataDe: function (s) { return s.data || Dados.tzData(s.inicio); },

  /* ---------- sessões ---------- */
  somaItens: function (s, exId) {
    return (s.itens || []).reduce(function (a, i) { return a + ((!exId || i.exercicio_id === exId) ? (i.duracao_seg || 0) : 0); }, 0);
  },
  /* Minutos da sessão. Com filtro de exercício: soma o tempo do próprio exercício; se ele não tem tempo
     (ex.: flexões), divide o tempo "sobrando" da sessão entre os exercícios que ficaram sem tempo. */
  minutos: function (s, exId) {
    if (!exId) return (s.duracao_seg || Estat.somaItens(s)) / 60;
    var proprio = Estat.somaItens(s, exId);
    if (proprio > 0 || !s.duracao_seg) return proprio / 60;
    var itens = s.itens || [], sem = itens.filter(function (i) { return !(i.duracao_seg > 0); }),
      meus = sem.filter(function (i) { return i.exercicio_id === exId; }),
      sobra = s.duracao_seg - Estat.somaItens(s);
    return (sobra > 0 && sem.length) ? (sobra * meus.length / sem.length) / 60 : 0;
  },
  periodo: function () {
    var per = Estat.$('stPeriodo').value, hoje = Estat.hoje();
    if (per === 'custom') return { de: Estat.$('stDe').value || null, ate: Estat.$('stAte').value || hoje };
    if (per === 'todos') {
      var ds = Dados.sessoes.map(Estat.dataDe).sort();
      return { de: ds.length ? ds[0] : Estat.addDias(hoje, -29), ate: hoje };
    }
    return { de: Estat.addDias(hoje, -(Number(per) - 1)), ate: hoje };
  },
  filtradas: function (ignorarPeriodo) {
    var p = Estat.periodo(), ex = Estat.$('stExercicio').value;
    return Dados.sessoes.filter(function (s) {
      var d = Estat.dataDe(s);
      if (!ignorarPeriodo && ((p.de && d < p.de) || (p.ate && d > p.ate))) return false;
      if (ex && !(s.itens || []).some(function (i) { return i.exercicio_id === ex; })) return false;
      return true;
    }).map(function (s) { return { s: s, d: Estat.dataDe(s), min: Estat.minutos(s, ex) }; });
  },

  /* ---------- sequência de dias ---------- */
  /* Corridas de dias treinados. Dias de descanso planejados não quebram a sequência. */
  corridas: function (dias, descanso, hoje) {
    var cont = function (a, b) {
      for (var x = Estat.addDias(a, 1); x < b; x = Estat.addDias(x, 1)) if (descanso.indexOf(Estat.dow(x)) < 0) return false;
      return true;
    };
    var maior = 0, corrida = 0, ult = null;
    dias.forEach(function (d) { corrida = (ult && cont(ult, d)) ? corrida + 1 : 1; if (corrida > maior) maior = corrida; ult = d; });
    return { atual: ult ? (cont(ult, hoje) ? corrida : 0) : 0, maior: maior };
  },
  sequenciaLocal: function (sessoes, descanso) {
    var set = {};
    sessoes.forEach(function (s) { set[Estat.dataDe(s)] = 1; });
    var dias = Object.keys(set).sort(), r = Estat.corridas(dias, descanso || Dados.descanso(), Estat.hoje());
    return { atual: r.atual, maior: r.maior, total: dias.length };
  },
  /* Usa o valor calculado no banco quando está atualizado (nada pendente); senão calcula com os dados do aparelho. */
  sequencia: async function () {
    var local = Estat.sequenciaLocal(Dados.sessoes);
    var srv = Dados.seqServidor;
    if (srv && srv.dia === Estat.hoje() && !(await Dados.pendentes())) return { atual: srv.atual, maior: srv.maior, total: local.total, origem: 'servidor' };
    return Object.assign(local, { origem: 'local' });
  },

  /* ---------- gráficos ---------- */
  grafico: function (id, cfg) {
    if (Estat.charts[id]) { Estat.charts[id].destroy(); delete Estat.charts[id]; }
    var el = Estat.$(id); if (!el || !window.Chart) return null;
    Chart.defaults.color = getComputedStyle(document.body).color;
    Chart.defaults.borderColor = 'rgba(128,128,128,.25)';
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false }, cfg.options || {});
    Estat.charts[id] = new Chart(el, cfg);
    return Estat.charts[id];
  },
  vazio: function (id, vazio) {
    var box = Estat.$(id); if (!box) return;
    var wrap = box.closest('.chart-box'); if (wrap) wrap.classList.toggle('d-none', vazio);
    var msg = Estat.$(id + 'Vazio'); if (msg) msg.classList.toggle('d-none', !vazio);
  },
  r1: function (n) { return Math.round(n * 10) / 10; },

  baldes: function (de, ate, gran) {
    var chaves = [], d = de;
    if (gran === 'mes') { d = de.slice(0, 7) + '-01'; while (d.slice(0, 7) <= ate.slice(0, 7)) { chaves.push(d.slice(0, 7)); d = Estat.addDias(d.slice(0, 7) + '-28', 4).slice(0, 7) + '-01'; } }
    else if (gran === 'semana') { d = Estat.segunda(de); while (d <= ate) { chaves.push(d); d = Estat.addDias(d, 7); } }
    else { while (d <= ate) { chaves.push(d); d = Estat.addDias(d, 1); } }
    return chaves;
  },
  chave: function (d, gran) { return gran === 'mes' ? d.slice(0, 7) : gran === 'semana' ? Estat.segunda(d) : d; },
  rotulo: function (k, gran) { return gran === 'mes' ? k.slice(5, 7) + '/' + k.slice(0, 4) : Estat.br(k); },

  gMinutos: function () {
    var p = Estat.periodo(), gran = Estat.$('stGran').value, dias = Estat.dif(p.de, p.ate) + 1;
    if (gran === 'dia' && dias > 200) { gran = 'semana'; Estat.$('stGran').value = 'semana'; }
    var ch = Estat.baldes(p.de, p.ate, gran), tot = {}, f = Estat.filtradas();
    ch.forEach(function (k) { tot[k] = 0; });
    f.forEach(function (x) { var k = Estat.chave(x.d, gran); if (k in tot) tot[k] += x.min; });
    var valores = ch.map(function (k) { return Estat.r1(tot[k]); });
    var soma = valores.reduce(function (a, b) { return a + b; }, 0);
    Estat.$('stResumoMin').textContent = f.length ? Dados.fmtNum(soma, 0) + ' min no período · ' + f.length + (f.length === 1 ? ' treino' : ' treinos') : '';
    Estat.vazio('cvMinutos', !f.length);
    Estat.grafico('cvMinutos', { type: 'bar', data: { labels: ch.map(function (k) { return Estat.rotulo(k, gran); }), datasets: [{ label: 'Minutos', data: valores, backgroundColor: Estat.COR.p }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
    return { gran: gran, valores: valores, chaves: ch };
  },
  gSessoesSemana: function () {
    var p = Estat.periodo(), ch = Estat.baldes(p.de, p.ate, 'semana'), tot = {}, f = Estat.filtradas();
    ch.forEach(function (k) { tot[k] = 0; });
    f.forEach(function (x) { var k = Estat.segunda(x.d); if (k in tot) tot[k]++; });
    Estat.vazio('cvSessSem', !f.length);
    Estat.grafico('cvSessSem', { type: 'bar', data: { labels: ch.map(Estat.br), datasets: [{ label: 'Treinos', data: ch.map(function (k) { return tot[k]; }), backgroundColor: Estat.COR.a }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    return { chaves: ch, totais: tot };
  },

  /* Mapa de calor: 53 semanas, estilo "contribuições". */
  gCalor: function () {
    var porDia = {}, hoje = Estat.hoje();
    Estat.filtradas(true).forEach(function (x) { var o = porDia[x.d] || (porDia[x.d] = { min: 0, n: 0 }); o.min += x.min; o.n++; });
    var ini = Estat.addDias(Estat.segunda(hoje), -52 * 7), fim = Estat.addDias(Estat.segunda(hoje), 6), html = '', d = ini, treinados = 0;
    while (d <= fim) {
      if (d > hoje) html += '<span class="heat-cel heat-fut"></span>';
      else {
        var o = porDia[d], n = !o ? 0 : (o.min >= 60 ? 4 : o.min >= 40 ? 3 : o.min >= 20 ? 2 : 1);
        if (o) treinados++;
        html += '<span class="heat-cel heat-' + n + '" title="' + Estat.brAno(d) + ': ' + (o ? Dados.fmtNum(o.min, 0) + ' min, ' + o.n + (o.n === 1 ? ' treino' : ' treinos') : 'sem treino') + '"></span>';
      }
      d = Estat.addDias(d, 1);
    }
    Estat.$('stHeat').innerHTML = html;
    Estat.$('stHeatTxt').textContent = treinados + (treinados === 1 ? ' dia treinado' : ' dias treinados') + ' nas últimas 53 semanas';
    return { treinados: treinados };
  },

  gDistribuicao: function () {
    var f = Estat.filtradas(), cat = {}, amb = {};
    f.forEach(function (x) {
      (x.s.itens || []).forEach(function (i) { var e = Dados.exMap[i.exercicio_id]; if (e) cat[e.categoria] = (cat[e.categoria] || 0) + 1; });
      var a = x.s.ambiente || 'nao'; amb[a] = (amb[a] || 0) + 1;
    });
    var cores = [Estat.COR.p, Estat.COR.a, Estat.COR.r, Estat.COR.c, Estat.COR.v];
    var ck = Object.keys(cat), ak = Object.keys(amb);
    Estat.vazio('cvCategoria', !ck.length); Estat.vazio('cvAmbiente', !ak.length);
    Estat.grafico('cvCategoria', { type: 'doughnut', data: { labels: ck.map(function (k) { return Dados.CAT[k]; }), datasets: [{ data: ck.map(function (k) { return cat[k]; }), backgroundColor: cores }] }, options: { plugins: { legend: { position: 'bottom' } } } });
    Estat.grafico('cvAmbiente', { type: 'doughnut', data: { labels: ak.map(function (k) { return Dados.AMB[k] || 'Não informado'; }), datasets: [{ data: ak.map(function (k) { return amb[k]; }), backgroundColor: cores }] }, options: { plugins: { legend: { position: 'bottom' } } } });
    return { categorias: cat, ambientes: amb };
  },

  /* Evolução por exercício */
  METRICAS: {
    reps: { rot: 'Repetições máximas', fn: function (its) { return Math.max.apply(null, its.map(function (i) { return i.reps || 0; })); } },
    carga: { rot: 'Carga máxima (kg)', fn: function (its) { return Math.max.apply(null, its.map(function (i) { return i.carga_kg || 0; })); } },
    volume: { rot: 'Volume (séries × reps × kg)', fn: function (its) { return its.reduce(function (a, i) { return a + (i.reps ? (i.series || 1) * i.reps * (i.carga_kg > 0 ? i.carga_kg : 1) : 0); }, 0); } },
    dist: { rot: 'Distância (km)', fn: function (its) { return its.reduce(function (a, i) { return a + (i.distancia_km || 0); }, 0); } },
    ritmo: { rot: 'Ritmo médio (min/km)', fn: function (its) {
      var c = its.filter(function (i) { return i.distancia_km > 0 && i.duracao_seg > 0; });
      var d = c.reduce(function (a, i) { return a + i.distancia_km; }, 0), t = c.reduce(function (a, i) { return a + i.duracao_seg; }, 0);
      return d > 0 ? t / d / 60 : 0; } },
    tempo: { rot: 'Tempo (min)', fn: function (its) { return its.reduce(function (a, i) { return a + (i.duracao_seg || 0); }, 0) / 60; } }
  },
  metricasDoModo: function (ex) {
    if (ex.modo === 'repeticoes') return ['reps', 'carga', 'volume'];
    if (ex.modo === 'tempo') return ex.campos_bike ? ['tempo', 'dist'] : ['tempo'];
    if (ex.modo === 'distancia_tempo') return ['dist', 'ritmo', 'tempo'];
    return ['reps', 'tempo', 'volume'];
  },
  preencherEvolucao: function () {
    var usados = {}, cont = {};
    Dados.sessoes.forEach(function (s) { (s.itens || []).forEach(function (i) { usados[i.exercicio_id] = 1; cont[i.exercicio_id] = (cont[i.exercicio_id] || 0) + 1; }); });
    var ids = Object.keys(usados).filter(function (id) { return Dados.exMap[id]; }).sort(function (a, b) { return cont[b] - cont[a]; });
    var sel = Estat.$('stExEvo'), atual = sel.value;
    sel.innerHTML = ids.map(function (id) { return '<option value="' + Util.esc(id) + '">' + Util.esc(Dados.exMap[id].nome) + '</option>'; }).join('');
    if (atual && usados[atual]) sel.value = atual;
    Estat.preencherMetricas();
  },
  preencherMetricas: function () {
    var ex = Dados.exMap[Estat.$('stExEvo').value], sel = Estat.$('stMetrica'), atual = sel.value;
    var ms = ex ? Estat.metricasDoModo(ex) : [];
    sel.innerHTML = ms.map(function (m) { return '<option value="' + m + '">' + Estat.METRICAS[m].rot + '</option>'; }).join('');
    if (ms.indexOf(atual) >= 0) sel.value = atual;
  },
  gEvolucao: function () {
    var exId = Estat.$('stExEvo').value, m = Estat.$('stMetrica').value, p = Estat.periodo(), pts = [];
    if (exId && m) {
      Dados.sessoes.slice().reverse().forEach(function (s) {
        var d = Estat.dataDe(s); if (d < p.de || d > p.ate) return;
        var its = (s.itens || []).filter(function (i) { return i.exercicio_id === exId; });
        if (!its.length) return;
        var v = Estat.METRICAS[m].fn(its);
        if (v > 0) pts.push({ d: d, v: Math.round(v * 100) / 100 });
      });
    }
    Estat.vazio('cvEvolucao', !pts.length);
    Estat.grafico('cvEvolucao', { type: 'line', data: { labels: pts.map(function (x) { return Estat.br(x.d); }), datasets: [{ label: m ? Estat.METRICAS[m].rot : '', data: pts.map(function (x) { return x.v; }), borderColor: Estat.COR.p, backgroundColor: Estat.COR.p, tension: 0.25, pointRadius: 4 }] }, options: { plugins: { legend: { display: false } } } });
    return pts;
  },

  /* Bicicleta ergométrica */
  gBike: function () {
    var p = Estat.periodo(), linhas = [];
    Dados.sessoes.slice().reverse().forEach(function (s) {
      var d = Estat.dataDe(s); if (d < p.de || d > p.ate) return;
      var its = (s.itens || []).filter(function (i) { var e = Dados.exMap[i.exercicio_id]; return e && e.campos_bike; });
      if (!its.length) return;
      var media = function (campo) { var v = its.map(function (i) { return i[campo]; }).filter(function (x) { return x > 0; }); return v.length ? Estat.r1(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null; };
      linhas.push({ d: d, min: Estat.r1(its.reduce(function (a, i) { return a + (i.duracao_seg || 0); }, 0) / 60), km: its.reduce(function (a, i) { return a + (i.distancia_km || 0); }, 0), res: media('resistencia'), cad: media('cadencia_rpm') });
    });
    Estat.$('secBike').classList.toggle('d-none', !linhas.length);
    if (!linhas.length) return linhas;
    var lab = linhas.map(function (x) { return Estat.br(x.d); });
    Estat.grafico('cvBikeA', { type: 'bar', data: { labels: lab, datasets: [
      { label: 'Minutos', data: linhas.map(function (x) { return x.min; }), backgroundColor: Estat.COR.p, yAxisID: 'y' },
      { label: 'Distância (km)', type: 'line', data: linhas.map(function (x) { return x.km || null; }), borderColor: Estat.COR.a, backgroundColor: Estat.COR.a, yAxisID: 'y1', spanGaps: true }] },
      options: { scales: { y: { beginAtZero: true, position: 'left' }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } } } } });
    Estat.grafico('cvBikeB', { type: 'line', data: { labels: lab, datasets: [
      { label: 'Resistência média', data: linhas.map(function (x) { return x.res; }), borderColor: Estat.COR.r, backgroundColor: Estat.COR.r, yAxisID: 'y', spanGaps: true },
      { label: 'Cadência média (rpm)', data: linhas.map(function (x) { return x.cad; }), borderColor: Estat.COR.v, backgroundColor: Estat.COR.v, yAxisID: 'y1', spanGaps: true }] },
      options: { scales: { y: { min: 0, max: 20, position: 'left' }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } } } } });
    return linhas;
  },

  /* Sequência, melhor dia e melhor horário */
  gHabitos: async function () {
    var sq = await Estat.sequencia();
    Estat.$('stSeqAtual').textContent = sq.atual; Estat.$('stSeqMaior').textContent = sq.maior;
    var f = Estat.filtradas(), porDia = [0, 0, 0, 0, 0, 0, 0], minDia = [0, 0, 0, 0, 0, 0, 0];
    var faixas = [{ n: 'Madrugada', a: 0, b: 4 }, { n: 'Manhã', a: 5, b: 11 }, { n: 'Tarde', a: 12, b: 17 }, { n: 'Noite', a: 18, b: 23 }], porFaixa = [0, 0, 0, 0], minFaixa = [0, 0, 0, 0];
    f.forEach(function (x) {
      var w = Estat.dow(x.d); porDia[w]++; minDia[w] += x.min;
      var h = Estat.hora(x.s.inicio);
      faixas.forEach(function (fx, k) { if (h >= fx.a && h <= fx.b) { porFaixa[k]++; minFaixa[k] += x.min; } });
    });
    var melhor = function (n, m) { var b = -1; n.forEach(function (v, i) { if (v > 0 && (b < 0 || m[i] > m[b] || (m[i] === m[b] && v > n[b]))) b = i; }); return b; };
    var bd = melhor(porDia, minDia), bf = melhor(porFaixa, minFaixa);
    Estat.$('stMelhorDia').textContent = bd >= 0 ? 'Seu dia mais forte é ' + Estat.DIA_LONGO[bd] + ' (' + porDia[bd] + (porDia[bd] === 1 ? ' treino, ' : ' treinos, ') + Dados.fmtNum(minDia[bd], 0) + ' min).' : 'Sem treinos no período.';
    Estat.$('stMelhorHora').textContent = bf >= 0 ? 'Você treina mais de ' + faixas[bf].n.toLowerCase() + ' (' + porFaixa[bf] + (porFaixa[bf] === 1 ? ' treino).' : ' treinos).') : '';
    var ordem = [1, 2, 3, 4, 5, 6, 0];
    Estat.vazio('cvDiaSemana', !f.length); Estat.vazio('cvHorario', !f.length);
    Estat.grafico('cvDiaSemana', { type: 'bar', data: { labels: ordem.map(function (i) { return Estat.DIA[i]; }), datasets: [{ label: 'Treinos', data: ordem.map(function (i) { return porDia[i]; }), backgroundColor: Estat.COR.p }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    Estat.grafico('cvHorario', { type: 'bar', data: { labels: faixas.map(function (x) { return x.n; }), datasets: [{ label: 'Treinos', data: porFaixa, backgroundColor: Estat.COR.a }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    return { seq: sq, porDia: porDia, porFaixa: porFaixa, melhorDia: bd, melhorFaixa: bf };
  },

  /* Esforço e humor */
  gEsforcoHumor: function () {
    var f = Estat.filtradas().slice().reverse().filter(function (x) { return x.s.rpe || x.s.humor; });
    Estat.vazio('cvEsforco', !f.length);
    Estat.grafico('cvEsforco', { type: 'line', data: { labels: f.map(function (x) { return Estat.br(x.d); }), datasets: [
      { label: 'Esforço (1–10)', data: f.map(function (x) { return x.s.rpe || null; }), borderColor: Estat.COR.r, backgroundColor: Estat.COR.r, yAxisID: 'y', spanGaps: true },
      { label: 'Humor (1–5)', data: f.map(function (x) { return x.s.humor || null; }), borderColor: Estat.COR.p, backgroundColor: Estat.COR.p, yAxisID: 'y1', spanGaps: true }] },
      options: { scales: { y: { min: 0, max: 10, position: 'left' }, y1: { min: 0, max: 5, position: 'right', grid: { drawOnChartArea: false } } } } });
    // humor × duração do treino
    var fx = [{ n: 'Até 19 min', a: 0, b: 19.99 }, { n: '20 a 39 min', a: 20, b: 39.99 }, { n: '40 a 59 min', a: 40, b: 59.99 }, { n: '60 min ou mais', a: 60, b: 1e9 }];
    var soma = fx.map(function () { return 0; }), n = fx.map(function () { return 0; });
    Estat.filtradas().forEach(function (x) {
      if (!x.s.humor || !(x.min > 0)) return;
      fx.forEach(function (g, k) { if (x.min >= g.a && x.min <= g.b) { soma[k] += x.s.humor; n[k]++; } });
    });
    var medias = soma.map(function (v, k) { return n[k] ? Estat.r1(v / n[k]) : null; });
    var tem = n.some(function (v) { return v > 0; });
    Estat.vazio('cvHumorDur', !tem);
    Estat.$('stHumorTxt').textContent = tem ? 'Humor médio (1 a 5) depois de treinos de cada duração. É só um retrato dos seus registros.' : '';
    Estat.grafico('cvHumorDur', { type: 'bar', data: { labels: fx.map(function (g) { return g.n; }), datasets: [{ label: 'Humor médio', data: medias, backgroundColor: Estat.COR.v }] }, options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 5 } } } });
    return { medias: medias, n: n };
  },

  /* Peso corporal */
  gPeso: function () {
    var ps = Dados.pesagens;
    Estat.vazio('cvPeso', ps.length < 1);
    Estat.grafico('cvPeso', { type: 'line', data: { labels: ps.map(function (p) { return Estat.br(p.data); }), datasets: [{ label: 'Peso (kg)', data: ps.map(function (p) { return p.peso_kg; }), borderColor: Estat.COR.c, backgroundColor: Estat.COR.c, tension: 0.2, pointRadius: 4 }] }, options: { plugins: { legend: { display: false } } } });
    Estat.$('listaPeso').innerHTML = ps.slice().reverse().slice(0, 8).map(function (p) {
      return '<div class="list-group-item d-flex justify-content-between align-items-center py-1"><span>' + Estat.brAno(p.data) + ' — <strong>' + Dados.fmtNum(p.peso_kg, 1) + ' kg</strong>' + (p.pendente ? ' <span class="badge text-bg-warning">pendente</span>' : '') +
        '</span><button class="btn btn-sm btn-outline-danger" data-del-peso="' + p.data + '" aria-label="Excluir pesagem de ' + Estat.brAno(p.data) + '"><i class="fa-solid fa-trash"></i></button></div>';
    }).join('');
  },
  salvarPeso: async function (ev) {
    ev.preventDefault();
    var data = Estat.$('pgData').value, kg = Number(Estat.$('pgKg').value);
    if (!data || data > Estat.hoje()) return Util.toast('Informe uma data válida (não pode ser no futuro).', 'erro');
    if (!(kg > 0 && kg < 500)) return Util.toast('Informe um peso entre 1 e 499 kg.', 'erro');
    await Dados.salvarPesagem(data, Math.round(kg * 10) / 10);
    Estat.$('pgKg').value = '';
    Util.toast('Pesagem salva.', 'ok');
  },

  /* Recordes pessoais */
  metricasItem: function (i, ex) {
    return {
      reps: i.reps > 0 ? i.reps : 0, carga: i.carga_kg > 0 ? i.carga_kg : 0, dist: i.distancia_km > 0 ? i.distancia_km : 0,
      ritmo: (i.distancia_km >= 0.5 && i.duracao_seg > 0) ? i.duracao_seg / i.distancia_km : 0,
      tempo: ex.modo === 'tempo' && i.duracao_seg > 0 ? i.duracao_seg : 0
    };
  },
  NOMES_REC: { reps: 'repetições', carga: 'carga', dist: 'distância', ritmo: 'melhor ritmo', tempo: 'maior tempo' },
  fmtRec: function (k, v) {
    return k === 'reps' ? v + ' reps' : k === 'carga' ? Dados.fmtNum(v) + ' kg' : k === 'dist' ? Dados.fmtNum(v, 2) + ' km' : k === 'ritmo' ? Dados.fmtRitmo(v) : Dados.fmtDur(v);
  },
  recordes: function () {
    var melhor = {};
    Dados.sessoes.forEach(function (s) {
      var d = Estat.dataDe(s);
      (s.itens || []).forEach(function (i) {
        var ex = Dados.exMap[i.exercicio_id]; if (!ex) return;
        var m = Estat.metricasItem(i, ex);
        Object.keys(m).forEach(function (k) {
          var v = m[k]; if (!(v > 0)) return;
          var chave = i.exercicio_id + '|' + k, atual = melhor[chave];
          var melhorou = !atual || (k === 'ritmo' ? v < atual.v : v > atual.v) || (v === atual.v && d < atual.d);
          if (melhorou) melhor[chave] = { v: v, d: d, ex: ex, k: k };
        });
      });
    });
    var porEx = {};
    Object.keys(melhor).forEach(function (c) { var r = melhor[c]; (porEx[r.ex.id] = porEx[r.ex.id] || { ex: r.ex, marcas: [] }).marcas.push(r); });
    return Object.keys(porEx).map(function (id) { return porEx[id]; }).sort(function (a, b) { return a.ex.nome.localeCompare(b.ex.nome, 'pt-BR'); });
  },
  gRecordes: function () {
    var lista = Estat.recordes();
    Estat.$('stRecordes').innerHTML = lista.length ? lista.map(function (r) {
      return '<div class="list-group-item"><div class="fw-semibold">' + Util.esc(r.ex.icone) + ' ' + Util.esc(r.ex.nome) + '</div><div class="small">' +
        r.marcas.map(function (m) { return '<span class="me-3">' + Estat.NOMES_REC[m.k] + ': <strong>' + Estat.fmtRec(m.k, m.v) + '</strong> <span class="text-body-secondary">(' + Estat.brAno(m.d) + ')</span></span>'; }).join('') + '</div></div>';
    }).join('') : '<div class="list-group-item text-body-secondary small">Seus recordes aparecem aqui conforme você registra treinos.</div>';
    return lista;
  },

  /* Retrospectiva do mês e do ano */
  intervaloRetro: function (tipo) {
    var h = Estat.hoje(), a = Number(h.slice(0, 4)), m = Number(h.slice(5, 7)), p2 = function (n) { return String(n).padStart(2, '0'); };
    var fimMes = function (ano, mes) { return ano + '-' + p2(mes) + '-' + p2(new Date(Date.UTC(ano, mes, 0)).getUTCDate()); };
    if (tipo === 'mes_atual') return { de: a + '-' + p2(m) + '-01', ate: fimMes(a, m), nome: 'este mês' };
    if (tipo === 'mes_anterior') { var ma = m === 1 ? 12 : m - 1, aa = m === 1 ? a - 1 : a; return { de: aa + '-' + p2(ma) + '-01', ate: fimMes(aa, ma), nome: 'o mês passado' }; }
    if (tipo === 'ano_atual') return { de: a + '-01-01', ate: a + '-12-31', nome: 'este ano' };
    return { de: (a - 1) + '-01-01', ate: (a - 1) + '-12-31', nome: 'o ano passado' };
  },
  contarRecordes: function (de, ate) {
    var melhor = {}, n = 0;
    Dados.sessoes.slice().reverse().forEach(function (s) {
      var d = Estat.dataDe(s);
      (s.itens || []).forEach(function (i) {
        var ex = Dados.exMap[i.exercicio_id]; if (!ex) return;
        var m = Estat.metricasItem(i, ex);
        Object.keys(m).forEach(function (k) {
          var v = m[k]; if (!(v > 0)) return;
          var c = i.exercicio_id + '|' + k, ant = melhor[c];
          if (ant !== undefined && (k === 'ritmo' ? v < ant : v > ant) && d >= de && d <= ate) n++;
          if (ant === undefined || (k === 'ritmo' ? v < ant : v > ant)) melhor[c] = v;
        });
      });
    });
    return n;
  },
  retrospectiva: function (tipo) {
    var iv = Estat.intervaloRetro(tipo);
    var ss = Dados.sessoes.filter(function (s) { var d = Estat.dataDe(s); return d >= iv.de && d <= iv.ate; });
    var dias = {}, min = 0, km = 0, reps = 0, kcal = 0, cont = {}, semanas = {};
    ss.forEach(function (s) {
      var d = Estat.dataDe(s), mm = Estat.minutos(s); dias[d] = 1; min += mm; kcal += s.calorias || 0;
      var sem = Estat.segunda(d); semanas[sem] = (semanas[sem] || 0) + mm;
      (s.itens || []).forEach(function (i) {
        km += i.distancia_km || 0; reps += i.reps ? (i.series || 1) * i.reps : 0;
        cont[i.exercicio_id] = (cont[i.exercicio_id] || 0) + 1;
      });
    });
    var topId = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; })[0];
    var melhorSem = Object.keys(semanas).sort(function (a, b) { return semanas[b] - semanas[a]; })[0];
    var r = { nome: iv.nome, treinos: ss.length, diasTreinados: Object.keys(dias).length, minutos: Math.round(min), km: Estat.r1(km * 10) / 10, reps: reps, kcal: Math.round(kcal),
      maisFeito: topId && Dados.exMap[topId] ? Dados.exMap[topId].nome + ' (' + cont[topId] + 'x)' : null,
      melhorSemana: melhorSem ? 'semana de ' + Estat.br(melhorSem) + ' (' + Dados.fmtNum(semanas[melhorSem], 0) + ' min)' : null,
      recordes: Estat.contarRecordes(iv.de, iv.ate) };
    return r;
  },
  gRetro: function () {
    var r = Estat.retrospectiva(Estat.$('stRetro').value), box = Estat.$('stRetroConteudo');
    if (!r.treinos) { box.innerHTML = '<p class="text-body-secondary mb-0">Nenhum treino registrado em ' + r.nome + '.</p>'; return r; }
    var num = function (v, t) { return '<div class="col-6 col-md-4"><div class="retro-num">' + v + '</div><div class="small text-body-secondary">' + t + '</div></div>'; };
    box.innerHTML = '<div class="row g-3">' + num(r.treinos, r.treinos === 1 ? 'treino' : 'treinos') + num(r.diasTreinados, 'dias treinados') + num(Dados.fmtNum(r.minutos, 0), 'minutos ativos') +
      (r.km ? num(Dados.fmtNum(r.km, 1), 'km percorridos') : '') + (r.reps ? num(Dados.fmtNum(r.reps, 0), 'repetições') : '') + (r.kcal ? num(Dados.fmtNum(r.kcal, 0), 'kcal estimadas') : '') +
      num(r.recordes, r.recordes === 1 ? 'recorde pessoal' : 'recordes pessoais') + '</div>' +
      '<p class="mt-3 mb-0 small">' + (r.maisFeito ? 'Exercício mais feito: <strong>' + Util.esc(r.maisFeito) + '</strong>. ' : '') + (r.melhorSemana ? 'Melhor semana: <strong>' + Util.esc(r.melhorSemana) + '</strong>.' : '') + '</p>';
    return r;
  },

  /* ---------- tela ---------- */
  preencherFiltroExercicio: function () {
    var sel = Estat.$('stExercicio'), atual = sel.value, usados = {};
    Dados.sessoes.forEach(function (s) { (s.itens || []).forEach(function (i) { usados[i.exercicio_id] = 1; }); });
    sel.innerHTML = '<option value="">Todos os exercícios</option>' + Dados.ex.filter(function (e) { return usados[e.id]; })
      .map(function (e) { return '<option value="' + Util.esc(e.id) + '">' + Util.esc(e.nome) + '</option>'; }).join('');
    if (atual && usados[atual]) sel.value = atual;
  },
  render: async function () {
    if (!Util.userId) return;
    Estat.$('boxStPers').classList.toggle('d-none', Estat.$('stPeriodo').value !== 'custom');
    var p = Estat.periodo();
    if (p.de && p.ate && p.de > p.ate) return Util.toast('A data inicial precisa ser anterior à final.', 'erro');
    Estat.gMinutos(); Estat.gSessoesSemana(); Estat.gCalor(); Estat.gDistribuicao();
    Estat.gEvolucao(); Estat.gBike(); await Estat.gHabitos(); Estat.gEsforcoHumor();
    Estat.gPeso(); Estat.gRecordes(); Estat.gRetro();
  },
  aoAbrir: function () {
    Estat.preencherFiltroExercicio(); Estat.preencherEvolucao();
    if (!Estat.$('pgData').value) Estat.$('pgData').value = Estat.hoje();
    Estat.render();
  },
  init: function () {
    var $ = Estat.$;
    ['stPeriodo', 'stExercicio', 'stDe', 'stAte', 'stGran', 'stRetro'].forEach(function (id) { $(id).addEventListener('change', Estat.render); });
    $('stExEvo').addEventListener('change', function () { Estat.preencherMetricas(); Estat.gEvolucao(); });
    $('stMetrica').addEventListener('change', Estat.gEvolucao);
    $('frmPeso').addEventListener('submit', Estat.salvarPeso);
    $('listaPeso').addEventListener('click', async function (e) {
      var b = e.target.closest('[data-del-peso]'); if (!b) return;
      if (await Util.confirmar('Excluir esta pesagem?', 'Excluir')) { await Dados.excluirPesagem(b.getAttribute('data-del-peso')); }
    });
    document.addEventListener('tema:mudou', function () { if (!$('appShell').classList.contains('d-none') && !document.querySelector('[data-pagina="estatisticas"]').classList.contains('d-none')) Estat.render(); });
    document.addEventListener('dados:atualizados', function () {
      if (document.querySelector('[data-pagina="estatisticas"]').classList.contains('d-none')) return;
      Estat.preencherFiltroExercicio(); Estat.preencherEvolucao(); Estat.render();
    });
  }
};

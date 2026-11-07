/* Conquistas: medalhas, nível/XP e mensagem do dia. Tudo é calculado com os dados do aparelho;
   o que for novo é gravado na tabela "conquistas" quando houver internet (e só então comemora). */
var Conquistas = {
  _rodando: false, _pedido: false, _timer: null, _fila: [],
  $: function (id) { return document.getElementById(id); },
  TITULOS: ['Iniciante', 'Praticante', 'Dedicado', 'Constante', 'Forte', 'Atleta', 'Veterano', 'Mestre', 'Lenda'],

  /* [código, nome, descrição, ícone, nível da medalha, categoria, função → [atual, alvo]] */
  defs: function () {
    var M = [], add = function (c, n, d, i, nv, cat, f) { M.push({ cod: c, nome: n, desc: d, icone: i, nv: nv, cat: cat, f: f }); };
    add('primeiro_treino', 'Primeiro passo', 'Registrar seu primeiro treino', 'fa-shoe-prints', 'bronze', 'Treinos', function (x) { return [x.n, 1]; });
    add('treinos_7', '7 treinos', 'Registrar 7 treinos', 'fa-dumbbell', 'bronze', 'Treinos', function (x) { return [x.n, 7]; });
    add('treinos_30', '30 treinos', 'Registrar 30 treinos', 'fa-dumbbell', 'prata', 'Treinos', function (x) { return [x.n, 30]; });
    add('treinos_100', '100 treinos', 'Registrar 100 treinos', 'fa-dumbbell', 'ouro', 'Treinos', function (x) { return [x.n, 100]; });
    [[7, 'bronze'], [21, 'prata'], [60, 'ouro'], [100, 'ouro']].forEach(function (a) {
      add('seq_' + a[0], a[0] + ' dias seguidos', 'Treinar ' + a[0] + ' dias em sequência', 'fa-fire', a[1], 'Constância', function (x) { return [x.seq, a[0]]; });
    });
    [[10, 'bronze'], [50, 'prata'], [100, 'ouro'], [250, 'ouro']].forEach(function (a) {
      add('horas_' + a[0], a[0] + ' horas', 'Acumular ' + a[0] + ' horas de treino', 'fa-clock', a[1], 'Tempo', function (x) { return [Math.floor(x.min / 60), a[0]]; });
    });
    [[100, 'bronze'], [500, 'prata'], [1000, 'ouro']].forEach(function (a) {
      add('km_' + a[0], a[0] + ' km', 'Acumular ' + a[0] + ' km (caminhada, corrida e pedal)', 'fa-route', a[1], 'Distância', function (x) { return [Math.floor(x.km), a[0]]; });
    });
    add('flexoes_1000', '1.000 flexões', 'Acumular 1.000 flexões', 'fa-hand-fist', 'prata', 'Repetições', function (x) { return [x.flex, 1000]; });
    add('abdominais_1000', '1.000 abdominais', 'Acumular 1.000 abdominais', 'fa-child-reaching', 'prata', 'Repetições', function (x) { return [x.abd, 1000]; });
    add('agachamentos_1000', '1.000 agachamentos', 'Acumular 1.000 agachamentos', 'fa-person-walking', 'prata', 'Repetições', function (x) { return [x.agach, 1000]; });
    add('polichinelos_1000', '1.000 polichinelos', 'Acumular 1.000 polichinelos', 'fa-person-running', 'prata', 'Repetições', function (x) { return [x.poli, 1000]; });
    add('recorde_1', 'Superação', 'Bater um recorde pessoal', 'fa-trophy', 'bronze', 'Recordes', function (x) { return [x.rec, 1]; });
    add('recorde_10', 'Superação ×10', 'Bater 10 recordes pessoais', 'fa-trophy', 'prata', 'Recordes', function (x) { return [x.rec, 10]; });
    add('meta_1', 'Meta cumprida', 'Cumprir uma meta', 'fa-bullseye', 'bronze', 'Metas', function (x) { return [x.metas, 1]; });
    add('meta_5', '5 metas cumpridas', 'Cumprir 5 metas', 'fa-bullseye', 'prata', 'Metas', function (x) { return [x.metas, 5]; });
    add('meta_20', '20 metas cumpridas', 'Cumprir 20 metas', 'fa-bullseye', 'ouro', 'Metas', function (x) { return [x.metas, 20]; });
    add('bingo_linha', 'Primeira linha', 'Completar uma linha, coluna ou diagonal no bingo', 'fa-table-cells', 'bronze', 'Bingo', function (x) { return [x.linhas, 1]; });
    add('bingo_1', 'Cartela cheia', 'Completar uma cartela de bingo', 'fa-table-cells-large', 'prata', 'Bingo', function (x) { return [x.cartelas, 1]; });
    add('bingo_5', '5 cartelas', 'Completar 5 cartelas de bingo', 'fa-table-cells-large', 'ouro', 'Bingo', function (x) { return [x.cartelas, 5]; });
    add('tres_ambientes', 'Casa, rua e academia', 'Treinar nos 3 ambientes na mesma semana', 'fa-map-location-dot', 'prata', 'Variedade', function (x) { return [x.tres ? 1 : 0, 1]; });
    add('bike_10h', 'Pedal de 10 horas', 'Acumular 10 horas na bicicleta ergométrica', 'fa-bicycle', 'bronze', 'Bicicleta', function (x) { return [Math.floor(x.bikeMin / 60), 10]; });
    add('bike_100km', 'Pedal de 100 km', 'Acumular 100 km na bicicleta ergométrica', 'fa-bicycle', 'prata', 'Bicicleta', function (x) { return [Math.floor(x.bikeKm), 100]; });
    add('bike_500km', 'Pedal de 500 km', 'Acumular 500 km na bicicleta ergométrica', 'fa-bicycle', 'ouro', 'Bicicleta', function (x) { return [Math.floor(x.bikeKm), 500]; });
    return M;
  },

  contexto: function () {
    var ses = Dados.sessoes.slice().sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });
    var x = { n: ses.length, min: 0, km: 0, flex: 0, abd: 0, agach: 0, poli: 0, rec: 0, bikeMin: 0, bikeKm: 0, seq: 0, metas: 0, linhas: 0, cartelas: 0, tres: false };
    var max = {};
    ses.forEach(function (s) {
      x.min += Estat.minutos(s);
      (s.itens || []).forEach(function (i) {
        var nome = Bingo.nomeNorm(i), e = Dados.exMap[i.exercicio_id], r = Bingo.reps(i);
        x.km += i.distancia_km || 0;
        if (nome.indexOf('flexao') >= 0) x.flex += r;
        if (nome.indexOf('abdominal') >= 0) x.abd += r;
        if (nome.indexOf('agachamento') >= 0) x.agach += r;
        if (nome.indexOf('polichinelo') >= 0) x.poli += r;
        if (nome.indexOf('bicicleta ergometrica') >= 0 || (e && e.campos_bike)) { x.bikeMin += (i.duracao_seg || 0) / 60; x.bikeKm += i.distancia_km || 0; }
      });
      var feito = false; // recorde: no máximo um por exercício em cada sessão
      (s.itens || []).forEach(function (i) {
        var m = max[i.exercicio_id] = max[i.exercicio_id] || { reps: 0, carga_kg: 0, distancia_km: 0 }, bateu = false;
        ['reps', 'carga_kg', 'distancia_km'].forEach(function (f) { var v = i[f] || 0; if (v > 0) { if (m[f] > 0 && v > m[f]) bateu = true; if (v > m[f]) m[f] = v; } });
        if (bateu) x.rec++;
      });
    });
    var set = {}; ses.forEach(function (s) { set[Estat.dataDe(s)] = 1; });
    x.seq = Estat.corridas(Object.keys(set).sort(), Dados.descanso(), Estat.hoje()).maior;
    if (Dados.seqServidor && Dados.seqServidor.maior > x.seq) x.seq = Dados.seqServidor.maior;
    x.metas = Dados.metasProg.filter(function (p) { return p.cumprida_em; }).length;
    var w = Bingo.semanas(ses); x.tres = Object.keys(w).some(function (a) { return Object.keys(w[a].amb).length >= 3; });
    var est = Bingo.todos(); x.bingoPts = 0;
    est.forEach(function (e) { x.linhas += e.linhasOn.length; if (e.cheia || e.c.concluida_em) x.cartelas++; x.bingoPts += e.pontos; });
    return x;
  },
  /* medalhas com situação: { d, atual, alvo, ok, em } */
  medalhas: function (x) {
    var srv = {}; Dados.conquistas.forEach(function (c) { srv[c.codigo] = c; });
    return Conquistas.defs().map(function (d) {
      var f = d.f(x), ok = f[0] >= f[1] || !!srv[d.cod];
      return { d: d, atual: Math.min(f[0], f[1]), alvo: f[1], ok: ok, gravada: !!srv[d.cod], em: srv[d.cod] ? srv[d.cod].desbloqueada_em : null };
    });
  },
  xp: function (x, ms) { return Math.round(x.min) + 10 * x.n + x.bingoPts + 25 * ms.filter(function (m) { return m.ok; }).length; },
  nivel: function (xp) {
    var L = Math.floor(Math.sqrt(xp / 60)) + 1, base = 60 * (L - 1) * (L - 1), prox = 60 * L * L;
    return { n: L, titulo: Conquistas.TITULOS[Math.min(L, Conquistas.TITULOS.length) - 1], xp: xp, base: base, prox: prox, pct: Math.round((xp - base) / (prox - base) * 100) };
  },

  /* grava as medalhas novas (só online) e devolve itens para comemorar */
  verificar: async function () {
    var itens = [];
    if (!Bingo.online() || !Dados.bingoCarregado) return itens;
    var x = Conquistas.contexto(), ms = Conquistas.medalhas(x), mudou = false;
    for (var k = 0; k < ms.length; k++) {
      var m = ms[k]; if (!m.ok || m.gravada) continue;
      var r = await Supa.client.from('conquistas').insert({ codigo: m.d.cod }).select().single();
      if (r.error) { if (r.error.code === '23505') mudou = true; continue; }
      await Api.db.conquistas.put(r.data); mudou = true;
      itens.push({ icone: m.d.icone, titulo: 'Medalha: ' + m.d.nome, texto: m.d.desc });
    }
    if (mudou) await Dados.carregarLocal();
    return itens;
  },

  ciclo: async function () {
    if (!Util.userId || !Dados.bingoCarregado) return;
    if (Conquistas._rodando) { Conquistas._pedido = true; return; }
    Conquistas._rodando = true;
    try {
      for (var v = 0; v < 4; v++) {
        Conquistas._pedido = false;
        var itens = [];
        await Bingo.garantirMensal();
        itens = itens.concat((await Bingo.persistir()).itens);
        itens = itens.concat(await Conquistas.verificar());
        if (itens.length) Conquistas.celebrar(itens);
        if (!Conquistas._pedido) break;
      }
    } catch (e) { /* tenta de novo no próximo ciclo */ }
    finally { Conquistas._rodando = false; }
    Conquistas.render();
  },

  celebrar: function (itens) {
    Conquistas._fila = Conquistas._fila.concat(itens);
    Conquistas._mostrar();
  },
  _mostrar: function () {
    if (!Conquistas._fila.length) return;
    if (document.querySelector('.modal.show')) { setTimeout(Conquistas._mostrar, 700); return; }
    var itens = Conquistas._fila; Conquistas._fila = [];
    Conquistas.$('listaConquista').innerHTML = itens.map(function (i) {
      return '<li class="list-group-item d-flex gap-3 align-items-center"><span class="medalha-ico nv-ouro"><i class="fa-solid ' + i.icone + '"></i></span><div><div class="fw-semibold">' + Util.esc(i.titulo) + '</div><div class="small text-body-secondary">' + Util.esc(i.texto) + '</div></div></li>';
    }).join('');
    bootstrap.Modal.getOrCreateInstance(Conquistas.$('modalConquista')).show();
    Util.confete();
  },

  MENSAGENS: [
    'Cada treino conta, do mais curto ao mais longo.', 'Hoje, o importante é se mexer do seu jeito.', 'Constância vale mais que intensidade.',
    'Um alongamento também é um treino.', 'Respeitar o descanso faz parte do progresso.', 'Seu corpo agradece cada passo de hoje.',
    'Comece pequeno: 10 minutos já mudam o dia.', 'Beba água e vá no seu ritmo.', 'Progresso se mede em semanas, não em um dia.',
    'Sem pressa e sem culpa: o que importa é voltar.', 'Escolha algo de que você goste e aproveite.', 'Hoje vale caminhada, bike ou o que der vontade.',
    'Ouça seu corpo: ele diz quando apertar e quando aliviar.', 'Pequenos hábitos, grandes resultados.'
  ],
  mensagem: function () {
    var rec = Dados.sessoes.slice(0, 3), rpe = rec.length ? rec.reduce(function (a, s) { return a + (s.rpe || 0); }, 0) / rec.length : 0;
    var sq = Estat.sequenciaLocal(Dados.sessoes);
    if (sq.atual >= 7 && rpe >= 8) return 'Você está em uma boa sequência com esforço alto. Que tal um treino leve ou um dia de descanso hoje?';
    var d = Math.floor(Date.parse(Estat.hoje() + 'T12:00:00Z') / 86400000);
    return Conquistas.MENSAGENS[d % Conquistas.MENSAGENS.length];
  },

  render: function () {
    if (!Util.userId || !Conquistas.$('cqMedalhas')) return;
    var x = Conquistas.contexto(), ms = Conquistas.medalhas(x), xp = Conquistas.xp(x, ms), n = Conquistas.nivel(xp), $ = Conquistas.$;
    var ganhas = ms.filter(function (m) { return m.ok; }).length;
    $('cqNivelNum').textContent = n.n; $('cqNivelTitulo').textContent = n.titulo;
    $('cqXp').textContent = xp + ' XP · faltam ' + (n.prox - xp) + ' para o nível ' + (n.n + 1);
    $('cqXpBarra').style.width = n.pct + '%'; $('cqXpBarra').parentNode.setAttribute('aria-valuenow', n.pct);
    $('cqResumo').innerHTML = '<span><strong>' + ganhas + '</strong>/' + ms.length + ' medalhas</span><span><strong>' + x.cartelas + '</strong> cartelas</span><span><strong>' + x.linhas + '</strong> linhas</span><span><strong>' + x.rec + '</strong> recordes</span>';
    $('cqMsg').textContent = Conquistas.mensagem();
    var cats = [], por = {};
    ms.forEach(function (m) { if (!por[m.d.cat]) { por[m.d.cat] = []; cats.push(m.d.cat); } por[m.d.cat].push(m); });
    $('cqMedalhas').innerHTML = cats.map(function (c) {
      return '<h2 class="h6 mt-3 mb-2">' + c + '</h2><div class="row g-2">' + por[c].map(function (m) {
        var pct = Math.round(m.atual / m.alvo * 100);
        return '<div class="col-6 col-md-4 col-lg-3"><div class="medalha' + (m.ok ? ' ganha' : '') + '" title="' + Util.esc(m.d.desc) + '">' +
          '<span class="medalha-ico nv-' + m.d.nv + '"><i class="fa-solid ' + (m.ok ? m.d.icone : 'fa-lock') + '"></i></span>' +
          '<div class="medalha-nome">' + Util.esc(m.d.nome) + '</div><div class="medalha-desc">' + Util.esc(m.d.desc) + '</div>' +
          (m.ok ? (m.em ? '<div class="medalha-data">' + Estat.brAno(Dados.tzData(m.em)) + '</div>' : '') :
            '<div class="progress mt-1" style="height:4px" role="progressbar" aria-label="Progresso" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:' + pct + '%"></div></div><div class="medalha-data">' + Dados.fmtNum(m.atual, 0) + ' / ' + Dados.fmtNum(m.alvo, 0) + '</div>') +
          '</div></div>';
      }).join('') + '</div>';
    }).join('');
    // painel da página Início
    if ($('pnNivel')) {
      $('pnNivel').textContent = 'Nível ' + n.n + ' · ' + n.titulo; $('pnNivelBarra').style.width = n.pct + '%';
      var c = Bingo.escolhida(), e = c ? Bingo.estado(c) : null;
      $('pnBingo').innerHTML = e ? '<span class="fw-semibold">' + e.marcadas + '/25</span> casas · ' + e.linhasOn.length + (e.linhasOn.length === 1 ? ' linha' : ' linhas') : 'Sem cartela ainda';
    }
  },

  init: function () {
    document.addEventListener('dados:atualizados', function () {
      Conquistas.render();
      clearTimeout(Conquistas._timer); Conquistas._timer = setTimeout(Conquistas.ciclo, 500);
    });
  },
  aoAbrir: function () { Conquistas.render(); Conquistas.ciclo(); }
};

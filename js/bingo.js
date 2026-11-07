/* Bingo de desafios (cartela 5×5). Casas automáticas são avaliadas aqui com os treinos do aparelho (funciona offline);
   o que for novo é gravado no banco quando houver internet. Pontuação, linhas e cartela cheia são sempre derivadas das casas marcadas. */
var Bingo = {
  sel: null, _vistas: {}, _criando: false,
  $: function (id) { return document.getElementById(id); },
  MESES: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  LINHAS: (function () {
    var l = [], i, j, a, b, d1 = [], d2 = [];
    for (i = 0; i < 5; i++) { a = []; b = []; for (j = 0; j < 5; j++) { a.push(i * 5 + j); b.push(j * 5 + i); } l.push(a, b); d1.push(i * 6); d2.push(4 + i * 4); }
    l.push(d1, d2); return l;
  })(),
  online: function () { return navigator.onLine && !!Util.userId; },

  /* ---------- avaliação das regras ---------- */
  nomeNorm: function (i) { var e = Dados.exMap[i.exercicio_id]; return e ? Util.semAcento(e.nome).toLowerCase() : ''; },
  serve: function (i, k) { if (!k || !k.length) return true; var n = Bingo.nomeNorm(i); return k.some(function (w) { return n.indexOf(w) >= 0; }); },
  reps: function (i) { return (i.reps || 0) * (i.series || 1); },
  contexto: function (c) {
    var fim = c.fim || '9999-12-31';
    var ses = Dados.sessoes.filter(function (s) { var d = Estat.dataDe(s); return d >= c.inicio && d <= fim; })
      .sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });
    return { c: c, ses: ses };
  },
  semanas: function (ses, filtro) {
    var m = {};
    ses.forEach(function (s) { var d = Estat.dataDe(s), w = Estat.segunda(d); if (!filtro || filtro(s)) { (m[w] = m[w] || { dias: {}, amb: {} }); m[w].dias[d] = 1; if (s.ambiente) m[w].amb[s.ambiente] = 1; } });
    return m;
  },
  avaliar: function (r, x) {
    var ses = x.ses, ok = false, sid = null, k = r.k;
    var cada = function (fn) { ses.forEach(function (s) { if (!ok && fn(s)) { ok = true; sid = s.id; } }); };
    var itens = function (s) { return s.itens || []; };
    switch (r.t) {
      case 'seq': {
        var set = {}; ses.forEach(function (s) { set[Estat.dataDe(s)] = 1; });
        ok = Estat.corridas(Object.keys(set).sort(), Dados.descanso(), Estat.hoje()).maior >= r.n; break;
      }
      case 'semana': {
        var w = Bingo.semanas(ses, function (s) { return !k || itens(s).some(function (i) { return Bingo.serve(i, k); }); });
        ok = Object.keys(w).some(function (a) { return Object.keys(w[a].dias).length >= r.n; }); break;
      }
      case 'fds': { var ds = {}; ses.forEach(function (s) { ds[Estat.dataDe(s)] = 1; }); ok = Object.keys(ds).some(function (d) { return Estat.dow(d) === 6 && ds[Estat.addDias(d, 1)]; }); break; }
      case 'ambs3': { var wa = Bingo.semanas(ses); ok = Object.keys(wa).some(function (a) { return Object.keys(wa[a].amb).length >= 3; }); break; }
      case 'antes': cada(function (s) { return Estat.hora(s.inicio) < r.h; }); break;
      case 'depois': cada(function (s) { return Estat.hora(s.inicio) >= r.h; }); break;
      case 'sessoes': ok = ses.length >= r.n; break;
      case 'minutos': ok = ses.reduce(function (a, s) { return a + Estat.minutos(s); }, 0) >= r.n; break;
      case 'reps_sessao': cada(function (s) { return itens(s).reduce(function (a, i) { return a + (Bingo.serve(i, k) ? Bingo.reps(i) : 0); }, 0) >= r.n; }); break;
      case 'reps_dia': {
        var pd = {}; ses.forEach(function (s) { var d = Estat.dataDe(s); itens(s).forEach(function (i) { if (Bingo.serve(i, k)) pd[d] = (pd[d] || 0) + Bingo.reps(i); }); });
        ok = Object.keys(pd).some(function (d) { return pd[d] >= r.n; }); break;
      }
      case 'tempo_item': cada(function (s) { return itens(s).some(function (i) { return Bingo.serve(i, k) && (i.duracao_seg || 0) >= r.seg; }); }); break;
      case 'min_item': cada(function (s) { return itens(s).reduce(function (a, i) { return a + (Bingo.serve(i, k) ? (i.duracao_seg || 0) : 0); }, 0) >= r.min * 60; }); break;
      case 'dist_item': cada(function (s) { return itens(s).some(function (i) { return Bingo.serve(i, k) && (i.distancia_km || 0) >= r.km; }); }); break;
      case 'tem': cada(function (s) { return itens(s).some(function (i) { return Bingo.serve(i, k); }); }); break;
      case 'amb': cada(function (s) { return s.ambiente === r.v; }); break;
      case 'resist': cada(function (s) { return itens(s).some(function (i) { return (i.resistencia || 0) >= r.n; }); }); break;
      case 'tipo': cada(function (s) { return itens(s).some(function (i) { return i.tipo_treino === r.v && Bingo.serve(i, k); }); }); break;
      case 'rpe': cada(function (s) { return (s.rpe || 0) >= r.n; }); break;
      case 'novo': cada(function (s) {
        var antes = Dados.sessoes.filter(function (o) { return new Date(o.inicio) < new Date(s.inicio); });
        if (!antes.length) return false;
        return itens(s).some(function (i) { return !antes.some(function (o) { return itens(o).some(function (j) { return j.exercicio_id === i.exercicio_id; }); }); });
      }); break;
      case 'recorde': cada(function (s) {
        return itens(s).some(function (i) {
          var prev = []; Dados.sessoes.forEach(function (o) { if (new Date(o.inicio) < new Date(s.inicio)) itens(o).forEach(function (j) { if (j.exercicio_id === i.exercicio_id) prev.push(j); }); });
          if (!prev.length) return false;
          return ['reps', 'carga_kg', 'distancia_km'].some(function (f) {
            var mx = Math.max.apply(null, prev.map(function (j) { return j[f] || 0; }));
            return (i[f] || 0) > 0 && mx > 0 && i[f] > mx;
          });
        });
      }); break;
      case 'meta': {
        var fim = x.c.fim || '9999-12-31';
        ok = Dados.metasProg.some(function (p) { if (!p.cumprida_em) return false; var d = Dados.tzData(p.cumprida_em); return d >= x.c.inicio && d <= fim; }); break;
      }
    }
    return { ok: ok, sid: sid };
  },

  /* ---------- estado derivado de uma cartela ---------- */
  casasDe: function (id) { return Dados.casas.filter(function (c) { return c.cartela_id === id; }).sort(function (a, b) { return a.posicao - b.posicao; }); },
  estado: function (c) {
    var hoje = Estat.hoje(), casas = Bingo.casasDe(c.id), ativa = !c.concluida_em && (!c.fim || c.fim >= hoje), x = null;
    var itens = casas.map(function (casa) {
      var gravada = !!casa.marcada_em, auto = false, sid = null;
      if (!gravada && ativa && casa.regra) { x = x || Bingo.contexto(c); var r = Bingo.avaliar(casa.regra, x); auto = r.ok; sid = r.sid; }
      return { casa: casa, gravada: gravada, auto: auto, sid: sid, on: gravada || auto };
    });
    var por = {}; itens.forEach(function (i) { por[i.casa.posicao] = i; });
    var linhas = function (campo) {
      var out = []; Bingo.LINHAS.forEach(function (l, n) { if (l.every(function (p) { return por[p] && por[p][campo]; })) out.push(n); }); return out;
    };
    var linhasOn = linhas('on'), cheia = itens.length === 25 && itens.every(function (i) { return i.on; });
    var pontos = itens.reduce(function (a, i) { return a + (i.on ? i.casa.pontos : 0); }, 0) + linhasOn.length * BINGO_DADOS.BONUS_LINHA + (cheia ? BINGO_DADOS.BONUS_CARTELA : 0);
    return { c: c, ativa: ativa, itens: itens, por: por, linhasOn: linhasOn, linhasGravadas: linhas('gravada'), cheia: cheia, marcadas: itens.filter(function (i) { return i.on; }).length, pontos: pontos };
  },
  todos: function () { return Dados.cartelas.map(Bingo.estado); },
  pontosTotais: function () { return Bingo.todos().reduce(function (a, e) { return a + e.pontos; }, 0); },

  /* ---------- servidor ---------- */
  puxar: async function (id) {
    var a = await Supa.client.from('bingo_cartelas').select('*').eq('id', id).single(); if (a.error) throw a.error;
    var b = await Supa.client.from('bingo_casas').select('*').eq('cartela_id', id); if (b.error) throw b.error;
    await Api.db.bingo_cartelas.put(a.data); await Api.db.bingo_casas.where('cartela_id').equals(id).delete(); await Api.db.bingo_casas.bulkPut(b.data);
  },
  embaralhar: function (v) { v = v.slice(); for (var i = v.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = v[i]; v[i] = v[j]; v[j] = t; } return v; },
  nivelAtual: function () {
    var ini = Estat.addDias(Estat.hoje(), -29), n = Dados.sessoes.filter(function (s) { return Estat.dataDe(s) >= ini; }).length;
    return n < 8 ? 'iniciante' : (n < 16 ? 'intermediario' : 'avancado');
  },
  gerar: function (nivel, tema) {
    var D = BINGO_DADOS, mix = D.NIVEIS[nivel].mix, usados = {}, ultima = Dados.cartelas.slice().sort(function (a, b) { return new Date(b.criada_em) - new Date(a.criada_em); })[0];
    if (ultima) Bingo.casasDe(ultima.id).forEach(function (c) { usados[c.desafio_id] = 1; });
    var esc = {}, lista = [];
    var tomar = function (d) { if (!esc[d.id]) { esc[d.id] = 1; lista.push(d); } };
    ['f', 'm', 'd'].forEach(function (dif) {
      var falta = mix[dif], tentativas = [
        function (d) { return d.tags.indexOf(tema) >= 0 && !usados[d.id]; },
        function (d) { return d.tags.indexOf(tema) >= 0; },
        function (d) { return !usados[d.id]; },
        function () { return true; }
      ];
      tentativas.forEach(function (f) {
        Bingo.embaralhar(D.DESAFIOS.filter(function (d) { return d.d === dif && !esc[d.id] && f(d); })).forEach(function (d) {
          if (falta > 0) { tomar(d); falta--; }
        });
      });
    });
    Bingo.embaralhar(D.DESAFIOS).forEach(function (d) { if (lista.length < 24) tomar(d); });
    lista = Bingo.embaralhar(lista).slice(0, 24);
    var casas = [], k = 0;
    for (var p = 0; p < 25; p++) {
      if (p === 12) { casas.push({ posicao: 12, desafio_id: 'livre', titulo: 'Casa livre', dificuldade: 'livre', pontos: 0, regra: null }); continue; }
      var d = lista[k++];
      casas.push({ posicao: p, desafio_id: d.id, titulo: d.t, dificuldade: D.DIF[d.d], pontos: D.PONTOS[d.d], regra: d.r || null });
    }
    return casas;
  },
  criar: async function (o) {
    if (!Bingo.online()) throw new Error('Sem internet: conecte-se para criar uma cartela.');
    var id = await Api.rpc('criar_cartela', { p: { titulo: o.titulo, tipo: o.tipo, tema: o.tema || null, nivel: o.nivel, mes: o.mes || null, fim: o.fim || null, casas: Bingo.gerar(o.nivel, o.tema || 'geral') } });
    await Bingo.puxar(id); await Dados.carregarLocal();
    return id;
  },
  garantirMensal: async function () {
    if (!Dados.bingoCarregado || !Bingo.online() || Bingo._criando) return false;
    var hoje = Estat.hoje(), mes = hoje.slice(0, 7) + '-01';
    if (Dados.cartelas.some(function (c) { return c.tipo === 'mensal' && c.mes === mes; })) return false;
    Bingo._criando = true;
    try {
      var a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7)), pa = m === 12 ? a + 1 : a, pm = m === 12 ? 1 : m + 1;
      var fim = Estat.addDias(pa + '-' + String(pm).padStart(2, '0') + '-01', -1);
      await Bingo.criar({ titulo: 'Bingo de ' + Bingo.MESES[m - 1] + ' de ' + a, tipo: 'mensal', nivel: Bingo.nivelAtual(), mes: mes, fim: fim, tema: 'geral' });
      return true;
    } catch (e) {
      if (e && e.code === '23505') { try { await Bingo.baixar(); } catch (e2) {} }
      return false;
    } finally { Bingo._criando = false; }
  },
  baixar: async function () { await Dados.sincronizar(); },

  /* Grava no banco o que ficou novo: casas automáticas, cartela concluída. Devolve os itens para comemorar. */
  persistir: async function () {
    var itens = [], mudou = false;
    if (!Bingo.online() || !Dados.bingoCarregado) return { itens: itens, mudou: false };
    var est = Bingo.todos();
    // linhas já gravadas antes deste ciclo (referência silenciosa para cartelas ainda não vistas)
    est.forEach(function (e) { if (!Bingo._vistas[e.c.id]) Bingo._vistas[e.c.id] = e.linhasGravadas.slice(); });
    for (var a = 0; a < est.length; a++) {
      var e = est[a];
      for (var b = 0; b < e.itens.length; b++) {
        var it = e.itens[b]; if (!it.auto) continue;
        var campos = { marcada_em: new Date().toISOString(), origem: 'auto', sessao_id: it.sid || null };
        var r = await Supa.client.from('bingo_casas').update(campos).eq('id', it.casa.id).select().single();
        if (r.error) continue;
        await Api.db.bingo_casas.put(r.data); mudou = true;
        itens.push({ icone: 'fa-square-check', titulo: 'Casa marcada!', texto: it.casa.titulo + ' (+' + it.casa.pontos + ' pontos)' });
      }
    }
    if (mudou) await Dados.carregarLocal();
    // linhas novas e cartela cheia (valem também para marcações manuais)
    var est2 = Bingo.todos();
    for (var c = 0; c < est2.length; c++) {
      var f = est2[c], antes = Bingo._vistas[f.c.id] || [];
      var novas = f.linhasGravadas.filter(function (n) { return antes.indexOf(n) < 0; });
      Bingo._vistas[f.c.id] = f.linhasGravadas.slice();
      if (novas.length) itens.push({ icone: 'fa-grip-lines', titulo: novas.length > 1 ? novas.length + ' linhas completas!' : 'Linha completa!', texto: f.c.titulo + ' (+' + (novas.length * BINGO_DADOS.BONUS_LINHA) + ' pontos de bônus)' });
      if (!f.c.concluida_em && f.itens.length === 25 && f.itens.every(function (i) { return i.gravada; })) {
        var rc = await Supa.client.from('bingo_cartelas').update({ concluida_em: new Date().toISOString() }).eq('id', f.c.id).select().single();
        if (!rc.error) { await Api.db.bingo_cartelas.put(rc.data); mudou = true; itens.push({ icone: 'fa-trophy', titulo: 'Cartela cheia!', texto: f.c.titulo + ' (+' + BINGO_DADOS.BONUS_CARTELA + ' pontos de bônus)' }); }
      }
    }
    if (mudou) await Dados.carregarLocal();
    return { itens: itens, mudou: mudou };
  },

  /* ---------- ações do usuário ---------- */
  marcar: async function (casaId, marcar) {
    if (!Bingo.online()) throw new Error('Sem internet: conecte-se para marcar manualmente.');
    var campos = marcar ? { marcada_em: new Date().toISOString(), origem: 'manual' } : { marcada_em: null, origem: null, sessao_id: null };
    var r = await Supa.client.from('bingo_casas').update(campos).eq('id', casaId).select().single();
    if (r.error) throw r.error;
    await Api.db.bingo_casas.put(r.data); await Dados.carregarLocal();
  },
  trocar: async function (casa, cartela) {
    if (!Bingo.online()) throw new Error('Sem internet: conecte-se para trocar o desafio.');
    var D = BINGO_DADOS, dif = casa.dificuldade, letra = dif === 'facil' ? 'f' : (dif === 'medio' ? 'm' : 'd');
    var naCartela = {}; Bingo.casasDe(cartela.id).forEach(function (c) { naCartela[c.desafio_id] = 1; });
    var tema = cartela.tema || 'geral';
    var pool = D.DESAFIOS.filter(function (d) { return d.d === letra && !naCartela[d.id]; });
    var pref = pool.filter(function (d) { return d.tags.indexOf(tema) >= 0; });
    var esc = Bingo.embaralhar(pref.length ? pref : pool)[0];
    if (!esc) throw new Error('Não há outro desafio disponível nesta dificuldade.');
    await Api.rpc('trocar_casa', { p_casa: casa.id, p: { desafio_id: esc.id, titulo: esc.t, dificuldade: D.DIF[esc.d], pontos: D.PONTOS[esc.d], regra: esc.r || null } });
    await Bingo.puxar(cartela.id); await Dados.carregarLocal();
    return esc;
  },

  /* ---------- tela ---------- */
  escolhida: function () {
    var cs = Dados.cartelas.slice().sort(function (a, b) { return new Date(b.criada_em) - new Date(a.criada_em); });
    if (Bingo.sel && cs.some(function (c) { return c.id === Bingo.sel; })) return cs.filter(function (c) { return c.id === Bingo.sel; })[0];
    var mes = Estat.hoje().slice(0, 7) + '-01';
    return cs.filter(function (c) { return c.tipo === 'mensal' && c.mes === mes; })[0] || cs.filter(function (c) { return !c.concluida_em; })[0] || cs[0] || null;
  },
  rotuloEstado: function (e) { return e.c.concluida_em ? 'concluída' : (e.ativa ? 'em andamento' : 'encerrada'); },
  render: function () {
    if (!Util.userId || !Bingo.$('bgGrade')) return;
    var cs = Dados.cartelas.slice().sort(function (a, b) { return new Date(b.criada_em) - new Date(a.criada_em); });
    var vazio = Bingo.$('bgVazio'), corpo = Bingo.$('bgCorpo');
    var c = Bingo.escolhida(); Bingo.sel = c ? c.id : null;
    vazio.classList.toggle('d-none', !!c); corpo.classList.toggle('d-none', !c);
    if (!c) {
      Bingo.$('bgVazioTxt').textContent = Bingo.online() ? (Dados.bingoCarregado ? 'Sua cartela do mês será criada automaticamente. Se preferir, crie agora.' : 'Carregando…') : 'Conecte-se à internet para criar sua primeira cartela.';
      return;
    }
    var sel = Bingo.$('bgSelect');
    sel.innerHTML = cs.map(function (k) { var e = Bingo.estado(k); return '<option value="' + k.id + '"' + (k.id === c.id ? ' selected' : '') + '>' + Util.esc(k.titulo) + ' — ' + Bingo.rotuloEstado(e) + '</option>'; }).join('');
    var e = Bingo.estado(c), hoje = Estat.hoje();
    var prazo = c.concluida_em ? 'Concluída em ' + Estat.brAno(Dados.tzData(c.concluida_em)) : (c.fim ? (e.ativa ? 'Até ' + Estat.brAno(c.fim) + ' · ' + (Estat.dif(hoje, c.fim) === 0 ? 'último dia' : 'faltam ' + Estat.dif(hoje, c.fim) + ' dias') : 'Encerrada em ' + Estat.brAno(c.fim)) : 'Sem prazo');
    var tema = BINGO_DADOS.TEMAS[c.tema];
    Bingo.$('bgResumo').innerHTML =
      '<div class="d-flex flex-wrap gap-3 align-items-end mb-2">' +
      '<div><div class="painel-num">' + e.marcadas + '<span class="fs-5 text-body-secondary">/25</span></div><div class="small text-body-secondary">casas</div></div>' +
      '<div><div class="fw-semibold fs-5">' + e.pontos + '</div><div class="small text-body-secondary">pontos</div></div>' +
      '<div><div class="fw-semibold fs-5">' + e.linhasOn.length + '</div><div class="small text-body-secondary">linhas</div></div>' +
      '<div><div class="fw-semibold fs-5">' + (3 - c.trocas) + '</div><div class="small text-body-secondary">trocas restantes</div></div></div>' +
      '<div class="progress mb-2" role="progressbar" aria-label="Casas marcadas" aria-valuenow="' + e.marcadas + '" aria-valuemin="0" aria-valuemax="25"><div class="progress-bar" style="width:' + (e.marcadas * 4) + '%"></div></div>' +
      '<div class="small text-body-secondary">' + (tema ? '<i class="fa-solid ' + tema.icone + ' me-1"></i>' + Util.esc(tema.nome) + ' · ' : '') + 'nível ' + Util.esc((BINGO_DADOS.NIVEIS[c.nivel] || {}).nome || c.nivel) + ' · ' + prazo + '</div>';
    var emLinha = {}; e.linhasOn.forEach(function (n) { Bingo.LINHAS[n].forEach(function (p) { emLinha[p] = 1; }); });
    Bingo.$('bgGrade').innerHTML = e.itens.map(function (it) {
      var cl = 'bingo-casa dif-' + it.casa.dificuldade + (it.on ? ' on' : '') + (emLinha[it.casa.posicao] ? ' linha' : '');
      var pts = it.casa.dificuldade === 'livre' ? '<i class="fa-solid fa-star"></i>' : '<span class="bg-pts">' + it.casa.pontos + '</span>';
      return '<button type="button" class="' + cl + '" data-casa="' + it.casa.id + '" aria-label="' + Util.esc(it.casa.titulo) + (it.on ? ' (feito)' : '') + '">' +
        '<span class="bg-txt">' + Util.esc(it.casa.titulo) + '</span>' + pts + (it.on ? '<i class="fa-solid fa-circle-check bg-ok"></i>' : '') + '</button>';
    }).join('');
    if (e.itens.length !== 25) Bingo.$('bgGrade').innerHTML = '<div class="text-body-secondary small p-3" style="grid-column:1/-1">Carregando as casas desta cartela… conecte-se à internet para sincronizar.</div>';
    Bingo.$('bgAviso').classList.toggle('d-none', Bingo.online());
  },

  abrirCasa: function (id) {
    var c = Bingo.escolhida(); if (!c) return; var e = Bingo.estado(c), it = e.itens.filter(function (x) { return x.casa.id === id; })[0]; if (!it) return;
    var casa = it.casa, nomes = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', livre: 'Casa livre' };
    var estado = it.on ? (it.gravada ? 'Feito' + (casa.origem === 'manual' ? ' (marcado por você)' : '') : 'Feito — será salvo quando houver internet') : 'Ainda não feito';
    var dica = casa.dificuldade === 'livre' ? 'Brinde da cartela: já vem marcada.' : (casa.regra ? 'Marca sozinha quando você registrar um treino que cumpra isso.' : 'O app não consegue medir isso: marque você mesmo quando fizer.');
    Bingo.$('bcTitulo').textContent = casa.titulo;
    Bingo.$('bcInfo').innerHTML = '<div class="mb-1"><span class="badge text-bg-secondary me-1">' + nomes[casa.dificuldade] + '</span>' + (casa.pontos ? '<span class="badge text-bg-light border">' + casa.pontos + ' pontos</span>' : '') + '</div>' +
      '<p class="mb-1 mt-2">' + Util.esc(estado) + '</p><p class="small text-body-secondary mb-0">' + dica + '</p>';
    var bt = '';
    var manualOk = e.ativa && !casa.regra && casa.dificuldade !== 'livre';
    if (manualOk && !it.gravada) bt += '<button type="button" class="btn btn-primary" data-acao="marcar"><i class="fa-solid fa-check me-1"></i>Marcar como feito</button>';
    if (manualOk && it.gravada && casa.origem === 'manual') bt += '<button type="button" class="btn btn-outline-secondary" data-acao="desmarcar"><i class="fa-solid fa-rotate-left me-1"></i>Desfazer</button>';
    if (e.ativa && !it.on && casa.dificuldade !== 'livre' && c.trocas < 3) bt += '<button type="button" class="btn btn-outline-primary" data-acao="trocar"><i class="fa-solid fa-shuffle me-1"></i>Trocar desafio (' + (3 - c.trocas) + ' restantes)</button>';
    Bingo.$('bcAcoes').innerHTML = bt; Bingo.$('bcAcoes').setAttribute('data-casa', id);
    bootstrap.Modal.getOrCreateInstance(Bingo.$('modalCasa')).show();
  },

  init: function () {
    var $ = Bingo.$;
    $('bgSelect').addEventListener('change', function () { Bingo.sel = this.value; Bingo.render(); });
    $('bgGrade').addEventListener('click', function (ev) { var b = ev.target.closest('[data-casa]'); if (b) Bingo.abrirCasa(b.getAttribute('data-casa')); });
    $('bcAcoes').addEventListener('click', async function (ev) {
      var b = ev.target.closest('[data-acao]'); if (!b) return;
      var id = this.getAttribute('data-casa'), c = Bingo.escolhida(), casa = Dados.casas.filter(function (x) { return x.id === id; })[0];
      var modal = bootstrap.Modal.getOrCreateInstance($('modalCasa')); b.disabled = true;
      try {
        if (b.getAttribute('data-acao') === 'marcar') { await Bingo.marcar(id, true); modal.hide(); Util.toast('Casa marcada.', 'ok'); }
        if (b.getAttribute('data-acao') === 'desmarcar') { await Bingo.marcar(id, false); modal.hide(); }
        if (b.getAttribute('data-acao') === 'trocar') {
          if (!(await Util.confirmar('Trocar este desafio por outro da mesma dificuldade? Cada cartela permite 3 trocas.', 'Trocar'))) { b.disabled = false; return; }
          var novo = await Bingo.trocar(casa, c); modal.hide(); Util.toast('Novo desafio: ' + novo.t, 'ok');
        }
      } catch (e) { b.disabled = false; Util.toast(/Sem internet/.test(e.message || '') ? e.message : 'Não foi possível concluir: ' + ((e && e.message) || e), 'erro'); }
    });
    $('btnNovaCartela').addEventListener('click', function () {
      $('ncTema').innerHTML = Object.keys(BINGO_DADOS.TEMAS).map(function (k) { return '<option value="' + k + '">' + BINGO_DADOS.TEMAS[k].nome + '</option>'; }).join('');
      $('ncNivel').innerHTML = Object.keys(BINGO_DADOS.NIVEIS).map(function (k) { return '<option value="' + k + '">' + BINGO_DADOS.NIVEIS[k].nome + '</option>'; }).join('');
      $('ncNivel').value = Bingo.nivelAtual();
      bootstrap.Modal.getOrCreateInstance($('modalNovaCartela')).show();
    });
    $('frmNovaCartela').addEventListener('submit', async function (ev) {
      ev.preventDefault(); var btn = $('btnCriarCartela'); btn.disabled = true;
      try {
        var tema = $('ncTema').value, tt = BINGO_DADOS.TEMAS[tema].nome;
        var id = await Bingo.criar({ titulo: ($('ncTitulo').value.trim() || ('Bingo: ' + tt)).slice(0, 80), tipo: 'tematica', tema: tema, nivel: $('ncNivel').value });
        Bingo.sel = id; $('ncTitulo').value = '';
        bootstrap.Modal.getOrCreateInstance($('modalNovaCartela')).hide(); Bingo.render(); Util.toast('Cartela criada!', 'ok');
      } catch (e) { Util.toast(/Sem internet/.test(e.message || '') ? e.message : 'Não foi possível criar a cartela.', 'erro'); }
      finally { btn.disabled = false; }
    });
    $('btnCriarAgora').addEventListener('click', async function () {
      this.disabled = true; try { await Bingo.garantirMensal(); Bingo.render(); } finally { this.disabled = false; }
    });
    document.addEventListener('dados:atualizados', Bingo.render);
  },
  aoAbrir: function () { Bingo.render(); Conquistas.ciclo(); }
};

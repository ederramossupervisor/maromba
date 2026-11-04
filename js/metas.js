/* Metas e dias de descanso. Datas em AAAA-MM-DD, fuso America/Sao_Paulo. */
var Metas = {
  _verificando: false,
  TIPOS: {
    frequencia: 'Frequência (número de treinos)', tempo: 'Tempo ativo (minutos)', distancia: 'Distância (km)',
    repeticoes: 'Repetições acumuladas', calorias: 'Calorias estimadas (kcal)', sequencia: 'Sequência de dias', marco: 'Marco de recorde'
  },
  UNID: { frequencia: 'treinos', tempo: 'min', distancia: 'km', repeticoes: 'reps', calorias: 'kcal', sequencia: 'dias' },
  METRICAS: { reps: 'Repetições seguidas', carga: 'Carga (kg)', dist: 'Distância (km)', tempo: 'Tempo (minutos)' },
  $: function (id) { return document.getElementById(id); },
  esc: function (s) { return Util.esc(s); },

  /* ---------- períodos ---------- */
  fimMes: function (d) { var a = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); },
  limites: function (m, ref) {
    if (m.periodo === 'dia') return { ini: ref, fim: ref };
    if (m.periodo === 'semana') { var s = Estat.segunda(ref); return { ini: s, fim: Estat.addDias(s, 6) }; }
    if (m.periodo === 'mes') return { ini: ref.slice(0, 7) + '-01', fim: Metas.fimMes(ref) };
    if (m.periodo === 'ano') return { ini: ref.slice(0, 4) + '-01-01', fim: ref.slice(0, 4) + '-12-31' };
    return { ini: m.data_ini, fim: m.data_fim || null };
  },
  anterior: function (m, ini) { return Metas.limites(m, Estat.addDias(ini, -1)); },
  recorrente: function (m) { return m.periodo !== 'livre'; },
  criadaEm: function (m) { return Dados.tzData(m.criada_em); },
  nomePeriodo: function (m) {
    return { dia: 'por dia', semana: 'por semana', mes: 'no mês', ano: 'no ano' }[m.periodo] ||
      (m.data_fim ? 'de ' + Estat.br(m.data_ini) + ' a ' + Estat.br(m.data_fim) : 'a partir de ' + Estat.br(m.data_ini));
  },
  rotuloPeriodo: function (m, lim) {
    if (m.periodo === 'dia') return lim.ini === Estat.hoje() ? 'Hoje' : Estat.brAno(lim.ini);
    if (m.periodo === 'semana') return 'Semana de ' + Estat.br(lim.ini) + ' a ' + Estat.br(lim.fim);
    if (m.periodo === 'mes') return lim.ini.slice(5, 7) + '/' + lim.ini.slice(0, 4);
    if (m.periodo === 'ano') return lim.ini.slice(0, 4);
    return Estat.br(lim.ini) + (lim.fim ? ' a ' + Estat.br(lim.fim) : ' em diante');
  },

  /* ---------- título automático ---------- */
  titulo: function (m) {
    var ex = m.exercicio_id && Dados.exMap[m.exercicio_id], onde = ex ? ex.nome : (m.categoria ? Dados.CAT[m.categoria] : ''), p = Metas.nomePeriodo(m), n = Dados.fmtNum(m.alvo, 2);
    var com = onde ? ' (' + onde + ')' : '';
    if (m.tipo === 'frequencia') return 'Treinar ' + n + (Number(m.alvo) === 1 ? ' vez ' : ' vezes ') + p + com + (m.min_sessao_min ? ', ao menos ' + m.min_sessao_min + ' min cada' : '');
    if (m.tipo === 'tempo') return n + ' minutos ' + p + com;
    if (m.tipo === 'distancia') return n + ' km ' + p + com;
    if (m.tipo === 'repeticoes') return n + ' ' + (ex ? ex.nome.toLowerCase() : 'repetições') + ' ' + p;
    if (m.tipo === 'calorias') return n + ' kcal ' + p;
    if (m.tipo === 'sequencia') return m.modo_seq === 'consecutivos' ? 'Treinar ' + n + ' dias seguidos' : 'Nunca ficar mais de ' + n + ' dias sem treinar (' + p + ')';
    return (ex ? ex.nome : 'Exercício') + ': chegar a ' + Metas.fmtMarco(m.metrica, m.alvo);
  },
  fmtMarco: function (metrica, v) {
    if (metrica === 'reps') return Dados.fmtNum(v, 0) + ' repetições seguidas';
    if (metrica === 'carga') return Dados.fmtNum(v, 1) + ' kg';
    if (metrica === 'dist') return Dados.fmtNum(v, 2) + ' km';
    return Dados.fmtDur(v);
  },

  /* ---------- valores ---------- */
  itensDe: function (m, s) {
    return (s.itens || []).filter(function (i) {
      var ex = Dados.exMap[i.exercicio_id];
      if (m.exercicio_id && i.exercicio_id !== m.exercicio_id) return false;
      if (m.categoria && (!ex || ex.categoria !== m.categoria)) return false;
      return true;
    });
  },
  sessaoVale: function (m, s) {
    if (m.ambiente && s.ambiente !== m.ambiente) return false;
    if ((m.exercicio_id || m.categoria) && !Metas.itensDe(m, s).length) return false;
    return true;
  },
  minutosDe: function (m, s) {
    if (m.exercicio_id) return Estat.minutos(s, m.exercicio_id);
    if (m.categoria) {
      var seg = Metas.itensDe(m, s).reduce(function (a, i) { return a + (i.duracao_seg || 0); }, 0);
      return seg > 0 ? seg / 60 : Estat.minutos(s);
    }
    return Estat.minutos(s);
  },
  sessoesEm: function (ini, fim) {
    return Dados.sessoes.filter(function (s) { var d = Estat.dataDe(s); return d >= ini && (!fim || d <= fim); });
  },
  valorAditivo: function (m, ini, fim) {
    var ss = Metas.sessoesEm(ini, fim).filter(function (s) { return Metas.sessaoVale(m, s); }), t = 0;
    ss.forEach(function (s) {
      if (m.tipo === 'frequencia') { if (!m.min_sessao_min || Metas.minutosDe(m, s) >= m.min_sessao_min) t++; }
      else if (m.tipo === 'tempo') t += Metas.minutosDe(m, s);
      else if (m.tipo === 'calorias') t += s.calorias || 0;
      else Metas.itensDe(m, s).forEach(function (i) {
        if (m.tipo === 'distancia') t += i.distancia_km || 0;
        else if (m.tipo === 'repeticoes' && i.reps > 0) t += (i.series || 1) * i.reps;
      });
    });
    return Math.round(t * 100) / 100;
  },
  valorMarco: function (m) {
    var melhor = 0;
    Dados.sessoes.forEach(function (s) {
      (s.itens || []).forEach(function (i) {
        if (i.exercicio_id !== m.exercicio_id) return;
        var v = m.metrica === 'reps' ? i.reps : m.metrica === 'carga' ? i.carga_kg : m.metrica === 'dist' ? i.distancia_km : i.duracao_seg;
        if (v > melhor) melhor = v;
      });
    });
    return melhor;
  },
  /* Sequência: "consecutivos" = maior corrida no período; "max_intervalo" = maior intervalo sem treinar (descanso não conta). */
  valorSequencia: function (m, ini, fim, hoje) {
    var desc = Dados.descanso(), set = {};
    var limite = (fim && fim < hoje) ? fim : hoje;
    Metas.sessoesEm(ini, limite).forEach(function (s) { set[Estat.dataDe(s)] = 1; });
    if (m.modo_seq === 'consecutivos') return Estat.corridas(Object.keys(set).sort(), desc, hoje).maior;
    // o dia de hoje só conta como falta depois que acabar (se ainda não treinou hoje)
    if (limite === hoje && !set[hoje]) limite = Estat.addDias(hoje, -1);
    var gap = 0, maior = 0;
    for (var d = ini; d <= limite; d = Estat.addDias(d, 1)) {
      if (set[d]) gap = 0;
      else if (desc.indexOf(Estat.dow(d)) < 0) { gap++; if (gap > maior) maior = gap; }
    }
    return maior;
  },

  /* Avalia uma meta num período (padrão: o período atual). */
  avaliar: function (m, ref) {
    var hoje = Estat.hoje(), r = { m: m, unid: Metas.UNID[m.tipo] || '' };
    var alvo = Number(m.alvo), lim = Metas.limites(m, ref || hoje);
    r.ini = lim.ini; r.fim = lim.fim; r.alvo = alvo;
    r.futuro = lim.ini > hoje;
    r.encerrado = !!lim.fim && lim.fim < hoje;
    if (m.tipo === 'marco') {
      r.valor = Metas.valorMarco(m); r.unid = '';
      r.cumprida = r.valor >= alvo; r.encerrado = false;
    } else if (m.tipo === 'sequencia') {
      r.valor = r.futuro ? 0 : Metas.valorSequencia(m, lim.ini, lim.fim, hoje);
      if (m.modo_seq === 'consecutivos') r.cumprida = r.valor >= alvo;
      else { r.quebrou = r.valor > alvo; r.cumprida = r.encerrado && !r.quebrou; }
    } else {
      r.valor = r.futuro ? 0 : Metas.valorAditivo(m, lim.ini, r.encerrado ? lim.fim : hoje);
      r.cumprida = r.valor >= alvo;
    }
    r.pct = alvo > 0 ? Math.min(100, Math.round(r.valor / alvo * 100)) : 0;
    r.falta = Math.max(0, alvo - r.valor);
    var aditivo = ['frequencia', 'tempo', 'distancia', 'repeticoes', 'calorias'].indexOf(m.tipo) >= 0;
    if (lim.fim && !r.encerrado && !r.futuro) {
      r.restantes = Estat.dif(hoje, lim.fim) + 1;
      if (aditivo && r.restantes > 0 && r.falta > 0) r.porDia = r.falta / r.restantes;
      if (m.tipo === 'sequencia' && m.modo_seq === 'max_intervalo') r.pct = Math.round((Estat.dif(lim.ini, hoje) + 1) / (Estat.dif(lim.ini, lim.fim) + 1) * 100);
    }
    // situação
    if (r.cumprida) r.situacao = 'cumprida';
    else if (m.tipo === 'sequencia' && m.modo_seq === 'max_intervalo') r.situacao = r.quebrou ? 'quebrada' : 'em_dia';
    else if (r.encerrado) r.situacao = 'nao_cumprida';
    else if (r.futuro) r.situacao = 'futura';
    else if (aditivo && lim.fim && m.periodo !== 'dia') {
      var total = Estat.dif(lim.ini, lim.fim) + 1, decorridos = Estat.dif(lim.ini, hoje) + 1;
      if (decorridos < 2) r.situacao = 'no_ritmo';
      else { var ratio = r.valor / (alvo * decorridos / total); r.situacao = ratio >= 1.1 ? 'adiantado' : ratio >= 0.9 ? 'no_ritmo' : 'atrasado'; }
    } else r.situacao = 'andamento';
    return r;
  },
  SITUACAO: {
    cumprida: ['Cumprida', 'success'], adiantado: ['Adiantado', 'success'], no_ritmo: ['No ritmo', 'primary'], atrasado: ['Atrasado', 'warning'],
    nao_cumprida: ['Não cumprida', 'secondary'], andamento: ['Em andamento', 'primary'], futura: ['Ainda não começou', 'secondary'],
    em_dia: ['Em dia', 'success'], quebrada: ['Intervalo estourado', 'warning']
  },
  fmtVal: function (r, v) {
    if (r.m.tipo === 'marco') return Metas.fmtMarco(r.m.metrica, v);
    return Dados.fmtNum(v, r.m.tipo === 'distancia' || r.m.tipo === 'tempo' ? 1 : 0) + ' ' + r.unid;
  },
  texto: function (r) {
    var m = r.m, t;
    if (m.tipo === 'sequencia' && m.modo_seq === 'max_intervalo') {
      t = 'Maior intervalo sem treinar: ' + r.valor + (r.valor === 1 ? ' dia' : ' dias') + ' (limite ' + Dados.fmtNum(r.alvo, 0) + ')';
      if (r.restantes) t += ' · ' + r.restantes + (r.restantes === 1 ? ' dia restante' : ' dias restantes');
      return t;
    }
    if (m.tipo === 'sequencia') return 'Melhor sequência no período: ' + r.valor + ' de ' + Dados.fmtNum(r.alvo, 0) + ' dias';
    t = Metas.fmtVal(r, r.valor) + ' de ' + Metas.fmtVal(r, r.alvo);
    if (m.tipo === 'marco') return 'Seu melhor registro: ' + Metas.fmtMarco(m.metrica, r.valor) + ' · meta: ' + Metas.fmtMarco(m.metrica, r.alvo);
    if (!r.cumprida && !r.encerrado && !r.futuro) {
      t += ' · faltam ' + Metas.fmtVal(r, r.falta);
      if (r.porDia) t += ' · precisa de ' + Dados.fmtNum(r.porDia, m.tipo === 'frequencia' ? 1 : 0) + ' ' + r.unid + '/dia (' + r.restantes + (r.restantes === 1 ? ' dia restante)' : ' dias restantes)');
    }
    return t;
  },

  /* ---------- sugestão e aviso de progressão ---------- */
  mediaSemanal: function (tipo) {
    var hoje = Estat.hoje(), segAtual = Estat.segunda(hoje), primeira = null;
    Dados.sessoes.forEach(function (s) { var d = Estat.dataDe(s); if (!primeira || d < primeira) primeira = d; });
    if (!primeira) return null;
    var inicio = Estat.addDias(segAtual, -28), p1 = Estat.segunda(primeira);
    if (p1 > inicio) inicio = p1;
    var semanas = Estat.dif(inicio, segAtual) / 7;
    if (semanas < 1) return null;
    var fake = { tipo: tipo };
    return Metas.valorAditivo(fake, inicio, Estat.addDias(segAtual, -1)) / semanas;
  },
  sugestao: function (tipo, periodo) {
    if (periodo !== 'semana' || (tipo !== 'tempo' && tipo !== 'frequencia')) return null;
    var media = Metas.mediaSemanal(tipo);
    if (media == null || media <= 0) return tipo === 'tempo'
      ? { valor: 150, texto: 'Sugestão inicial: 150 minutos por semana (referência da Organização Mundial da Saúde).' }
      : { valor: 3, texto: 'Sugestão inicial: 3 treinos por semana.' };
    var alvo = tipo === 'tempo' ? Math.max(10, Math.floor(media * 1.1 / 5) * 5) : Math.max(1, Math.floor(media * 1.1 + 1e-9));
    return { valor: alvo, media: media, texto: 'Nas últimas semanas você fez em média ' + Dados.fmtNum(media, 1) + (tipo === 'tempo' ? ' minutos' : ' treinos') + ' por semana. Sugestão (até +10%): ' + alvo + '.' };
  },

  /* ---------- comemoração e registro das metas cumpridas ---------- */
  periodosAteAgora: function (m) {
    var hoje = Estat.hoje();
    if (!Metas.recorrente(m)) return [Metas.limites(m, hoje)];
    var lista = [], lim = Metas.limites(m, hoje), criada = Metas.criadaEm(m);
    for (var k = 0; k < 60 && lim.fim >= criada; k++) { lista.unshift(lim); lim = Metas.anterior(m, lim.ini); }
    return lista;
  },
  verificarCumpridas: async function () {
    if (Metas._verificando || !Util.userId || !navigator.onLine) return;
    Metas._verificando = true;
    try {
      var novas = [], hoje = Estat.hoje();
      for (var i = 0; i < Dados.metas.length; i++) {
        var m = Dados.metas[i]; if (!m.ativa) continue;
        var periodos = Metas.periodosAteAgora(m);
        for (var j = 0; j < periodos.length; j++) {
          var lim = periodos[j], chave = lim.ini;
          if (Dados.metasProg.some(function (p) { return p.meta_id === m.id && p.periodo_inicio === chave; })) continue;
          var r = Metas.avaliar(m, m.periodo === 'livre' ? hoje : lim.ini);
          if (!r.cumprida) continue;
          var atual = lim.ini === Metas.limites(m, hoje).ini;
          var ok = await Dados.registrarProgresso({ meta_id: m.id, periodo_inicio: chave, periodo_fim: lim.fim, valor: r.valor, alvo: r.alvo });
          if (ok && atual) novas.push(r);
        }
      }
      if (novas.length) Metas.celebrar(novas);
    } catch (e) { /* tenta de novo na próxima sincronização */ }
    Metas._verificando = false;
  },
  celebrar: function (lista) {
    Metas.$('listaMetasCumpridas').innerHTML = lista.map(function (r) { return '<li class="list-group-item"><i class="fa-solid fa-bullseye me-1"></i> <strong>' + Metas.esc(r.m.titulo) + '</strong></li>'; }).join('');
    bootstrap.Modal.getOrCreateInstance(Metas.$('modalMetaCumprida')).show();
    Util.confete();
  },

  /* ---------- histórico ---------- */
  historico: function () {
    var linhas = [], hoje = Estat.hoje();
    Dados.metas.forEach(function (m) {
      if (!Metas.recorrente(m)) {
        var r = Metas.avaliar(m);
        var feito = r.cumprida || r.encerrado || Dados.metasProg.some(function (p) { return p.meta_id === m.id; });
        if (feito) linhas.push({ m: m, rotulo: Metas.rotuloPeriodo(m, { ini: r.ini, fim: r.fim }), texto: Metas.texto(r), ok: r.cumprida || Dados.metasProg.some(function (p) { return p.meta_id === m.id; }), fim: r.fim || hoje });
        return;
      }
      var atual = Metas.limites(m, hoje).ini, criada = Metas.criadaEm(m), lim = Metas.anterior(m, atual);
      for (var k = 0; k < 12 && lim.fim >= criada; k++) {
        if (lim.ini >= criada) {
          var rr = Metas.avaliar(m, lim.ini), reg = Dados.metasProg.some(function (p) { return p.meta_id === m.id && p.periodo_inicio === lim.ini; });
          linhas.push({ m: m, rotulo: Metas.rotuloPeriodo(m, lim), texto: Metas.fmtVal(rr, rr.valor) + ' de ' + Metas.fmtVal(rr, rr.alvo), ok: rr.cumprida || reg, fim: lim.fim });
        }
        lim = Metas.anterior(m, lim.ini);
      }
    });
    return linhas.sort(function (a, b) { return a.fim < b.fim ? 1 : -1; }).slice(0, 40);
  },

  /* ---------- tela ---------- */
  cartao: function (m) {
    var r = Metas.avaliar(m), s = Metas.SITUACAO[r.situacao] || ['', 'secondary'];
    var cor = r.situacao === 'quebrada' || r.situacao === 'atrasado' ? 'bg-warning' : (r.cumprida ? 'bg-success' : '');
    var per = m.tipo === 'marco' ? 'Marco de recorde' : (Metas.recorrente(m) ? Metas.rotuloPeriodo(m, { ini: r.ini, fim: r.fim }) : Metas.nomePeriodo(m));
    var filtros = [m.ambiente ? Dados.AMB[m.ambiente] : '', m.categoria ? Dados.CAT[m.categoria] : ''].filter(Boolean).join(' · ');
    return '<div class="card mb-2"><div class="card-body">' +
      '<div class="d-flex justify-content-between align-items-start gap-2"><div><div class="fw-semibold">' + Metas.esc(m.titulo) + '</div>' +
      '<div class="small text-body-secondary">' + Metas.esc(per) + (filtros ? ' · ' + Metas.esc(filtros) : '') + '</div></div>' +
      '<span class="badge text-bg-' + s[1] + '">' + s[0] + '</span></div>' +
      '<div class="progress my-2" role="progressbar" aria-label="Progresso da meta" aria-valuenow="' + r.pct + '" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar ' + cor + '" style="width:' + r.pct + '%">' + r.pct + '%</div></div>' +
      '<div class="small">' + Metas.esc(Metas.texto(r)) + '</div>' +
      '<div class="mt-2 d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-outline-secondary" data-meta-encerrar="' + Metas.esc(m.id) + '">Encerrar</button>' +
      '<button class="btn btn-sm btn-outline-danger" data-meta-excluir="' + Metas.esc(m.id) + '">Excluir</button></div></div></div>';
  },
  render: function () {
    if (!Util.userId || Metas.$('pagMetasLista') === null) return;
    var ativas = Dados.metas.filter(function (m) { return m.ativa; }), enc = Dados.metas.filter(function (m) { return !m.ativa; });
    Metas.$('pagMetasLista').innerHTML = ativas.length ? ativas.map(Metas.cartao).join('')
      : '<div class="card"><div class="card-body text-center text-body-secondary">Você ainda não tem metas. Escolha um atalho abaixo ou toque em “Nova meta”.</div></div>';
    Metas.$('boxEncerradas').classList.toggle('d-none', !enc.length);
    Metas.$('listaEncerradas').innerHTML = enc.map(function (m) {
      return '<div class="list-group-item d-flex justify-content-between align-items-center gap-2"><span class="small">' + Metas.esc(m.titulo) + '</span><span class="btn-group btn-group-sm flex-none">' +
        '<button class="btn btn-outline-primary" data-meta-reativar="' + Metas.esc(m.id) + '">Reativar</button><button class="btn btn-outline-danger" data-meta-excluir="' + Metas.esc(m.id) + '">Excluir</button></span></div>';
    }).join('');
    var h = Metas.historico();
    Metas.$('listaHistoricoMetas').innerHTML = h.length ? h.map(function (x) {
      return '<div class="list-group-item d-flex justify-content-between align-items-center gap-2"><div><div class="small fw-semibold">' + Metas.esc(x.m.titulo) + '</div>' +
        '<div class="small text-body-secondary">' + Metas.esc(x.rotulo) + ' · ' + Metas.esc(x.texto) + '</div></div>' +
        '<span class="badge text-bg-' + (x.ok ? 'success' : 'secondary') + '">' + (x.ok ? '<i class="fa-solid fa-check me-1"></i>Cumprida' : 'Não cumprida') + '</span></div>';
    }).join('') : '<div class="list-group-item small text-body-secondary">O histórico aparece quando o primeiro período terminar.</div>';
    var desc = Dados.descanso();
    document.querySelectorAll('[data-descanso]').forEach(function (c) { c.checked = desc.indexOf(Number(c.getAttribute('data-descanso'))) >= 0; });
  },
  destaque: function () {
    var rs = Dados.metas.filter(function (m) { return m.ativa; }).map(function (m) { return Metas.avaliar(m); })
      .filter(function (r) { return !r.futuro && !r.encerrado; });
    if (!rs.length) return null;
    rs.sort(function (a, b) { return (a.cumprida - b.cumprida) || (b.pct - a.pct); });
    return rs[0];
  },

  /* ---------- formulário da nova meta ---------- */
  atualizarForm: function () {
    var $ = Metas.$, t = $('mtTipo').value, per = $('mtPeriodo').value;
    var seq = t === 'sequencia', marco = t === 'marco';
    $('boxMtPeriodo').classList.toggle('d-none', seq || marco);
    $('boxMtDatas').classList.toggle('d-none', !(seq || (!marco && per === 'livre')));
    $('boxMtSeq').classList.toggle('d-none', !seq);
    $('boxMtMetrica').classList.toggle('d-none', !marco);
    $('boxMtAmbiente').classList.toggle('d-none', seq || marco);
    $('boxMtCategoria').classList.toggle('d-none', seq || marco);
    $('boxMtMinSessao').classList.toggle('d-none', t !== 'frequencia');
    $('mtExercicioRot').textContent = marco ? 'Exercício (obrigatório)' : 'Exercício (opcional)';
    var un = marco ? { reps: 'repetições seguidas', carga: 'kg', dist: 'km', tempo: 'minutos' }[$('mtMetrica').value] : (seq ? 'dias' : Metas.UNID[t]);
    $('mtAlvoRot').textContent = 'Valor da meta (' + un + ')';
    var sg = Metas.sugestao(t, per);
    $('boxMtSugestao').classList.toggle('d-none', !sg);
    if (sg) { $('mtSugestaoTxt').textContent = sg.texto; $('btnUsarSugestao').setAttribute('data-valor', sg.valor); }
  },
  abrirForm: function (pre) {
    var $ = Metas.$; pre = pre || {};
    $('frmMeta').reset();
    $('mtTipo').value = pre.tipo || 'tempo'; $('mtPeriodo').value = pre.periodo || 'semana';
    $('mtAlvo').value = pre.alvo || ''; $('mtMinSessao').value = pre.min_sessao_min || '';
    $('mtSeqModo').value = pre.modo_seq || 'consecutivos'; $('mtMetrica').value = pre.metrica || 'reps';
    $('mtDataIni').value = pre.data_ini || Estat.hoje(); $('mtDataFim').value = pre.data_fim || '';
    var opts = '<option value="">—</option>' + Dados.ex.map(function (e) { return '<option value="' + Metas.esc(e.id) + '">' + Metas.esc(e.nome) + '</option>'; }).join('');
    $('mtExercicio').innerHTML = opts; $('mtExercicio').value = pre.exercicio_id || '';
    Metas.atualizarForm();
    bootstrap.Modal.getOrCreateInstance($('modalMeta')).show();
  },
  atalho: function (nome) {
    var bike = Dados.ex.filter(function (e) { return e.campos_bike; })[0], flex = Dados.ex.filter(function (e) { return /^Flexão de braço$/.test(e.nome); })[0];
    var A = {
      oms: { tipo: 'tempo', periodo: 'semana', alvo: 150 },
      treinos4: { tipo: 'frequencia', periodo: 'semana', alvo: 4 },
      seq21: { tipo: 'sequencia', modo_seq: 'consecutivos', alvo: 21 },
      bike3: { tipo: 'frequencia', periodo: 'semana', alvo: 3, min_sessao_min: 30, exercicio_id: bike && bike.id },
      bike100: { tipo: 'distancia', periodo: 'mes', alvo: 100, exercicio_id: bike && bike.id },
      flex1000: { tipo: 'repeticoes', periodo: 'mes', alvo: 1000, exercicio_id: flex && flex.id }
    };
    Metas.abrirForm(A[nome]);
  },
  lerForm: function () {
    var $ = Metas.$, t = $('mtTipo').value, hoje = Estat.hoje();
    var alvo = Number($('mtAlvo').value);
    var m = { tipo: t, alvo: alvo, periodo: $('mtPeriodo').value, exercicio_id: $('mtExercicio').value || null, categoria: null, ambiente: null, min_sessao_min: null, modo_seq: null, metrica: null, data_ini: null, data_fim: null };
    if (t === 'sequencia') { m.periodo = 'livre'; m.modo_seq = $('mtSeqModo').value; m.exercicio_id = null; }
    else if (t === 'marco') { m.periodo = 'livre'; m.metrica = $('mtMetrica').value; if (m.metrica === 'tempo') m.alvo = Math.round(alvo * 60); }
    else { m.categoria = $('mtCategoria').value || null; m.ambiente = $('mtAmbiente').value || null; }
    if (t === 'frequencia' && $('mtMinSessao').value) m.min_sessao_min = Math.round(Number($('mtMinSessao').value));
    if (m.periodo === 'livre') { m.data_ini = t === 'marco' ? hoje : ($('mtDataIni').value || hoje); m.data_fim = (t === 'marco') ? null : ($('mtDataFim').value || null); }
    return m;
  },
  validar: function (m) {
    if (!(m.alvo > 0)) return 'Informe um valor maior que zero para a meta.';
    if (m.tipo === 'marco' && !m.exercicio_id) return 'Escolha o exercício do marco.';
    if (m.data_fim && m.data_fim < m.data_ini) return 'A data final precisa ser depois da inicial.';
    if (m.tipo === 'sequencia' && m.modo_seq === 'max_intervalo' && !m.data_fim) return 'Para “nunca ficar mais de X dias sem treinar”, informe até quando a meta vale.';
    if (m.tipo === 'sequencia' && m.alvo > 3650) return 'Esse número de dias é grande demais.';
    return null;
  },
  salvar: async function (ev) {
    ev.preventDefault();
    var m = Metas.lerForm(), erro = Metas.validar(m);
    if (erro) return Util.toast(erro, 'erro');
    var sg = Metas.sugestao(m.tipo, m.periodo);
    if (sg && sg.media && m.alvo > sg.media * 1.1 + 0.001) {
      var pct = Math.round((m.alvo / sg.media - 1) * 100);
      var okAviso = await Util.confirmar('Essa meta é ' + pct + '% maior que sua média das últimas semanas. Aumentos graduais (até cerca de 10%) ajudam a evitar lesões e cansaço, e o descanso também faz parte do treino. Criar mesmo assim?', 'Criar meta');
      if (!okAviso) return;
    }
    m.titulo = Metas.titulo(m);
    var btn = Metas.$('btnSalvarMeta'); btn.disabled = true;
    try {
      await Dados.criarMeta(m);
      bootstrap.Modal.getOrCreateInstance(Metas.$('modalMeta')).hide();
      Util.toast('Meta criada.', 'ok');
      Metas.verificarCumpridas();
    } catch (e) { Util.toast(e.message && /Sem internet/.test(e.message) ? e.message : 'Não foi possível criar a meta: ' + (e.message || e), 'erro'); }
    btn.disabled = false;
  },

  init: function () {
    var $ = Metas.$;
    $('btnNovaMeta').addEventListener('click', function () { Metas.abrirForm(); });
    document.querySelectorAll('[data-atalho]').forEach(function (b) { b.addEventListener('click', function () { Metas.atalho(b.getAttribute('data-atalho')); }); });
    ['mtTipo', 'mtPeriodo', 'mtMetrica'].forEach(function (id) { $(id).addEventListener('change', Metas.atualizarForm); });
    $('btnUsarSugestao').addEventListener('click', function (e) { $('mtAlvo').value = e.currentTarget.getAttribute('data-valor'); });
    $('frmMeta').addEventListener('submit', Metas.salvar);
    $('pagMetas').addEventListener('click', async function (e) {
      var enc = e.target.closest('[data-meta-encerrar]'), exc = e.target.closest('[data-meta-excluir]'), rea = e.target.closest('[data-meta-reativar]');
      try {
        if (enc) { await Dados.atualizarMeta(enc.getAttribute('data-meta-encerrar'), { ativa: false }); Util.toast('Meta encerrada.', 'ok'); }
        if (rea) { await Dados.atualizarMeta(rea.getAttribute('data-meta-reativar'), { ativa: true }); Metas.verificarCumpridas(); }
        if (exc && await Util.confirmar('Excluir esta meta e o histórico dela? Não dá para desfazer.', 'Excluir')) { await Dados.excluirMeta(exc.getAttribute('data-meta-excluir')); Util.toast('Meta excluída.', 'ok'); }
      } catch (err) { Util.toast(/Sem internet/.test(err.message || '') ? err.message : 'Não foi possível concluir a ação.', 'erro'); }
    });
    document.querySelectorAll('[data-descanso]').forEach(function (c) {
      c.addEventListener('change', async function () {
        var dias = Array.prototype.filter.call(document.querySelectorAll('[data-descanso]'), function (x) { return x.checked; }).map(function (x) { return Number(x.getAttribute('data-descanso')); });
        await Dados.salvarDescanso(dias);
        Util.toast('Dias de descanso salvos.', 'ok');
      });
    });
    document.addEventListener('dados:atualizados', function () { Metas.render(); Metas.verificarCumpridas(); });
  },
  aoAbrir: function () { Metas.render(); }
};

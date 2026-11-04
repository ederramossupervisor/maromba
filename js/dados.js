/* Dados: cache local (Dexie) + sincronização com o Supabase + cálculos (ritmo, calorias, recordes). */
var Dados = {
  ex: [], exMap: {}, sessoes: [], pesagens: [], config: {}, metas: [], metasProg: [], seqServidor: null, _sync: null, ultimoErro: null,
  EQUIP: {
    nenhum: 'Sem equipamento', bicicleta_ergometrica: 'Bicicleta ergométrica', bicicleta: 'Bicicleta', halteres: 'Halteres',
    barra: 'Barra', elastico: 'Elástico', esteira: 'Esteira', banco: 'Banco', corda: 'Corda',
    aparelho_academia: 'Aparelho de academia', bola: 'Bola', piscina: 'Piscina', outro: 'Outro'
  },
  AMB: { casa: 'Casa', academia: 'Academia', ar_livre: 'Ar livre' },
  CAT: { cardio: 'Cardio', forca: 'Força', mobilidade: 'Mobilidade', esporte: 'Esportes', outro: 'Outro' },
  TIPO_TREINO: { leve: 'Leve', continuo: 'Contínuo', intervalado: 'Intervalado (HIIT)' },

  /* ---------- formatação ---------- */
  fmtNum: function (n, dec) {
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 1 : dec });
  },
  fmtDur: function (seg) {
    seg = Math.round(seg || 0);
    if (seg < 60) return seg + ' s';
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    if (h > 0) return h + 'h' + String(m).padStart(2, '0');
    return m + ' min' + (s ? ' ' + String(s).padStart(2, '0') + ' s' : '');
  },
  fmtRitmo: function (segPorKm) {
    var m = Math.floor(segPorKm / 60), s = Math.round(segPorKm % 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ':' + String(s).padStart(2, '0') + '/km';
  },
  ritmo: function (km, seg) { return (km > 0 && seg > 0) ? seg / km : null; },
  velocidade: function (km, seg) { return (km > 0 && seg > 0) ? km / (seg / 3600) : null; },
  tzData: function (quando) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(quando)); },
  fmtDataHora: function (iso) {
    var d = new Date(iso);
    var dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    var hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d);
    return dia + ' · ' + hora;
  },
  novoId: function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  },

  resumoItem: function (it) {
    var p = [];
    if (it.series && it.reps) p.push(it.series + '×' + it.reps);
    else if (it.reps) p.push(it.reps + ' reps');
    if (it.carga_kg) p.push(Dados.fmtNum(it.carga_kg) + ' kg');
    if (it.duracao_seg) p.push(Dados.fmtDur(it.duracao_seg));
    if (it.distancia_km) p.push(Dados.fmtNum(it.distancia_km, 2) + ' km');
    var r = Dados.ritmo(it.distancia_km, it.duracao_seg);
    var ex = Dados.exMap[it.exercicio_id];
    if (r && ex && ex.modo === 'distancia_tempo') p.push(Dados.fmtRitmo(r));
    if (it.resistencia) p.push('resist. ' + it.resistencia);
    if (it.cadencia_rpm) p.push(it.cadencia_rpm + ' rpm');
    if (it.calorias_aparelho) p.push(it.calorias_aparelho + ' kcal (aparelho)');
    if (it.tipo_treino) p.push(Dados.TIPO_TREINO[it.tipo_treino] || it.tipo_treino);
    return p.join(' · ');
  },

  /* ---------- cálculos ---------- */
  /* Calorias estimadas = MET × peso (kg) × horas. MET médio dos exercícios (ponderado pela duração, quando houver). */
  calorias: function (sessao, pesoKg) {
    if (!pesoKg || pesoKg <= 0) return null;
    var itens = sessao.itens || [];
    var somaDur = itens.reduce(function (a, i) { return a + (i.duracao_seg || 0); }, 0);
    var total = sessao.duracao_seg || somaDur;
    if (!total) return null;
    var met = null, comDur = itens.filter(function (i) { return i.duracao_seg > 0 && Dados.exMap[i.exercicio_id]; });
    if (comDur.length) {
      met = comDur.reduce(function (a, i) { return a + Dados.exMap[i.exercicio_id].met * i.duracao_seg; }, 0) / somaDur;
    } else {
      var ms = itens.filter(function (i) { return Dados.exMap[i.exercicio_id]; }).map(function (i) { return Dados.exMap[i.exercicio_id].met; });
      if (!ms.length) return null;
      met = ms.reduce(function (a, b) { return a + b; }, 0) / ms.length;
    }
    return Math.round(met * pesoKg * (total / 3600) * 10) / 10;
  },

  ultimoItem: function (exId, ignorarSessaoId) {
    for (var s = 0; s < Dados.sessoes.length; s++) {
      var ses = Dados.sessoes[s];
      if (ses.id === ignorarSessaoId) continue;
      for (var k = 0; k < (ses.itens || []).length; k++) if (ses.itens[k].exercicio_id === exId) return ses.itens[k];
    }
    return null;
  },

  /* Recordes pessoais: só comemora quando já existia marca anterior e ela foi superada. */
  recordes: function (item, ignorarSessaoId) {
    var ex = Dados.exMap[item.exercicio_id]; if (!ex) return [];
    var prev = [];
    Dados.sessoes.forEach(function (s) {
      if (s.id === ignorarSessaoId) return;
      (s.itens || []).forEach(function (i) { if (i.exercicio_id === item.exercicio_id) prev.push(i); });
    });
    var defs = [
      { rot: 'mais repetições', val: function (i) { return i.reps; }, fmt: function (v) { return v + ' reps'; } },
      { rot: 'mais carga', val: function (i) { return i.carga_kg; }, fmt: function (v) { return Dados.fmtNum(v) + ' kg'; } },
      { rot: 'maior distância', val: function (i) { return i.distancia_km; }, fmt: function (v) { return Dados.fmtNum(v, 2) + ' km'; } },
      { rot: 'melhor ritmo', menor: true, val: function (i) { return (i.distancia_km >= 0.5 && i.duracao_seg > 0) ? i.duracao_seg / i.distancia_km : 0; }, fmt: Dados.fmtRitmo },
      { rot: 'maior tempo', val: function (i) { return ex.modo === 'tempo' ? i.duracao_seg : 0; }, fmt: Dados.fmtDur }
    ];
    var out = [];
    defs.forEach(function (d) {
      var novo = d.val(item); if (!(novo > 0)) return;
      var antes = prev.map(d.val).filter(function (v) { return v > 0; });
      if (!antes.length) return;
      var melhor = d.menor ? Math.min.apply(null, antes) : Math.max.apply(null, antes);
      if (d.menor ? novo < melhor : novo > melhor) out.push({ exercicio: ex.nome, iconeHtml: Util.iconeEx(ex), rotulo: d.rot, valor: d.fmt(novo), anterior: d.fmt(melhor) });
    });
    return out;
  },

  /* ---------- carga local ---------- */
  carregarLocal: async function () {
    var ex = await Api.db.exercicios.toArray();
    ex.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    Dados.ex = ex; Dados.exMap = {};
    ex.forEach(function (e) { Dados.exMap[e.id] = e; });
    var ss = await Api.db.sessoes.toArray();
    Dados.sessoes = ss.filter(function (s) { return !s.excluido; })
      .sort(function (a, b) { return new Date(b.inicio) - new Date(a.inicio); });
    var ps = await Api.db.pesagens.toArray();
    Dados.pesagens = ps.filter(function (p) { return !p.excluido; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    var cf = await Api.db.configuracoes.toArray(); Dados.config = {};
    cf.forEach(function (c) { Dados.config[c.chave] = c.valor; });
    Dados.metas = (await Api.db.metas.toArray()).sort(function (a, b) { return new Date(a.criada_em) - new Date(b.criada_em); });
    Dados.metasProg = await Api.db.metas_progresso.toArray();
    await Dados.atualizarBadge();
    document.dispatchEvent(new Event('dados:atualizados'));
  },

  pendentes: async function () {
    var a = await Api.db.sessoes.where('pendente').equals(1).count();
    var b = await Api.db.pesagens.where('pendente').equals(1).count();
    var c = await Api.db.configuracoes.where('pendente').equals(1).count();
    return a + b + c;
  },

  /* Dias da semana de descanso planejado (0 = domingo ... 6 = sábado). */
  descanso: function () {
    var v = Dados.config.dias_descanso;
    return Array.isArray(v) ? v.filter(function (n) { return n >= 0 && n <= 6; }) : [];
  },
  atualizarBadge: async function () {
    var n = 0; try { n = await Dados.pendentes(); } catch (e) {}
    document.querySelectorAll('[data-sync-badge]').forEach(function (el) {
      el.classList.toggle('d-none', n === 0);
      el.textContent = n + (n === 1 ? ' treino pendente de envio' : ' treinos pendentes de envio');
      el.title = Dados.ultimoErro || 'Será enviado quando houver internet';
    });
  },

  /* ---------- gravar / excluir (sempre local primeiro) ---------- */
  salvar: async function (sessao) {
    sessao.pendente = 1; delete sessao.excluido;
    await Api.db.sessoes.put(sessao);
    await Dados.carregarLocal();
    Dados.sincronizar();
  },
  excluir: async function (id) {
    var s = await Api.db.sessoes.get(id); if (!s) return;
    s.excluido = 1; s.pendente = 1;
    await Api.db.sessoes.put(s);
    await Dados.carregarLocal();
    Dados.sincronizar();
  },

  /* ---------- sincronização ---------- */
  sincronizar: function () {
    if (Dados._sync) return Dados._sync;
    if (!navigator.onLine || !Util.userId) return Promise.resolve(false);
    Dados._sync = Dados._sincronizar().catch(function (e) { Dados.ultimoErro = String((e && e.message) || e); return false; })
      .then(function (r) { Dados._sync = null; return r; });
    return Dados._sync;
  },

  _payload: function (s) {
    return {
      id: s.id, inicio: s.inicio, duracao_seg: s.duracao_seg, local: s.local, ambiente: s.ambiente, rpe: s.rpe,
      humor: s.humor, clima: s.clima, observacoes: s.observacoes, calorias: s.calorias,
      itens: (s.itens || []).map(function (i, n) {
        return {
          exercicio_id: i.exercicio_id, ordem: n, series: i.series, reps: i.reps, carga_kg: i.carga_kg,
          duracao_seg: i.duracao_seg, distancia_km: i.distancia_km, resistencia: i.resistencia,
          cadencia_rpm: i.cadencia_rpm, calorias_aparelho: i.calorias_aparelho, tipo_treino: i.tipo_treino
        };
      })
    };
  },

  _sincronizar: async function () {
    Dados.ultimoErro = null;
    // 1) enviar pendentes
    var pend = await Api.db.sessoes.where('pendente').equals(1).toArray();
    for (var k = 0; k < pend.length; k++) {
      var s = pend[k];
      var r = s.excluido
        ? await Supa.client.from('sessoes').delete().eq('id', s.id)
        : await Supa.client.rpc('salvar_sessao', { p: Dados._payload(s) });
      if (r.error) {
        if (!r.error.code) throw new Error('Sem conexão com o servidor'); // falha de rede: tenta depois
        Dados.ultimoErro = 'Um treino foi recusado pelo servidor: ' + r.error.message; // dado inválido: não trava a fila
        continue;
      }
      if (s.excluido) await Api.db.sessoes.delete(s.id);
      else await Api.db.sessoes.update(s.id, { pendente: 0 });
    }
    // 1b) enviar pesagens pendentes
    var pp = await Api.db.pesagens.where('pendente').equals(1).toArray();
    for (var q = 0; q < pp.length; q++) {
      var p = pp[q];
      var rp = p.excluido
        ? await Supa.client.from('pesagens').delete().eq('data', p.data)
        : await Supa.client.from('pesagens').upsert({ user_id: Util.userId, data: p.data, peso_kg: p.peso_kg }, { onConflict: 'user_id,data' });
      if (rp.error) {
        if (!rp.error.code) throw new Error('Sem conexão com o servidor');
        Dados.ultimoErro = 'Uma pesagem foi recusada pelo servidor: ' + rp.error.message;
        continue;
      }
      if (p.excluido) await Api.db.pesagens.delete(p.data); else await Api.db.pesagens.update(p.data, { pendente: 0 });
    }
    // 1c) enviar configurações pendentes
    var cp = await Api.db.configuracoes.where('pendente').equals(1).toArray();
    for (var c1 = 0; c1 < cp.length; c1++) {
      var rc = await Supa.client.from('configuracoes').upsert({ user_id: Util.userId, chave: cp[c1].chave, valor: cp[c1].valor, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id,chave' });
      if (rc.error) {
        if (!rc.error.code) throw new Error('Sem conexão com o servidor');
        Dados.ultimoErro = 'Uma configuração foi recusada pelo servidor: ' + rc.error.message; continue;
      }
      await Api.db.configuracoes.update(cp[c1].chave, { pendente: 0 });
    }
    // 2) baixar catálogo e treinos
    var re = await Supa.client.from('exercicios').select('*').order('nome');
    if (re.error) throw re.error;
    await Api.db.exercicios.clear(); await Api.db.exercicios.bulkPut(re.data);

    var vistos = {}, de = 0, TAM = 500;
    for (;;) {
      var rs = await Supa.client.from('sessoes').select('*, sessao_itens(*)').order('inicio', { ascending: false }).range(de, de + TAM - 1);
      if (rs.error) throw rs.error;
      for (var j = 0; j < rs.data.length; j++) {
        var sv = rs.data[j]; vistos[sv.id] = true;
        var loc = await Api.db.sessoes.get(sv.id);
        if (loc && loc.pendente) continue;
        var itens = (sv.sessao_itens || []).sort(function (a, b) { return a.ordem - b.ordem; });
        delete sv.sessao_itens;
        sv.inicio = new Date(sv.inicio).toISOString();
        sv.itens = itens; sv.pendente = 0;
        await Api.db.sessoes.put(sv);
      }
      if (rs.data.length < TAM) break;
      de += TAM;
    }
    var todas = await Api.db.sessoes.toArray();
    for (var m = 0; m < todas.length; m++) {
      if (!todas[m].pendente && !vistos[todas[m].id]) await Api.db.sessoes.delete(todas[m].id); // apagada em outro aparelho
    }
    var rpes = await Supa.client.from('pesagens').select('data,peso_kg').order('data');
    if (rpes.error) throw rpes.error;
    var locaisP = await Api.db.pesagens.toArray(), vp = {};
    for (var z = 0; z < rpes.data.length; z++) {
      vp[rpes.data[z].data] = true;
      var lp = await Api.db.pesagens.get(rpes.data[z].data);
      if (!lp || !lp.pendente) await Api.db.pesagens.put({ data: rpes.data[z].data, peso_kg: Number(rpes.data[z].peso_kg), pendente: 0 });
    }
    for (var y = 0; y < locaisP.length; y++) if (!locaisP[y].pendente && !vp[locaisP[y].data]) await Api.db.pesagens.delete(locaisP[y].data);

    // configurações, metas e períodos cumpridos
    var rcf = await Supa.client.from('configuracoes').select('chave,valor');
    if (rcf.error) throw rcf.error;
    var vc = {}, locC = await Api.db.configuracoes.toArray();
    for (var c2 = 0; c2 < rcf.data.length; c2++) {
      vc[rcf.data[c2].chave] = true;
      var lc = await Api.db.configuracoes.get(rcf.data[c2].chave);
      if (!lc || !lc.pendente) await Api.db.configuracoes.put({ chave: rcf.data[c2].chave, valor: rcf.data[c2].valor, pendente: 0 });
    }
    for (var c3 = 0; c3 < locC.length; c3++) if (!locC[c3].pendente && !vc[locC[c3].chave]) await Api.db.configuracoes.delete(locC[c3].chave);
    var rm = await Supa.client.from('metas').select('*').order('criada_em');
    if (rm.error) throw rm.error;
    await Api.db.metas.clear(); await Api.db.metas.bulkPut(rm.data);
    var rmp = await Supa.client.from('metas_progresso').select('*').range(0, 4999);
    if (rmp.error) throw rmp.error;
    await Api.db.metas_progresso.clear(); await Api.db.metas_progresso.bulkPut(rmp.data);

    // sequência de dias calculada no banco (data de São Paulo); só vale quando não há nada pendente
    if (!(await Dados.pendentes())) {
      var rq = await Supa.client.rpc('sequencia_dias');
      if (!rq.error && rq.data && rq.data[0]) Dados.seqServidor = { atual: rq.data[0].atual, maior: rq.data[0].maior, dia: Dados.tzData(Date.now()) };
    }
    await Dados.carregarLocal();
    return true;
  },

  /* ---------- pesagens (peso corporal) ---------- */
  salvarPesagem: async function (data, kg) {
    await Api.db.pesagens.put({ data: data, peso_kg: kg, pendente: 1 });
    await Dados.carregarLocal(); Dados.sincronizar();
  },
  excluirPesagem: async function (data) {
    await Api.db.pesagens.put({ data: data, peso_kg: 0, pendente: 1, excluido: 1 });
    await Dados.carregarLocal(); Dados.sincronizar();
  },

  /* ---------- descanso, metas (escritas de metas exigem internet) ---------- */
  salvarDescanso: async function (dias) {
    await Api.db.configuracoes.put({ chave: 'dias_descanso', valor: dias.slice().sort(), pendente: 1 });
    Dados.seqServidor = null; // será recalculada no banco após sincronizar
    await Dados.carregarLocal(); Dados.sincronizar();
  },
  _online: function () { if (!navigator.onLine) throw new Error('Sem internet: conecte-se para alterar metas.'); },
  criarMeta: async function (campos) {
    Dados._online();
    var r = await Supa.client.from('metas').insert(campos).select().single();
    if (r.error) throw r.error;
    await Api.db.metas.put(r.data); await Dados.carregarLocal();
    return r.data;
  },
  atualizarMeta: async function (id, campos) {
    Dados._online();
    var r = await Supa.client.from('metas').update(campos).eq('id', id).select().single();
    if (r.error) throw r.error;
    await Api.db.metas.put(r.data); await Dados.carregarLocal();
  },
  excluirMeta: async function (id) {
    Dados._online();
    var r = await Supa.client.from('metas').delete().eq('id', id);
    if (r.error) throw r.error;
    await Api.db.metas.delete(id);
    await Api.db.metas_progresso.where('meta_id').equals(id).delete();
    await Dados.carregarLocal();
  },
  /* Retorna true se este aparelho registrou o período (e deve comemorar); false se já estava registrado. */
  registrarProgresso: async function (linha) {
    if (!navigator.onLine) return false;
    var r = await Supa.client.from('metas_progresso').insert(linha).select().single();
    if (r.error) { if (r.error.code === '23505') return false; throw r.error; }
    await Api.db.metas_progresso.put(r.data);
    Dados.metasProg.push(r.data);
    return true;
  },

  iniciar: async function () {
    await Dados.carregarLocal();
    window.addEventListener('online', function () { Dados.sincronizar(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) Dados.sincronizar(); });
    return Dados.sincronizar();
  },

  /* ---------- exercícios próprios ---------- */
  criarExercicio: async function (campos) {
    var r = await Supa.client.from('exercicios').insert(campos).select().single();
    if (r.error) throw r.error;
    await Api.db.exercicios.put(r.data); await Dados.carregarLocal();
    return r.data;
  },
  excluirExercicio: async function (id) {
    var r = await Supa.client.from('exercicios').delete().eq('id', id);
    if (r.error) throw r.error;
    await Api.db.exercicios.delete(id); await Dados.carregarLocal();
  }
};

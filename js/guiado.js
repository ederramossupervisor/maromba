/* Treino guiado a partir de um modelo. O estado fica salvo no aparelho (sobrevive a recarregar a página). */
var Guiado = {
  S: null, ctx: null, wl: null, _seg: null, _timer: null,
  $: function (id) { return document.getElementById(id); },
  agora: function () { return Date.now(); },

  /* ---------- estado ---------- */
  carregar: function () {
    var s = Util.ls.get('guiado', null);
    if (s && s.v === 1 && Guiado.agora() - s.inicioMs < 12 * 3600 * 1000) return s;
    if (s) Util.ls.del('guiado');
    return null;
  },
  salvarEstado: function () { if (Guiado.S) Util.ls.set('guiado', Guiado.S); else Util.ls.del('guiado'); },

  /* Passos: exercício por exercício; ou, no circuito, rodada por rodada. */
  gerarPassos: function (m) {
    var itens = m.itens || [], passos = [];
    var mk = function (it, k, serie) { return { k: k, ex: it.exercicio_id, serie: serie, de: it.series, reps: it.reps || null, carga_kg: it.carga_kg || null, duracao_seg: it.duracao_seg || null, distancia_km: it.distancia_km || null, descanso_seg: it.descanso_seg || 0 }; };
    if (m.circuito) {
      var max = Math.max.apply(null, itens.map(function (i) { return i.series; }).concat([1]));
      for (var r = 1; r <= max; r++) itens.forEach(function (it, k) { if (r <= it.series) passos.push(mk(it, k, r)); });
    } else itens.forEach(function (it, k) { for (var s = 1; s <= it.series; s++) passos.push(mk(it, k, s)); });
    return passos;
  },

  iniciar: async function (modelo) {
    if (!modelo || !(modelo.itens || []).length) return Util.toast('Esse modelo não tem exercícios.', 'erro');
    if (Guiado.carregar() && !(await Util.confirmar('Você já tem um treino em andamento. Começar outro descarta o anterior. Continuar?', 'Começar outro'))) return;
    var cfg = Util.ls.get('guiado_cfg', { som: true, vib: true });
    Guiado.S = { v: 1, modeloId: modelo.id, nome: modelo.nome, ambiente: modelo.ambiente || 'casa', passos: Guiado.gerarPassos(modelo), i: 0, fase: 'ativo',
      descansoAte: null, descansoTotal: 0, inicioMs: Guiado.agora(), fimMs: null, regs: [], contRodando: false, contT0: 0, contAcum: 0, contFim: false, som: cfg.som, vib: cfg.vib };
    Guiado.salvarEstado();
    Guiado.ligarAudio(); Guiado.travarTela();
    App.ir('guiado');
  },
  continuar: function () { Guiado.S = Guiado.carregar(); if (!Guiado.S) return; Guiado.ligarAudio(); Guiado.travarTela(); App.ir('guiado'); },
  descartar: async function (perguntar) {
    if (perguntar && !(await Util.confirmar('Descartar este treino em andamento? O que você fez não será salvo.', 'Descartar'))) return;
    Guiado.S = null; Guiado.salvarEstado(); Guiado.soltarTela(); Guiado.atualizarBanners(); App.ir('modelos');
  },

  /* ---------- som, vibração e tela acesa ---------- */
  ligarAudio: function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !Guiado.ctx) Guiado.ctx = new AC();
      if (Guiado.ctx && Guiado.ctx.state === 'suspended') Guiado.ctx.resume();
    } catch (e) {}
  },
  beep: function (freq, ms) {
    if (!Guiado.S || !Guiado.S.som || !Guiado.ctx) return;
    try {
      var o = Guiado.ctx.createOscillator(), g = Guiado.ctx.createGain(), t = Guiado.ctx.currentTime;
      o.frequency.value = freq; o.type = 'sine'; o.connect(g); g.connect(Guiado.ctx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch (e) {}
  },
  vibrar: function (padrao) { if (Guiado.S && Guiado.S.vib && navigator.vibrate) { try { navigator.vibrate(padrao); } catch (e) {} } },
  aviso: function (longo) {
    if (longo) { Guiado.beep(880, 700); Guiado.vibrar([300, 120, 300]); } else { Guiado.beep(660, 150); Guiado.vibrar(60); }
  },
  travarTela: async function () { try { if (navigator.wakeLock && !Guiado.wl) Guiado.wl = await navigator.wakeLock.request('screen'); } catch (e) { Guiado.wl = null; } },
  soltarTela: function () { try { if (Guiado.wl) Guiado.wl.release(); } catch (e) {} Guiado.wl = null; },

  /* ---------- ações ---------- */
  passo: function () { return Guiado.S.passos[Guiado.S.i]; },
  duracaoContagem: function () {
    var S = Guiado.S, p = Guiado.passo(); if (!p || !p.duracao_seg) return 0;
    var el = S.contAcum + (S.contRodando ? Guiado.agora() - S.contT0 : 0);
    return el;
  },
  contIniciar: function () {
    var S = Guiado.S; Guiado.ligarAudio(); if (S.contRodando) return;
    S.contRodando = true; S.contT0 = Guiado.agora(); S.contFim = false; Guiado._seg = null;
    Guiado.salvarEstado(); Guiado.render();
  },
  contParar: function () {
    var S = Guiado.S; if (!S.contRodando) return;
    S.contAcum += Guiado.agora() - S.contT0; S.contRodando = false; Guiado.salvarEstado(); Guiado.render();
  },
  num: function (id) { var v = Guiado.$(id).value; return v === '' ? null : Number(v); },
  concluir: function () {
    var S = Guiado.S, p = Guiado.passo(); Guiado.ligarAudio();
    var el = Guiado.duracaoContagem(), dur = null;
    if (p.duracao_seg) dur = S.contFim ? p.duracao_seg : (el > 1000 ? Math.round(el / 1000) : p.duracao_seg);
    var reg = { p: S.i, k: p.k, ex: p.ex, reps: p.reps ? Guiado.num('gdReps') : null, carga_kg: Guiado.num('gdCarga'), duracao_seg: dur, distancia_km: Guiado.num('gdKm'),
      resistencia: Guiado.num('gdRes'), cadencia_rpm: Guiado.num('gdCad'), calorias_aparelho: Guiado.num('gdKcal') };
    if (p.reps && !(reg.reps > 0)) reg.reps = p.reps;
    S.regs.push(reg);
    Guiado.proximo(p.descanso_seg);
  },
  pular: function () { Guiado.proximo(0); },
  proximo: function (descanso) {
    var S = Guiado.S;
    S.contRodando = false; S.contAcum = 0; S.contFim = false; Guiado._seg = null;
    S.i++;
    if (S.i >= S.passos.length) return Guiado.terminar();
    if (descanso > 0) { S.fase = 'descanso'; S.descansoTotal = descanso; S.descansoAte = Guiado.agora() + descanso * 1000; }
    else S.fase = 'ativo';
    Guiado.salvarEstado(); Guiado.render();
  },
  terminar: function () {
    var S = Guiado.S; S.fase = 'fim'; S.fimMs = Guiado.agora(); S.contRodando = false;
    Guiado.salvarEstado(); Guiado.soltarTela(); Guiado.aviso(true); Guiado.render();
  },
  encerrar: async function () {
    if (await Util.confirmar('Encerrar o treino agora? O que você já fez será mantido para salvar.', 'Encerrar')) Guiado.terminar();
  },
  maisDescanso: function () { var S = Guiado.S; if (S.fase === 'descanso') { S.descansoAte += 15000; S.descansoTotal += 15; Guiado._seg = null; Guiado.salvarEstado(); } },
  pularDescanso: function () { var S = Guiado.S; S.fase = 'ativo'; S.descansoAte = null; Guiado._seg = null; Guiado.salvarEstado(); Guiado.render(); },

  /* ---------- relógio ---------- */
  fmt: function (ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); },
  tick: function () {
    var S = Guiado.S; if (!S) return;
    var agora = Guiado.agora();
    if (S.fase === 'descanso') {
      var falta = S.descansoAte - agora, seg = Math.ceil(falta / 1000);
      Guiado.$('gdDescTempo').textContent = Guiado.fmt(falta);
      if (seg !== Guiado._seg) { Guiado._seg = seg; if (seg > 0 && seg <= 3) Guiado.aviso(false); }
      if (falta <= 0) { Guiado.aviso(true); S.fase = 'ativo'; S.descansoAte = null; Guiado._seg = null; Guiado.salvarEstado(); Guiado.render(); }
    } else if (S.fase === 'ativo') {
      var p = Guiado.passo(); if (!p || !p.duracao_seg) return;
      var restante = p.duracao_seg * 1000 - Guiado.duracaoContagem();
      Guiado.$('gdContagem').textContent = S.contFim ? '00:00' : Guiado.fmt(restante);
      if (S.contRodando) {
        var sg = Math.ceil(restante / 1000);
        if (sg !== Guiado._seg) { Guiado._seg = sg; if (sg > 0 && sg <= 3) Guiado.aviso(false); }
        if (restante <= 0) { S.contFim = true; S.contRodando = false; S.contAcum = p.duracao_seg * 1000; Guiado.aviso(true); Guiado.salvarEstado(); Guiado.render(); }
      }
    }
  },

  /* ---------- tela ---------- */
  textoMeta: function (p) {
    var ex = Dados.exMap[p.ex], t = [];
    if (p.reps) t.push(p.reps + ' repetições'); if (p.duracao_seg) t.push(Dados.fmtDur(p.duracao_seg));
    if (p.carga_kg) t.push(Dados.fmtNum(p.carga_kg) + ' kg'); if (p.distancia_km) t.push(Dados.fmtNum(p.distancia_km, 2) + ' km');
    return 'Série ' + p.serie + ' de ' + p.de + (t.length ? ' · alvo: ' + t.join(' · ') : '');
  },
  render: function () {
    var S = Guiado.S, $ = Guiado.$;
    if (!S) return;
    $('gdTitulo').textContent = S.nome;
    var total = S.passos.length, feitos = Math.min(S.i, total), pct = Math.round(feitos / total * 100);
    $('gdBarra').style.width = pct + '%'; $('gdBarra').setAttribute('aria-valuenow', pct);
    $('gdSom').setAttribute('aria-pressed', S.som); $('gdSom').classList.toggle('active', S.som);
    $('gdVib').setAttribute('aria-pressed', S.vib); $('gdVib').classList.toggle('active', S.vib);
    $('gdAtivo').classList.toggle('d-none', S.fase !== 'ativo'); $('gdDescanso').classList.toggle('d-none', S.fase !== 'descanso'); $('gdFim').classList.toggle('d-none', S.fase !== 'fim');
    if (S.fase === 'fim') { $('gdProgresso').textContent = 'Treino concluído'; Guiado.renderFim(); return; }
    var p = Guiado.passo(), ex = Dados.exMap[p.ex];
    $('gdProgresso').textContent = 'Passo ' + (S.i + 1) + ' de ' + total;
    var prox = S.passos[S.fase === 'descanso' ? S.i : S.i + 1], pe = prox && Dados.exMap[prox.ex];
    if (S.fase === 'descanso') {
      $('gdDescProx').innerHTML = pe ? 'A seguir: <strong>' + Util.esc(pe.icone) + ' ' + Util.esc(pe.nome) + '</strong><br><span class="small text-body-secondary">' + Util.esc(Guiado.textoMeta(prox)) + '</span>' : '';
      Guiado.tick(); return;
    }
    $('gdExNome').textContent = (ex ? ex.icone + ' ' + ex.nome : 'Exercício');
    $('gdMeta').textContent = Guiado.textoMeta(p);
    var tem = !!p.duracao_seg;
    $('gdBoxTempo').classList.toggle('d-none', !tem);
    $('gdContIniciar').classList.toggle('d-none', S.contRodando || S.contFim); $('gdContParar').classList.toggle('d-none', !S.contRodando);
    $('gdContIniciar').textContent = S.contAcum > 0 ? 'Retomar tempo' : 'Iniciar tempo';
    var bike = !!(ex && ex.campos_bike);
    $('gdBoxReps').classList.toggle('d-none', !p.reps);
    $('gdBoxCarga').classList.toggle('d-none', !(ex && ex.modo === 'repeticoes'));
    $('gdBoxKm').classList.toggle('d-none', !(ex && (ex.modo === 'distancia_tempo' || bike)));
    $('gdBoxBike').classList.toggle('d-none', !bike);
    $('gdReps').value = p.reps || ''; $('gdCarga').value = p.carga_kg || ''; $('gdKm').value = p.distancia_km || '';
    $('gdRes').value = ''; $('gdCad').value = ''; $('gdKcal').value = '';
    $('gdConcluir').classList.toggle('btn-success', S.contFim);
    $('gdProximo').innerHTML = pe ? 'Depois: ' + Util.esc(pe.icone) + ' ' + Util.esc(pe.nome) + ' — ' + Util.esc(Guiado.textoMeta(prox)) : 'Este é o último passo.';
    Guiado.tick();
  },

  /* Junta as séries registradas em itens da sessão (séries iguais viram "3×15"). */
  montarItens: function () {
    var S = Guiado.S, ordem = [], porK = {};
    S.regs.forEach(function (r) { if (!porK[r.k]) { porK[r.k] = []; ordem.push(r.k); } porK[r.k].push(r); });
    var soma = function (a, c) { var t = a.reduce(function (x, r) { return x + (r[c] || 0); }, 0); return t > 0 ? t : null; };
    var media = function (a, c) { var v = a.filter(function (r) { return r[c] > 0; }).map(function (r) { return r[c]; }); return v.length ? Math.round(v.reduce(function (x, y) { return x + y; }, 0) / v.length) : null; };
    var itens = [];
    ordem.forEach(function (k) {
      var regs = porK[k], exId = regs[0].ex, base = { exercicio_id: exId, resistencia: media(regs, 'resistencia'), cadencia_rpm: media(regs, 'cadencia_rpm'), calorias_aparelho: soma(regs, 'calorias_aparelho'), tipo_treino: null };
      if (regs.every(function (r) { return r.reps > 0; })) {
        var grupos = [];
        regs.forEach(function (r) {
          var g = grupos[grupos.length - 1];
          if (g && g.reps === r.reps && g.carga === (r.carga_kg || null)) g.regs.push(r); else grupos.push({ reps: r.reps, carga: r.carga_kg || null, regs: [r] });
        });
        grupos.forEach(function (g) {
          itens.push(Object.assign({}, base, { series: g.regs.length, reps: g.reps, carga_kg: g.carga, duracao_seg: soma(g.regs, 'duracao_seg'), distancia_km: soma(g.regs, 'distancia_km') }));
        });
      } else {
        itens.push(Object.assign({}, base, { series: regs.length, reps: null, carga_kg: null, duracao_seg: soma(regs, 'duracao_seg'), distancia_km: soma(regs, 'distancia_km') }));
      }
    });
    return itens;
  },
  renderFim: function () {
    var S = Guiado.S, $ = Guiado.$, itens = Guiado.montarItens(), seg = Math.round(((S.fimMs || Guiado.agora()) - S.inicioMs) / 1000);
    $('gdResumo').innerHTML = '<p class="mb-2"><strong>' + Dados.fmtDur(seg) + '</strong> de treino · ' + S.regs.length + (S.regs.length === 1 ? ' série registrada' : ' séries registradas') + '</p>' +
      '<ul class="small mb-0">' + itens.map(function (i) { var e = Dados.exMap[i.exercicio_id]; return '<li>' + (e ? Util.esc(e.icone + ' ' + e.nome) : '') + ' <span class="text-body-secondary">— ' + Util.esc(Dados.resumoItem(i)) + '</span></li>'; }).join('') + '</ul>';
    if (!$('gdLocal').value) $('gdLocal').value = '';
    $('gdAmbiente').value = S.ambiente || 'casa';
    $('gdSalvar').disabled = !S.regs.length;
    $('gdSemRegistro').classList.toggle('d-none', !!S.regs.length);
    var h = $('gdHumor');
    h.innerHTML = Dados.HUMOR.map(function (e, i) { return '<button type="button" class="btn btn-outline-secondary humor-btn' + (Guiado.humor === i + 1 ? ' active' : '') + '" data-gd-humor="' + (i + 1) + '" aria-label="Humor ' + (i + 1) + ' de 5">' + e + '</button>'; }).join('');
    $('gdRpeTxt').textContent = Guiado.rpe ? Guiado.rpe + ' de 10' : 'não informado';
  },
  rpe: null, humor: null,
  salvar: async function () {
    var S = Guiado.S, $ = Guiado.$; if (!S || !S.regs.length) return;
    var btn = $('gdSalvar'); btn.disabled = true;
    try {
      var itens = Guiado.montarItens(), id = Dados.novoId(), fim = S.fimMs || Guiado.agora();
      var sessao = { id: id, inicio: new Date(S.inicioMs).toISOString(), duracao_seg: Math.max(1, Math.round((fim - S.inicioMs) / 1000)),
        local: $('gdLocal').value.trim() || null, ambiente: $('gdAmbiente').value || null, rpe: Guiado.rpe, humor: Guiado.humor, clima: null,
        observacoes: $('gdObs').value.trim() || null, itens: itens, calorias: null };
      sessao.data = Dados.tzData(sessao.inicio);
      sessao.calorias = Dados.calorias(sessao, (Perfil.dados || {}).peso);
      var prs = []; itens.forEach(function (it) { prs = prs.concat(Dados.recordes(it, id)); });
      await Dados.salvar(sessao);
      Guiado.S = null; Guiado.salvarEstado(); Guiado.rpe = null; Guiado.humor = null; $('gdObs').value = ''; Guiado.soltarTela();
      Util.toast('Treino salvo.', 'ok');
      App.ir('historico');
      if (prs.length) Treino.celebrar(prs);
    } catch (e) { Util.toast('Não foi possível salvar o treino: ' + (e.message || e), 'erro'); btn.disabled = false; }
  },

  /* ---------- avisos "treino em andamento" ---------- */
  atualizarBanners: function () {
    var s = Util.userId ? Guiado.carregar() : null;
    document.querySelectorAll('[data-aviso-guiado]').forEach(function (b) {
      b.classList.toggle('d-none', !s);
      var t = b.querySelector('[data-aviso-guiado-nome]'); if (t && s) t.textContent = s.nome;
    });
  },

  init: function () {
    var $ = Guiado.$;
    $('gdContIniciar').addEventListener('click', Guiado.contIniciar); $('gdContParar').addEventListener('click', Guiado.contParar);
    $('gdConcluir').addEventListener('click', Guiado.concluir); $('gdPular').addEventListener('click', Guiado.pular);
    $('gdEncerrar').addEventListener('click', Guiado.encerrar); $('gdEncerrar2').addEventListener('click', Guiado.encerrar);
    $('gdMais15').addEventListener('click', Guiado.maisDescanso); $('gdPularDesc').addEventListener('click', Guiado.pularDescanso);
    $('gdSalvar').addEventListener('click', Guiado.salvar); $('gdDescartar').addEventListener('click', function () { Guiado.descartar(true); });
    ['gdSom', 'gdVib'].forEach(function (id) {
      $(id).addEventListener('click', function () {
        var S = Guiado.S; if (!S) return; var k = id === 'gdSom' ? 'som' : 'vib'; S[k] = !S[k];
        Util.ls.set('guiado_cfg', { som: S.som, vib: S.vib }); Guiado.salvarEstado(); Guiado.ligarAudio(); Guiado.render();
      });
    });
    $('gdRpe').addEventListener('input', function (e) { Guiado.rpe = Number(e.target.value); $('gdRpeTxt').textContent = Guiado.rpe + ' de 10'; });
    $('gdHumor').addEventListener('click', function (e) {
      var b = e.target.closest('[data-gd-humor]'); if (!b) return;
      var v = Number(b.getAttribute('data-gd-humor')); Guiado.humor = Guiado.humor === v ? null : v; Guiado.renderFim();
    });
    document.querySelectorAll('[data-guiado-continuar]').forEach(function (b) { b.addEventListener('click', Guiado.continuar); });
    document.querySelectorAll('[data-guiado-descartar]').forEach(function (b) { b.addEventListener('click', function () { Guiado.descartar(true); }); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Guiado.S) { Guiado.travarTela(); Guiado.tick(); } });
    Guiado._timer = setInterval(function () { if (Guiado.S) Guiado.tick(); }, 250);
  },
  aoAbrir: function () {
    Guiado.S = Guiado.carregar();
    if (!Guiado.S) { App.ir('modelos'); return; }
    Guiado.render();
  }
};

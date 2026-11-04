/* Tela "Registrar treino" */
var Treino = {
  st: null,

  novoEstado: function () {
    return { id: null, inicio: null, ambiente: 'casa', local: '', rpe: null, humor: null, clima: '', obs: '', itens: [], editando: false };
  },
  $: function (id) { return document.getElementById(id); },

  paraInputLocal: function (d) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  /* ---------- cronômetro (persiste ao recarregar) ---------- */
  crono: function () { return Util.ls.get('crono', { rodando: false, t0: 0, acum: 0, inicioReal: null }); },
  cronoSalvar: function (c) { Util.ls.set('crono', c); },
  cronoMs: function () { var c = Treino.crono(); return c.acum + (c.rodando ? Date.now() - c.t0 : 0); },
  cronoDesenhar: function () {
    var ms = Treino.cronoMs(), c = Treino.crono(), s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = function (n) { return String(n).padStart(2, '0'); };
    Treino.$('cronoDisplay').textContent = (h ? h + ':' : '') + p(m) + ':' + p(x);
    Treino.$('btnCronoToggle').innerHTML = c.rodando ? '<i class="fa-solid fa-pause me-1"></i>Pausar'
      : '<i class="fa-solid fa-play me-1"></i>' + (ms > 0 ? 'Retomar' : 'Iniciar');
  },
  cronoToggle: function () {
    var c = Treino.crono();
    if (c.rodando) { c.acum += Date.now() - c.t0; c.rodando = false; }
    else {
      if (!c.inicioReal && c.acum === 0) c.inicioReal = new Date().toISOString();
      c.t0 = Date.now(); c.rodando = true;
    }
    Treino.cronoSalvar(c); Treino.cronoDesenhar();
  },
  cronoFinalizar: function () {
    var c = Treino.crono();
    if (c.rodando) { c.acum += Date.now() - c.t0; c.rodando = false; Treino.cronoSalvar(c); }
    var seg = Math.round(c.acum / 1000);
    if (seg < 1) { Util.toast('Inicie o cronômetro primeiro.', 'info'); return; }
    Treino.$('trDuracao').value = String(Math.round(seg / 6) / 10);
    if (c.inicioReal) Treino.$('trInicio').value = Treino.paraInputLocal(new Date(c.inicioReal));
    Treino.cronoDesenhar();
    Util.toast('Duração preenchida: ' + Dados.fmtDur(seg) + '.', 'ok');
  },
  cronoZerar: function () { Treino.cronoSalvar({ rodando: false, t0: 0, acum: 0, inicioReal: null }); Treino.cronoDesenhar(); },

  /* ---------- formulário ---------- */
  limpar: function () {
    Treino.st = Treino.novoEstado();
    Treino.st.inicio = new Date();
    Treino.desenharTudo();
  },

  desenharTudo: function () {
    var st = Treino.st;
    Treino.$('trInicio').value = Treino.paraInputLocal(st.inicio instanceof Date ? st.inicio : new Date(st.inicio));
    var dur = st.duracao_seg_form;
    Treino.$('trDuracao').value = dur == null ? '' : String(dur);
    Treino.$('trLocal').value = st.local || '';
    Treino.$('trClima').value = st.clima || '';
    Treino.$('trObs').value = st.obs || '';
    Treino.marcarAmbiente(); Treino.desenharRpe(); Treino.desenharHumor();
    Treino.desenharItens(); Treino.desenharLocais();
    Treino.$('avisoEdicao').classList.toggle('d-none', !st.editando);
    Treino.$('btnSalvarTreino').textContent = st.editando ? 'Salvar alterações' : 'Salvar treino';
  },

  desenharLocais: function () {
    var vistos = {}, lista = [];
    Dados.sessoes.forEach(function (s) { if (s.local && !vistos[s.local]) { vistos[s.local] = 1; lista.push(s.local); } });
    ['Sala de casa', 'Academia', 'Parque'].forEach(function (l) { if (!vistos[l]) lista.push(l); });
    Treino.$('listaLocais').innerHTML = lista.map(function (l) { return '<option value="' + Util.esc(l) + '">'; }).join('');
  },

  marcarAmbiente: function () {
    document.querySelectorAll('[data-amb]').forEach(function (b) {
      var on = b.getAttribute('data-amb') === Treino.st.ambiente;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', on);
    });
    Treino.$('boxClima').classList.toggle('d-none', Treino.st.ambiente !== 'ar_livre');
  },
  desenharRpe: function () {
    var v = Treino.st.rpe;
    Treino.$('trRpe').value = v || 5;
    Treino.$('rpeTexto').textContent = v ? v + ' de 10' : 'não informado';
    Treino.$('btnRpeLimpar').classList.toggle('d-none', !v);
  },
  desenharHumor: function () {
    var box = Treino.$('trHumor');
    box.innerHTML = Util.HUMOR_FA.map(function (e, i) {
      return '<button type="button" class="btn btn-outline-secondary humor-btn' + (Treino.st.humor === i + 1 ? ' active' : '') +
        '" data-humor="' + (i + 1) + '" aria-label="' + e.t + ' (' + (i + 1) + ' de 5)" title="' + e.t + '" aria-pressed="' + (Treino.st.humor === i + 1) + '"><i class="fa-solid ' + e.c + '"></i></button>';
    }).join('');
  },

  /* ---------- itens ---------- */
  campoNum: function (rot, campo, i, val, attrs, col) {
    return '<div class="' + (col || 'col-4') + '"><label class="form-label small mb-1">' + rot + '</label>' +
      '<input class="form-control" type="number" inputmode="decimal" min="0" ' + (attrs || '') + ' data-i="' + i + '" data-campo="' + campo + '" value="' + (val == null ? '' : val) + '"></div>';
  },
  itemHtml: function (it, i) {
    var ex = Dados.exMap[it.exercicio_id];
    if (!ex) return '';
    var N = Treino.campoNum, seg = it.duracao_seg;
    var min = seg ? Math.floor(seg / 60) : '', ss = seg ? seg % 60 : '';
    var campos = '';
    if (ex.modo === 'repeticoes' || ex.modo === 'misto') {
      campos += N('Séries', 'series', i, it.series, 'step="1" max="200"') + N('Repetições', 'reps', i, it.reps, 'step="1" max="100000"');
      if (ex.modo === 'repeticoes') campos += N('Carga (kg)', 'carga_kg', i, it.carga_kg, 'step="0.5" max="1000"');
    }
    if (ex.modo === 'distancia_tempo') campos += N('Distância (km)', 'distancia_km', i, it.distancia_km, 'step="0.01" max="1000"', 'col-12 col-sm-4');
    if (ex.modo !== 'repeticoes') {
      campos += N('Minutos', 'min', i, min, 'step="1" max="1440"') + N('Segundos', 'seg', i, ss, 'step="1" max="59"');
    }
    var bike = '';
    if (ex.campos_bike) {
      bike = '<div class="row g-2 mt-1">' +
        N('Distância (km)', 'distancia_km', i, it.distancia_km, 'step="0.01" max="1000"', 'col-6 col-sm-3') +
        N('Resistência (1–20)', 'resistencia', i, it.resistencia, 'step="1" min="1" max="20"', 'col-6 col-sm-3') +
        N('Cadência (rpm)', 'cadencia_rpm', i, it.cadencia_rpm, 'step="1" max="300"', 'col-6 col-sm-3') +
        N('Calorias do aparelho', 'calorias_aparelho', i, it.calorias_aparelho, 'step="1"', 'col-6 col-sm-3') +
        '<div class="col-12"><label class="form-label small mb-1">Tipo de treino</label><select class="form-select" data-i="' + i + '" data-campo="tipo_treino">' +
        '<option value="">—</option>' + Object.keys(Dados.TIPO_TREINO).map(function (k) {
          return '<option value="' + k + '"' + (it.tipo_treino === k ? ' selected' : '') + '>' + Dados.TIPO_TREINO[k] + '</option>';
        }).join('') + '</select></div></div>';
    }
    var ult = Dados.ultimoItem(ex.id, Treino.st.id);
    var dica = ult ? 'Última vez: ' + Util.esc(Dados.resumoItem(ult)) : '';
    return '<div class="card mb-2 item-card" data-card="' + i + '"><div class="card-body py-2">' +
      '<div class="d-flex justify-content-between align-items-start">' +
      '<div class="fw-semibold">' + Util.iconeEx(ex) + ' ' + Util.esc(ex.nome) + '</div>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" data-remover="' + i + '" aria-label="Remover ' + Util.esc(ex.nome) + '"><i class="fa-solid fa-xmark"></i></button></div>' +
      (dica ? '<div class="small text-body-secondary mb-1">' + dica + '</div>' : '') +
      '<div class="row g-2">' + campos + '</div>' + bike +
      '<div class="small text-body-secondary mt-1" data-live="' + i + '"></div></div></div>';
  },
  desenharItens: function () {
    var box = Treino.$('trItens');
    box.innerHTML = Treino.st.itens.length
      ? Treino.st.itens.map(Treino.itemHtml).join('')
      : '<p class="text-body-secondary small mb-2">Nenhum exercício ainda. Toque em “Adicionar exercício”.</p>';
    Treino.st.itens.forEach(function (_, i) { Treino.live(i); });
  },
  live: function (i) {
    var it = Treino.st.itens[i], el = document.querySelector('[data-live="' + i + '"]');
    if (!el || !it) return;
    var r = Dados.ritmo(it.distancia_km, it.duracao_seg), v = Dados.velocidade(it.distancia_km, it.duracao_seg);
    el.textContent = (r && v) ? 'Ritmo ' + Dados.fmtRitmo(r) + ' · ' + Dados.fmtNum(v, 1) + ' km/h' : '';
  },
  lerCampo: function (el) {
    var i = +el.getAttribute('data-i'), c = el.getAttribute('data-campo'), it = Treino.st.itens[i];
    if (!it) return;
    if (c === 'min' || c === 'seg') {
      var card = el.closest('[data-card]');
      var m = parseFloat(card.querySelector('[data-campo="min"]').value) || 0;
      var s = parseFloat(card.querySelector('[data-campo="seg"]').value) || 0;
      var total = Math.round(Math.max(0, m) * 60 + Math.max(0, s));
      it.duracao_seg = total > 0 ? total : null;
    } else if (c === 'tipo_treino') {
      it.tipo_treino = el.value || null;
    } else {
      var v = el.value === '' ? null : Number(el.value);
      if (v != null && (isNaN(v) || v < 0)) v = null;
      if (v != null && ['series', 'reps', 'resistencia', 'cadencia_rpm', 'calorias_aparelho'].indexOf(c) >= 0) v = Math.round(v);
      it[c] = v;
    }
    Treino.live(i);
  },

  /* ---------- seletor de exercício ---------- */
  abrirSeletor: function () {
    Treino.$('pkBusca').value = '';
    Treino.$('pkCategoria').value = '';
    Treino.$('pkAmbiente').value = '';
    Treino.desenharSeletor();
    bootstrap.Modal.getOrCreateInstance(Treino.$('modalExercicio')).show();
  },
  desenharSeletor: function () {
    var q = Treino.$('pkBusca').value.trim().toLowerCase(), cat = Treino.$('pkCategoria').value, amb = Treino.$('pkAmbiente').value;
    var norm = function (s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
    var lista = Dados.ex.filter(function (e) {
      return (!q || norm(e.nome).indexOf(norm(q)) >= 0) && (!cat || e.categoria === cat) && (!amb || (e.ambientes || []).indexOf(amb) >= 0);
    });
    var rec = '';
    if (!q && !cat && !amb) {
      var vistos = {}, ids = [];
      Dados.sessoes.slice(0, 20).forEach(function (s) { (s.itens || []).forEach(function (i) { if (!vistos[i.exercicio_id] && Dados.exMap[i.exercicio_id] && ids.length < 6) { vistos[i.exercicio_id] = 1; ids.push(i.exercicio_id); } }); });
      if (ids.length) rec = '<div class="mb-2"><div class="small text-body-secondary mb-1">Recentes</div><div class="d-flex flex-wrap gap-1">' + ids.map(function (id) {
        var e = Dados.exMap[id]; return '<button type="button" class="btn btn-sm btn-outline-primary" data-escolher="' + id + '">' + Util.iconeEx(e) + ' ' + Util.esc(e.nome) + '</button>';
      }).join('') + '</div></div>';
    }
    Treino.$('pkLista').innerHTML = rec + (lista.length ? lista.map(function (e) {
      return '<div class="list-group-item d-flex align-items-center gap-2 px-0">' +
        '<button type="button" class="btn btn-link text-reset text-start flex-grow-1 p-2" data-escolher="' + e.id + '">' +
        '<span class="fs-5 me-2">' + Util.iconeEx(e) + '</span><span class="fw-semibold">' + Util.esc(e.nome) + '</span>' +
        '<span class="d-block small text-body-secondary">' + Util.esc(Dados.CAT[e.categoria]) + ' · ' + Util.esc(Dados.EQUIP[e.equipamento] || e.equipamento) +
        (e.user_id ? ' · meu' : '') + '</span></button>' +
        (e.user_id ? '<button type="button" class="btn btn-sm btn-outline-danger" data-excluir-ex="' + e.id + '" aria-label="Excluir ' + Util.esc(e.nome) + '"><i class="fa-solid fa-trash"></i></button>' : '') +
        '</div>';
    }).join('') : '<div class="text-body-secondary small py-3">Nenhum exercício encontrado. Você pode criar o seu abaixo.</div>');
  },
  escolher: function (id) {
    Treino.st.itens.push({ exercicio_id: id, series: null, reps: null, carga_kg: null, duracao_seg: null, distancia_km: null, resistencia: null, cadencia_rpm: null, calorias_aparelho: null, tipo_treino: null });
    bootstrap.Modal.getOrCreateInstance(Treino.$('modalExercicio')).hide();
    Treino.desenharItens();
    var cards = document.querySelectorAll('.item-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ block: 'center' });
  },
  criarExercicio: async function (ev) {
    ev.preventDefault();
    var nome = Treino.$('nxNome').value.trim();
    if (!nome) return Util.toast('Informe o nome do exercício.', 'erro');
    var amb = Array.prototype.map.call(document.querySelectorAll('[name="nxAmb"]:checked'), function (c) { return c.value; });
    if (!amb.length) amb = ['casa'];
    var met = Number(Treino.$('nxMet').value) || 4;
    try {
      var e = await Dados.criarExercicio({
        nome: nome, categoria: Treino.$('nxCategoria').value, modo: Treino.$('nxModo').value, met: Math.min(25, Math.max(0.5, met)),
        equipamento: Treino.$('nxEquip').value, ambientes: amb, icone: 'fa-' + (Treino.$('nxIcone').value || 'dumbbell')
      });
      Treino.$('frmNovoEx').reset();
      Util.toast('Exercício criado.', 'ok');
      Treino.escolher(e.id);
    } catch (err) {
      Util.toast(/duplicate|unique/i.test(err.message || '') ? 'Você já tem um exercício com esse nome.' : 'Não foi possível criar (precisa de internet).', 'erro');
    }
  },
  excluirExercicio: async function (id) {
    var e = Dados.exMap[id]; if (!e) return;
    if (!(await Util.confirmar('Excluir o exercício "' + e.nome + '"?', 'Excluir'))) return;
    try { await Dados.excluirExercicio(id); Treino.desenharSeletor(); Util.toast('Exercício excluído.', 'ok'); }
    catch (err) { Util.toast('Esse exercício já foi usado em treinos e não pode ser excluído.', 'erro'); }
  },

  /* ---------- carregar modelos ---------- */
  copiarItens: function (itens) {
    return itens.map(function (i) { var c = JSON.parse(JSON.stringify(i)); delete c.id; delete c.sessao_id; delete c.user_id; delete c.ordem; return c; });
  },
  repetirUltimo: function () {
    var s = Dados.sessoes[0];
    if (!s) { Util.toast('Você ainda não tem treinos para repetir.', 'info'); return; }
    Treino.st = Treino.novoEstado();
    Treino.st.inicio = new Date();
    Treino.st.ambiente = s.ambiente || 'casa'; Treino.st.local = s.local || '';
    Treino.st.itens = Treino.copiarItens(s.itens || []);
    App.ir('registrar'); Treino.desenharTudo();
    Util.toast('Último treino copiado. Ajuste e salve.', 'info');
  },
  editar: function (id) {
    var s = Dados.sessoes.filter(function (x) { return x.id === id; })[0]; if (!s) return;
    Treino.st = {
      id: s.id, inicio: new Date(s.inicio), ambiente: s.ambiente || 'casa', local: s.local || '', rpe: s.rpe || null, humor: s.humor || null,
      clima: s.clima || '', obs: s.observacoes || '', itens: Treino.copiarItens(s.itens || []), editando: true,
      duracao_seg_form: s.duracao_seg ? Math.round(s.duracao_seg / 6) / 10 : null
    };
    App.ir('registrar'); Treino.desenharTudo();
  },

  /* ---------- salvar ---------- */
  validar: function () {
    var st = Treino.st;
    if (!st.itens.length) return 'Adicione pelo menos um exercício.';
    for (var i = 0; i < st.itens.length; i++) {
      var it = st.itens[i], ex = Dados.exMap[it.exercicio_id], nome = ex ? ex.nome : 'exercício';
      var temReps = it.reps > 0, temDur = it.duracao_seg > 0, temDist = it.distancia_km > 0;
      var ok = ex.modo === 'repeticoes' ? temReps : ex.modo === 'tempo' ? (temDur || (ex.campos_bike && temDist))
        : ex.modo === 'distancia_tempo' ? (temDist || temDur) : (temReps || temDur);
      if (!ok) return 'Preencha os dados de "' + nome + '" (ou remova o exercício).';
      if (it.duracao_seg > 86400) return '"' + nome + '": duração acima de 24 horas.';
      if (it.resistencia != null && (it.resistencia < 1 || it.resistencia > 20)) return '"' + nome + '": resistência deve ficar entre 1 e 20.';
    }
    var ini = new Date(Treino.$('trInicio').value);
    if (isNaN(ini.getTime())) return 'Informe a data e a hora do treino.';
    if (ini.getTime() > Date.now() + 3600000) return 'A data do treino está no futuro.';
    var d = parseFloat(Treino.$('trDuracao').value);
    if (!isNaN(d) && (d < 0 || d > 1440)) return 'A duração total precisa ficar entre 0 e 24 horas.';
    return null;
  },
  salvar: async function (ev) {
    ev.preventDefault();
    var erro = Treino.validar();
    if (erro) return Util.toast(erro, 'erro');
    var st = Treino.st, btn = Treino.$('btnSalvarTreino'); btn.disabled = true;
    try {
      var itens = st.itens, somaDur = itens.reduce(function (a, i) { return a + (i.duracao_seg || 0); }, 0);
      var dm = parseFloat(Treino.$('trDuracao').value);
      var dur = !isNaN(dm) && dm > 0 ? Math.round(dm * 60) : (somaDur > 0 ? somaDur : null);
      var id = st.id || Dados.novoId();
      var sessao = {
        id: id, inicio: new Date(Treino.$('trInicio').value).toISOString(), duracao_seg: dur,
        local: Treino.$('trLocal').value.trim() || null, ambiente: st.ambiente, rpe: st.rpe, humor: st.humor,
        clima: st.ambiente === 'ar_livre' ? (Treino.$('trClima').value.trim() || null) : null,
        observacoes: Treino.$('trObs').value.trim() || null, itens: itens, calorias: null
      };
      sessao.data = Dados.tzData(sessao.inicio);
      sessao.calorias = Dados.calorias(sessao, (Perfil.dados || {}).peso);
      var prs = [];
      itens.forEach(function (it) { prs = prs.concat(Dados.recordes(it, id)); });
      await Dados.salvar(sessao);
      Treino.cronoZerar();
      Util.toast(st.editando ? 'Treino atualizado.' : 'Treino salvo.', 'ok');
      Treino.limpar();
      App.ir('historico');
      if (prs.length) Treino.celebrar(prs);
    } catch (e) {
      Util.toast('Não foi possível salvar o treino: ' + (e.message || e), 'erro');
    } finally { btn.disabled = false; }
  },
  celebrar: function (prs) {
    Treino.$('listaRecordes').innerHTML = prs.map(function (p) {
      return '<li class="list-group-item">' + p.iconeHtml + ' <strong>' + Util.esc(p.exercicio) + '</strong>: ' + Util.esc(p.rotulo) +
        ' — <strong>' + Util.esc(p.valor) + '</strong> <span class="text-body-secondary small">(antes: ' + Util.esc(p.anterior) + ')</span></li>';
    }).join('');
    bootstrap.Modal.getOrCreateInstance(Treino.$('modalRecorde')).show();
  },

  /* ---------- ligações (feitas uma vez, na inicialização) ---------- */
  init: function () {
    var $ = Treino.$;
    Treino.st = Treino.novoEstado(); Treino.st.inicio = new Date();
    $('btnCronoToggle').addEventListener('click', Treino.cronoToggle);
    $('btnCronoFinalizar').addEventListener('click', Treino.cronoFinalizar);
    $('btnCronoZerar').addEventListener('click', Treino.cronoZerar);
    setInterval(function () { if (!document.hidden && Util.userId) Treino.cronoDesenhar(); }, 500);
    ['btnRepetirUltimo', 'btnRepetirInicio'].forEach(function (b) { $(b).addEventListener('click', Treino.repetirUltimo); });
    $('btnAddExercicio').addEventListener('click', Treino.abrirSeletor);
    $('frmTreino').addEventListener('submit', Treino.salvar);
    $('btnCancelarEdicao').addEventListener('click', function () { Treino.limpar(); App.ir('historico'); });
    document.querySelectorAll('[data-amb]').forEach(function (b) {
      b.addEventListener('click', function () { Treino.st.ambiente = b.getAttribute('data-amb'); Treino.marcarAmbiente(); });
    });
    $('trLocal').addEventListener('input', function (e) { Treino.st.local = e.target.value; });
    $('trClima').addEventListener('input', function (e) { Treino.st.clima = e.target.value; });
    $('trObs').addEventListener('input', function (e) { Treino.st.obs = e.target.value; });
    $('trRpe').addEventListener('input', function (e) { Treino.st.rpe = Number(e.target.value); Treino.desenharRpe(); });
    $('btnRpeLimpar').addEventListener('click', function () { Treino.st.rpe = null; Treino.desenharRpe(); });
    $('trHumor').addEventListener('click', function (e) {
      var b = e.target.closest('[data-humor]'); if (!b) return;
      var v = Number(b.getAttribute('data-humor'));
      Treino.st.humor = Treino.st.humor === v ? null : v; Treino.desenharHumor();
    });
    $('trItens').addEventListener('input', function (e) { var el = e.target.closest('[data-campo]'); if (el) Treino.lerCampo(el); });
    $('trItens').addEventListener('change', function (e) { var el = e.target.closest('[data-campo]'); if (el) Treino.lerCampo(el); });
    $('trItens').addEventListener('click', function (e) {
      var b = e.target.closest('[data-remover]'); if (!b) return;
      Treino.st.itens.splice(Number(b.getAttribute('data-remover')), 1); Treino.desenharItens();
    });
    ['pkBusca', 'pkCategoria', 'pkAmbiente'].forEach(function (id) { $(id).addEventListener('input', Treino.desenharSeletor); });
    $('pkLista').addEventListener('click', function (e) {
      var esc = e.target.closest('[data-escolher]'), del = e.target.closest('[data-excluir-ex]');
      if (esc) Treino.escolher(esc.getAttribute('data-escolher'));
      else if (del) Treino.excluirExercicio(del.getAttribute('data-excluir-ex'));
    });
    $('nxIcone').innerHTML = Util.FA_ICONES.map(function (i) { return '<option value="' + i.k + '">' + i.nome + '</option>'; }).join('');
    $('frmNovoEx').addEventListener('submit', Treino.criarExercicio);
    document.addEventListener('dados:atualizados', function () { Treino.desenharLocais(); });
    Treino.desenharTudo();
    Treino.cronoDesenhar();
  },
  aoAbrir: function () { Treino.desenharLocais(); Treino.cronoDesenhar(); }
};

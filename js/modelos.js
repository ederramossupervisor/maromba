/* Modelos de treino: lista, editor e atalho para o treino guiado. */
var Modelos = {
  ed: null,
  $: function (id) { return document.getElementById(id); },

  resumoItem: function (i) {
    var p = [];
    var por = i.reps ? i.reps + ' reps' : (i.duracao_seg ? Dados.fmtDur(i.duracao_seg) : '');
    p.push(i.series + (por ? ' × ' + por : ' série(s)'));
    if (i.carga_kg) p.push(Dados.fmtNum(i.carga_kg) + ' kg');
    if (i.distancia_km) p.push(Dados.fmtNum(i.distancia_km, 2) + ' km');
    if (i.descanso_seg) p.push('descanso ' + i.descanso_seg + ' s');
    return p.join(' · ');
  },

  /* ---------- lista ---------- */
  cartao: function (m) {
    var meu = !!m.user_id, est = Dados.estimarModelo(m);
    var itens = (m.itens || []).map(function (i) {
      var e = Dados.exMap[i.exercicio_id];
      return '<li>' + (e ? Util.esc(e.icone) + ' <strong>' + Util.esc(e.nome) + '</strong>' : 'Exercício removido') + ' <span class="text-body-secondary">— ' + Util.esc(Modelos.resumoItem(i)) + '</span></li>';
    }).join('');
    return '<div class="card mb-2"><div class="card-body">' +
      '<div class="fw-semibold">' + Util.esc(m.nome) + '</div>' +
      '<div class="small text-body-secondary">≈ ' + est + ' min · ' + (m.itens || []).length + ' exercícios' + (m.ambiente ? ' · ' + Util.esc(Dados.AMB[m.ambiente]) : '') + (m.circuito ? ' · circuito' : '') + '</div>' +
      (m.descricao ? '<div class="small mt-1">' + Util.esc(m.descricao) + '</div>' : '') +
      '<details class="mt-2"><summary class="small">Ver exercícios</summary><ul class="small mt-2 mb-0 ps-3">' + itens + '</ul></details>' +
      '<div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary btn-sm" data-md-iniciar="' + Util.esc(m.id) + '"><i class="fa-solid fa-play me-1"></i>Iniciar</button>' +
      (meu ? '<button class="btn btn-outline-secondary btn-sm" data-md-editar="' + Util.esc(m.id) + '">Editar</button><button class="btn btn-outline-danger btn-sm" data-md-excluir="' + Util.esc(m.id) + '">Excluir</button>'
           : '<button class="btn btn-outline-secondary btn-sm" data-md-copiar="' + Util.esc(m.id) + '">Copiar para editar</button>') +
      '</div></div></div>';
  },
  render: function () {
    if (!Util.userId || !Modelos.$('mdMeus')) return;
    var meus = Dados.modelos.filter(function (m) { return m.user_id; }), prontos = Dados.modelos.filter(function (m) { return !m.user_id; });
    Modelos.$('mdMeus').innerHTML = meus.length ? meus.map(Modelos.cartao).join('') : '<div class="card"><div class="card-body text-center text-body-secondary small">Você ainda não criou modelos. Toque em “Novo modelo” ou copie um dos modelos prontos.</div></div>';
    Modelos.$('mdProntos').innerHTML = prontos.map(Modelos.cartao).join('');
    Guiado.atualizarBanners();
  },

  /* ---------- editor ---------- */
  novoEstado: function () { return { id: null, nome: '', descricao: '', ambiente: 'casa', circuito: false, itens: [] }; },
  abrirEditor: function (m, copia) {
    Modelos.ed = Modelos.novoEstado();
    if (m) {
      Modelos.ed.id = copia ? null : m.id; Modelos.ed.nome = copia ? m.nome + ' (cópia)' : m.nome;
      Modelos.ed.descricao = m.descricao || ''; Modelos.ed.ambiente = m.ambiente || ''; Modelos.ed.circuito = !!m.circuito;
      Modelos.ed.itens = (m.itens || []).map(function (i) { return { exercicio_id: i.exercicio_id, series: i.series, reps: i.reps, duracao_seg: i.duracao_seg, carga_kg: i.carga_kg, distancia_km: i.distancia_km, descanso_seg: i.descanso_seg }; });
    }
    Modelos.$('mdTituloEd').textContent = Modelos.ed.id ? 'Editar modelo' : 'Novo modelo';
    Modelos.$('mdNome').value = Modelos.ed.nome; Modelos.$('mdDescricao').value = Modelos.ed.descricao;
    Modelos.$('mdAmbiente').value = Modelos.ed.ambiente; Modelos.$('mdCircuito').checked = Modelos.ed.circuito;
    Modelos.desenharItens(); App.ir('modelo');
  },
  campo: function (rot, campo, i, val, attrs, col) {
    return '<div class="' + (col || 'col-4') + '"><label class="form-label small mb-1">' + rot + '</label><input class="form-control" type="number" inputmode="decimal" min="0" ' + (attrs || '') +
      ' data-i="' + i + '" data-campo="' + campo + '" value="' + (val == null ? '' : val) + '"></div>';
  },
  itemHtml: function (it, i, total) {
    var ex = Dados.exMap[it.exercicio_id]; if (!ex) return '';
    var N = Modelos.campo, h = '';
    h += N('Séries', 'series', i, it.series, 'step="1" min="1" max="50"');
    if (ex.modo === 'repeticoes' || ex.modo === 'misto') h += N('Repetições', 'reps', i, it.reps, 'step="1" max="10000"');
    if (ex.modo !== 'repeticoes') h += N(ex.modo === 'misto' ? 'ou tempo (s)' : 'Tempo (s)', 'duracao_seg', i, it.duracao_seg, 'step="1" max="86400"');
    if (ex.modo === 'repeticoes') h += N('Carga (kg)', 'carga_kg', i, it.carga_kg, 'step="0.5" max="1000"');
    if (ex.modo === 'distancia_tempo' || ex.campos_bike) h += N('Distância (km)', 'distancia_km', i, it.distancia_km, 'step="0.01" max="1000"');
    h += N('Descanso (s)', 'descanso_seg', i, it.descanso_seg, 'step="5" max="600"');
    return '<div class="card mb-2 item-card"><div class="card-body py-2"><div class="d-flex justify-content-between align-items-center mb-1">' +
      '<div class="fw-semibold">' + Util.esc(ex.icone) + ' ' + Util.esc(ex.nome) + '</div><div class="btn-group btn-group-sm">' +
      '<button type="button" class="btn btn-outline-secondary" data-mv="' + i + '" data-dir="-1" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '><i class="fa-solid fa-arrow-up"></i></button>' +
      '<button type="button" class="btn btn-outline-secondary" data-mv="' + i + '" data-dir="1" aria-label="Descer"' + (i === total - 1 ? ' disabled' : '') + '><i class="fa-solid fa-arrow-down"></i></button>' +
      '<button type="button" class="btn btn-outline-danger" data-rm="' + i + '" aria-label="Remover"><i class="fa-solid fa-xmark"></i></button></div></div><div class="row g-2">' + h + '</div></div></div>';
  },
  desenharItens: function () {
    var its = Modelos.ed.itens;
    Modelos.$('mdItens').innerHTML = its.length ? its.map(function (it, i) { return Modelos.itemHtml(it, i, its.length); }).join('')
      : '<p class="text-body-secondary small">Nenhum exercício ainda. Toque em “Adicionar exercício”.</p>';
    Modelos.$('mdEstimativa').textContent = its.length ? 'Duração estimada: ≈ ' + Dados.estimarModelo({ itens: its }) + ' min' : '';
  },
  lerCampo: function (el) {
    var it = Modelos.ed.itens[Number(el.getAttribute('data-i'))], c = el.getAttribute('data-campo');
    var v = el.value === '' ? null : Number(el.value); if (v != null && (isNaN(v) || v < 0)) v = null;
    if (v != null && c !== 'carga_kg' && c !== 'distancia_km') v = Math.round(v);
    it[c] = v;
    Modelos.$('mdEstimativa').textContent = 'Duração estimada: ≈ ' + Dados.estimarModelo({ itens: Modelos.ed.itens }) + ' min';
  },
  validar: function (m) {
    if (!m.nome.trim()) return 'Dê um nome ao modelo.';
    if (!m.itens.length) return 'Adicione pelo menos um exercício.';
    for (var i = 0; i < m.itens.length; i++) {
      var it = m.itens[i], ex = Dados.exMap[it.exercicio_id], nome = ex ? ex.nome : 'exercício';
      if (!(it.series >= 1 && it.series <= 50)) return '"' + nome + '": séries entre 1 e 50.';
      var ok = ex.modo === 'repeticoes' ? it.reps > 0 : ex.modo === 'misto' ? (it.reps > 0 || it.duracao_seg > 0) : (it.duracao_seg > 0 || it.distancia_km > 0);
      if (!ok) return 'Preencha o alvo de "' + nome + '" (repetições ou tempo).';
      if (it.descanso_seg == null) it.descanso_seg = 30;
      if (it.descanso_seg > 600) return '"' + nome + '": descanso de até 600 segundos.';
    }
    return null;
  },
  salvar: async function (ev) {
    ev.preventDefault();
    var m = { id: Modelos.ed.id, nome: Modelos.$('mdNome').value.trim(), descricao: Modelos.$('mdDescricao').value.trim() || null,
      ambiente: Modelos.$('mdAmbiente').value || null, circuito: Modelos.$('mdCircuito').checked, itens: Modelos.ed.itens };
    var erro = Modelos.validar(m); if (erro) return Util.toast(erro, 'erro');
    var btn = Modelos.$('btnSalvarModelo'); btn.disabled = true;
    try { await Dados.salvarModelo(m); Util.toast('Modelo salvo.', 'ok'); App.ir('modelos'); }
    catch (e) { Util.toast(/Sem internet/.test(e.message || '') ? e.message : (/unique|duplicate/i.test(e.message || '') ? 'Você já tem um modelo com esse nome.' : 'Não foi possível salvar: ' + (e.message || e)), 'erro'); }
    btn.disabled = false;
  },

  achar: function (id) { return Dados.modelos.filter(function (m) { return m.id === id; })[0]; },
  init: function () {
    var $ = Modelos.$;
    $('btnNovoModelo').addEventListener('click', function () { Modelos.abrirEditor(null); });
    $('pagModelos').addEventListener('click', async function (e) {
      var ini = e.target.closest('[data-md-iniciar]'), ed = e.target.closest('[data-md-editar]'), cp = e.target.closest('[data-md-copiar]'), ex = e.target.closest('[data-md-excluir]');
      if (ini) Guiado.iniciar(Modelos.achar(ini.getAttribute('data-md-iniciar')));
      if (ed) Modelos.abrirEditor(Modelos.achar(ed.getAttribute('data-md-editar')), false);
      if (cp) Modelos.abrirEditor(Modelos.achar(cp.getAttribute('data-md-copiar')), true);
      if (ex && await Util.confirmar('Excluir este modelo? Não dá para desfazer.', 'Excluir')) {
        try { await Dados.excluirModelo(ex.getAttribute('data-md-excluir')); Util.toast('Modelo excluído.', 'ok'); }
        catch (err) { Util.toast(/Sem internet/.test(err.message || '') ? err.message : 'Não foi possível excluir.', 'erro'); }
      }
    });
    $('btnAddExModelo').addEventListener('click', function () {
      Treino.abrirSeletor(function (id) {
        var ex = Dados.exMap[id];
        Modelos.ed.itens.push({ exercicio_id: id, series: ex.modo === 'distancia_tempo' || ex.campos_bike ? 1 : 3, reps: ex.modo === 'repeticoes' ? 10 : null,
          duracao_seg: (ex.modo === 'tempo' || ex.modo === 'distancia_tempo') ? (ex.campos_bike ? 1800 : 30) : null, carga_kg: null, distancia_km: null, descanso_seg: 30 });
        Modelos.desenharItens();
      });
    });
    $('mdItens').addEventListener('input', function (e) { var el = e.target.closest('[data-campo]'); if (el) Modelos.lerCampo(el); });
    $('mdItens').addEventListener('click', function (e) {
      var mv = e.target.closest('[data-mv]'), rm = e.target.closest('[data-rm]'), its = Modelos.ed.itens;
      if (mv) { var i = Number(mv.getAttribute('data-mv')), j = i + Number(mv.getAttribute('data-dir')); if (its[j]) { var t = its[i]; its[i] = its[j]; its[j] = t; Modelos.desenharItens(); } }
      if (rm) { its.splice(Number(rm.getAttribute('data-rm')), 1); Modelos.desenharItens(); }
    });
    $('frmModelo').addEventListener('submit', Modelos.salvar);
    $('btnCancelarModelo').addEventListener('click', function () { App.ir('modelos'); });
    document.addEventListener('dados:atualizados', Modelos.render);
  },
  aoAbrir: function () { Modelos.render(); }
};

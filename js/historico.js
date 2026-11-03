/* Tela "Histórico" */
var Historico = {
  $: function (id) { return document.getElementById(id); },

  preencherFiltros: function () {
    var $ = Historico.$;
    var guardar = { ex: $('hfExercicio').value, loc: $('hfLocal').value, eq: $('hfEquip').value };
    var usados = {}, locais = {}, equips = {};
    Dados.sessoes.forEach(function (s) {
      if (s.local) locais[s.local] = 1;
      (s.itens || []).forEach(function (i) {
        usados[i.exercicio_id] = 1;
        var e = Dados.exMap[i.exercicio_id]; if (e) equips[e.equipamento] = 1;
      });
    });
    var opt = function (v, t) { return '<option value="' + Util.esc(v) + '">' + Util.esc(t) + '</option>'; };
    $('hfExercicio').innerHTML = opt('', 'Todos os exercícios') + Dados.ex.filter(function (e) { return usados[e.id]; })
      .map(function (e) { return opt(e.id, e.nome); }).join('');
    $('hfLocal').innerHTML = opt('', 'Todos os locais') + Object.keys(locais).sort().map(function (l) { return opt(l, l); }).join('');
    $('hfEquip').innerHTML = opt('', 'Todos os equipamentos') + Object.keys(equips).sort().map(function (k) { return opt(k, Dados.EQUIP[k] || k); }).join('');
    $('hfExercicio').value = guardar.ex; $('hfLocal').value = guardar.loc; $('hfEquip').value = guardar.eq;
  },

  filtrar: function () {
    var $ = Historico.$, per = $('hfPeriodo').value, ex = $('hfExercicio').value, loc = $('hfLocal').value, eq = $('hfEquip').value;
    var de = null, ate = null;
    if (per === 'custom') { de = $('hfDe').value || null; ate = $('hfAte').value || null; }
    else if (per !== 'todos') { de = Dados.tzData(Date.now() - (Number(per) - 1) * 86400000); }
    return Dados.sessoes.filter(function (s) {
      var d = s.data || Dados.tzData(s.inicio);
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      if (loc && s.local !== loc) return false;
      if (ex && !(s.itens || []).some(function (i) { return i.exercicio_id === ex; })) return false;
      if (eq && !(s.itens || []).some(function (i) { var e = Dados.exMap[i.exercicio_id]; return e && e.equipamento === eq; })) return false;
      return true;
    });
  },

  render: function () {
    var $ = Historico.$;
    $('boxPersonalizado').classList.toggle('d-none', $('hfPeriodo').value !== 'custom');
    var lista = Historico.filtrar();
    var total = lista.reduce(function (a, s) { return a + (s.duracao_seg || 0); }, 0);
    $('hResumo').textContent = lista.length
      ? lista.length + (lista.length === 1 ? ' treino' : ' treinos') + (total ? ' · ' + Dados.fmtDur(total) + ' no total' : '')
      : '';
    if (!lista.length) {
      $('hLista').innerHTML = '<div class="card"><div class="card-body text-center text-body-secondary">' +
        (Dados.sessoes.length ? 'Nenhum treino com esses filtros.' : 'Você ainda não registrou nenhum treino. Que tal começar agora?') + '</div></div>';
      return;
    }
    $('hLista').innerHTML = lista.map(function (s) {
      var itens = (s.itens || []).map(function (i) {
        var e = Dados.exMap[i.exercicio_id];
        return '<li>' + (e ? Util.esc(e.icone) + ' <strong>' + Util.esc(e.nome) + '</strong>' : 'Exercício removido') +
          (Dados.resumoItem(i) ? ' <span class="text-body-secondary">— ' + Util.esc(Dados.resumoItem(i)) + '</span>' : '') + '</li>';
      }).join('');
      var meta = [];
      if (s.local) meta.push('<i class="fa-solid fa-location-dot"></i> ' + Util.esc(s.local));
      if (s.ambiente) meta.push(Util.esc(Dados.AMB[s.ambiente]));
      if (s.duracao_seg) meta.push('<i class="fa-regular fa-clock"></i> ' + Dados.fmtDur(s.duracao_seg));
      if (s.calorias) meta.push('≈ ' + Dados.fmtNum(s.calorias, 0) + ' kcal');
      if (s.rpe) meta.push('esforço ' + s.rpe + '/10');
      if (s.humor) meta.push(Dados.HUMOR[s.humor - 1]);
      return '<div class="card mb-2"><div class="card-body">' +
        '<div class="d-flex justify-content-between align-items-start gap-2">' +
        '<div><div class="fw-semibold">' + Util.esc(Dados.fmtDataHora(s.inicio)) +
        (s.pendente ? ' <span class="badge text-bg-warning ms-1">pendente de envio</span>' : '') + '</div>' +
        '<div class="small text-body-secondary">' + meta.join(' · ') + '</div></div>' +
        '<div class="btn-group btn-group-sm flex-none">' +
        '<button class="btn btn-outline-secondary" data-editar="' + Util.esc(s.id) + '" aria-label="Editar treino"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="btn btn-outline-danger" data-excluir="' + Util.esc(s.id) + '" aria-label="Excluir treino"><i class="fa-solid fa-trash"></i></button></div></div>' +
        '<ul class="list-unstyled small mt-2 mb-0">' + itens + '</ul>' +
        (s.clima ? '<div class="small text-body-secondary mt-1">Clima: ' + Util.esc(s.clima) + '</div>' : '') +
        (s.observacoes ? '<div class="small mt-1 fst-italic">' + Util.esc(s.observacoes) + '</div>' : '') +
        '</div></div>';
    }).join('');
  },

  init: function () {
    var $ = Historico.$;
    ['hfPeriodo', 'hfExercicio', 'hfLocal', 'hfEquip', 'hfDe', 'hfAte'].forEach(function (id) { $(id).addEventListener('change', Historico.render); });
    $('hLista').addEventListener('click', async function (e) {
      var ed = e.target.closest('[data-editar]'), ex = e.target.closest('[data-excluir]');
      if (ed) Treino.editar(ed.getAttribute('data-editar'));
      if (ex && await Util.confirmar('Excluir este treino? Não dá para desfazer.', 'Excluir')) {
        try { await Dados.excluir(ex.getAttribute('data-excluir')); Util.toast('Treino excluído.', 'ok'); }
        catch (err) { Util.toast('Não foi possível excluir.', 'erro'); }
      }
    });
    document.addEventListener('dados:atualizados', function () { Historico.preencherFiltros(); Historico.render(); });
    Historico.preencherFiltros(); Historico.render();
  },
  aoAbrir: function () { Historico.preencherFiltros(); Historico.render(); }
};

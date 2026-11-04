/* Painel (página Início) */
var Inicio = {
  $: function (id) { return document.getElementById(id); },

  resumo: function (sessoes) {
    var hoje = Estat.hoje(), seg = Estat.segunda(hoje), mes = hoje.slice(0, 7);
    var r = { hoje: { min: 0, n: 0 }, semana: { min: 0, n: 0 }, mes: { min: 0, n: 0 }, ultimos7: [] };
    var porDia = {};
    sessoes.forEach(function (s) {
      var d = Estat.dataDe(s), m = Estat.minutos(s);
      porDia[d] = (porDia[d] || 0) + 1;
      if (d === hoje) { r.hoje.min += m; r.hoje.n++; }
      if (d >= seg && d <= hoje) { r.semana.min += m; r.semana.n++; }
      if (d.slice(0, 7) === mes) { r.mes.min += m; r.mes.n++; }
    });
    for (var k = 6; k >= 0; k--) { var d = Estat.addDias(hoje, -k); r.ultimos7.push({ d: d, n: porDia[d] || 0 }); }
    return r;
  },

  render: async function () {
    if (!Util.userId) return;
    var $ = Inicio.$, r = Inicio.resumo(Dados.sessoes);
    var linha = function (x) { return x.n ? Dados.fmtNum(x.min, 0) + ' min · ' + x.n + (x.n === 1 ? ' treino' : ' treinos') : 'Nenhum treino'; };
    $('pnHoje').textContent = linha(r.hoje); $('pnSemana').textContent = linha(r.semana); $('pnMes').textContent = linha(r.mes);
    var sq = await Estat.sequencia();
    $('pnSeqAtual').textContent = sq.atual;
    $('pnSeqTxt').textContent = sq.atual === 0 ? 'Que tal começar uma nova sequência hoje?' : (sq.atual === 1 ? 'dia seguido' : 'dias seguidos') + ' · maior: ' + sq.maior;
    $('pnSemanaDias').innerHTML = r.ultimos7.map(function (x) {
      return '<span class="dia-ponto' + (x.n ? ' on' : '') + '" title="' + Estat.brAno(x.d) + (x.n ? ': treinou' : ': sem treino') + '"><span class="dia-nome">' + Estat.DIA[Estat.dow(x.d)].charAt(0).toUpperCase() + '</span></span>';
    }).join('');
    var u = Dados.sessoes[0], box = $('pnUltimo');
    if (!u) { box.innerHTML = '<p class="text-body-secondary mb-0">Você ainda não registrou treinos. Toque em “Registrar treino” para começar.</p>'; return; }
    var itens = (u.itens || []).slice(0, 4).map(function (i) {
      var e = Dados.exMap[i.exercicio_id];
      return '<li>' + (e ? Util.esc(e.icone) + ' ' + Util.esc(e.nome) : 'Exercício removido') + (Dados.resumoItem(i) ? ' <span class="text-body-secondary">— ' + Util.esc(Dados.resumoItem(i)) + '</span>' : '') + '</li>';
    }).join('');
    var mais = (u.itens || []).length > 4 ? '<li class="text-body-secondary">+ ' + ((u.itens || []).length - 4) + ' exercício(s)</li>' : '';
    box.innerHTML = '<div class="fw-semibold">' + Util.esc(Dados.fmtDataHora(u.inicio)) + '</div>' +
      '<div class="small text-body-secondary mb-1">' + [u.local ? Util.esc(u.local) : '', u.duracao_seg ? Dados.fmtDur(u.duracao_seg) : ''].filter(Boolean).join(' · ') + '</div>' +
      '<ul class="list-unstyled small mb-0">' + itens + mais + '</ul>';
  },

  init: function () {
    document.addEventListener('dados:atualizados', Inicio.render);
  },
  aoAbrir: function () { Inicio.render(); }
};

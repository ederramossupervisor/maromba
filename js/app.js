var App = {
  paginas: [
    { id: 'inicio', nome: 'Início', icone: 'fa-house' },
    { id: 'registrar', nome: 'Registrar treino', icone: 'fa-dumbbell' },
    { id: 'historico', nome: 'Histórico', icone: 'fa-clock-rotate-left' },
    { id: 'metas', nome: 'Metas', icone: 'fa-bullseye' },
    { id: 'estatisticas', nome: 'Estatísticas', icone: 'fa-chart-line' },
    { id: 'config', nome: 'Configurações', icone: 'fa-gear' }
  ],

  montarMenu: function () {
    var html = App.paginas.map(function (p) {
      return '<a class="nav-link" href="#' + p.id + '" data-nav="' + p.id + '"><i class="fa-solid ' + p.icone + ' fa-fw"></i>' + Util.esc(p.nome) + '</a>';
    }).join('');
    document.querySelectorAll('[data-menu]').forEach(function (n) { n.innerHTML = html; });
  },

  ir: function (id) {
    if (!App.paginas.some(function (p) { return p.id === id; })) id = 'inicio';
    document.querySelectorAll('.pagina').forEach(function (s) { s.classList.toggle('d-none', s.getAttribute('data-pagina') !== id); });
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('ativo', a.getAttribute('data-nav') === id); });
    var oc = document.getElementById('menuLateral');
    var inst = bootstrap.Offcanvas.getInstance(oc); if (inst) inst.hide();
    window.scrollTo(0, 0);
    if (id === 'config') App.carregarConvites();
    if (id === 'registrar') Treino.aoAbrir();
    if (id === 'historico') Historico.aoAbrir();
    if (id === 'estatisticas') Estat.aoAbrir();
    if (id === 'metas') Metas.aoAbrir();
    if (id === 'inicio') Inicio.aoAbrir();
  },

  /* ---- convites (somente administrador) ---- */
  ehAdmin: false,
  carregarConvites: async function () {
    if (!App.ehAdmin) return;
    var lista = document.getElementById('listaConvites');
    try {
      var itens = await Api.admin.listarConvites();
      if (!itens.length) { lista.innerHTML = '<div class="list-group-item text-body-secondary small">Nenhum convite ainda.</div>'; return; }
      lista.innerHTML = itens.map(function (c) {
        var ativo = c.situacao === 'ativo';
        var quando = ativo ? 'vale até ' + new Date(c.expira_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          : (c.situacao === 'usado' ? 'usado por ' + Util.esc(c.usado_por_email || '—') : c.situacao);
        return '<div class="list-group-item d-flex justify-content-between align-items-center gap-2 flex-wrap">' +
          '<div><code class="fs-6">' + Util.esc(c.codigo) + '</code><div class="small text-body-secondary">' + quando + '</div></div>' +
          (ativo ? '<div class="btn-group btn-group-sm">' +
            '<button class="btn btn-outline-primary" data-copiar="' + Util.esc(c.codigo) + '">Copiar link</button>' +
            '<button class="btn btn-outline-danger" data-cancelar="' + Util.esc(c.id) + '">Cancelar</button></div>' : '') +
          '</div>';
      }).join('');
    } catch (e) { lista.innerHTML = '<div class="list-group-item text-danger small">Não foi possível carregar os convites.</div>'; }
  },

  ligarConvites: function () {
    document.getElementById('btnNovoConvite').addEventListener('click', async function () {
      try { await Api.admin.criarConvite(); Util.toast('Convite criado.', 'ok'); App.carregarConvites(); }
      catch (e) { Util.toast('Não foi possível criar o convite.', 'erro'); }
    });
    document.getElementById('listaConvites').addEventListener('click', async function (ev) {
      var cp = ev.target.closest('[data-copiar]'), cn = ev.target.closest('[data-cancelar]');
      if (cp) {
        var link = Util.baseUrl() + '?convite=' + cp.getAttribute('data-copiar');
        try { await navigator.clipboard.writeText(link); Util.toast('Link copiado.', 'ok'); }
        catch (e) { window.prompt('Copie o link:', link); }
      }
      if (cn && await Util.confirmar('Cancelar este convite? Ele deixará de funcionar.', 'Cancelar convite')) {
        try { await Api.admin.cancelarConvite(cn.getAttribute('data-cancelar')); App.carregarConvites(); }
        catch (e) { Util.toast('Não foi possível cancelar.', 'erro'); }
      }
    });
  },

  /* ---- PWA ---- */
  registrarSW: function () {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('service-worker.js').then(function (reg) {
      function avisar(sw) {
        document.getElementById('avisoAtualizacao').classList.remove('d-none');
        document.getElementById('btnAtualizar').onclick = function () { sw.postMessage('SKIP_WAITING'); };
      }
      if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var n = reg.installing;
        n.addEventListener('statechange', function () {
          if (n.state === 'installed' && navigator.serviceWorker.controller) avisar(n);
        });
      });
    });
    var recarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (recarregou) return; recarregou = true; location.reload();
    });
  },

  aposLogin: async function () {
    await Dados.carregarLocal();
    App.ir((location.hash || '#inicio').replace('#', ''));
    try { App.ehAdmin = await Api.admin.ehAdmin(); } catch (e) { App.ehAdmin = false; }
    document.getElementById('cardConvites').classList.toggle('d-none', !App.ehAdmin);
    if (App.ehAdmin) App.carregarConvites();
    Dados.iniciar();
  },

  init: function () {
    document.getElementById('appVersao').textContent = Util.VERSAO;
    App.montarMenu();
    Perfil.ligarForm();
    Treino.init();
    Historico.init();
    Estat.init();
    Metas.init();
    Inicio.init();      // ligado na inicialização, não só ao abrir Configurações
    App.ligarConvites();
    var sw = document.getElementById('swEscuro');
    sw.checked = Util.tema.get() === 'dark';
    sw.addEventListener('change', function () { Util.tema.set(sw.checked ? 'dark' : 'light'); });
    document.getElementById('btnSair').addEventListener('click', async function () {
      if (await Util.confirmar('Deseja sair da sua conta?', 'Sair')) Auth.sair();
    });
    window.addEventListener('hashchange', function () { if (Util.userId) App.ir(location.hash.replace('#', '')); });
    // efeito de "ondinha" nos botões (mesmo do app de leitura)
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('.btn'); if (!b || b.disabled) return;
      var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement('span');
      s.className = 'ripple'; s.style.width = s.style.height = d + 'px';
      s.style.left = (ev.clientX - r.left - d / 2) + 'px'; s.style.top = (ev.clientY - r.top - d / 2) + 'px';
      b.appendChild(s); setTimeout(function () { s.remove(); }, 600);
    });
    App.registrarSW();
    Auth.init();
  }
};
document.addEventListener('DOMContentLoaded', App.init);

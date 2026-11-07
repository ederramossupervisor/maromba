var Util = {
  VERSAO: '4.5.0',
  userId: null,
  esc: function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },
  baseUrl: function () { return location.origin + location.pathname.replace(/[^\/]*$/, ''); },
  setUser: function (id) { Util.userId = id; },
  /* localStorage isolado por usuário: u_<id>__chave */
  ls: {
    _k: function (k) { return 'u_' + Util.userId + '__' + k; },
    get: function (k, padrao) {
      try { var v = localStorage.getItem(Util.ls._k(k)); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; }
    },
    set: function (k, v) { try { localStorage.setItem(Util.ls._k(k), JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(Util.ls._k(k)); } catch (e) {} }
  },
  toast: function (msg, tipo) {
    var cor = { ok: 'text-bg-success', erro: 'text-bg-danger', info: 'text-bg-secondary' }[tipo || 'info'];
    var el = document.createElement('div');
    el.className = 'toast align-items-center border-0 ' + cor;
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="d-flex"><div class="toast-body">' + Util.esc(msg) + '</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button></div>';
    document.getElementById('toasts').appendChild(el);
    var t = new bootstrap.Toast(el, { delay: 4000 });
    el.addEventListener('hidden.bs.toast', function () { el.remove(); });
    t.show();
  },
  /* Atenção: o método se chama "confirmar" (não "confirm"). Retorna Promise<boolean>. */
  confirmar: function (texto, rotuloSim) {
    return new Promise(function (resolve) {
      var m = document.getElementById('modalConfirmar');
      document.getElementById('modalConfirmarTexto').textContent = texto;
      var sim = document.getElementById('modalConfirmarSim');
      sim.textContent = rotuloSim || 'Confirmar';
      var inst = bootstrap.Modal.getOrCreateInstance(m);
      var resposta = false;
      function onSim() { resposta = true; inst.hide(); }
      function onFim() { sim.removeEventListener('click', onSim); m.removeEventListener('hidden.bs.modal', onFim); resolve(resposta); }
      sim.addEventListener('click', onSim);
      m.addEventListener('hidden.bs.modal', onFim);
      inst.show();
    });
  },
  confete: function () {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cores = ['#5C6B5A', '#B79C6B', '#8B4A3D', '#8B7D6B', '#7A8B5E'], box = document.createElement('div');
    box.className = 'confete'; box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 70; i++) {
      var s = document.createElement('span');
      s.style.left = Math.random() * 100 + '%'; s.style.background = cores[i % cores.length];
      s.style.animationDelay = Math.random() * 0.6 + 's'; s.style.animationDuration = 2 + Math.random() * 1.5 + 's';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 4500);
  },
  /* ---------- ícones (Font Awesome) no lugar de emojis ---------- */
  FA_ICONES: [
    { k: 'dumbbell', nome: 'Haltere', cp: 'f44b' }, { k: 'heart-pulse', nome: 'Coração', cp: 'f21e' },
    { k: 'person-running', nome: 'Corrida', cp: 'f70c' }, { k: 'person-walking', nome: 'Caminhada', cp: 'f554' },
    { k: 'bicycle', nome: 'Bicicleta', cp: 'f206' }, { k: 'person-biking', nome: 'Pedal', cp: 'f84a' },
    { k: 'fire', nome: 'Fogo', cp: 'f06d' }, { k: 'bolt', nome: 'Raio', cp: 'f0e7' },
    { k: 'mountain', nome: 'Montanha', cp: 'f6fc' }, { k: 'medal', nome: 'Medalha', cp: 'f5a2' },
    { k: 'stopwatch', nome: 'Cronômetro', cp: 'f2f2' }, { k: 'trophy', nome: 'Troféu', cp: 'f091' },
    { k: 'shoe-prints', nome: 'Pegadas', cp: 'f54b' }, { k: 'hand-fist', nome: 'Punho', cp: 'f6de' },
    { k: 'spa', nome: 'Relaxar', cp: 'f5bb' }, { k: 'star', nome: 'Estrela', cp: 'f005' }
  ],
  semAcento: function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); },
  /* Ícone de um exercício: usa o "fa-..." gravado ou escolhe pelo nome/categoria (os emojis antigos são ignorados). */
  iconeExClasse: function (ex) {
    ex = ex || {};
    if (/^fa-[a-z0-9-]+$/.test(ex.icone || '')) return ex.icone;
    var n = Util.semAcento(ex.nome), mapa = [
      [/bicicleta|ergometric|bike/, 'fa-bicycle'], [/pedal|ciclis/, 'fa-person-biking'], [/caminhada|andar/, 'fa-person-walking'],
      [/corrida|correr|trote/, 'fa-person-running'], [/polichinelo|joelho alto/, 'fa-child-reaching'], [/corda/, 'fa-person-running'],
      [/burpee/, 'fa-fire'], [/escalador|mountain/, 'fa-mountain'], [/escada/, 'fa-arrows-up-to-line'], [/natac/, 'fa-person-swimming'],
      [/danca|ritmo/, 'fa-music'], [/flexao|flexoes|triceps|mergulho/, 'fa-hand-fist'], [/abdominal|supra|infra|canivete/, 'fa-circle-up'],
      [/prancha/, 'fa-ruler-horizontal'], [/agachamento|afundo|avanco|ponte|panturrilha|leg press/, 'fa-weight-hanging'],
      [/yoga|pilates|relax|respira/, 'fa-spa'], [/alongament|mobilidade/, 'fa-person-praying'], [/futebol/, 'fa-futbol'],
      [/volei/, 'fa-volleyball'], [/trilha/, 'fa-person-hiking'], [/funcional/, 'fa-bolt']
    ];
    for (var i = 0; i < mapa.length; i++) if (mapa[i][0].test(n)) return mapa[i][1];
    return { cardio: 'fa-heart-pulse', forca: 'fa-dumbbell', mobilidade: 'fa-spa', esporte: 'fa-futbol' }[ex.categoria] || 'fa-star';
  },
  iconeEx: function (ex) { return '<i class="fa-solid ' + Util.iconeExClasse(ex) + ' fa-fw ico-ex" aria-hidden="true"></i>'; },
  HUMOR_FA: [
    { c: 'fa-face-sad-tear', t: 'Muito mal' }, { c: 'fa-face-frown', t: 'Mal' }, { c: 'fa-face-meh', t: 'Normal' },
    { c: 'fa-face-smile', t: 'Bem' }, { c: 'fa-face-laugh-beam', t: 'Muito bem' }
  ],
  humorHtml: function (n) {
    var h = Util.HUMOR_FA[(n || 0) - 1]; if (!h) return '';
    return '<i class="fa-solid ' + h.c + '" role="img" aria-label="' + h.t + '" title="' + h.t + '"></i>';
  },
  /* Seletor de ícones (botões) — usado no perfil e na criação de exercício */
  seletorIcones: function (box, atual, aoMudar) {
    box.innerHTML = Util.FA_ICONES.map(function (i) {
      return '<button type="button" class="btn-icone' + (i.k === atual ? ' ativo' : '') + '" data-ico="' + i.k + '" aria-label="' + i.nome + '" aria-pressed="' + (i.k === atual) + '" title="' + i.nome + '"><i class="fa-solid fa-' + i.k + '"></i></button>';
    }).join('');
    if (!box._ligado) {
      box._ligado = true;
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-ico]'); if (!b) return;
        box.querySelectorAll('[data-ico]').forEach(function (x) { var on = x === b; x.classList.toggle('ativo', on); x.setAttribute('aria-pressed', on); });
        if (aoMudar) aoMudar(b.getAttribute('data-ico'));
      });
    }
  },
  tema: {
    aplicar: function (t) { document.documentElement.setAttribute('data-bs-theme', t); },
    get: function () { return localStorage.getItem('maromba_tema') || 'light'; },
    set: function (t) { localStorage.setItem('maromba_tema', t); Util.tema.aplicar(t); document.dispatchEvent(new Event('tema:mudou')); }
  }
};
Util.tema.aplicar(Util.tema.get());

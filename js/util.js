var Util = {
  VERSAO: '3.0.0',
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
  tema: {
    aplicar: function (t) { document.documentElement.setAttribute('data-bs-theme', t); },
    get: function () { return localStorage.getItem('maromba_tema') || 'light'; },
    set: function (t) { localStorage.setItem('maromba_tema', t); Util.tema.aplicar(t); document.dispatchEvent(new Event('tema:mudou')); }
  }
};
Util.tema.aplicar(Util.tema.get());

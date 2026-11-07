/* Botão discreto "instalar no celular": Android/Chrome usa o aviso nativo; iPhone/iPad mostra o passo a passo. */
var Instalar = {
  evento: null,
  $: function (id) { return document.getElementById(id); },
  instalado: function () {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  },
  ios: function () {
    var ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },
  atualizar: function () {
    var b = Instalar.$('btnInstalar'); if (!b) return;
    b.classList.toggle('d-none', Instalar.instalado() || !(Instalar.evento || Instalar.ios()));
  },
  clicar: async function () {
    if (Instalar.evento) {
      var ev = Instalar.evento; Instalar.evento = null;
      try { ev.prompt(); await ev.userChoice; } catch (e) {}
      Instalar.atualizar(); return;
    }
    if (Instalar.ios()) bootstrap.Modal.getOrCreateInstance(Instalar.$('modalInstalar')).show();
  },
  init: function () {
    Instalar.$('btnInstalar').addEventListener('click', Instalar.clicar);
    Instalar.atualizar();
  }
};
// o aviso do navegador pode chegar antes do restante do app carregar
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); Instalar.evento = e; Instalar.atualizar(); });
window.addEventListener('appinstalled', function () { Instalar.evento = null; Instalar.atualizar(); Util.toast('App instalado!', 'ok'); });

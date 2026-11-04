var Perfil = {
  dados: null,
  fotoNova: undefined, // undefined = sem mudança; null = remover; string = dataURL

  carregar: async function () {
    try {
      var d = await Api.perfil.get();
      if (d) { Perfil.dados = d; Util.ls.set('perfil', d); }
    } catch (e) { /* offline: usa cache */ }
    if (!Perfil.dados) Perfil.dados = Util.ls.get('perfil', null);
    Perfil.aplicar();
    Perfil.preencherForm();
  },

  iconeEhFoto: function (ic) { return typeof ic === 'string' && ic.indexOf('img:') === 0; },
  iconeEmoji: function (ic) { return (ic && ic.indexOf('emoji:') === 0) ? ic.slice(6) : '💪'; },
  iconeHtml: function (ic) {
    if (Perfil.iconeEhFoto(ic)) return '<img alt="" src="' + Util.esc(ic.slice(4)) + '">';
    return Util.esc(Perfil.iconeEmoji(ic));
  },

  /* PNG estático do ícone (para favicon e apple-touch-icon) */
  iconePng: function (ic, cor, tam) {
    return new Promise(function (resolve) {
      var c = document.createElement('canvas'); c.width = c.height = tam;
      var x = c.getContext('2d');
      if (Perfil.iconeEhFoto(ic)) {
        var im = new Image();
        im.onload = function () { x.drawImage(im, 0, 0, tam, tam); resolve(c.toDataURL('image/png')); };
        im.onerror = function () { resolve(null); };
        im.src = ic.slice(4);
        return;
      }
      x.fillStyle = cor || '#5C6B5A'; x.fillRect(0, 0, tam, tam);
      x.font = Math.round(tam * 0.62) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(Perfil.iconeEmoji(ic), tam / 2, tam / 2 + tam * 0.04);
      resolve(c.toDataURL('image/png'));
    });
  },

  aplicar: async function () {
    var d = Perfil.dados || {};
    var nome = d.nome_app || 'maromba', cor = d.cor || '#5C6B5A', ic = d.icone || 'emoji:💪';
    document.title = nome;
    document.querySelectorAll('[data-app-nome]').forEach(function (e) { e.textContent = nome; });
    document.querySelectorAll('[data-app-icone]').forEach(function (e) { e.innerHTML = Perfil.iconeHtml(ic); });
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', cor);
    if (Util.userId) {
      document.getElementById('lnkManifest').setAttribute('href',
        Supa.URL + '/functions/v1/app-manifest?u=' + encodeURIComponent(Util.userId) + '&b=' + encodeURIComponent(Util.baseUrl()));
    }
    var p32 = await Perfil.iconePng(ic, cor, 64), p180 = await Perfil.iconePng(ic, cor, 180);
    if (p32) document.getElementById('lnkFavicon').setAttribute('href', p32);
    if (p180) document.getElementById('lnkApple').setAttribute('href', p180);
  },

  preencherForm: function () {
    var d = Perfil.dados || {};
    document.getElementById('pfNome').value = d.nome_app || '';
    document.getElementById('pfEmoji').value = Perfil.iconeEhFoto(d.icone) ? '' : Perfil.iconeEmoji(d.icone);
    document.getElementById('pfCor').value = d.cor || '#5C6B5A';
    document.getElementById('pfPeso').value = d.peso == null ? '' : d.peso;
    document.getElementById('pfAltura').value = d.altura == null ? '' : d.altura;
    document.getElementById('pfAno').value = d.ano_nascimento == null ? '' : d.ano_nascimento;
    document.getElementById('pfObjetivo').value = d.objetivo || '';
    Perfil.fotoNova = undefined;
    Perfil.previa(d.icone);
  },

  previa: function (ic) {
    document.getElementById('pfPrevia').innerHTML = Perfil.iconeHtml(ic);
    document.getElementById('btnRemoverFoto').classList.toggle('d-none', !Perfil.iconeEhFoto(ic));
  },

  redimensionar: function (file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = reject;
      r.onload = function () {
        var im = new Image();
        im.onerror = reject;
        im.onload = function () {
          var c = document.createElement('canvas'); c.width = c.height = 192;
          var x = c.getContext('2d'), l = Math.min(im.width, im.height);
          x.drawImage(im, (im.width - l) / 2, (im.height - l) / 2, l, l, 0, 0, 192, 192);
          resolve(c.toDataURL('image/png'));
        };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  },

  /* Ligado na inicialização do app (não só ao abrir Configurações). */
  ligarForm: function () {
    document.getElementById('pfFoto').addEventListener('change', async function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      try { Perfil.fotoNova = await Perfil.redimensionar(f); Perfil.previa('img:' + Perfil.fotoNova); }
      catch (e) { Util.toast('Não foi possível ler a imagem.', 'erro'); }
    });
    document.getElementById('btnRemoverFoto').addEventListener('click', function () {
      Perfil.fotoNova = null; document.getElementById('pfFoto').value = '';
      Perfil.previa('emoji:' + (document.getElementById('pfEmoji').value || '💪'));
    });
    document.getElementById('pfEmoji').addEventListener('input', function (ev) {
      if (Perfil.fotoNova === undefined && Perfil.iconeEhFoto((Perfil.dados || {}).icone)) return;
      if (typeof Perfil.fotoNova === 'string') return;
      Perfil.previa('emoji:' + (ev.target.value || '💪'));
    });
    document.getElementById('frmPerfil').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var num = function (id) { var v = document.getElementById(id).value; return v === '' ? null : Number(v); };
      var icone;
      if (typeof Perfil.fotoNova === 'string') icone = 'img:' + Perfil.fotoNova;
      else if (Perfil.fotoNova === undefined && Perfil.iconeEhFoto((Perfil.dados || {}).icone)) icone = Perfil.dados.icone;
      else icone = 'emoji:' + (document.getElementById('pfEmoji').value.trim() || '💪');
      var campos = {
        nome_app: document.getElementById('pfNome').value.trim() || 'maromba',
        icone: icone,
        cor: document.getElementById('pfCor').value,
        peso: num('pfPeso'), altura: num('pfAltura'), ano_nascimento: num('pfAno'),
        objetivo: document.getElementById('pfObjetivo').value || null
      };
      try {
        Perfil.dados = await Api.perfil.salvar(campos);
        Util.ls.set('perfil', Perfil.dados);
        Perfil.fotoNova = undefined;
        await Perfil.aplicar(); Perfil.preencherForm();
        Util.toast('Perfil salvo.', 'ok');
      } catch (e) { Util.toast('Não foi possível salvar: ' + (e.message || e), 'erro'); }
    });
  }
};

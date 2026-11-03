var Auth = {
  traduzir: function (err) {
    var m = (err && err.message) || String(err || '');
    if (/Database error saving new user/i.test(m) || /Convite inv/i.test(m)) return 'Convite inválido ou já usado';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
    if (/already registered/i.test(m)) return 'Este e-mail já está cadastrado';
    if (/at least \d+ characters/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (/same password/i.test(m)) return 'A nova senha precisa ser diferente da anterior';
    return m || 'Ocorreu um erro. Tente novamente.';
  },

  msg: function (texto, tipo) {
    var el = document.getElementById('authMsg');
    if (!texto) { el.classList.add('d-none'); return; }
    el.className = 'alert mt-3 mb-0 py-2 small alert-' + (tipo || 'danger');
    el.textContent = texto;
  },

  ir: function (nome) {
    ['Entrar', 'Criar', 'Esqueci', 'Nova'].forEach(function (n) {
      document.getElementById('frm' + n).classList.toggle('d-none', n !== nome);
    });
    Auth.msg('');
  },

  ocupado: function (form, sim) {
    form.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = sim; });
  },

  entrar: async function (user) {
    var id = user.id;
    var ultimo = localStorage.getItem('maromba_ultimo_usuario');
    if (ultimo && ultimo !== id) { // troca de usuário: recarrega para não misturar dados
      localStorage.setItem('maromba_ultimo_usuario', id);
      location.reload(); return;
    }
    localStorage.setItem('maromba_ultimo_usuario', id);
    Util.setUser(id);
    Api.abrirDb(id);
    document.getElementById('authOverlay').classList.add('d-none');
    document.getElementById('appShell').classList.remove('d-none');
    await Perfil.carregar();
    App.aposLogin();
  },

  sair: async function () {
    try { await Supa.client.auth.signOut(); } catch (e) {}
    localStorage.removeItem('maromba_ultimo_usuario');
    location.reload();
  },

  init: async function () {
    document.querySelectorAll('[data-ir]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); Auth.ir(a.getAttribute('data-ir')); });
    });

    var cv = new URLSearchParams(location.search).get('convite');
    if (cv) { document.getElementById('criConvite').value = cv.toUpperCase(); Auth.ir('Criar'); }

    document.getElementById('frmEntrar').addEventListener('submit', async function (e) {
      e.preventDefault(); var f = e.target; Auth.ocupado(f, true); Auth.msg('');
      var r = await Supa.client.auth.signInWithPassword({
        email: document.getElementById('entEmail').value.trim(),
        password: document.getElementById('entSenha').value
      });
      Auth.ocupado(f, false);
      if (r.error) return Auth.msg(Auth.traduzir(r.error));
      Auth.entrar(r.data.user);
    });

    document.getElementById('frmCriar').addEventListener('submit', async function (e) {
      e.preventDefault(); var f = e.target; Auth.ocupado(f, true); Auth.msg('');
      var codigo = document.getElementById('criConvite').value.trim().toUpperCase();
      var email = document.getElementById('criEmail').value.trim();
      var senha = document.getElementById('criSenha').value;
      try {
        if (senha.length < 6) throw new Error('at least 6 characters');
        var ok = await Api.validarConvite(codigo, email);
        if (!ok) throw new Error('Convite inválido ou já usado');
        var r = await Supa.client.auth.signUp({
          email: email, password: senha,
          options: { data: { codigo_convite: codigo }, emailRedirectTo: Util.baseUrl() }
        });
        if (r.error) throw r.error;
        if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0) throw new Error('already registered');
        if (r.data.session) { Auth.ocupado(f, false); return Auth.entrar(r.data.user); }
        Auth.msg('Conta criada! Abra o e-mail que enviamos e confirme o cadastro para entrar.', 'success');
      } catch (err) { Auth.msg(Auth.traduzir(err)); }
      Auth.ocupado(f, false);
    });

    document.getElementById('frmEsqueci').addEventListener('submit', async function (e) {
      e.preventDefault(); var f = e.target; Auth.ocupado(f, true); Auth.msg('');
      var r = await Supa.client.auth.resetPasswordForEmail(document.getElementById('esqEmail').value.trim(), { redirectTo: Util.baseUrl() });
      Auth.ocupado(f, false);
      if (r.error) return Auth.msg(Auth.traduzir(r.error));
      Auth.msg('Se o e-mail estiver cadastrado, você receberá um link em instantes.', 'success');
    });

    document.getElementById('frmNova').addEventListener('submit', async function (e) {
      e.preventDefault(); var f = e.target; Auth.msg('');
      var s1 = document.getElementById('novSenha').value, s2 = document.getElementById('novSenha2').value;
      if (s1.length < 6) return Auth.msg('A senha precisa ter pelo menos 6 caracteres');
      if (s1 !== s2) return Auth.msg('As senhas não são iguais');
      Auth.ocupado(f, true);
      var r = await Supa.client.auth.updateUser({ password: s1 });
      Auth.ocupado(f, false);
      if (r.error) return Auth.msg(Auth.traduzir(r.error));
      history.replaceState(null, '', location.pathname);
      Util.toast('Senha alterada com sucesso.', 'ok');
      Auth.entrar(r.data.user);
    });

    var recuperando = AUTH_HASH.type === 'recovery' && !AUTH_HASH.error_code;
    Supa.client.auth.onAuthStateChange(function (evento) {
      if (evento === 'PASSWORD_RECOVERY') { document.getElementById('authOverlay').classList.remove('d-none'); Auth.ir('Nova'); }
    });

    if (AUTH_HASH.error_code) {
      Auth.ir('Esqueci');
      Auth.msg(AUTH_HASH.error_code === 'otp_expired' ? 'O link expirou ou já foi usado. Peça um novo.' : 'Link inválido. Peça um novo.');
      history.replaceState(null, '', location.pathname);
      return;
    }
    var s = await Supa.client.auth.getSession();
    if (recuperando) { Auth.ir('Nova'); return; }
    if (s.data.session) Auth.entrar(s.data.session.user);
  }
};

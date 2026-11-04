var Api = {
  db: null,
  abrirDb: function (userId) {
    Api.db = new Dexie('AppDB_' + userId);
    Api.db.version(1).stores({ configuracoes: 'chave' });
    Api.db.version(2).stores({
      configuracoes: 'chave',
      exercicios: 'id',
      sessoes: 'id,data,inicio,pendente'
    });
    Api.db.version(3).stores({
      configuracoes: 'chave',
      exercicios: 'id',
      sessoes: 'id,data,inicio,pendente',
      pesagens: 'data,pendente'
    });
    Api.db.version(4).stores({
      configuracoes: 'chave,pendente',
      exercicios: 'id',
      sessoes: 'id,data,inicio,pendente',
      pesagens: 'data,pendente',
      metas: 'id',
      metas_progresso: 'id,meta_id'
    });
    return Api.db;
  },
  rpc: async function (nome, args) {
    var r = await Supa.client.rpc(nome, args || {});
    if (r.error) throw r.error;
    return r.data;
  },
  perfil: {
    get: async function () {
      var r = await Supa.client.from('perfis').select('*').maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
    salvar: async function (campos) {
      var r = await Supa.client.from('perfis').update(campos).eq('user_id', Util.userId).select().single();
      if (r.error) throw r.error;
      return r.data;
    }
  },
  admin: {
    ehAdmin: function () { return Api.rpc('eh_admin'); },
    criarConvite: function () { return Api.rpc('criar_convite'); },
    listarConvites: function () { return Api.rpc('listar_convites'); },
    cancelarConvite: function (id) { return Api.rpc('cancelar_convite', { p_id: id }); }
  },
  validarConvite: function (codigo, email) { return Api.rpc('validar_convite', { p_codigo: codigo, p_email: email }); }
};

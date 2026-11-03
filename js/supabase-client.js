/* Captura o hash da URL ANTES de o Supabase limpá-lo (recuperação de senha). */
(function () {
  var h = (location.hash || '').replace(/^#/, '');
  var p = new URLSearchParams(h);
  window.AUTH_HASH = {
    type: p.get('type'),
    error_code: p.get('error_code'),
    error_description: p.get('error_description')
  };
})();

var Supa = {
  URL: 'https://ycnktfqvjpqbxfvxafrz.supabase.co',
  // Chave publishable (pública, segura para o navegador). NUNCA coloque a service_role aqui.
  KEY: 'sb_publishable_ayBkJ47zIKEHVxK0ta3RXQ_SHTadFNz'
};
Supa.client = window.supabase.createClient(Supa.URL, Supa.KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

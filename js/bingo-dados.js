/* Catálogo de desafios do Bingo (fácil de editar).
   Cada desafio: id (não mude depois de usado), t (texto), d (dificuldade: f/m/d), tags (temas), r (regra automática; sem "r" = marcação manual).
   Regras (r.t):
     seq {n}                 treinar n dias seguidos (dias de descanso planejados não quebram)
     semana {n, k?}          n dias diferentes na mesma semana (seg–dom); k = só exercícios com esse nome
     fds                     treinar no sábado e no domingo do mesmo fim de semana
     antes {h} / depois {h}  treino iniciado antes / a partir de h horas (São Paulo)
     sessoes {n}             n treinos no período da cartela
     minutos {n}             n minutos de treino somados
     reps_sessao {n, k}      n repetições (séries × reps) de exercícios k numa só sessão
     reps_dia {n, k}         n repetições de exercícios k no mesmo dia
     tempo_item {seg, k}     um exercício k com pelo menos seg segundos
     min_item {min, k}       min minutos somados de exercícios k numa só sessão
     dist_item {km, k}       um exercício k com pelo menos km quilômetros
     tem {k}                 qualquer sessão com exercício k
     amb {v}                 sessão no ambiente v (casa, academia, ar_livre)
     ambs3                   os 3 ambientes na mesma semana
     resist {n}              bicicleta com resistência ≥ n
     tipo {v, k?}            tipo de treino (leve, continuo, intervalado)
     rpe {n}                 treino com esforço (RPE) ≥ n
     novo                    exercício que você nunca tinha feito antes da cartela
     recorde                 superar um recorde pessoal
     meta                    cumprir uma meta
   "k" é uma lista de palavras (sem acento, minúsculas) procuradas no nome do exercício. */
var BINGO_DADOS = {
  PONTOS: { f: 10, m: 20, d: 40 },
  DIF: { f: 'facil', m: 'medio', d: 'dificil' },
  BONUS_LINHA: 50,
  BONUS_CARTELA: 300,
  TEMAS: {
    geral: { nome: 'Variada (tudo um pouco)', icone: 'fa-shuffle' },
    casa: { nome: 'Em casa, sem equipamento', icone: 'fa-house' },
    bike: { nome: 'Bicicleta ergométrica', icone: 'fa-bicycle' },
    cardio: { nome: 'Cardio e resistência', icone: 'fa-heart-pulse' },
    forca: { nome: 'Força e repetições', icone: 'fa-dumbbell' },
    mobilidade: { nome: 'Mobilidade e bem-estar', icone: 'fa-spa' }
  },
  NIVEIS: {
    iniciante: { nome: 'Iniciante', mix: { f: 13, m: 9, d: 2 } },
    intermediario: { nome: 'Intermediário', mix: { f: 8, m: 11, d: 5 } },
    avancado: { nome: 'Avançado', mix: { f: 4, m: 11, d: 9 } }
  },
  DESAFIOS: [
    /* consistência */
    { id: 'seq3', t: 'Treinar 3 dias seguidos', d: 'f', tags: ['geral', 'casa'], r: { t: 'seq', n: 3 } },
    { id: 'seq5', t: 'Treinar 5 dias seguidos', d: 'm', tags: ['geral'], r: { t: 'seq', n: 5 } },
    { id: 'seq7', t: 'Treinar 7 dias seguidos', d: 'd', tags: ['geral'], r: { t: 'seq', n: 7 } },
    { id: 'sem3', t: 'Treinar 3 dias na mesma semana', d: 'f', tags: ['geral', 'casa'], r: { t: 'semana', n: 3 } },
    { id: 'sem4', t: 'Treinar 4 dias na mesma semana', d: 'm', tags: ['geral'], r: { t: 'semana', n: 4 } },
    { id: 'sem5', t: 'Treinar 5 dias na mesma semana', d: 'd', tags: ['geral'], r: { t: 'semana', n: 5 } },
    { id: 'fds', t: 'Treinar no sábado e no domingo do mesmo fim de semana', d: 'f', tags: ['geral', 'casa'], r: { t: 'fds' } },
    { id: 'antes9', t: 'Treinar antes das 9h', d: 'f', tags: ['geral'], r: { t: 'antes', h: 9 } },
    { id: 'antes7', t: 'Treinar antes das 7h', d: 'm', tags: ['geral'], r: { t: 'antes', h: 7 } },
    { id: 'noite', t: 'Treinar à noite (a partir das 19h)', d: 'f', tags: ['geral'], r: { t: 'depois', h: 19 } },
    { id: 's5', t: 'Registrar 5 treinos', d: 'f', tags: ['geral', 'casa'], r: { t: 'sessoes', n: 5 } },
    { id: 's10', t: 'Registrar 10 treinos', d: 'm', tags: ['geral'], r: { t: 'sessoes', n: 10 } },
    { id: 's16', t: 'Registrar 16 treinos', d: 'd', tags: ['geral'], r: { t: 'sessoes', n: 16 } },
    { id: 'm60', t: 'Acumular 60 minutos de treino', d: 'f', tags: ['geral', 'casa'], r: { t: 'minutos', n: 60 } },
    { id: 'm150', t: 'Acumular 150 minutos de treino', d: 'm', tags: ['geral'], r: { t: 'minutos', n: 150 } },
    { id: 'm300', t: 'Acumular 300 minutos de treino', d: 'd', tags: ['geral'], r: { t: 'minutos', n: 300 } },
    /* força */
    { id: 'poli50', t: '50 polichinelos em uma sessão', d: 'f', tags: ['geral', 'casa', 'cardio'], r: { t: 'reps_sessao', n: 50, k: ['polichinelo'] } },
    { id: 'poli100', t: '100 polichinelos em uma sessão', d: 'm', tags: ['geral', 'casa', 'cardio'], r: { t: 'reps_sessao', n: 100, k: ['polichinelo'] } },
    { id: 'flex20', t: '20 flexões em uma sessão', d: 'f', tags: ['geral', 'casa', 'forca'], r: { t: 'reps_sessao', n: 20, k: ['flexao'] } },
    { id: 'flex50', t: '50 flexões no mesmo dia', d: 'm', tags: ['geral', 'casa', 'forca'], r: { t: 'reps_dia', n: 50, k: ['flexao'] } },
    { id: 'flex100', t: '100 flexões no mesmo dia', d: 'd', tags: ['forca', 'casa'], r: { t: 'reps_dia', n: 100, k: ['flexao'] } },
    { id: 'abd50', t: '50 abdominais no mesmo dia', d: 'f', tags: ['geral', 'casa', 'forca'], r: { t: 'reps_dia', n: 50, k: ['abdominal'] } },
    { id: 'abd100', t: '100 abdominais no mesmo dia', d: 'm', tags: ['geral', 'casa', 'forca'], r: { t: 'reps_dia', n: 100, k: ['abdominal'] } },
    { id: 'abd200', t: '200 abdominais no mesmo dia', d: 'd', tags: ['forca', 'casa'], r: { t: 'reps_dia', n: 200, k: ['abdominal'] } },
    { id: 'agach30', t: '30 agachamentos em uma sessão', d: 'f', tags: ['geral', 'casa', 'forca'], r: { t: 'reps_sessao', n: 30, k: ['agachamento'] } },
    { id: 'agach100', t: '100 agachamentos em uma sessão', d: 'm', tags: ['geral', 'casa', 'forca'], r: { t: 'reps_sessao', n: 100, k: ['agachamento'] } },
    { id: 'prancha60', t: 'Prancha de 1 minuto', d: 'f', tags: ['geral', 'casa', 'forca'], r: { t: 'tempo_item', seg: 60, k: ['prancha'] } },
    { id: 'prancha120', t: 'Prancha de 2 minutos', d: 'd', tags: ['forca', 'casa'], r: { t: 'tempo_item', seg: 120, k: ['prancha'] } },
    { id: 'burpee20', t: '20 burpees em uma sessão', d: 'm', tags: ['geral', 'casa', 'cardio'], r: { t: 'reps_sessao', n: 20, k: ['burpee'] } },
    { id: 'afundo30', t: '30 afundos em uma sessão', d: 'm', tags: ['casa', 'forca'], r: { t: 'reps_sessao', n: 30, k: ['afundo'] } },
    { id: 'ponte30', t: '30 pontes de glúteos em uma sessão', d: 'f', tags: ['casa', 'forca'], r: { t: 'reps_sessao', n: 30, k: ['ponte'] } },
    { id: 'barra5', t: '5 repetições na barra fixa', d: 'm', tags: ['forca'], r: { t: 'reps_sessao', n: 5, k: ['barra fixa'] } },
    { id: 'corda5', t: 'Pular corda por 5 minutos', d: 'm', tags: ['geral', 'casa', 'cardio'], r: { t: 'min_item', min: 5, k: ['pular corda'] } },
    /* cardio */
    { id: 'cam30', t: 'Caminhada de 30 minutos', d: 'f', tags: ['geral', 'cardio'], r: { t: 'min_item', min: 30, k: ['caminhada'] } },
    { id: 'cam3', t: 'Caminhar 3 km de uma vez', d: 'f', tags: ['geral', 'cardio'], r: { t: 'dist_item', km: 3, k: ['caminhada'] } },
    { id: 'cam5', t: 'Caminhar 5 km de uma vez', d: 'm', tags: ['geral', 'cardio'], r: { t: 'dist_item', km: 5, k: ['caminhada'] } },
    { id: 'corr3', t: 'Correr 3 km', d: 'm', tags: ['geral', 'cardio'], r: { t: 'dist_item', km: 3, k: ['corrida'] } },
    { id: 'corr5', t: 'Correr 5 km', d: 'd', tags: ['cardio'], r: { t: 'dist_item', km: 5, k: ['corrida'] } },
    { id: 'corr20', t: 'Correr por 20 minutos', d: 'm', tags: ['cardio'], r: { t: 'min_item', min: 20, k: ['corrida'] } },
    { id: 'trilha', t: 'Fazer uma trilha', d: 'm', tags: ['cardio'], r: { t: 'tem', k: ['trilha'] } },
    { id: 'natacao', t: 'Nadar', d: 'm', tags: ['cardio'], r: { t: 'tem', k: ['natacao'] } },
    { id: 'danca20', t: 'Dançar por 20 minutos', d: 'f', tags: ['geral', 'casa', 'cardio'], r: { t: 'min_item', min: 20, k: ['danca'] } },
    { id: 'passos', t: 'Dar 10.000 passos em um dia', d: 'm', tags: ['geral', 'cardio'] },
    /* bicicleta ergométrica */
    { id: 'bike30', t: '30 minutos na bicicleta ergométrica', d: 'f', tags: ['geral', 'bike', 'casa'], r: { t: 'min_item', min: 30, k: ['bicicleta ergometrica'] } },
    { id: 'bike60', t: '60 minutos na bicicleta ergométrica', d: 'd', tags: ['bike'], r: { t: 'min_item', min: 60, k: ['bicicleta ergometrica'] } },
    { id: 'bike10km', t: 'Pedalar 10 km na bicicleta ergométrica', d: 'm', tags: ['bike'], r: { t: 'dist_item', km: 10, k: ['bicicleta ergometrica'] } },
    { id: 'bikeres', t: 'Pedalar com resistência 8 ou mais', d: 'm', tags: ['bike'], r: { t: 'resist', n: 8 } },
    { id: 'bikeint', t: 'Treino intervalado na bicicleta', d: 'm', tags: ['bike'], r: { t: 'tipo', v: 'intervalado', k: ['bicicleta'] } },
    { id: 'bike20', t: '20 minutos na bicicleta ergométrica', d: 'f', tags: ['bike'], r: { t: 'min_item', min: 20, k: ['bicicleta ergometrica'] } },
    { id: 'bike3d', t: 'Pedalar em 3 dias da mesma semana', d: 'd', tags: ['bike'], r: { t: 'semana', n: 3, k: ['bicicleta'] } },
    { id: 'bike5km', t: 'Pedalar 5 km na bicicleta ergométrica', d: 'f', tags: ['bike'], r: { t: 'dist_item', km: 5, k: ['bicicleta ergometrica'] } },
    /* ambientes */
    { id: 'ar', t: 'Treinar ao ar livre', d: 'f', tags: ['geral', 'cardio'], r: { t: 'amb', v: 'ar_livre' } },
    { id: 'acad', t: 'Treinar na academia', d: 'f', tags: ['geral', 'forca'], r: { t: 'amb', v: 'academia' } },
    { id: 'casa', t: 'Treinar em casa', d: 'f', tags: ['geral', 'casa', 'bike'], r: { t: 'amb', v: 'casa' } },
    { id: 'tres', t: 'Treinar nos 3 ambientes na mesma semana', d: 'd', tags: ['geral'], r: { t: 'ambs3' } },
    /* mobilidade e bem-estar */
    { id: 'along', t: 'Fazer um alongamento', d: 'f', tags: ['geral', 'casa', 'mobilidade'], r: { t: 'tem', k: ['alongamento'] } },
    { id: 'along5', t: 'Alongar em 5 dias da mesma semana', d: 'm', tags: ['casa', 'mobilidade'], r: { t: 'semana', n: 5, k: ['alongamento'] } },
    { id: 'yoga', t: 'Fazer yoga ou pilates', d: 'f', tags: ['geral', 'casa', 'mobilidade'], r: { t: 'tem', k: ['yoga', 'pilates'] } },
    { id: 'mobil', t: 'Fazer mobilidade de ombros ou quadril', d: 'f', tags: ['casa', 'mobilidade'], r: { t: 'tem', k: ['mobilidade'] } },
    { id: 'relax', t: 'Fazer respiração e relaxamento', d: 'f', tags: ['casa', 'mobilidade'], r: { t: 'tem', k: ['respiracao'] } },
    { id: 'agua', t: 'Beber água ao longo do dia (cerca de 2 litros)', d: 'f', tags: ['geral', 'casa', 'mobilidade'] },
    { id: 'sono', t: 'Dormir bem (7 horas ou mais)', d: 'f', tags: ['geral', 'casa', 'mobilidade'] },
    { id: 'escada', t: 'Usar a escada em vez do elevador hoje', d: 'f', tags: ['geral', 'casa'] },
    { id: 'ativo', t: 'Fazer um dia de descanso ativo (passeio leve)', d: 'f', tags: ['geral', 'mobilidade'] },
    { id: 'amigo', t: 'Treinar com um amigo ou familiar', d: 'm', tags: ['geral', 'cardio'] },
    /* geral */
    { id: 'novo', t: 'Experimentar um exercício novo', d: 'f', tags: ['geral', 'casa'], r: { t: 'novo' } },
    { id: 'recorde', t: 'Bater um recorde pessoal', d: 'm', tags: ['geral', 'forca', 'cardio'], r: { t: 'recorde' } },
    { id: 'rpe8', t: 'Fazer um treino puxado (esforço 8 ou mais)', d: 'm', tags: ['geral', 'forca', 'cardio'], r: { t: 'rpe', n: 8 } },
    { id: 'meta', t: 'Cumprir uma meta', d: 'm', tags: ['geral'], r: { t: 'meta' } }
  ],
  porId: function (id) { for (var i = 0; i < BINGO_DADOS.DESAFIOS.length; i++) if (BINGO_DADOS.DESAFIOS[i].id === id) return BINGO_DADOS.DESAFIOS[i]; return null; }
};

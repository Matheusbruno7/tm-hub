// CASQUINHA · previsão de rating e ranking, metas e torneios a priorizar.
//
// 1. Chance de vitória em cada jogo: regressão logística da diferença de rating
//    (coeficientes b0, b1 ajustados no tm-clubes com milhares de jogos oficiais)
//    + um ajuste de FORMA do atleta, estimado nos jogos dos últimos 12 meses,
//    com mais peso nos recentes (meia-vida de 120 dias) e "puxado para zero"
//    quando há poucos jogos (λ = 5). Teste no passado (mai–set/2026): reduz o
//    erro da previsão de jogos em ~0,7% em relação ao rating sozinho.
// 2. Simulação de Monte Carlo: para cada evento planejado, sorteia o número de
//    jogos e os adversários a partir do histórico do próprio atleta e aplica a
//    tabela oficial do rating (Manual CBTM 2026, 1.7.2.5.5) × peso do evento.
// 3. Ranking Nacional: soma dos 8 melhores resultados nas últimas 52 semanas
//    (Manual 1.7.2.2), com colocações sorteadas do histórico do atleta.

export const ESPERADAS = [
  [750, Infinity, 1, 0], [500, 749, 2, 0], [400, 499, 3, 1], [300, 399, 4, 2], [200, 299, 5, 3],
  [150, 199, 6, 4], [100, 149, 7, 5], [50, 99, 8, 6], [25, 49, 9, 7], [0, 24, 10, 8],
];
export const INESPERADAS = [
  [500, Infinity, 30, 22], [400, 499, 26, 20], [300, 399, 23, 18], [200, 299, 20, 16], [150, 199, 18, 14],
  [100, 149, 16, 12], [50, 99, 14, 11], [25, 49, 12, 10], [0, 24, 11, 9],
];

// Tipos de evento: peso no rating (1.7.2.3) e pontos de ranking por fase (1.7.2.2.3)
export const TIPOS = {
  brasileirao: { nome: "Brasileirão", peso: 18, ranking: [23400, 14400, 9000, 5400, 3600, 1800, 700] },
  seletiva: { nome: "Seletiva Nacional", peso: 12, ranking: [15600, 9600, 6000, 3600, 2400, 1200, 500] },
  ouro: { nome: "Copa Brasil Ouro", peso: 9, ranking: [11700, 7200, 4500, 2700, 1800, 900, 300] },
  prata: { nome: "Copa Brasil Prata", peso: 6, ranking: [7800, 4800, 3000, 1800, 1200, 600, 200] },
  estadual: { nome: "Estadual", peso: 3, ranking: [3900, 2400, 1500, 900, 600, 300, 100] },
  regional: { nome: "Regional", peso: 1, ranking: [1300, 800, 500, 300, 200, 100, 50] },
};

export const CLASSES = {
  M: [["A", 3300], ["B", 2800], ["C", 2300], ["D", 1900], ["E", 1600], ["F", 1300], ["G", 1000], ["H", 850], ["I", 700], ["J", 550], ["L", 400], ["M", 350], ["N", 251], ["O", -Infinity]],
  F: [["A", 2500], ["B", 2000], ["C", 1400], ["D", 1000], ["E", 700], ["F", 600], ["G", 500], ["H", 400], ["I", 251], ["J", -Infinity]],
};
export const classeDe = (rating, sexo) => (CLASSES[sexo] || CLASSES.M).find(([, min]) => rating >= min)[0];
export const minimoDaClasse = (classe, sexo) => (CLASSES[sexo] || CLASSES.M).find(([c]) => c === classe)?.[1];

const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase();

export function tipoDoEvento(nome) {
  const n = norm(nome);
  if (/BRASILEIRAO/.test(n)) return "brasileirao"; // "Liga Nipo Brasileira" não é Brasileirão
  if (/COPA BRASIL/.test(n) && /OURO/.test(n)) return "ouro";
  if (/COPA BRASIL/.test(n) && /PRATA/.test(n)) return "prata";
  if (/ESTADUAL|DISTRITAL|PAULISTAO|CAMPEONATO (CEARENSE|MINEIRO|PARAENSE|CATARINENSE|GAUCHO|PARANAENSE|AMAPAENSE)/.test(n)) return "estadual"; // inclui "SÉRIE OURO/PRATA"
  if (/SELETIVA/.test(n)) return "seletiva";
  if (/REGIONAL|LIGA/.test(n)) return "regional";
  return null;
}

// ---------------- números aleatórios reproduzíveis ----------------
export function aleatorio(semente = 12345) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- leitura do histórico ----------------
const PESOS_CANDIDATOS = [1, 2, 3, 6, 9, 10, 12, 18];
const meio = (lo, hi) => (lo >= 500 ? 650 : (lo + hi) / 2);

function decodificar(pontos, peso) {
  if (pontos % peso) return null;
  const b = pontos / peso;
  if (b > 0) {
    for (const [lo, hi, v] of ESPERADAS) if (b === v) return { delta: meio(lo, hi), venceu: true, favorito: true };
    for (const [lo, hi, v] of INESPERADAS) if (b === v) return { delta: meio(lo, hi), venceu: true, favorito: false };
    return null;
  }
  const q = -b;
  if (q === 0) return { delta: 650, venceu: false, favorito: false };
  for (const [lo, hi, , p] of ESPERADAS) if (q === p) return { delta: meio(lo, hi), venceu: false, favorito: false };
  for (const [lo, hi, , p] of INESPERADAS) if (q === p) return { delta: meio(lo, hi), venceu: false, favorito: true };
  return null;
}

/**
 * Jogos do perfil de rating da CBTM -> [{data, eventoId, evento, tipo, peso, dif, venceu, pontos}]
 * dif = rating do atleta − rating do adversário (aproximado pela faixa da tabela).
 * O peso de cada evento é deduzido dos próprios pontos (eventos antigos tinham outros pesos).
 */
export function historico(perfilRating) {
  const porEvento = new Map();
  for (const g of perfilRating?.games || []) {
    const k = g.EventoId;
    if (!porEvento.has(k)) porEvento.set(k, []);
    porEvento.get(k).push(g);
  }
  const saida = [];
  for (const jogos of porEvento.values()) {
    const tipo = tipoDoEvento(jogos[0].EventoNome);
    const preferido = tipo ? TIPOS[tipo].peso : null;
    // Se o peso do tipo de evento explica os pontos, usa ele. Senão, entre os
    // pesos que explicam, escolhe o que exige menos zebras (que são raras).
    let escolha = null;
    for (const w of [preferido, ...PESOS_CANDIDATOS.filter((x) => x !== preferido)].filter(Boolean)) {
      const d = jogos.map((g) => (g.Pontos == null ? null : decodificar(g.Pontos, w)));
      if (!d.every(Boolean)) continue;
      const zebras = d.filter((x) => x.venceu !== x.favorito).length;
      if (w === preferido) { escolha = { w, d }; break; }
      if (!escolha || zebras < escolha.zebras) escolha = { w, d, zebras };
    }
    if (escolha) {
      const { w, d } = escolha;
      jogos.forEach((g, i) => saida.push({
        data: String(g.DataHorario).slice(0, 10), eventoId: g.EventoId, evento: g.EventoNome, tipo, peso: w,
        dif: d[i].favorito ? d[i].delta : -d[i].delta, venceu: d[i].venceu, pontos: g.Pontos,
        hora: String(g.DataHorario).slice(11, 16), adversario: g.AdversarioNome, antes: g.RatingInicial, sets: g.Sets,
      }));
    }
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data));
}

const sig = (z) => 1 / (1 + Math.exp(-z));
const logit = (p) => Math.log(p / (1 - p));

/** Chance de o atleta vencer um adversário com diferença `dif` (atleta − adversário). */
export function probVitoria(dif, modelo, forma = 0) {
  const pFav = sig(modelo.b0 + (modelo.b1 * Math.abs(dif)) / 100);
  const p = dif >= 0 ? pFav : 1 - pFav;
  return sig(logit(Math.min(Math.max(p, 1e-6), 1 - 1e-6)) + forma);
}

export const PARAM_FORMA = { lambda: 5, meiaVidaDias: 120, janelaDias: 365 };

/** Ajuste de forma (em escala logit): vitórias acima ou abaixo do esperado pelo rating. */
export function estimarForma(hist, modelo, hoje, p = PARAM_FORMA) {
  const ref = Date.parse(hoje);
  let num = 0, den = 0, n = 0;
  for (const j of hist) {
    const idade = (ref - Date.parse(j.data)) / 864e5;
    if (idade < 0 || idade > p.janelaDias) continue;
    const w = 0.5 ** (idade / p.meiaVidaDias);
    const q = probVitoria(j.dif, modelo, 0);
    num += w * ((j.venceu ? 1 : 0) - q);
    den += w * q * (1 - q);
    n++;
  }
  return { forma: num / (den + p.lambda), jogos: n };
}

/** Distribuições empíricas usadas na simulação. */
export function perfilDeJogo(hist, hoje) {
  const ref = Date.parse(hoje);
  const recentes = hist.filter((j) => (ref - Date.parse(j.data)) / 864e5 <= 365);
  const base = recentes.length >= 8 ? recentes : hist.slice(-40);
  const difs = base.map((j) => j.dif);
  const jogosPorEvento = { todos: [] };
  const porEv = new Map();
  for (const j of hist.slice(-200)) {
    const k = j.eventoId;
    porEv.set(k, { tipo: j.tipo, n: (porEv.get(k)?.n || 0) + 1 });
  }
  for (const { tipo, n } of porEv.values()) {
    jogosPorEvento.todos.push(n);
    if (tipo) (jogosPorEvento[tipo] ||= []).push(n);
  }
  return { difs: difs.length ? difs : [0], jogosPorEvento: jogosPorEvento.todos.length ? jogosPorEvento : { todos: [5] } };
}

function pontosDoJogo(dif, venceu, peso) {
  const delta = Math.abs(dif);
  const favorito = dif >= 0;
  const esperada = venceu === favorito;
  const [, , v, p] = (esperada ? ESPERADAS : INESPERADAS).find(([lo, hi]) => delta >= lo && delta <= hi);
  return venceu ? v * peso : p * peso ? -p * peso : 0;
}

const quantil = (ordenado, q) => ordenado[Math.min(ordenado.length - 1, Math.max(0, Math.round(q * (ordenado.length - 1))))];

/**
 * Simula o rating até o fim do calendário planejado.
 * eventos: [{id, nome, data, tipo}]  (tipo = chave de TIPOS)
 */
export function simularRating({ ratingInicial, modelo, forma, perfil, eventos, sims = 3000, semente = 7, meta = null }) {
  const rnd = aleatorio(semente);
  const ordem = [...eventos].sort((a, b) => a.data.localeCompare(b.data));
  const finais = new Float64Array(sims);
  const porEvento = ordem.map(() => ({ soma: 0, jogos: 0, vit: 0, trajetoria: new Float64Array(sims) }));
  for (let s = 0; s < sims; s++) {
    let r = ratingInicial;
    ordem.forEach((ev, i) => {
      const t = TIPOS[ev.tipo] || TIPOS.regional;
      const lista = perfil.jogosPorEvento[ev.tipo] || perfil.jogosPorEvento.todos;
      const n = lista[Math.floor(rnd() * lista.length)];
      const antes = r;
      for (let k = 0; k < n; k++) {
        const dif = perfil.difs[Math.floor(rnd() * perfil.difs.length)];
        const venceu = rnd() < probVitoria(dif, modelo, forma);
        r += pontosDoJogo(dif, venceu, t.peso);
        porEvento[i].vit += venceu ? 1 : 0;
      }
      porEvento[i].soma += r - antes;
      porEvento[i].jogos += n;
      porEvento[i].trajetoria[s] = r;
    });
    finais[s] = r;
  }
  const ord = Array.from(finais).sort((a, b) => a - b);
  const resumo = (arr) => {
    const o = Array.from(arr).sort((a, b) => a - b);
    return { p10: quantil(o, 0.1), p25: quantil(o, 0.25), p50: quantil(o, 0.5), p75: quantil(o, 0.75), p90: quantil(o, 0.9) };
  };
  return {
    inicial: ratingInicial,
    media: ord.reduce((a, b) => a + b, 0) / sims,
    ...resumo(ord),
    probMeta: meta == null ? null : ord.filter((x) => x >= meta).length / sims,
    probAcima: (valor) => ord.filter((x) => x >= valor).length / sims,
    eventos: ordem.map((ev, i) => ({
      ...ev,
      ganhoMedio: porEvento[i].soma / sims,
      jogosMedios: porEvento[i].jogos / sims,
      aproveitamento: porEvento[i].jogos ? porEvento[i].vit / porEvento[i].jogos : null,
      faixa: resumo(porEvento[i].trajetoria),
    })),
  };
}

/** Chance de terminar em cada classe. */
export function chancesPorClasse(sim, sexo) {
  const tabela = CLASSES[sexo] || CLASSES.M;
  const saida = [];
  let acima = 0;
  for (const [classe, min] of tabela) {
    const pAcima = min === -Infinity ? 1 : sim.probAcima(min);
    saida.push({ classe, prob: Math.max(0, pAcima - acima) });
    acima = pAcima;
  }
  return saida;
}

/**
 * Quais torneios priorizar para alcançar a meta: quanto cada evento candidato
 * acrescenta à chance de chegar lá, sobre o plano atual.
 */
export function priorizarTorneios({ base, candidatos, meta, sims = 1500 }) {
  const ref = simularRating({ ...base, sims, meta });
  return candidatos.map((ev) => {
    const com = simularRating({ ...base, sims, meta, eventos: [...base.eventos, ev] });
    return { ...ev, ganhoMedio: com.media - ref.media, ganhoChance: com.probMeta - ref.probMeta };
  }).sort((a, b) => b.ganhoChance - a.ganhoChance || b.ganhoMedio - a.ganhoMedio);
}

/** Aproveitamento esperado no calendário típico do atleta (média da chance de vitória). */
export function aproveitamentoEsperado(perfil, modelo, forma) {
  return perfil.difs.reduce((s, d) => s + probVitoria(d, modelo, forma), 0) / perfil.difs.length;
}

/**
 * Que forma o atleta precisaria para que a meta vire o resultado mais provável
 * (mediana ≥ meta) com o plano atual. Devolve null se nem com forma alta.
 */
export function formaNecessaria({ base, meta }) {
  let lo = -2, hi = 2.5;
  const ok = (f) => simularRating({ ...base, forma: f, sims: 600 }).p50 >= meta;
  if (!ok(hi)) return null;
  if (ok(lo)) return lo;
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2;
    if (ok(m)) hi = m; else lo = m;
  }
  return hi;
}

// ---------------- Ranking Nacional ----------------
const pontosDoCampeao = (tipo) => (TIPOS[tipo] || TIPOS.regional).ranking[0];

/**
 * Projeta os pontos do Ranking Nacional numa data:
 * resultados (counted + other do perfil de ranking) ainda dentro das 52
 * semanas + colocações sorteadas para os eventos planejados.
 */
export function simularRanking({ resultados, eventos, ate, sims = 3000, semente = 9 }) {
  const rnd = aleatorio(semente);
  const limite = Date.parse(ate) - 364 * 864e5;
  const validos = resultados.filter((r) => Date.parse(r.data) > limite && Date.parse(r.data) <= Date.parse(ate)).map((r) => r.pontos);
  // fração do campeão que o atleta costuma fazer, por tipo de evento
  const fracoes = {};
  for (const r of resultados) {
    const t = r.tipo || tipoDoEvento(r.evento);
    if (!t) continue;
    (fracoes[t] ||= []).push(r.pontos / pontosDoCampeao(t));
    (fracoes.todos ||= []).push(r.pontos / pontosDoCampeao(t));
  }
  const totais = new Float64Array(sims);
  for (let s = 0; s < sims; s++) {
    const pts = [...validos];
    for (const ev of eventos) {
      // Sem histórico no mesmo tipo de evento, assume a colocação mais modesta
      // (fase de grupos): um título estadual não vira título de Brasileirão.
      const lista = fracoes[ev.tipo] || [(TIPOS[ev.tipo] || TIPOS.regional).ranking.at(-1) / pontosDoCampeao(ev.tipo)];
      const f = lista[Math.floor(rnd() * lista.length)];
      pts.push(Math.round(f * pontosDoCampeao(ev.tipo)));
    }
    totais[s] = pts.sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0);
  }
  const o = Array.from(totais).sort((a, b) => a - b);
  return { semNovos: validos.sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0), p10: quantil(o, 0.1), p50: quantil(o, 0.5), p90: quantil(o, 0.9) };
}

/** Posição estimada numa lista de pontos (os demais atletas parados). */
export function posicaoEstimada(pontos, pontosDosOutros) {
  return 1 + pontosDosOutros.filter((p) => p > pontos).length;
}

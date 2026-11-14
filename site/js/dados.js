// Carregamento dos dados publicados pelo tm-clubes e funções do modelo.
const BASE = "dados/";
const cache = {};

async function json(nome) {
  if (!cache[nome]) {
    cache[nome] = fetch(BASE + nome, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Não foi possível carregar ${nome} (${r.status})`);
      return r.json();
    });
  }
  return cache[nome];
}

export const carregarRanking = () => json("ranking_clubes.json");
export const carregarAtletas = () => json("atletas_por_clube.json");
export const carregarModelo = () => json("modelo_vitoria.json");

// ---- pontos ao vivo (worker tm-pontos-ao-vivo na Cloudflare) ----
export const AO_VIVO = "https://casquinha-ao-vivo.matheusbruno045.workers.dev/api/";
async function aoVivo(caminho) {
  const r = await fetch(AO_VIVO + caminho);
  if (!r.ok) throw new Error(r.status === 404 ? "não encontrado" : `serviço ao vivo indisponível (${r.status})`);
  return r.json();
}
export const carregarResumoAoVivo = () => aoVivo("resumo");
export const carregarSaldos = () => aoVivo("saldos");
export const carregarEventoAoVivo = (slug) => aoVivo(`evento/${encodeURIComponent(slug)}`);
export const buscarAtletasAoVivo = (q) => aoVivo(`atletas?q=${encodeURIComponent(q)}`);
export const carregarAtletaAoVivo = (chave) => aoVivo(`atleta/${encodeURIComponent(chave)}`);

// mesma normalização do worker (src/calculo.js)
export const normalizar = (s) =>
  String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
export const chaveAtleta = (nome, clube) => `${normalizar(nome)}|${normalizar(clube)}`;

// ---- Força do Clube (espelha tm-clubes/src/tmclubes/forca.py) ----
const PESOS_FORCA = { elite: 0.5, profundidade: 0.3, volume: 0.2 };
function forcaDe(indices) {
  const o = [...indices].sort((a, b) => b - a);
  const elite = o.slice(0, 5).reduce((s, x) => s + x, 0) / 5;
  const prof = o.slice(5, 15).reduce((s, x) => s + x, 0) / 10;
  const vol = Math.min(1, Math.log1p(o.length) / Math.log1p(50)) * 100;
  return 10 * (PESOS_FORCA.elite * elite + PESOS_FORCA.profundidade * prof + PESOS_FORCA.volume * vol);
}

/**
 * Projeta a Força e a posição de cada clube com os pontos ao vivo (saldo de
 * rating dos jogos que a CBTM ainda não publicou). Devolve Map id -> {forca,
 * forca_masculino, forca_feminino} e uma função de posição por campo.
 */
/**
 * Saldo ao vivo de um atleta do clube. Procura por NOME|CLUBE atual; se o
 * atleta jogou por outro clube (transferência), usa o saldo pelo nome,
 * desde que o nome seja de uma pessoa só entre os atletas ativos.
 */
export function criarBuscaDeSaldo(atletasDb, s) {
  const contagem = new Map();
  for (const lista of Object.values(atletasDb.clubes || {}))
    for (const a of lista) { const n = normalizar(a.nome); contagem.set(n, (contagem.get(n) || 0) + 1); }
  const saldos = s.saldos || s, porNome = s.por_nome || {};
  return (nome, clube) => {
    const k = chaveAtleta(nome, clube);
    if (saldos[k] != null) return saldos[k];
    const n = normalizar(nome);
    return contagem.get(n) === 1 ? porNome[n] || 0 : 0;
  };
}

export function projetarClubes(ranking, atletasDb, saldosResp) {
  const saldoDe = criarBuscaDeSaldo(atletasDb, saldosResp);
  const clubes = ranking.clubes;
  const novos = new Map();
  const todos = { M: [], F: [] };
  let afetados = 0;
  for (const c of clubes) {
    const lista = (atletasDb.clubes[c.id] || []).map((a) => {
      const s = saldoDe(a.nome, c.nome_cbtm);
      if (s) afetados++;
      return { sexo: a.sexo, rating: a.rating + s };
    });
    novos.set(c.id, lista);
    for (const a of lista) todos[a.sexo]?.push(a.rating);
  }
  // a referência do índice também considera os atletas vinculados a federações
  for (const f of ranking.federacoes?.itens || []) {
    for (const a of atletasDb.clubes[f.id] || []) todos[a.sexo]?.push(a.rating + saldoDe(a.nome, f.nome_cbtm));
  }
  const ref = {};
  for (const sx of ["M", "F"]) {
    const top = todos[sx].sort((a, b) => b - a).slice(0, 10);
    ref[sx] = top.reduce((s, x) => s + x, 0) / Math.max(1, top.length);
  }
  const idx = (a) => Math.min(100, (100 * a.rating) / ref[a.sexo]);
  const proj = new Map();
  for (const c of clubes) {
    const l = novos.get(c.id);
    proj.set(c.id, {
      forca: forcaDe(l.map(idx)),
      forca_masculino: l.some((a) => a.sexo === "M") ? forcaDe(l.filter((a) => a.sexo === "M").map(idx)) : 0,
      forca_feminino: l.some((a) => a.sexo === "F") ? forcaDe(l.filter((a) => a.sexo === "F").map(idx)) : 0,
    });
  }
  const posicoes = (campo, filtro = () => true) => {
    const ord = clubes.filter(filtro).sort((a, b) => proj.get(b.id)[campo] - proj.get(a.id)[campo] || b.atletas_ativos - a.atletas_ativos);
    return new Map(ord.map((c, i) => [c.id, i + 1]));
  };
  return { proj, posicoes, afetados };
}

export const REGIOES = {
  Norte: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};
export const SEM_ESTADO = "Clubes sem estado";
export const regiaoDe = (uf) => Object.keys(REGIOES).find((r) => REGIOES[r].includes(uf)) || null;

// ---- modelo de vitória (espelha tmclubes/modelo.py e simulador.py) ----
const sig = (z) => 1 / (1 + Math.exp(-z));

export function probVitoria(ra, rb, m) {
  if (ra === rb) return 0.5;
  const pFav = sig(m.b0 + (m.b1 * Math.abs(ra - rb)) / 100);
  return ra > rb ? pFav : 1 - pFav;
}

function probMaioria(probs, precisa) {
  let total = 0;
  const n = probs.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let vit = 0, p = 1;
    for (let i = 0; i < n; i++) {
      const v = (mask >> i) & 1;
      vit += v;
      p *= v ? probs[i] : 1 - probs[i];
    }
    if (vit >= precisa) total += p;
  }
  return total;
}

export const FORMATOS = {
  mini: {
    nome: "Mini Davis (formato CBTM)",
    atletas: 2,
    descricao: "Até 3 jogos em melhor de 5 sets: Duplas, A × X e B × Y. Vence quem fizer 2.",
    jogos: (a, b) => [
      { jogo: "Duplas", a: `${a[0].nome} / ${a[1].nome}`, b: `${b[0].nome} / ${b[1].nome}`, ra: (a[0].rating + a[1].rating) / 2, rb: (b[0].rating + b[1].rating) / 2 },
      { jogo: "A × X", a: a[0].nome, b: b[0].nome, ra: a[0].rating, rb: b[0].rating },
      { jogo: "B × Y", a: a[1].nome, b: b[1].nome, ra: a[1].rating, rb: b[1].rating },
    ],
    precisa: 2,
  },
  cinco: {
    nome: "5 jogos simples (equipes de 3)",
    atletas: 3,
    descricao: "A × X, B × Y, C × Z, A × Y e B × X. Vence quem fizer 3.",
    jogos: (a, b) => [
      [0, 0, "A × X"], [1, 1, "B × Y"], [2, 2, "C × Z"], [0, 1, "A × Y"], [1, 0, "B × X"],
    ].map(([i, j, n]) => ({ jogo: n, a: a[i].nome, b: b[j].nome, ra: a[i].rating, rb: b[j].rating })),
    precisa: 3,
  },
};

export function simular(formato, equipeA, equipeB, modelo) {
  const f = FORMATOS[formato];
  const jogos = f.jogos(equipeA, equipeB).map((j) => ({ ...j, p: probVitoria(j.ra, j.rb, modelo) }));
  return { jogos, prob: probMaioria(jogos.map((j) => j.p), f.precisa) };
}

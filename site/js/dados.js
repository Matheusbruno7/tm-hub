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

// Estatísticas do atleta a partir dos jogos (placar set a set).
// jogo: { data, venceu, sets: [[pontosDoAtleta, pontosDoAdversario], ...], dif, p, tipo, adversario, pontos }

/** Placar dos sets do perfil oficial: "(11,11,7,2,11,0,0) 3 X 2(4,6,11,11,5,0,0)" -> [[11,4],[11,6],...] */
export function lerSets(texto, venceu) {
  const m = String(texto || "").match(/\(([^)]*)\)\s*(\d+)\s*X\s*(\d+)\s*\(([^)]*)\)/i);
  if (!m) return [];
  const esq = m[1].split(",").map(Number), dir = m[4].split(",").map(Number);
  let sets = esq.map((x, i) => [x, dir[i] ?? 0]).filter(([x, y]) => x || y);
  const ganhosEsq = sets.filter(([x, y]) => x > y).length, ganhosDir = sets.length - ganhosEsq;
  if (venceu != null && (ganhosEsq > ganhosDir) !== venceu) sets = sets.map(([x, y]) => [y, x]); // garante o ponto de vista do atleta
  return sets;
}

const taxa = (v, t) => (t ? v / t : null);

/** Melhor de 3 ou de 5 (pelo número de sets para vencer). */
const setsParaVencer = (sets) => Math.max(sets.filter(([x, y]) => x > y).length, sets.filter(([x, y]) => y > x).length);

export function calcularEstatisticas(jogos) {
  const comSets = jogos.filter((j) => j.sets?.length);
  const r = {
    jogos: jogos.length, vitorias: jogos.filter((j) => j.venceu).length,
    esperado: jogos.reduce((s, j) => s + (j.p ?? 0.5), 0),
    sets: { ganhos: 0, perdidos: 0, pontosFeitos: 0, pontosSofridos: 0 },
    placares: {}, decisivo: { v: 0, d: 0 }, apertados: { v: 0, d: 0 }, deuce: { v: 0, d: 0 },
    primeiroSet: { ganhouEVenceu: 0, ganhou: 0, perdeuEVenceu: 0, perdeu: 0 },
    viradas: { a_favor: 0, contra: 0 }, contraFortes: { v: 0, t: 0, esp: 0 }, contraFracos: { v: 0, t: 0, esp: 0 },
    porTipo: {}, porAno: {}, rivais: {}, zebrasAFavor: 0, zebrasContra: 0, sequencia: { tipo: null, n: 0 },
  };
  for (const j of comSets) {
    const sets = j.sets;
    const ganhos = sets.filter(([x, y]) => x > y).length, perdidos = sets.length - ganhos;
    r.sets.ganhos += ganhos; r.sets.perdidos += perdidos;
    for (const [x, y] of sets) {
      r.sets.pontosFeitos += x; r.sets.pontosSofridos += y;
      if (Math.abs(x - y) === 2) r.apertados[x > y ? "v" : "d"]++;
      if (Math.min(x, y) >= 10) r.deuce[x > y ? "v" : "d"]++;
    }
    const placar = `${ganhos}×${perdidos}`;
    r.placares[placar] = (r.placares[placar] || 0) + 1;
    const n = setsParaVencer(sets);
    // set decisivo: o jogo chegou ao último set possível (2×2 em melhor de 5; 1×1 em melhor de 3)
    if (n >= 2 && sets.length === 2 * n - 1) r.decisivo[j.venceu ? "v" : "d"]++;
    const [x1, y1] = sets[0];
    if (x1 > y1) { r.primeiroSet.ganhou++; if (j.venceu) r.primeiroSet.ganhouEVenceu++; }
    else { r.primeiroSet.perdeu++; if (j.venceu) r.primeiroSet.perdeuEVenceu++; }
    // virada: venceu depois de perder os 2 primeiros sets (ou perdeu depois de ganhar os 2)
    if (n >= 3 && sets.length >= 4) {
      const doisPrimeiros = sets.slice(0, 2).filter(([x, y]) => x > y).length;
      if (doisPrimeiros === 0 && j.venceu) r.viradas.a_favor++;
      if (doisPrimeiros === 2 && !j.venceu) r.viradas.contra++;
    }
  }
  for (const j of jogos) {
    const alvo = j.dif < 0 ? r.contraFortes : r.contraFracos;
    alvo.t++; alvo.esp += j.p ?? 0.5; if (j.venceu) alvo.v++;
    if (j.venceu && (j.p ?? 0.5) < 0.4) r.zebrasAFavor++;
    if (!j.venceu && (j.p ?? 0.5) > 0.6) r.zebrasContra++;
    const tipo = j.tipo || "outros";
    r.porTipo[tipo] ||= { v: 0, t: 0 }; r.porTipo[tipo].t++; if (j.venceu) r.porTipo[tipo].v++;
    const ano = String(j.data).slice(0, 4);
    r.porAno[ano] ||= { v: 0, t: 0 }; r.porAno[ano].t++; if (j.venceu) r.porAno[ano].v++;
    if (j.adversario) {
      const k = j.adversario;
      r.rivais[k] ||= { nome: k, v: 0, t: 0, ultimo: j.data };
      r.rivais[k].t++; if (j.venceu) r.rivais[k].v++;
      if (j.data > r.rivais[k].ultimo) r.rivais[k].ultimo = j.data;
    }
  }
  // sequência atual (jogos do mais recente para o mais antigo)
  for (const j of jogos) {
    const t = j.venceu ? "V" : "D";
    if (!r.sequencia.tipo) r.sequencia.tipo = t;
    if (t !== r.sequencia.tipo) break;
    r.sequencia.n++;
  }
  r.ultimos = jogos.slice(0, 10).map((j) => (j.venceu ? "V" : "D"));
  r.taxa = taxa(r.vitorias, r.jogos);
  r.taxaSets = taxa(r.sets.ganhos, r.sets.ganhos + r.sets.perdidos);
  r.taxaDecisivo = taxa(r.decisivo.v, r.decisivo.v + r.decisivo.d);
  r.taxaApertados = taxa(r.apertados.v, r.apertados.v + r.apertados.d);
  r.taxaDeuce = taxa(r.deuce.v, r.deuce.v + r.deuce.d);
  r.rivaisLista = Object.values(r.rivais).filter((x) => x.t >= 2).sort((a, b) => b.t - a.t || b.ultimo.localeCompare(a.ultimo)).slice(0, 8);
  r.comSets = comSets.length;
  return r;
}

/** Frases com os padrões mais marcantes (só quando há jogos suficientes). */
export function padroes(e) {
  const f = [];
  const pc = (x) => `${Math.round(x * 100)}%`;
  const nDec = e.decisivo.v + e.decisivo.d;
  if (nDec >= 4 && e.taxa != null) {
    const d = e.taxaDecisivo - e.taxa;
    if (d >= 0.1) f.push(["forte", `Cresce na pressão: venceu ${pc(e.taxaDecisivo)} dos jogos que chegaram ao set decisivo (${e.decisivo.v} de ${nDec}), acima do aproveitamento geral (${pc(e.taxa)}).`]);
    else if (d <= -0.1) f.push(["atencao", `Sente a pressão: venceu só ${pc(e.taxaDecisivo)} dos jogos decididos no último set (${e.decisivo.v} de ${nDec}), abaixo do aproveitamento geral (${pc(e.taxa)}).`]);
    else f.push(["neutro", `No set decisivo, rende como no resto do jogo: ${pc(e.taxaDecisivo)} de vitórias (${e.decisivo.v} de ${nDec}).`]);
  }
  const nAp = e.apertados.v + e.apertados.d;
  if (nAp >= 8) {
    if (e.taxaApertados >= 0.58) f.push(["forte", `Decide bem os sets apertados: venceu ${pc(e.taxaApertados)} dos sets definidos por 2 pontos (${e.apertados.v} de ${nAp}).`]);
    else if (e.taxaApertados <= 0.42) f.push(["atencao", `Perde muitos sets apertados: venceu ${pc(e.taxaApertados)} dos sets definidos por 2 pontos (${e.apertados.v} de ${nAp}).`]);
  }
  const p = e.primeiroSet;
  if (p.perdeu >= 5 && taxa(p.perdeuEVenceu, p.perdeu) >= 0.4) f.push(["forte", `Não se entrega: virou ${pc(p.perdeuEVenceu / p.perdeu)} dos jogos em que perdeu o 1º set.`]);
  if (p.ganhou >= 5 && taxa(p.ganhouEVenceu, p.ganhou) <= 0.6) f.push(["atencao", `Começa bem mas nem sempre fecha: ganhou o 1º set e mesmo assim perdeu ${pc(1 - p.ganhouEVenceu / p.ganhou)} desses jogos.`]);
  if (e.viradas.a_favor >= 2) f.push(["forte", `${e.viradas.a_favor} viradas depois de perder os 2 primeiros sets.`]);
  if (e.viradas.contra >= 2) f.push(["atencao", `${e.viradas.contra} jogos perdidos depois de vencer os 2 primeiros sets.`]);
  const cf = e.contraFortes;
  if (cf.t >= 6) {
    const d = cf.v - cf.esp;
    if (d >= 1.5) f.push(["forte", `Gosta de jogo grande: contra adversários de rating maior venceu ${cf.v} de ${cf.t}, ${Math.round(d)} a mais do que o rating previa.`]);
    else if (d <= -1.5) f.push(["atencao", `Contra adversários de rating maior venceu ${cf.v} de ${cf.t}, ${Math.round(-d)} a menos do que o rating previa.`]);
  }
  const fr = e.contraFracos;
  if (fr.t >= 6 && fr.v - fr.esp <= -1.5) f.push(["atencao", `Tropeça contra quem tem rating menor: perdeu ${fr.t - fr.v} de ${fr.t} jogos em que era favorito.`]);
  if (e.sequencia.n >= 4) f.push([e.sequencia.tipo === "V" ? "forte" : "atencao", `Sequência atual: ${e.sequencia.n} ${e.sequencia.tipo === "V" ? "vitórias" : "derrotas"} seguidas.`]);
  return f;
}

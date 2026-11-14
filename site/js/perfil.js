// Perfil do atleta: cabeçalho comum e abas
//   perfil    → histórico e estatísticas (padrão)
//   jogos     → jogos e pontos (pendentes e oficiais) com a chance de vitória
//   previsao  → previsão até o fim do ano e metas
import { renderPrevisao } from "./atletas.js";
import { abrirCartao, botaoCompartilhar } from "./cartao.js";
import { calcularEstatisticas, lerSets, padroes } from "./estatisticas.js";
import { barrasVerticais, esc, fmt, linhaTempo, pct } from "./graficos.js";
import { renderJogos } from "./pontos.js";
import { classeDe, historico, probVitoria, TIPOS, tipoDoEvento } from "./previsao.js";

const RANKING = "https://casquinha-ranking.matheusbruno045.workers.dev/api/";
const AO_VIVO = "https://casquinha-ao-vivo.matheusbruno045.workers.dev/api/";
const get = async (base, caminho) => {
  const r = await fetch(base + caminho);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `erro ${r.status}`);
  return d;
};
const normalizar = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const sinal = (n) => `${n > 0 ? "+" : ""}${fmt(n)}`;
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const NOMES_TIPO = { rating: "Rating", olimpico: "Ranking Olímpico", paralimpico: "Ranking Paralímpico" };
const ABAS = [["perfil", "Perfil e estatísticas"], ["jogos", "Jogos e pontos"], ["previsao", "Previsão e metas"]];

let cache = { id: null, dados: null, em: 0 };

async function carregar(ctx, id) {
  if (cache.id === id && Date.now() - cache.em < 60e3) return cache.dados;
  // "~NOME|CLUBE" (vindo dos destaques ou da lista de um clube): procura no índice
  if (id.startsWith("~")) {
    const chave = id.slice(1);
    try {
      const { itens } = await get(RANKING, `busca?q=${encodeURIComponent(chave.split("|")[0])}`);
      const achado = itens.find((a) => `${normalizar(a.nome)}|${normalizar(a.clube)}` === chave) || (itens.length === 1 ? itens[0] : null);
      if (achado) id = achado.id;
    } catch (e) { /* segue só com o ao vivo */ }
  }
  const [d, modelo] = await Promise.all([get(RANKING, `atleta/${encodeURIComponent(id)}?v=5`).catch(() => null), ctx.carregarModelo()]);
  const chave = d ? `${normalizar(d.atleta.nome)}|${normalizar(d.atleta.clube)}` : id.replace(/^.*~/, "");
  const vivo = await get(AO_VIVO, `atleta/${encodeURIComponent(chave)}`).catch(() => null);
  const dados = { id, d, modelo, vivo };
  cache = { id, dados, em: Date.now() };
  return dados;
}

/** Jogos pendentes (ao vivo) + oficiais, do mais recente para o mais antigo, no mesmo formato. */
function unificarJogos(d, vivo, modelo, { ate365 = false } = {}) {
  const hoje = hojeISO();
  const pend = (vivo?.jogos || []).map((j) => ({
    pendente: true, data: j.dia, hora: j.hora, evento: j.evento, categoria: `${j.categoria} · ${j.fase}`, tipo: tipoDoEvento(j.evento),
    adversario: j.adversario, ratingAdv: j.rating_adversario, antes: j.antes, dif: j.antes - j.rating_adversario,
    venceu: j.venceu, pontos: j.pontos, placar: j.placar, clube: j.clube,
    sets: (j.sets || []).filter(([x, y]) => x || y), p: probVitoria(j.antes - j.rating_adversario, modelo),
  }));
  const ofi = historico({ games: d?.jogos || [] }).map((j) => {
    const sets = lerSets(j.sets, j.venceu);
    const g = sets.filter(([x, y]) => x > y).length;
    return {
      pendente: false, data: j.data, hora: j.hora, evento: j.evento, tipo: j.tipo, adversario: j.adversario,
      ratingAdv: j.antes - j.dif, antes: j.antes, dif: j.dif, venceu: j.venceu, pontos: j.pontos,
      placar: sets.length ? `${g} × ${sets.length - g}` : "", sets, p: probVitoria(j.dif, modelo),
    };
  }).filter((j) => !ate365 || (Date.parse(hoje) - Date.parse(j.data)) / 864e5 <= 365);
  return [...pend, ...ofi].sort((a, b) => `${b.data} ${b.hora || ""}`.localeCompare(`${a.data} ${a.hora || ""}`));
}

export async function viewPerfil(ctx, id, q) {
  ctx.marcarMenu("atletas");
  const aba = ABAS.some(([k]) => k === q.get("aba")) ? q.get("aba") : "perfil";
  ctx.main.innerHTML = '<div class="carregando">Carregando o atleta na CBTM…</div>';
  let dados;
  try { dados = await carregar(ctx, id); } catch (e) { dados = null; }
  if (!dados || (!dados.d && !dados.vivo)) {
    ctx.main.innerHTML = `<a class="voltar" href="#/atletas">← Atletas</a><div class="card vazio">Atleta não encontrado.</div>`;
    return;
  }
  const { d, modelo, vivo } = dados;
  id = dados.id;
  const nome = d?.pessoa?.Nome || d?.atleta?.nome || vivo?.nome;
  const clube = d?.atleta?.clube || vivo?.clube;
  const sexo = d?.atleta?.sexo || d?.pessoa?.Sexo || "M";
  const oficial = d?.atleta?.rating ?? vivo?.oficial;
  const saldo = vivo?.saldo || 0;
  const atual = oficial + saldo;

  ctx.main.innerHTML = `
    <a class="voltar" href="#/atletas">← Atletas</a>
    <section class="perfil-topo">
      <div class="avatar" aria-hidden="true">${esc(String(nome).split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join(""))}</div>
      <div class="perfil-id"><h1>${esc(nome)}</h1><p class="mut">${esc(clube)}${d?.pessoa?.Idade ? ` · ${d.pessoa.Idade} anos` : ""} · ${sexo === "F" ? "Feminino" : "Masculino"}</p>
        <div class="lista-chips"><span class="tag">Classe ${classeDe(atual, sexo)}</span>${d ? `<span class="tag">${esc(d.atleta.categoria)} · ${d.atleta.posicao}º</span>` : ""}
          ${(d?.rankings || []).slice(0, 3).map((r) => `<span class="tag">${esc(NOMES_TIPO[r.tipo])} · ${esc(r.categoria)}: <b>${r.posicao}º</b></span>`).join("")}</div></div>
      <div class="perfil-numeros">
        <div><span>Rating oficial</span><b>${fmt(oficial)}</b></div>
        <div><span>A publicar</span><b class="${saldo > 0 ? "txt-pos" : saldo < 0 ? "txt-neg" : ""}">${sinal(saldo)}</b></div>
        <div class="forte"><span>Rating ao vivo</span><b>${fmt(atual)}</b></div>
      </div>
      <div>${botaoCompartilhar("btn-perfil")}</div>
    </section>
    <div class="abas mt" role="tablist">${ABAS.map(([k, n]) => `<button role="tab" data-aba="${k}" aria-selected="${k === aba}">${n}</button>`).join("")}</div>
    <div id="aba-conteudo"></div>`;
  ctx.main.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
    q.set("aba", b.dataset.aba);
    ctx.irPara(`atleta/${encodeURIComponent(id)}`, q);
  }));
  const alvo = ctx.main.querySelector("#aba-conteudo");
  const jogos12 = unificarJogos(d, vivo, modelo, { ate365: true });
  const est12 = calcularEstatisticas(jogos12);

  ctx.main.querySelector("#btn-perfil").addEventListener("click", () => abrirCartao({
    secao: "Perfil do atleta", nome, linhas: [clube, `Classe ${classeDe(atual, sexo)}${d ? ` · ${d.atleta.posicao}º no ${d.atleta.categoria}` : ""}`],
    destaque: { rotulo: saldo ? "Rating ao vivo" : "Rating oficial", valor: fmt(atual), sub: saldo ? `${sinal(saldo)} pontos nos jogos mais recentes` : `${est12.jogos} jogos nos últimos 12 meses` },
    metricas: [["de vitórias (12 meses)", est12.taxa != null ? pct(est12.taxa) : "–"], ["no set decisivo", est12.taxaDecisivo != null ? pct(est12.taxaDecisivo) : "–"], ["sets apertados", est12.taxaApertados != null ? pct(est12.taxaApertados) : "–"]],
    barras: { titulo: "Últimos 12 meses", itens: [["Vitórias", est12.taxa || 0, est12.taxa != null ? pct(est12.taxa) : "–"], ["Sets ganhos", est12.taxaSets || 0, est12.taxaSets != null ? pct(est12.taxaSets) : "–"], ["Set decisivo", est12.taxaDecisivo || 0, est12.taxaDecisivo != null ? pct(est12.taxaDecisivo) : "–"]] },
    texto: `${nome} no tênis de mesa: rating ${fmt(atual)}`, arquivo: `atleta-${normalizar(nome).toLowerCase().replace(/\s+/g, "-")}`,
  }));

  if (aba === "jogos") return renderJogos(ctx, alvo, { jogos: jogos12, clube, modelo });
  if (aba === "previsao") {
    if (!d) { alvo.innerHTML = '<div class="card vazio">A previsão precisa do perfil oficial do atleta na CBTM.</div>'; return; }
    alvo.innerHTML = '<div class="carregando">Montando a previsão…</div>';
    const cal = await get(RANKING, "calendario?v=5").catch(() => ({ eventos: [] }));
    return renderPrevisao(ctx, alvo, { id, d, modelo, vivo, cal });
  }
  renderEstatisticas(alvo, { d, vivo, modelo, saldo, atual, hoje: hojeISO() });
}

function renderEstatisticas(alvo, { d, vivo, modelo, saldo, atual, hoje }) {
  const todos = unificarJogos(d, vivo, modelo);
  let periodo = "12m";
  const desenhar = () => {
    const jogos = periodo === "12m" ? todos.filter((j) => (Date.parse(hoje) - Date.parse(j.data)) / 864e5 <= 365) : todos;
    const e = calcularEstatisticas(jogos);
    const frases = padroes(e);
    const evol = (d?.eventos || []).filter((x) => x.RatingFinal != null).map((x) => ({ x: String(x.DataFim || x.DataInicio).slice(0, 10), y: x.RatingFinal, rotulo: `${dataBR(x.DataFim || x.DataInicio)} · ${x.EventoNome}<br><b>${fmt(x.RatingFinal)}</b> (${sinal(x.Pontos)})` }))
      .sort((a, b) => a.x.localeCompare(b.x)).filter((p) => periodo !== "12m" || (Date.parse(hoje) - Date.parse(p.x)) / 864e5 <= 365);
    if (saldo) evol.push({ x: hoje, y: atual, rotulo: `Agora (ao vivo): <b>${fmt(atual)}</b> (${sinal(saldo)} a publicar)` });
    const nDec = e.decisivo.v + e.decisivo.d, nAp = e.apertados.v + e.apertados.d, nDeuce = e.deuce.v + e.deuce.d;
    const ordemPlacar = ["3×0", "3×1", "3×2", "2×3", "1×3", "0×3", "2×0", "2×1", "1×2", "0×2"].filter((k) => e.placares[k]);
    const linhaComp = (rot, v, t, sub, dica) => `<div class="comp-l" style="grid-template-columns:150px minmax(0,1fr) 92px" ${dica ? `data-dica="${esc(dica)}"` : ""}><span>${rot}${sub ? `<br><small class="mut">${sub}</small>` : ""}</span><span class="barra"><i style="width:${t ? (100 * v) / t : 0}%"></i></span><b>${t ? pct(v / t) : "–"} <small class="mut">${v}/${t}</small></b></div>`;
    alvo.innerHTML = `
      <div class="filtros"><div class="seg" role="group" aria-label="Período">
        <button type="button" data-p="12m" aria-pressed="${periodo === "12m"}">Últimos 12 meses</button>
        <button type="button" data-p="tudo" aria-pressed="${periodo === "tudo"}">Toda a carreira</button></div>
        <span class="mut" style="font-size:13px">${fmt(e.jogos)} jogos (${fmt(e.comSets)} com placar dos sets) · fonte: perfil oficial da CBTM + jogos ainda não publicados</span></div>
      ${e.jogos ? `
      <div class="grade g4">
        <div class="card kpi"><div class="v">${pct(e.taxa)}</div><div class="r">de vitórias (${e.vitorias}V ${e.jogos - e.vitorias}D)</div></div>
        <div class="card kpi"><div class="v">${e.taxaSets != null ? pct(e.taxaSets) : "–"}</div><div class="r">dos sets ganhos (${e.sets.ganhos}–${e.sets.perdidos})</div></div>
        <div class="card kpi" data-dica="Jogos que chegaram ao último set possível: 2×2 nos jogos em melhor de 5 (1×1 em melhor de 3)."><div class="v">${e.taxaDecisivo != null ? pct(e.taxaDecisivo) : "–"}</div><div class="r">no set decisivo · pressão do 2×2 (${e.decisivo.v}/${nDec})</div></div>
        <div class="card kpi" data-dica="Vitórias reais menos a soma das chances de vitória antes de cada jogo."><div class="v ${e.vitorias - e.esperado >= 0 ? "txt-pos" : "txt-neg"}">${sinal(Math.round(e.vitorias - e.esperado))}</div><div class="r">vitórias acima do esperado pelo rating</div></div>
      </div>
      ${frases.length ? `<div class="card mt"><h3>Padrões</h3><ul class="padroes">${frases.map(([t, txt]) => `<li class="${t}">${esc(txt)}</li>`).join("")}</ul></div>` : ""}
      <div class="grade g2 mt">
        <div class="card"><h3>Pressão e momentos decisivos</h3>
          ${linhaComp("Set decisivo", e.decisivo.v, nDec, "jogo empatado em 2×2", "Vitórias nos jogos que foram para o último set.")}
          ${linhaComp("Sets apertados", e.apertados.v, nAp, "decididos por 2 pontos", "Sets que terminaram com 2 pontos de diferença (ex.: 11-9, 12-10).")}
          ${linhaComp("Sets com 10×10", e.deuce.v, nDeuce, "chegaram ao empate em 10", "")}
          ${linhaComp("Ganhou o 1º set", e.primeiroSet.ganhouEVenceu, e.primeiroSet.ganhou, "e venceu o jogo", "")}
          ${linhaComp("Perdeu o 1º set", e.primeiroSet.perdeuEVenceu, e.primeiroSet.perdeu, "e mesmo assim venceu", "")}
          <p class="mut" style="font-size:13px;margin-top:8px">Viradas depois de perder os 2 primeiros sets: <b>${e.viradas.a_favor}</b> · jogos perdidos depois de vencer os 2 primeiros: <b>${e.viradas.contra}</b></p>
        </div>
        <div class="card"><h3>Placares</h3>${ordemPlacar.length ? barrasVerticais(ordemPlacar.map((k) => ({ rotulo: k, valor: e.placares[k] })), { unidade: "jogos" }) : '<p class="mut">Sem placar dos sets.</p>'}
          <p class="mut" style="font-size:13px">Pontos por set: <b>${e.comSets ? fmt(e.sets.pontosFeitos / (e.sets.ganhos + e.sets.perdidos), 1) : "–"}</b> feitos e <b>${e.comSets ? fmt(e.sets.pontosSofridos / (e.sets.ganhos + e.sets.perdidos), 1) : "–"}</b> sofridos, em média.</p></div>
      </div>
      <div class="grade g2 mt">
        <div class="card"><h3>Contra quem</h3>
          ${linhaComp("Rating maior", e.contraFortes.v, e.contraFortes.t, `esperado pelo rating: ${fmt(e.contraFortes.esp, 0)} vitórias`, "")}
          ${linhaComp("Rating menor", e.contraFracos.v, e.contraFracos.t, `esperado pelo rating: ${fmt(e.contraFracos.esp, 0)} vitórias`, "")}
          <p class="mut" style="font-size:13px;margin-top:8px">Zebras a favor (venceu com menos de 40% de chance): <b>${e.zebrasAFavor}</b> · zebras contra (perdeu com mais de 60%): <b>${e.zebrasContra}</b></p>
          <h3 class="mt">Por tipo de evento</h3>
          ${Object.entries(e.porTipo).sort((a, b) => b[1].t - a[1].t).map(([k, v]) => linhaComp(TIPOS[k]?.nome || "Outros", v.v, v.t, "", "")).join("")}
        </div>
        <div class="card"><h3>Ano a ano</h3>${barrasVerticais(Object.keys(e.porAno).sort().map((a) => ({ rotulo: a, valor: Math.round((100 * e.porAno[a].v) / e.porAno[a].t) })), { unidade: "% de vitórias" })}
          <p class="mut" style="font-size:13px">Percentual de vitórias em cada ano (${Object.keys(e.porAno).sort().map((a) => `${a}: ${e.porAno[a].t} jogos`).join(" · ")}).</p>
          <h3 class="mt">Últimos 10 jogos</h3><div class="forma-l">${e.ultimos.map((r) => `<span class="vd ${r === "V" ? "v" : "d"}">${r}</span>`).join("")}</div>
        </div>
      </div>
      ${evol.length > 1 ? `<div class="card mt"><h3>Rating ao longo do tempo</h3>${linhaTempo(evol)}</div>` : ""}
      ${e.rivaisLista.length ? `<div class="card mt"><h3>Adversários mais frequentes</h3><div class="tabela-wrap" style="box-shadow:none"><table><thead><tr><th>Adversário</th><th class="dir">Jogos</th><th class="dir">Vitórias</th><th class="dir">Derrotas</th><th class="dir">Último jogo</th></tr></thead><tbody>
        ${e.rivaisLista.map((r) => `<tr><td class="clube-nome">${esc(r.nome)}</td><td class="dir num">${r.t}</td><td class="dir num txt-pos">${r.v}</td><td class="dir num txt-neg">${r.t - r.v}</td><td class="dir num">${dataBR(r.ultimo)}</td></tr>`).join("")}</tbody></table></div></div>` : ""}
      ` : '<div class="card vazio">Sem jogos no período.</div>'}`;
    alvo.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => { periodo = b.dataset.p; desenhar(); }));
  };
  desenhar();
}

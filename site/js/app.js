import { criarBuscaDeSaldo, normalizar as normalizarTexto, buscarAtletasAoVivo, carregarAtletaAoVivo, carregarAtletas, carregarEventoAoVivo, carregarModelo, carregarRanking, carregarResumoAoVivo, carregarSaldos, FORMATOS, projetarClubes, REGIOES, regiaoDe, SEM_ESTADO, simular } from "./dados.js";
import { viewAtleta as viewAtletaRanking, viewAtletas } from "./atletas.js";
import { abrirCartao, botaoCompartilhar } from "./cartao.js";
import { viewPontos, viewPontosAtleta } from "./pontos.js";
import { ativarDicas, barrasAgrupadas, barrasVerticais, esc, fmt, legenda, pct } from "./graficos.js";

const main = document.getElementById("conteudo");
const CORES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
const POR_PAGINA = 50;
const ICONE_INFO = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

let R; // ranking_clubes.json
const porId = new Map();
let PROJ = null; // projeção com os pontos ao vivo: { proj, posicoes, afetados, em }

async function obterProjecao() {
  if (PROJ && Date.now() - PROJ.em < 60e3) return PROJ;
  const [s, a] = await Promise.all([carregarSaldos(), carregarAtletas()]);
  PROJ = { ...projetarClubes(R, a, s), em: Date.now(), oficialAte: s.oficial_ate };
  return PROJ;
}

// ---------------- utilidades ----------------
function rota() {
  const h = location.hash.replace(/^#\/?/, "");
  const [caminho, query = ""] = h.split("?");
  return { partes: caminho.split("/").filter(Boolean), q: new URLSearchParams(query) };
}
function irPara(caminho, q) {
  const s = q && [...q].length ? `?${q}` : "";
  location.hash = `#/${caminho}${s}`;
}
function atualizarQuery(caminho, q) {
  const s = [...q].length ? `?${q}` : "";
  history.replaceState(null, "", `#/${caminho}${s}`);
}
const campoForca = (sexo) => (sexo === "M" ? "forca_masculino" : sexo === "F" ? "forca_feminino" : "forca");
const ufRotulo = (uf) => (uf === SEM_ESTADO ? "Sem estado" : uf);
const aviso = () => `<div class="aviso">${ICONE_INFO}<div><b>Os dados usam os números dos atletas do último ano.</b> Só contam atletas que disputaram eventos oficiais da CBTM nas últimas 52 semanas. Atletas inscritos diretamente por federações aparecem separados.</div></div>`;

const SECAO_MENU = { comparar: "clubes", simulador: "clubes", "ao-vivo": "pontos" };
const subnavClubes = (atual) => `<nav class="subnav" aria-label="Clubes">${[["clubes", "Ranking de Clubes"], ["comparar", "Comparar"], ["simulador", "Simulador de confronto"]].map(([r, n]) => `<a href="#/${r}" class="${r === atual ? "on" : ""}">${n}</a>`).join("")}</nav>`;
function marcarMenu(secao) {
  secao = SECAO_MENU[secao] || secao;
  document.querySelectorAll(".menu a").forEach((a) => a.classList.toggle("on", a.dataset.secao === secao));
}

// ---------------- início ----------------
function viewInicio() {
  marcarMenu("");
  const r = R.resumo;
  const top = R.clubes.slice(0, 5);
  main.innerHTML = `
    <section class="home-hero">
      <h1>Ranking de Clubes do tênis de mesa brasileiro</h1>
      <p>Compare a <b>Força do Clube</b> de ${fmt(r.clubes_no_ranking)} clubes, calculada com o rating dos ${fmt(r.atletas_ativos_em_clubes)} atletas que jogaram no último ano, e simule confrontos entre equipes.</p>
      <a class="btn" href="#/clubes">Ver o Ranking de Clubes →</a>
    </section>
    <div class="grade g3">
      <a class="card atalho" href="#/clubes"><h2>Ranking de Clubes</h2><p class="mut">Força do Clube no Brasil, por região e por estado, com filtros por sexo.</p></a>
      <a class="card atalho" href="#/comparar"><h2>Comparar clubes</h2><p class="mut">Até 4 clubes lado a lado: elite, profundidade, volume e classes de rating.</p></a>
      <a class="card atalho" href="#/simulador"><h2>Simulador de confronto</h2><p class="mut">A chance de cada clube vencer um confronto por equipes, jogo a jogo.</p></a>
    </div>
    <div class="grade g3 mt">
      <div class="card"><h3>Top 5 · Força do Clube</h3>
        ${top.map((c, i) => `<div class="comp-l" style="grid-template-columns:24px minmax(0,1fr) 56px"><span class="mut num">${i + 1}</span><a href="#/clubes/${c.id}" class="clube-nome">${esc(c.nome)} <span class="tag">${esc(ufRotulo(c.uf))}</span></a><b>${fmt(c.forca, 1)}</b></div>`).join("")}
      </div>
      <div class="card"><h3><span class="ao-vivo-pulso" aria-hidden="true"></span>Ao vivo</h3><p>Os pontos de rating de cada jogo assim que o resultado cai na CBTM.</p><a class="btn prim" href="#/pontos">Ver pontos e buscar atleta →</a>
        </div>
      <div class="card"><h3>Atletas</h3><p>Rating, rankings, <b>previsão até o fim do ano</b>, metas e quais torneios priorizar.</p><a class="btn prim" href="#/atletas">Buscar atleta →</a></div>
    </div>`;
}

// ---------------- ranking de clubes ----------------
function filtrarClubes(q) {
  const busca = (q.get("q") || "").trim().toLowerCase();
  const uf = q.get("uf") || "";
  const regiao = q.get("regiao") || "";
  const sexo = q.get("sexo") || "";
  const campo = campoForca(sexo);
  let lista = R.clubes.filter((c) => (sexo === "M" ? c.atletas_masculino : sexo === "F" ? c.atletas_feminino : c.atletas_ativos) > 0);
  // posição Brasil de acordo com o sexo escolhido
  lista = [...lista].sort((a, b) => b[campo] - a[campo] || b.atletas_ativos - a.atletas_ativos);
  lista.forEach((c, i) => (c._posBr = i + 1));
  if (regiao) lista = lista.filter((c) => (regiao === "sem" ? c.uf === SEM_ESTADO : regiaoDe(c.uf) === regiao));
  if (uf) lista = lista.filter((c) => c.uf === uf);
  if (busca) lista = lista.filter((c) => c.nome_cbtm.toLowerCase().includes(busca));
  const ordem = q.get("ordem") || "forca";
  const dir = q.get("dir") === "asc" ? 1 : -1;
  const chaves = { forca: campo, elite: "elite", prof: "profundidade", atletas: "atletas_ativos", top10: "top100_rating", nome: "nome" };
  const k = chaves[ordem] || campo;
  lista.sort((a, b) => (k === "nome" ? a.nome.localeCompare(b.nome) * -dir : (a[k] - b[k]) * dir) || a._posBr - b._posBr);
  return { lista, campo, sexo };
}

function viewClubes(q) {
  marcarMenu("clubes");
  const aba = q.get("aba") || "clubes";
  const r = R.resumo;
  const ufs = [...new Set(R.clubes.map((c) => c.uf).filter((u) => u !== SEM_ESTADO))].sort();
  const sexo = q.get("sexo") || "";
  main.innerHTML = `
    ${subnavClubes("clubes")}
    <div class="cab"><div><h1>Ranking de Clubes</h1><p>Clubes ordenados pela <b>Força do Clube</b> (0 a 1.000): a qualidade dos melhores atletas, a profundidade do elenco e o número de atletas ativos. <a href="#/metodologia">Como é calculada</a></p></div>${botaoCompartilhar("btn-ranking")}</div>
    ${aviso()}
    <div class="podio">${R.clubes.slice(0, 3).map((c, i) => `<a href="#/clubes/${c.id}"><span class="medalha">${i + 1}º</span>
      <div class="nome">${esc(c.nome)}</div><div class="mut" style="font-size:13px">${esc(ufRotulo(c.uf))} · ${fmt(c.atletas_ativos)} atletas ativos</div>
      <div class="forca">${fmt(c.forca, 1)}</div><div class="barra"><i style="width:${c.forca / 10}%"></i></div></a>`).join("")}</div>
    <div class="grade g4">
      <div class="card kpi"><div class="v">${fmt(r.clubes_no_ranking)}</div><div class="r">clubes no ranking</div></div>
      <div class="card kpi"><div class="v">${fmt(r.atletas_ativos_em_clubes)}</div><div class="r">atletas ativos em clubes</div></div>
      <div class="card kpi"><div class="v">${fmt(r.atletas_ativos_em_federacoes)}</div><div class="r">atletas vinculados a federações</div></div>
      <div class="card kpi"><div class="v">${fmt(r.clubes_sem_estado)}</div><div class="r">clubes sem estado identificado</div></div>
    </div>
    <div class="abas mt" role="tablist">
      <button role="tab" aria-selected="${aba === "clubes"}" data-aba="clubes">Clubes</button>
      <button role="tab" aria-selected="${aba === "federacoes"}" data-aba="federacoes">Atletas vinculados a federações</button>
    </div>
    <div id="painel"></div>`;
  main.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => { q.set("aba", b.dataset.aba); q.delete("pagina"); irPara("clubes", q); }));
  main.querySelector("#btn-ranking").addEventListener("click", () => {
    const { lista, campo } = filtrarClubes(q);
    const filtro = [q.get("uf"), q.get("regiao") && q.get("regiao") !== "sem" ? `Região ${q.get("regiao")}` : "", q.get("sexo") === "M" ? "masculino" : q.get("sexo") === "F" ? "feminino" : ""].filter(Boolean).join(" · ");
    abrirCartao({
      secao: "Ranking de Clubes · Força do Clube", nome: `Top 10${filtro ? ` · ${filtro}` : " do Brasil"}`,
      linhas: ["Força do Clube (0 a 1.000) com os atletas que jogaram nos últimos 12 meses"],
      lista: { neutro: true, titulo: "Clubes mais fortes", itens: lista.slice(0, 10).map((c) => [`${c._posBr}º`, c.nome, `${ufRotulo(c.uf)} · ${fmt(c.atletas_ativos)} atletas ativos`, fmt(c[campo], 1)]) },
      texto: "Ranking de Clubes do tênis de mesa brasileiro", arquivo: "ranking-de-clubes",
    });
  });
  const painel = main.querySelector("#painel");

  if (aba === "federacoes") {
    painel.innerHTML = `
      <p class="mut">Atletas inscritos diretamente pela federação estadual, sem clube. Eles não entram no Ranking de Clubes.</p>
      <div class="tabela-wrap"><table><thead><tr><th>Federação</th><th>UF</th><th class="dir">Atletas ativos</th><th class="dir">Masc.</th><th class="dir">Fem.</th><th class="dir">Top 100 rating</th></tr></thead><tbody>
      ${R.federacoes.itens.map((f) => `<tr class="clic" data-id="${f.id}"><td class="clube-nome">${esc(f.nome)}</td><td>${esc(ufRotulo(f.uf))}</td><td class="dir num">${fmt(f.atletas_ativos)}</td><td class="dir num">${fmt(f.atletas_masculino)}</td><td class="dir num">${fmt(f.atletas_feminino)}</td><td class="dir num">${fmt(f.top100_rating)}</td></tr>`).join("")}
      </tbody></table></div>`;
    painel.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => irPara(`clubes/${tr.dataset.id}`)));
    return;
  }

  painel.innerHTML = `
    <div class="filtros">
      <input type="search" id="f-q" placeholder="Buscar clube" value="${esc(q.get("q") || "")}" aria-label="Buscar clube">
      <select id="f-regiao" aria-label="Região">
        <option value="">Todas as regiões</option>
        ${Object.keys(REGIOES).map((rg) => `<option ${q.get("regiao") === rg ? "selected" : ""}>${rg}</option>`).join("")}
        <option value="sem" ${q.get("regiao") === "sem" ? "selected" : ""}>Clubes sem estado</option>
      </select>
      <select id="f-uf" aria-label="Estado">
        <option value="">Todos os estados</option>
        ${ufs.map((u) => `<option ${q.get("uf") === u ? "selected" : ""}>${u}</option>`).join("")}
      </select>
      <div class="seg" role="group" aria-label="Sexo">
        ${[["", "Geral"], ["M", "Masculino"], ["F", "Feminino"]].map(([v, n]) => `<button type="button" data-sexo="${v}" aria-pressed="${sexo === v}">${n}</button>`).join("")}
      </div>
    </div>
    <div id="tabela"></div>`;

  const desenhar = () => {
    const { lista, campo } = filtrarClubes(q);
    const pagina = Math.max(1, +q.get("pagina") || 1);
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    const pg = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
    const ordem = q.get("ordem") || "forca";
    const dir = q.get("dir") === "asc" ? "ascending" : "descending";
    const th = (k, rot, cls = "") => `<th class="${cls}" aria-sort="${ordem === k ? dir : "none"}"><button data-ordem="${k}">${rot}</button></th>`;
    const filtrado = q.get("uf") || q.get("regiao") || q.get("q");
    const sexoN = sexo === "M" ? "masculino" : sexo === "F" ? "feminino" : "";
    const contaSexo = (c) => (sexo === "M" ? c.atletas_masculino : sexo === "F" ? c.atletas_feminino : c.atletas_ativos) > 0;
    const posProj = PROJ ? PROJ.posicoes(campo, contaSexo) : null;
    main.querySelector("#tabela").innerHTML = lista.length ? `
      <div class="tabela-wrap"><table class="tab-clubes">
        <thead><tr><th>#</th>${th("nome", "Clube")}<th>UF</th>${th("forca", `Força do Clube${sexoN ? ` (${sexoN})` : ""}`)}${th("elite", "Elite", "dir")}${th("prof", "Profund.", "dir")}${th("atletas", "Atletas ativos", "dir")}${th("top10", "Top 100 rating", "dir")}<th class="dir th-quebra" data-dica="Posição que o clube deve ter na próxima atualização oficial (segunda-feira), somando os pontos dos jogos já lançados na CBTM e ainda não publicados no rating oficial.">Provável posição amanhã</th></tr></thead>
        <tbody>${pg.map((c) => `
          <tr class="clic" data-id="${c.id}">
            <td class="pos">${c._posBr}</td>
            <td><div class="clube-nome">${esc(c.nome)}</div><div class="clube-sub">${c.uf === SEM_ESTADO ? '<span class="tag alerta">sem estado</span>' : `${fmt(c.atletas_masculino)} masc. · ${fmt(c.atletas_feminino)} fem.`}</div></td>
            <td>${esc(ufRotulo(c.uf))}</td>
            <td><div class="forca-cel" data-dica="Força do Clube: <b>${fmt(c[campo], 1)}</b> de 1.000"><b>${fmt(c[campo], 1)}</b><span class="barra"><i style="width:${c[campo] / 10}%"></i></span></div></td>
            <td class="dir num">${fmt(c.elite, 1)}</td>
            <td class="dir num">${fmt(c.profundidade, 1)}</td>
            <td class="dir num">${fmt(c.atletas_ativos)}</td>
            <td class="dir num">${fmt(c.top100_rating)}</td>
            <td class="dir num">${celulaProjecao(c, posProj)}</td>
          </tr>`).join("")}</tbody></table></div>
      <div class="paginacao"><span>${fmt(lista.length)} clubes${filtrado ? " no filtro" : ""} · a coluna # é a posição no Brasil</span>
        <span><button class="btn" data-pg="${pagina - 1}" ${pagina <= 1 ? "disabled" : ""}>← Anterior</button> <span class="num">${pagina}/${paginas}</span> <button class="btn" data-pg="${pagina + 1}" ${pagina >= paginas ? "disabled" : ""}>Próxima →</button></span></div>`
      : `<div class="card vazio">Nenhum clube encontrado com esses filtros.</div>`;
    main.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => irPara(`clubes/${tr.dataset.id}`)));
    main.querySelectorAll("[data-ordem]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.ordem;
      if ((q.get("ordem") || "forca") === k) q.set("dir", q.get("dir") === "asc" ? "desc" : "asc");
      else { q.set("ordem", k); q.set("dir", k === "nome" ? "asc" : "desc"); }
      q.delete("pagina"); atualizarQuery("clubes", q); desenhar();
    }));
    main.querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { q.set("pagina", b.dataset.pg); atualizarQuery("clubes", q); desenhar(); window.scrollTo({ top: 0 }); }));
  };

  const mudar = (k, v) => { v ? q.set(k, v) : q.delete(k); q.delete("pagina"); atualizarQuery("clubes", q); desenhar(); };
  let t;
  main.querySelector("#f-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => mudar("q", e.target.value), 180); });
  main.querySelector("#f-regiao").addEventListener("change", (e) => { q.delete("uf"); main.querySelector("#f-uf").value = ""; mudar("regiao", e.target.value); });
  main.querySelector("#f-uf").addEventListener("change", (e) => mudar("uf", e.target.value));
  main.querySelectorAll("[data-sexo]").forEach((b) => b.addEventListener("click", () => {
    main.querySelectorAll("[data-sexo]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    mudar("sexo", b.dataset.sexo);
  }));
  desenhar();
  obterProjecao().then(() => { if (location.hash.startsWith("#/clubes") && !rota().partes[1]) desenhar(); })
    .catch(() => { PROJ = null; main.querySelectorAll(".tab-clubes tbody td:last-child").forEach((td) => (td.textContent = "–")); });
}

function celulaProjecao(c, posProj) {
  if (!posProj) return '<span class="mut" data-dica="Carregando os pontos ao vivo…">…</span>';
  const p = posProj.get(c.id);
  if (!p) return "–";
  const d = c._posBr - p;
  const seta = d > 0 ? `<span class="sobe" data-dica="Deve subir ${d} posição(ões)">▲ ${d}</span>`
    : d < 0 ? `<span class="desce" data-dica="Deve cair ${-d} posição(ões)">▼ ${-d}</span>`
    : '<span class="mut" data-dica="Deve manter a posição">=</span>';
  return `<b>${p}º</b> ${seta}`;
}

// ---------------- detalhe do clube ----------------
async function viewClube(id) {
  marcarMenu("clubes");
  const c = porId.get(id);
  if (!c) { main.innerHTML = `<div class="card vazio">Clube não encontrado. <a href="#/clubes">Voltar ao ranking</a></div>`; return; }
  const ehFed = R.federacoes.itens.includes(c);
  const todosAtletas = await carregarAtletas();
  const atletas = todosAtletas.clubes[id] || [];
  const comp = (rot, v, dica) => `<div class="comp-l" data-dica="${esc(dica)}"><span>${rot}</span><span class="barra"><i style="width:${v}%"></i></span><b>${fmt(v, 1)}</b></div>`;
  const classes = (obj) => Object.entries(obj).map(([k, v]) => ({ rotulo: k, valor: v }));
  const faixas = ["Base (Sub)", "Absoluto", "Adulto", "Master"].map((f) => ({ rotulo: f, valor: c.faixas_etarias?.[f] || 0 }));
  const doEstado = R.clubes.filter((x) => x.uf === c.uf);
  const media = (lista, k) => lista.reduce((t, x) => t + (x[k] || 0), 0) / Math.max(1, lista.length);
  const serieComp = [{ nome: c.nome, cor: "var(--s1)" }, { nome: `Média de ${c.uf === SEM_ESTADO ? "clubes sem estado" : c.uf}`, cor: "var(--s2)" }, { nome: "Média do Brasil", cor: "var(--s3)" }];

  main.innerHTML = `
    <a class="voltar" href="#/clubes">← Ranking de Clubes</a>
    <div class="card det-topo">
      <div>
        <h1>${esc(c.nome)}</h1>
        <p class="mut">${esc(c.nome_cbtm)} · ${c.uf === SEM_ESTADO ? '<span class="tag alerta">sem estado identificado</span>' : `${esc(c.uf)} · ${esc(regiaoDe(c.uf) || "")}`}</p>
        ${ehFed ? '<p><span class="tag">Atletas vinculados a federação. Não entra no Ranking de Clubes.</span></p>' : `<p><b>${c.posicao_brasil}º</b> no Brasil${c.uf !== SEM_ESTADO ? ` · <b>${c.posicao_estado}º</b> em ${esc(c.uf)}` : ""}</p>
        <div class="escolha">${botaoCompartilhar("btn-clube")}<a class="btn" href="#/comparar?c=0.${id}">Comparar com outros clubes</a><a class="btn" href="#/simulador?a=${id}">Simular confronto</a></div>`}
      </div>
      ${ehFed ? "" : `<div class="selo"><div class="r">Força do Clube</div><div class="v">${fmt(c.forca, 1)}</div><div class="r">de 1.000</div></div>`}
    </div>
    ${aviso()}
    <div class="grade g4">
      <div class="card kpi"><div class="v">${fmt(c.atletas_ativos)}</div><div class="r">atletas ativos (${fmt(c.atletas_cadastrados)} no rating)</div></div>
      <div class="card kpi"><div class="v">${fmt(c.atletas_masculino)} · ${fmt(c.atletas_feminino)}</div><div class="r">masculino · feminino</div></div>
      <div class="card kpi"><div class="v">${fmt(c.top100_rating)}</div><div class="r">atletas no top 100 do rating nacional</div></div>
      <div class="card kpi"><div class="v">${fmt(c.atletas_paralimpicos)}</div><div class="r">atletas paralímpicos</div></div>
    </div>
    ${ehFed ? "" : `<div class="grade g2 mt">
      <div class="card"><h3>Comparado com o estado e o Brasil</h3>
        ${barrasAgrupadas(["elite", "profundidade", "volume"].map((k) => ({ rotulo: { elite: "Elite", profundidade: "Profundidade", volume: "Volume" }[k], valores: [c[k], media(doEstado, k), media(R.clubes, k)] })), serieComp)}
        ${legenda(serieComp)}
        <p class="mut" style="font-size:13px">Mais forte que <b>${`${Math.floor((100 * (R.clubes.length - c.posicao_brasil)) / Math.max(1, R.clubes.length - 1))}%`}</b> dos clubes do Brasil${c.uf !== SEM_ESTADO ? ` e ${c.posicao_estado}º de ${doEstado.length} em ${esc(c.uf)}` : ""}.</p></div>
      <div class="card" id="semana"><h3>Desde a última atualização oficial</h3><div class="carregando" style="padding:20px">Carregando pontos ao vivo…</div></div>
    </div>`}
    <div class="grade g2 mt">
      <div class="card"><h3>Composição da Força</h3>
        <div class="comp">
          ${comp("Elite (50%)", c.elite, "Média do índice dos 5 melhores atletas")}
          ${comp("Profundidade (30%)", c.profundidade, "Média do índice do 6º ao 15º atleta")}
          ${comp("Volume (20%)", c.volume, "Número de atletas ativos em escala logarítmica (teto de 50)")}
        </div>
        <p class="mut mt" style="font-size:13px">Índice do atleta (0 a 100): rating do atleta comparado à média dos 10 melhores atletas ativos do Brasil do mesmo sexo.</p>
        ${ehFed ? "" : `<div class="grade g2 mt"><div><h3>Força masculina</h3><b class="num" style="font-size:22px">${fmt(c.forca_masculino, 1)}</b></div><div><h3>Força feminina</h3><b class="num" style="font-size:22px">${fmt(c.forca_feminino, 1)}</b></div></div>`}
      </div>
      <div class="card"><h3>Atletas por faixa etária (ranking olímpico)</h3>${barrasVerticais(faixas)}<p class="mut" style="font-size:13px">Um atleta pode aparecer em mais de uma faixa (ex.: Sub-19 e Absoluto).</p></div>
    </div>
    <div class="grade g2 mt">
      <div class="card"><h3>Classes de rating · masculino</h3>${c.atletas_masculino ? barrasVerticais(classes(c.classes_masculino)) : '<p class="mut">Sem atletas masculinos ativos.</p>'}
        <p class="mut" style="font-size:13px">Rating médio ${fmt(c.rating_medio_masculino)} · mediano ${fmt(c.rating_mediano_masculino)}</p></div>
      <div class="card"><h3>Classes de rating · feminino</h3>${c.atletas_feminino ? barrasVerticais(classes(c.classes_feminino)) : '<p class="mut">Sem atletas femininas ativas.</p>'}
        <p class="mut" style="font-size:13px">Rating médio ${fmt(c.rating_medio_feminino)} · mediano ${fmt(c.rating_mediano_feminino)}</p></div>
    </div>
    <h2 class="mt" style="margin-top:22px">Atletas ativos</h2>
    <div class="filtros"><div class="seg" role="group" aria-label="Sexo dos atletas">
      ${[["", "Todos"], ["M", "Masculino"], ["F", "Feminino"]].map(([v, n]) => `<button type="button" data-sx="${v}" aria-pressed="${v === ""}">${n}</button>`).join("")}</div></div>
    <div id="lista-atletas"></div>`;

  if (!ehFed) {
    main.querySelector("#btn-clube").addEventListener("click", () => abrirCartao({
      secao: "Ranking de Clubes · Força do Clube", nome: c.nome,
      linhas: [`${c.uf === SEM_ESTADO ? "" : `${c.uf} · `}${c.posicao_brasil}º no Brasil${c.uf !== SEM_ESTADO ? ` · ${c.posicao_estado}º em ${c.uf}` : ""}`],
      destaque: { rotulo: "Força do Clube", valor: fmt(c.forca, 1), sub: `Mais forte que ${`${Math.floor((100 * (R.clubes.length - c.posicao_brasil)) / Math.max(1, R.clubes.length - 1))}%`} dos clubes do Brasil` },
      metricas: [["atletas ativos", fmt(c.atletas_ativos)], ["no top 100 do rating", fmt(c.top100_rating)], ["masc. · fem.", `${c.atletas_masculino} · ${c.atletas_feminino}`]],
      barras: { titulo: "Composição", itens: [["Elite", c.elite / 100, fmt(c.elite, 1)], ["Profundidade", c.profundidade / 100, fmt(c.profundidade, 1)], ["Volume", c.volume / 100, fmt(c.volume, 1)]] },
      lista: { neutro: true, titulo: "Melhores atletas", itens: atletas.slice(0, 5).map((a, i) => [i + 1, a.nome, `Classe ${a.classe}`, fmt(a.rating)]) },
      texto: `${c.nome}: Força do Clube ${fmt(c.forca, 1)} no tênis de mesa`, arquivo: `clube-${id}`,
    }));
    Promise.all([carregarSaldos(), obterProjecao()]).then(([s, proj]) => {
      const alvo = main.querySelector("#semana");
      if (!alvo) return;
      const saldoDe = criarBuscaDeSaldo(todosAtletas, s);
      const comSaldo = atletas.map((a) => ({ ...a, saldo: saldoDe(a.nome, c.nome_cbtm) })).filter((a) => a.saldo).sort((x, y) => y.saldo - x.saldo);
      const total = comSaldo.reduce((t, a) => t + a.saldo, 0);
      const pos = proj.posicoes("forca", (x) => x.atletas_ativos > 0).get(c.id);
      const dif = c.posicao_brasil - pos;
      alvo.innerHTML = `<h3>Desde a última atualização oficial</h3>
        <div class="grade g2"><div><div class="kpi" style="padding:0"><div class="v ${total > 0 ? "txt-pos" : total < 0 ? "txt-neg" : ""}">${total > 0 ? "+" : ""}${fmt(total)}</div><div class="r">pontos de rating somados (${comSaldo.length} atletas jogaram)</div></div></div>
        <div><div class="kpi" style="padding:0"><div class="v">${pos}º</div><div class="r">provável posição amanhã ${dif > 0 ? `<span class="sobe">▲ ${dif}</span>` : dif < 0 ? `<span class="desce">▼ ${-dif}</span>` : "(mantém)"}</div></div></div></div>
        ${comSaldo.length ? `<div class="mt">${comSaldo.slice(0, 6).map((a) => `<a class="linha-rank simples" href="#/pontos/${encodeURIComponent(`~${normalizarTexto(a.nome)}|${normalizarTexto(c.nome_cbtm)}`)}"><span class="nome-rank"><b>${esc(a.nome)}</b><small>Classe ${esc(a.classe)} · rating ${fmt(a.rating)}</small></span><span class="pts ${a.saldo > 0 ? "pos" : "neg"}">${a.saldo > 0 ? "+" : ""}${fmt(a.saldo)}</span></a>`).join("")}</div>` : '<p class="mut mt">Nenhum atleta do clube jogou desde a última atualização oficial.</p>'}
        <p class="mut" style="font-size:12px;margin-top:8px">Rating oficial da CBTM com jogos até ${String(s.oficial_ate || "").split("-").reverse().join("/")}. <a href="#/pontos">Ver pontos pós-jogo</a></p>`;
    }).catch(() => { const alvo = main.querySelector("#semana"); if (alvo) alvo.innerHTML = '<h3>Desde a última atualização oficial</h3><p class="mut">Pontos ao vivo indisponíveis no momento.</p>'; });
  }

  const lista = (sx) => {
    const l = atletas.filter((a) => !sx || a.sexo === sx);
    main.querySelector("#lista-atletas").innerHTML = l.length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>#</th><th>Atleta</th><th>Sexo</th><th>Classe</th><th class="dir">Rating</th><th class="dir">Índice</th><th class="dir" data-dica="Posição no rating nacional, entre todos os atletas do mesmo sexo.">Rating Brasil</th><th class="dir" data-dica="Categoria mais alta do Absoluto em que o atleta aparece no ranking olímpico (A é a mais forte) e a posição nela.">Absoluto</th></tr></thead>
      <tbody>${l.map((a, i) => `<tr class="clic" data-atleta="${esc(`~${normalizarTexto(a.nome)}|${normalizarTexto(c.nome_cbtm)}`)}"><td class="pos">${i + 1}</td><td class="clube-nome">${esc(a.nome)} ${a.paralimpico ? '<span class="tag">paralímpico</span>' : ""}</td><td>${a.sexo === "M" ? "Masc." : "Fem."}</td><td><span class="tag">${esc(a.classe)}</span></td><td class="dir num">${fmt(a.rating)}</td><td class="dir"><div class="forca-cel" style="min-width:120px"><b>${fmt(a.indice, 1)}</b><span class="barra"><i style="width:${a.indice}%"></i></span></div></td><td class="dir num">${a.posicao_rating ? `${fmt(a.posicao_rating)}º` : "–"}</td><td class="dir num">${a.absoluto ? `Abs. ${esc(a.absoluto.categoria)} · ${a.absoluto.posicao}º` : "–"}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="card vazio">Nenhum atleta.</div>';
    main.querySelectorAll("tr[data-atleta]").forEach((tr) => tr.addEventListener("click", () => irPara(`pontos/${encodeURIComponent(tr.dataset.atleta)}`)));
  };
  main.querySelectorAll("[data-sx]").forEach((b) => b.addEventListener("click", () => {
    main.querySelectorAll("[data-sx]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    lista(b.dataset.sx);
  }));
  lista("");
}

// ---------------- seletor de clube (busca) ----------------
function seletorClube(el, aoEscolher, { excluir = [] } = {}) {
  el.innerHTML = `<input type="search" class="campo" placeholder="Buscar clube pelo nome" aria-label="Buscar clube" autocomplete="off"><div class="sugestoes" hidden></div>`;
  const inp = el.querySelector("input"), sug = el.querySelector(".sugestoes");
  inp.addEventListener("input", () => {
    const t = inp.value.trim().toLowerCase();
    if (t.length < 2) { sug.hidden = true; return; }
    const r = R.clubes.filter((c) => !excluir.includes(c.id) && c.nome_cbtm.toLowerCase().includes(t)).slice(0, 12);
    sug.innerHTML = r.length ? r.map((c) => `<button type="button" data-id="${c.id}">${esc(c.nome)} <span class="mut">· ${esc(ufRotulo(c.uf))} · Força ${fmt(c.forca, 1)}</span></button>`).join("") : '<div class="vazio">Nenhum clube</div>';
    sug.hidden = false;
    sug.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => aoEscolher(b.dataset.id)));
  });
  inp.addEventListener("blur", () => setTimeout(() => (sug.hidden = true), 150));
}

// ---------------- comparar ----------------
function viewComparar(q) {
  marcarMenu("comparar");
  // c=slot.id,slot.id  — o slot fixa a cor de cada clube (a cor segue o clube)
  const sel = (q.get("c") || "").split(",").filter(Boolean).map((s) => { const [slot, ...r] = s.split("."); return { slot: +slot, id: r.join(".") }; })
    .filter((s) => porId.has(s.id) && s.slot >= 0 && s.slot < 4).slice(0, 4);
  const salvar = (lista) => { lista.length ? q.set("c", lista.map((s) => `${s.slot}.${s.id}`).join(",")) : q.delete("c"); irPara("comparar", q); };
  const clubes = sel.map((s) => ({ ...porId.get(s.id), cor: CORES[s.slot], slot: s.slot }));
  const series = clubes.map((c) => ({ nome: c.nome, cor: c.cor }));

  main.innerHTML = `
    ${subnavClubes("comparar")}
    <div class="cab"><div><h1>Comparar clubes</h1><p>Escolha até 4 clubes para ver lado a lado.</p></div></div>
    ${aviso()}
    <div class="card"><div class="escolha">
      ${clubes.map((c) => `<span class="chip"><i style="background:${c.cor}"></i>${esc(c.nome)}<button type="button" data-rm="${c.id}" aria-label="Remover ${esc(c.nome)}">×</button></span>`).join("")}
      ${clubes.length < 4 ? '<div class="busca-clube" id="add"></div>' : ""}
    </div></div>
    <div id="cmp"></div>`;
  main.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => salvar(sel.filter((s) => s.id !== b.dataset.rm))));
  const add = main.querySelector("#add");
  if (add) seletorClube(add, (id) => {
    const livre = [0, 1, 2, 3].find((s) => !sel.some((x) => x.slot === s));
    salvar([...sel, { slot: livre, id }]);
  }, { excluir: sel.map((s) => s.id) });

  const cmp = main.querySelector("#cmp");
  if (clubes.length < 2) { cmp.innerHTML = `<div class="card vazio mt">Adicione pelo menos 2 clubes para comparar.</div>`; return; }
  const linha = (rot, f) => `<tr><td class="mut">${rot}</td>${clubes.map((c) => `<td class="dir num">${f(c)}</td>`).join("")}</tr>`;
  const melhorClasse = (c) => {
    const m = Object.entries(c.classes_masculino).find(([, v]) => v)?.[0];
    const f = Object.entries(c.classes_feminino).find(([, v]) => v)?.[0];
    return `${m ? `M: ${m}` : "–"} · ${f ? `F: ${f}` : "–"}`;
  };
  cmp.innerHTML = `
    <div class="grade g2 mt">
      <div class="card"><h3>Força do Clube</h3>${barrasAgrupadas([
        { rotulo: "Geral", valores: clubes.map((c) => c.forca / 10) },
        { rotulo: "Masculino", valores: clubes.map((c) => c.forca_masculino / 10) },
        { rotulo: "Feminino", valores: clubes.map((c) => c.forca_feminino / 10) },
      ], series, { sufixo: "" })}${legenda(series)}<p class="mut" style="font-size:13px">Escala de 0 a 100 (Força ÷ 10).</p></div>
      <div class="card"><h3>Componentes (0 a 100)</h3>${barrasAgrupadas([
        { rotulo: "Elite", valores: clubes.map((c) => c.elite) },
        { rotulo: "Profundidade", valores: clubes.map((c) => c.profundidade) },
        { rotulo: "Volume", valores: clubes.map((c) => c.volume) },
      ], series)}${legenda(series)}</div>
    </div>
    <div class="tabela-wrap mt"><table>
      <thead><tr><th></th>${clubes.map((c) => `<th class="dir"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.cor};margin-right:6px"></span>${esc(c.nome)}</th>`).join("")}</tr></thead>
      <tbody>
        ${linha("Força do Clube", (c) => `<b>${fmt(c.forca, 1)}</b>`)}
        ${linha("Posição no Brasil", (c) => `${c.posicao_brasil}º`)}
        ${linha("Estado", (c) => esc(ufRotulo(c.uf)))}
        ${linha("Atletas ativos", (c) => fmt(c.atletas_ativos))}
        ${linha("Masculino · feminino", (c) => `${fmt(c.atletas_masculino)} · ${fmt(c.atletas_feminino)}`)}
        ${linha("Atletas no top 100 do rating", (c) => fmt(c.top100_rating))}
        ${linha("Rating médio masc.", (c) => fmt(c.rating_medio_masculino))}
        ${linha("Rating médio fem.", (c) => fmt(c.rating_medio_feminino))}
        ${linha("Melhor classe", melhorClasse)}
        ${linha("Paralímpicos", (c) => fmt(c.atletas_paralimpicos))}
      </tbody></table></div>
    <div class="escolha mt">${clubes.length >= 2 ? `<a class="btn prim" href="#/simulador?a=${clubes[0].id}&b=${clubes[1].id}">Simular ${esc(clubes[0].nome)} × ${esc(clubes[1].nome)}</a>` : ""}</div>`;
}

// ---------------- simulador ----------------
async function viewSimulador(q) {
  marcarMenu("simulador");
  const [modelo, atletasDb] = await Promise.all([carregarModelo(), carregarAtletas()]);
  const formato = FORMATOS[q.get("f")] ? q.get("f") : "mini";
  const sexo = q.get("sexo") === "F" ? "F" : "M";
  const ids = [q.get("a"), q.get("b")];
  const F = FORMATOS[formato];

  main.innerHTML = `
    ${subnavClubes("simulador")}
    <div class="cab"><div><h1>Simulador de confronto</h1><p>A chance de cada clube vencer um confronto por equipes, calculada com a <b>regressão logística</b> dos jogos oficiais. <a href="#/metodologia">Entenda o modelo</a></p></div></div>
    ${aviso()}
    <div class="filtros">
      <div class="seg" role="group" aria-label="Formato">${Object.entries(FORMATOS).map(([k, f]) => `<button type="button" data-f="${k}" aria-pressed="${k === formato}">${esc(f.nome)}</button>`).join("")}</div>
      <div class="seg" role="group" aria-label="Sexo">${[["M", "Masculino"], ["F", "Feminino"]].map(([v, n]) => `<button type="button" data-sexo="${v}" aria-pressed="${v === sexo}">${n}</button>`).join("")}</div>
    </div>
    <p class="mut" style="font-size:13px">${esc(F.descricao)}</p>
    <div class="vs">
      <div class="card lado" id="lado-a"></div>
      <div class="vs-x">×</div>
      <div class="card lado" id="lado-b"></div>
    </div>
    <div id="res" class="mt"></div>`;
  main.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { q.set("f", b.dataset.f); q.delete("ea"); q.delete("eb"); irPara("simulador", q); }));
  main.querySelectorAll("[data-sexo]").forEach((b) => b.addEventListener("click", () => { q.set("sexo", b.dataset.sexo); q.delete("ea"); q.delete("eb"); irPara("simulador", q); }));

  const equipes = [];
  ["a", "b"].forEach((lado, i) => {
    const el = main.querySelector(`#lado-${lado}`);
    const c = porId.get(ids[i]);
    const cor = CORES[i];
    if (!c) {
      el.innerHTML = `<h3>${i ? "Clube B" : "Clube A"}</h3><div class="busca-clube"></div>`;
      seletorClube(el.querySelector(".busca-clube"), (id) => { q.set(lado, id); q.delete(`e${lado}`); irPara("simulador", q); });
      return;
    }
    const elenco = (atletasDb.clubes[c.id] || []).filter((a) => a.sexo === sexo).sort((x, y) => y.rating - x.rating);
    const escolhidos = (q.get(`e${lado}`) || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < elenco.length);
    const idx = [];
    for (let k = 0; k < F.atletas; k++) {
      const pref = escolhidos[k];
      idx.push(pref != null && !idx.includes(pref) ? pref : [...elenco.keys()].find((n) => !idx.includes(n) && !escolhidos.slice(k + 1).includes(n)));
    }
    const letras = i ? ["X", "Y", "Z"] : ["A", "B", "C"];
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div><span class="chip" style="padding-right:10px"><i style="background:${cor}"></i>${esc(c.nome)}</span><div class="mut" style="font-size:13px;margin-top:4px">${esc(ufRotulo(c.uf))} · Força ${fmt(c.forca, 1)}</div></div>
        <button class="btn" type="button" data-trocar="${lado}">Trocar</button>
      </div>
      ${elenco.length < F.atletas ? `<p class="mt" style="color:var(--alerta)">O clube tem ${elenco.length} atleta(s) ${sexo === "M" ? "masculino(s)" : "feminina(s)"} ativo(s); são necessários ${F.atletas}.</p>` :
        idx.map((n, k) => `<label for="s-${lado}-${k}">Atleta ${letras[k]}</label><select class="campo" id="s-${lado}-${k}" data-lado="${lado}" data-k="${k}">${elenco.map((a, j) => `<option value="${j}" ${j === n ? "selected" : ""}>${esc(a.nome)} · ${fmt(a.rating)} (${esc(a.classe)})</option>`).join("")}</select>`).join("")}`;
    el.querySelector("[data-trocar]").addEventListener("click", () => { q.delete(lado); q.delete(`e${lado}`); irPara("simulador", q); });
    el.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => {
      const atual = [...el.querySelectorAll("select")].map((x) => x.value);
      q.set(`e${lado}`, atual.join(",")); irPara("simulador", q);
    }));
    if (elenco.length >= F.atletas) equipes[i] = { clube: c, atletas: idx.map((n) => elenco[n]) };
  });

  const res = main.querySelector("#res");
  if (!equipes[0] || !equipes[1]) {
    res.innerHTML = `<div class="card vazio">Escolha os dois clubes para simular. Os ${F.atletas} atletas de maior rating entram por padrão, e você pode trocar.</div>`;
    return;
  }
  const repetidos = equipes.some((e) => new Set(e.atletas.map((a) => a.nome + a.rating)).size < e.atletas.length);
  const s = simular(formato, equipes[0].atletas, equipes[1].atletas, modelo);
  const pa = s.prob, pb = 1 - pa;
  const favorito = pa >= pb ? equipes[0].clube.nome : equipes[1].clube.nome;
  res.innerHTML = `
    ${repetidos ? '<div class="aviso">O mesmo atleta foi escolhido duas vezes numa equipe. Ajuste a escalação.</div>' : ""}
    <div class="card resultado">
      <h3>Chance de vencer o confronto</h3>
      <div class="placar">
        <div><div class="v" style="color:var(--tx)">${pct(pa)}</div><div class="n">${esc(equipes[0].clube.nome)}</div></div>
        <div class="mut">×</div>
        <div><div class="v">${pct(pb)}</div><div class="n">${esc(equipes[1].clube.nome)}</div></div>
      </div>
      <div class="duelo" data-dica="${esc(`${equipes[0].clube.nome}: <b>${pct(pa)}</b> · ${equipes[1].clube.nome}: <b>${pct(pb)}</b>`)}"><i style="width:${pa * 100}%"></i><i style="width:${pb * 100}%"></i></div>
      <p class="mut" style="font-size:14px">${Math.abs(pa - pb) < 0.1 ? "Confronto equilibrado." : `Favorito: <b>${esc(favorito)}</b>.`}</p>
    </div>
    <div class="card mt"><h3>Jogo a jogo</h3>
      ${s.jogos.map((j) => `<div class="jogo-l"><b>${esc(j.jogo)}</b><span>${esc(j.a)} <span class="mut num">(${fmt(j.ra)})</span></span>
        <div class="duelo" data-dica="${esc(`${j.a}: <b>${pct(j.p)}</b> · ${j.b}: <b>${pct(1 - j.p)}</b>`)}"><i style="width:${j.p * 100}%"></i><i style="width:${(1 - j.p) * 100}%"></i></div>
        <span style="text-align:right">${esc(j.b)} <span class="mut num">(${fmt(j.rb)})</span></span></div>`).join("")}
      ${legenda([{ nome: equipes[0].clube.nome, cor: CORES[0] }, { nome: equipes[1].clube.nome, cor: CORES[1] }])}
      <p class="mut mt" style="font-size:13px">Cada jogo usa a chance de vitória pela diferença de rating. Na dupla, usa a média de rating dos dois atletas. Modelo ajustado com ${fmt(modelo.jogos)} jogos oficiais.</p>
    </div>`;
}

// ---------------- metodologia ----------------
async function viewMetodologia() {
  marcarMenu("metodologia");
  const m = await carregarModelo().catch(() => null);
  const met = R.metodologia;
  main.innerHTML = `
    <div class="cab"><div><h1>Metodologia</h1><p>Como calculamos a Força do Clube e as chances do simulador.</p></div></div>
    ${aviso()}
    <div class="card metod">
      <h2>De onde vêm os dados</h2>
      <ul>
        <li>Rating, ranking olímpico e paralímpico públicos da CBTM (CBTM Live), atualizados semanalmente.</li>
        <li>Lista oficial de clubes federados da CBTM e rating por estado, usados para identificar o estado de cada clube.</li>
      </ul>
      <h2>Quem conta</h2>
      <ul>
        <li><b>Atleta ativo:</b> ${esc(met.ativo)}</li>
        <li><b>Atletas vinculados a federações:</b> atletas inscritos diretamente pela federação estadual aparecem em lista separada e não entram no Ranking de Clubes.</li>
        <li><b>Estado do clube:</b> primeiro pela lista oficial de clubes federados; depois pelo estado da maioria dos atletas do clube no rating por estado da CBTM; por último pela sigla no nome. Se nada disso funcionar, o clube vai para <b>Clubes sem estado</b> até ser corrigido manualmente.</li>
      </ul>
      <h2>Força do Clube (0 a 1.000)</h2>
      <ul>
        <li><b>Índice do atleta (0 a 100):</b> ${esc(met.indice)} Referência atual: ${fmt(met.referencias?.masculino)} pontos no masculino e ${fmt(met.referencias?.feminino)} no feminino. Como a referência é por sexo, masculino e feminino ficam na mesma escala, mesmo com faixas de rating diferentes.</li>
        <li><b>Elite (${met.pesos.elite * 100}%):</b> média do índice dos ${met.n_elite} melhores atletas do clube. Vaga vazia vale 0.</li>
        <li><b>Profundidade (${met.pesos.profundidade * 100}%):</b> média do índice do ${met.n_elite + 1}º ao ${met.n_elite + met.n_profundidade}º atleta. Vaga vazia vale 0.</li>
        <li><b>Volume (${met.pesos.volume * 100}%):</b> número de atletas ativos em escala logarítmica, com teto em ${met.teto_volume} atletas.</li>
        <li>Força = 10 × (0,5 × Elite + 0,3 × Profundidade + 0,2 × Volume). Há também a força só com o masculino e só com o feminino.</li>
      </ul>
      <h2>Simulador (regressão logística)</h2>
      <ul>
        <li>Nos perfis de rating da CBTM, os pontos de cada jogo divididos pelo peso do evento revelam, pela tabela oficial (Manual da CBTM, item 1.7.2.5.5), a faixa de diferença de rating e se o favorito venceu.</li>
        <li>Com esses jogos ajustamos P(favorito vence) = 1 / (1 + e<sup>−(b0 + b1·Δ/100)</sup>), em que Δ é a diferença de rating.${m ? ` Coeficientes atuais: b0 = ${fmt(m.b0, 3)}, b1 = ${fmt(m.b1, 3)}, com ${fmt(m.jogos)} jogos.` : ""}</li>
        <li>O confronto soma as chances de todas as combinações de resultado dos jogos. Formato padrão: Mini Davis da CBTM (Manual, item 1.9.2.10).</li>
        <li>Limitações: o modelo considera só a diferença de rating, sem forma recente, estilo de jogo ou confronto direto; a força da dupla é aproximada pela média do rating.</li>
      </ul>
      <h2>Pontos pós-jogo</h2>
      <ul>
        <li>Um robô lê os resultados da CBTM a cada minuto e calcula os pontos de rating de cada jogo com a regra oficial: rating dos dois atletas imediatamente antes do jogo, tabela de vitória esperada ou inesperada e peso do evento. A regra foi conferida com 60 confrontos oficiais (100% de acerto).</li>
        <li>A <b>chance de vencer</b> mostrada em cada jogo é a do modelo de regressão logística, só com a diferença de rating antes do jogo. Nos jogos já publicados pela CBTM, o rating do adversário é aproximado pela faixa da tabela.</li>
      </ul>
      <h2>Previsão até o fim do ano e metas</h2>
      <ul>
        <li>A chance de vitória soma um ajuste de <b>forma recente</b>: vitórias acima ou abaixo do esperado nos últimos 12 meses, com mais peso nos jogos recentes. No teste com jogos de maio a setembro de 2026, a forma melhorou um pouco a previsão (erro 0,7% menor).</li>
        <li>Para cada evento do plano do atleta, simulamos 3.000 vezes o número de jogos e os adversários, sorteados do histórico do próprio atleta, e aplicamos a tabela oficial.</li>
        <li>"Quais torneios priorizar" mostra quanto cada evento acrescenta à chance de alcançar a meta.</li>
      </ul>
      ${m ? `<h2>Calibração do modelo</h2><p class="mut">Taxa de vitória do favorito observada nos jogos e prevista pelo modelo, por faixa de diferença de rating.</p>
      <div class="tabela-wrap"><table><thead><tr><th class="dir">Δ rating (aprox.)</th><th class="dir">Jogos</th><th class="dir">Observado</th><th class="dir">Previsto</th></tr></thead><tbody>
      ${m.calibracao.map((c) => `<tr><td class="dir num">${fmt(c.delta)}</td><td class="dir num">${fmt(c.jogos)}</td><td class="dir num">${pct(c.observado)}</td><td class="dir num">${pct(c.previsto)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
    </div>`;
}

// ---------------- ao vivo ----------------
let recarga = null; // atualização automática das telas ao vivo
function recarregarEm(seg, fn) {
  clearInterval(recarga);
  recarga = setInterval(() => { if (!document.hidden) fn(); }, seg * 1000);
}
const dataBR = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const pontos = (n) => `<span class="pts ${n > 0 ? "pos" : n < 0 ? "neg" : ""}">${n > 0 ? "+" : ""}${fmt(n)}</span>`;
const quando = (ms) => {
  if (!ms) return "–";
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 90 ? "há instantes" : s < 3600 ? `há ${Math.round(s / 60)} min` : new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
const avisoAoVivo = (oficialAte) => `<div class="aviso">${ICONE_INFO}<div><b>Pontos calculados pela CASQUINHA logo que o resultado é lançado na CBTM</b>, com a regra oficial do rating (rating de cada atleta antes do jogo, tabela de vitória esperada ou inesperada e peso do evento). O rating oficial publicado pela CBTM inclui os jogos até <b>${dataBR(oficialAte)}</b>; os jogos depois disso aparecem aqui. Em caso de diferença, vale o oficial.</div></div>`;

async function viewAoVivo() {
  marcarMenu("ao-vivo");
  main.innerHTML = `<div class="carregando">Carregando eventos ao vivo…</div>`;
  const desenhar = async () => {
    const r = await carregarResumoAoVivo();
    const vivos = r.eventos.filter((e) => e.ao_vivo);
    const outros = r.eventos.filter((e) => !e.ao_vivo);
    const linhaEv = (e) => `<tr class="clic" data-slug="${esc(e.slug)}">
      <td>${e.ao_vivo ? '<span class="ao-vivo-pulso" aria-hidden="true"></span>' : ""}<span class="clube-nome">${esc(e.nome)}</span><div class="clube-sub">${esc(e.cidade)}</div></td>
      <td>${dataBR(e.inicio)}${e.fim !== e.inicio ? ` a ${dataBR(e.fim)}` : ""}</td>
      <td>${esc(e.tipo)} <span class="tag" data-dica="${e.peso_estimado ? "Peso estimado: o tipo do evento não foi identificado pelo nome." : "Peso do evento no rating (Manual CBTM 2026)"}">peso ${e.peso}${e.peso_estimado ? "?" : ""}</span></td>
      <td class="dir num">${fmt(e.jogos)}</td></tr>`;
    const tabela = (lista) => `<div class="tabela-wrap"><table><thead><tr><th>Evento</th><th>Data</th><th>Tipo</th><th class="dir">Jogos calculados</th></tr></thead><tbody>${lista.map(linhaEv).join("")}</tbody></table></div>`;
    const busca = main.querySelector("#busca-atleta")?.value || "";
    main.innerHTML = `
      <div class="cab"><div><h1>Ao vivo</h1><p>Pontos de rating de cada jogo assim que o resultado cai no sistema da CBTM. Atualiza sozinho a cada minuto.</p></div>
        <p class="mut" style="font-size:13px">Última leitura da CBTM: ${quando(r.rodada_em)}</p></div>
      ${avisoAoVivo(r.oficial_ate)}
      <div class="card"><h3>Buscar atleta</h3>
        <div class="filtros" style="margin:0"><input type="search" id="busca-atleta" placeholder="Nome do atleta (ex.: Davi Fujii)" value="${esc(busca)}" aria-label="Nome do atleta"></div>
        <div id="res-atletas"></div></div>
      <div class="grade g3 mt">
        <div class="card kpi"><div class="v">${fmt(vivos.length)}</div><div class="r">eventos acontecendo agora</div></div>
        <div class="card kpi"><div class="v">${fmt(r.jogos)}</div><div class="r">jogos calculados e ainda não publicados no oficial</div></div>
        <div class="card kpi"><div class="v">${fmt(r.atletas_com_jogos)}</div><div class="r">atletas com pontos a publicar</div></div>
      </div>
      ${vivos.length ? `<h2 class="mt" style="margin-top:22px"><span class="ao-vivo-pulso" aria-hidden="true"></span>Acontecendo agora</h2>${tabela(vivos)}` : ""}
      <h2 class="mt" style="margin-top:22px">Eventos com pontos a publicar</h2>
      ${outros.length ? tabela(outros) : '<div class="card vazio">Nenhum outro evento pendente.</div>'}`;
    main.querySelectorAll("tr[data-slug]").forEach((tr) => tr.addEventListener("click", () => irPara(`ao-vivo/${encodeURIComponent(tr.dataset.slug)}`)));
    const inp = main.querySelector("#busca-atleta");
    let t;
    const buscar = async () => {
      const termo = inp.value.trim();
      const alvo = main.querySelector("#res-atletas");
      if (termo.length < 3) { alvo.innerHTML = ""; return; }
      const { itens } = await buscarAtletasAoVivo(termo);
      alvo.innerHTML = itens.length ? `<div class="tabela-wrap mt"><table><thead><tr><th>Atleta</th><th class="dir">Oficial</th><th class="dir">Ao vivo</th><th class="dir">Saldo</th><th class="dir">Jogos</th></tr></thead><tbody>
        ${itens.map((a) => `<tr class="clic" data-chave="${esc(a.chave)}"><td><span class="clube-nome">${esc(a.nome)}</span><div class="clube-sub">${esc(a.clube)}</div></td><td class="dir num">${fmt(a.oficial)}</td><td class="dir num"><b>${fmt(a.atual)}</b></td><td class="dir">${pontos(a.saldo)}</td><td class="dir num">${fmt(a.jogos)}</td></tr>`).join("")}
        </tbody></table></div>` : '<p class="mut mt">Nenhum atleta com jogos ainda não publicados no rating oficial.</p>';
      alvo.querySelectorAll("tr[data-chave]").forEach((tr) => tr.addEventListener("click", () => irPara(`atleta/${encodeURIComponent(tr.dataset.chave)}`)));
    };
    inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(buscar, 250); });
    if (busca) buscar();
  };
  await desenhar();
  recarregarEm(60, () => { if (!main.querySelector("#busca-atleta:focus")) desenhar(); });
}

async function viewEventoAoVivo(slug, q) {
  marcarMenu("ao-vivo");
  main.innerHTML = `<div class="carregando">Carregando jogos…</div>`;
  const desenhar = async () => {
    const { evento: e, jogos } = await carregarEventoAoVivo(slug);
    const cats = [...new Set(jogos.map((j) => j.categoria))].sort();
    const cat = q.get("cat") || "";
    const busca = normalizarBusca(q.get("q") || "");
    const lista = jogos.filter((j) => (!cat || j.categoria === cat) && (!busca || `${j.a.nome} ${j.b.nome}`.includes(busca))).reverse();
    const lado = (l, cls) => `<div class="${cls}"><a href="#/atleta/${encodeURIComponent(l.chave)}" class="${l.venceu ? "venceu" : ""}">${esc(l.nome)}</a>
      <div class="linha-meta">${esc(l.clube)} · ${fmt(l.antes)} ${pontos(l.pontos)}</div></div>`;
    main.innerHTML = `
      <a class="voltar" href="#/pontos">← Pontos pós-jogo</a>
      <div class="cab"><div><h1>${e.ao_vivo ? '<span class="ao-vivo-pulso" aria-hidden="true"></span>' : ""}${esc(e.nome)}</h1>
        <p>${esc(e.cidade)} · ${dataBR(e.inicio)}${e.fim !== e.inicio ? ` a ${dataBR(e.fim)}` : ""} · ${esc(e.tipo)}, peso ${e.peso}${e.peso_estimado ? " (estimado)" : ""} · ${fmt(jogos.length)} jogos calculados</p></div></div>
      <div class="filtros">
        <input type="search" id="f-q" placeholder="Buscar atleta neste evento" value="${esc(q.get("q") || "")}" aria-label="Buscar atleta">
        <select id="f-cat" aria-label="Categoria"><option value="">Todas as categorias</option>${cats.map((c) => `<option ${c === cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      </div>
      <div class="card">${lista.length ? lista.map((j) => `<div class="jogo-vivo">
        ${lado(j.a, "lado-a")}
        <div class="meio"><b>${j.a.placar} × ${j.b.placar}</b><small>${esc(j.categoria)}</small><small>${esc(j.fase)}${j.grupo ? ` ${esc(j.grupo)}` : ""} · ${esc(j.hora)}</small></div>
        ${lado(j.b, "lado-b")}</div>`).join("") : '<div class="vazio">Nenhum jogo finalizado com esses filtros.</div>'}</div>`;
    let t;
    main.querySelector("#f-q").addEventListener("input", (ev) => { clearTimeout(t); t = setTimeout(() => { ev.target.value ? q.set("q", ev.target.value) : q.delete("q"); atualizarQuery(`ao-vivo/${encodeURIComponent(slug)}`, q); desenhar(); }, 250); });
    main.querySelector("#f-cat").addEventListener("change", (ev) => { ev.target.value ? q.set("cat", ev.target.value) : q.delete("cat"); atualizarQuery(`ao-vivo/${encodeURIComponent(slug)}`, q); desenhar(); });
  };
  await desenhar();
  recarregarEm(60, () => { if (!main.querySelector("#f-q:focus")) desenhar(); });
}
const normalizarBusca = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

async function viewAtleta(chave) {
  marcarMenu("ao-vivo");
  main.innerHTML = `<div class="carregando">Carregando atleta…</div>`;
  const desenhar = async () => {
    let a;
    try { a = await carregarAtletaAoVivo(chave); } catch (e) {
      main.innerHTML = `<a class="voltar" href="#/pontos">← Pontos pós-jogo</a><div class="card vazio">Este atleta não tem jogos ainda não publicados no rating oficial.</div>`; return;
    }
    const r = await carregarResumoAoVivo().catch(() => ({}));
    const jogos = [...a.jogos].reverse();
    main.innerHTML = `
      <a class="voltar" href="#/pontos">← Pontos pós-jogo</a>
      <div class="card det-topo">
        <div><h1>${esc(a.nome)}</h1><p class="mut">${esc(a.clube)}</p>
          <p>${fmt(a.jogos.length)} jogos · ${fmt(a.vitorias)} vitórias · ${fmt(a.jogos.length - a.vitorias)} derrotas, em ${fmt(a.eventos.length)} evento(s) ainda não publicado(s) no oficial</p></div>
        <div class="selo"><div class="r">Rating ao vivo</div><div class="v">${fmt(a.atual)}</div><div class="r">oficial ${fmt(a.oficial)} · saldo ${a.saldo > 0 ? "+" : ""}${fmt(a.saldo)}</div></div>
      </div>
      ${avisoAoVivo(r.oficial_ate)}
      <div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Evento / categoria</th><th>Adversário</th><th class="dir">Placar</th><th class="dir">Rating antes</th><th class="dir">Pontos</th></tr></thead><tbody>
      ${jogos.map((j) => `<tr><td class="num">${dataBR(j.dia)} ${esc(j.hora)}</td><td><span class="clube-nome">${esc(j.categoria)}</span> · ${esc(j.fase)}<div class="clube-sub">${esc(j.evento)} · peso ${j.peso}</div></td>
        <td>${esc(j.adversario)} <span class="mut num">(${fmt(j.rating_adversario)})</span><div class="clube-sub">${esc(j.clube_adversario)}</div></td>
        <td class="dir num ${j.venceu ? "venceu" : ""}">${j.venceu ? "V" : "D"} ${esc(j.placar)}</td><td class="dir num">${fmt(j.antes)}</td><td class="dir">${pontos(j.pontos)}</td></tr>`).join("")}
      </tbody></table></div>`;
  };
  await desenhar();
  recarregarEm(60, desenhar);
}

// ---------------- roteador ----------------
async function render() {
  const { partes, q } = rota();
  clearInterval(recarga);
  try {
    const ctx = { main, marcarMenu, irPara, atualizarQuery, carregarModelo };
    if (partes[0] === "pontos" && partes[1]) await viewPontosAtleta(ctx, decodeURIComponent(partes.slice(1).join("/")));
    else if (partes[0] === "pontos") await viewPontos(ctx, q);
    else if (partes[0] === "atletas" && partes[1]) await viewAtletaRanking(ctx, decodeURIComponent(partes.slice(1).join("/")));
    else if (partes[0] === "atletas") await viewAtletas(ctx, q);
    else if (partes[0] === "ao-vivo" && partes[1]) await viewEventoAoVivo(decodeURIComponent(partes.slice(1).join("/")), q);
    else if (partes[0] === "ao-vivo") await viewAoVivo();
    else if (partes[0] === "atleta" && partes[1]) await viewAtleta(decodeURIComponent(partes.slice(1).join("/")));
    else if (partes[0] === "clubes" && partes[1]) await viewClube(partes[1]);
    else if (partes[0] === "clubes") viewClubes(q);
    else if (partes[0] === "comparar") viewComparar(q);
    else if (partes[0] === "simulador") await viewSimulador(q);
    else if (partes[0] === "metodologia") await viewMetodologia();
    else viewInicio();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card vazio">Não foi possível montar esta página: ${esc(e.message)}</div>`;
  }
}

async function iniciar() {
  document.getElementById("tema").addEventListener("click", () => {
    const escuro = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const novo = escuro ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem("tema", novo); } catch (e) { /* sem armazenamento */ }
  });
  ativarDicas();
  try {
    R = await carregarRanking();
  } catch (e) {
    main.innerHTML = `<div class="card vazio">Não foi possível carregar os dados. ${esc(e.message)}</div>`;
    return;
  }
  [...R.clubes, ...R.federacoes.itens].forEach((c) => porId.set(c.id, c));
  const d = new Date(R.meta.gerado_em);
  document.getElementById("atualizacao").textContent = `Dados atualizados em ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
  window.addEventListener("hashchange", () => { render(); main.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); });
  render();
}

iniciar();

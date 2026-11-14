// Seção Atletas: busca, rankings por categoria, perfil, previsão até o fim do ano e metas.
import { abrirCartao, botaoCompartilhar } from "./cartao.js";
import { esc, fmt, linhaTempo, pct } from "./graficos.js";
import {
  aproveitamentoEsperado, chancesPorClasse, classeDe, CLASSES, estimarForma, formaNecessaria, historico, minimoDaClasse,
  perfilDeJogo, posicaoEstimada, priorizarTorneios, simularRanking, simularRating, TIPOS,
} from "./previsao.js";

const API = "https://casquinha-ranking.matheusbruno045.workers.dev/api/";
const AO_VIVO = "https://casquinha-ao-vivo.matheusbruno045.workers.dev/api/";
const get = async (base, caminho) => {
  const r = await fetch(base + caminho);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `erro ${r.status}`);
  return d;
};
const normalizar = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const FIM_DO_ANO = () => `${hojeISO().slice(0, 4)}-12-31`;
const NOMES_TIPO = { rating: "Rating", olimpico: "Ranking Olímpico", paralimpico: "Ranking Paralímpico" };
const ufDe = (texto) => (String(texto || "").match(/[-–/ ]\s*([A-Z]{2})\s*$/) || [])[1] || null;
const lerLocal = (k, p) => { try { return JSON.parse(localStorage.getItem(k)) ?? p; } catch (e) { return p; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
const sinal = (n) => `${n > 0 ? "+" : ""}${fmt(n)}`;

// ---------------------------------------------------------------- lista e busca
export async function viewAtletas(ctx, q) {
  ctx.marcarMenu("atletas");
  const tipo = NOMES_TIPO[q.get("tipo")] ? q.get("tipo") : "rating";
  ctx.main.innerHTML = `
    <div class="cab"><div><h1>Atletas</h1><p>Busque um atleta para ver o rating, os rankings, a <b>previsão até o fim do ano</b> e montar <b>metas</b>. Ou navegue pelas classificações oficiais da CBTM.</p></div></div>
    <div class="card"><h3>Buscar atleta</h3>
      <div class="filtros" style="margin:0"><input type="search" id="busca" placeholder="Nome do atleta (ex.: Davi Fujii)" value="${esc(q.get("q") || "")}" aria-label="Nome do atleta" autocomplete="off"></div>
      <div id="res-busca"></div></div>
    <h2 style="margin-top:22px">Classificações</h2>
    <div class="filtros">
      <div class="seg" role="group" aria-label="Classificação">${Object.entries(NOMES_TIPO).map(([k, n]) => `<button type="button" data-tipo="${k}" aria-pressed="${k === tipo}">${n}</button>`).join("")}</div>
      <select id="f-cat" aria-label="Categoria"><option>Carregando…</option></select>
      <select id="f-ano" aria-label="Ano"></select>
      <select id="f-reg" aria-label="Região"></select>
    </div>
    <div id="lista"></div>`;

  // busca por nome
  const inp = ctx.main.querySelector("#busca");
  let t;
  const buscar = async () => {
    const termo = inp.value.trim();
    termo ? q.set("q", termo) : q.delete("q");
    ctx.atualizarQuery("atletas", q);
    const alvo = ctx.main.querySelector("#res-busca");
    if (termo.length < 3) { alvo.innerHTML = ""; return; }
    alvo.innerHTML = '<p class="mut mt">Buscando…</p>';
    try {
      const { itens } = await get(API, `busca?q=${encodeURIComponent(termo)}`);
      alvo.innerHTML = itens.length ? `<div class="tabela-wrap mt"><table><thead><tr><th>Atleta</th><th>Classe</th><th class="dir">Rating</th><th class="dir">Posição na classe</th></tr></thead><tbody>
        ${itens.map((a) => `<tr class="clic" data-id="${esc(a.id)}"><td><span class="clube-nome">${esc(a.nome)}</span><div class="clube-sub">${esc(a.clube)}</div></td><td>${esc(a.categoria)}</td><td class="dir num"><b>${fmt(a.rating)}</b></td><td class="dir num">${fmt(a.posicao)}º</td></tr>`).join("")}
        </tbody></table></div>` : '<p class="mut mt">Nenhum atleta encontrado. Confira a grafia (a CBTM usa nome e último sobrenome, ex.: "DAVI FUJII").</p>';
      alvo.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => ctx.irPara(`atleta/${encodeURIComponent(tr.dataset.id)}`)));
    } catch (e) { alvo.innerHTML = `<p class="mut mt">${esc(e.message)}. O índice de atletas pode estar sendo montado; tente em alguns minutos.</p>`; }
  };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(buscar, 300); });
  if (inp.value) buscar();

  // classificações oficiais
  ctx.main.querySelectorAll("[data-tipo]").forEach((b) => b.addEventListener("click", () => { q.set("tipo", b.dataset.tipo); ["cat", "ano", "pagina"].forEach((k) => q.delete(k)); ctx.irPara("atletas", q); }));
  let op;
  try { op = await get(API, `opcoes/${tipo}`); } catch (e) { ctx.main.querySelector("#lista").innerHTML = `<div class="card vazio">${esc(e.message)}</div>`; return; }
  const cats = [...op.categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const cat = q.get("cat") || cats[0]?.id;
  const anos = op.years?.length ? [...op.years].sort((a, b) => b - a) : [String(new Date().getFullYear())];
  const ano = q.get("ano") || anos[0];
  const reg = q.get("regiao") || "Brasil";
  const sel = (id, itens, atual) => { ctx.main.querySelector(id).innerHTML = itens.map(([v, n]) => `<option value="${esc(v)}" ${String(v) === String(atual) ? "selected" : ""}>${esc(n)}</option>`).join(""); };
  sel("#f-cat", cats.map((c) => [c.id, c.name]), cat);
  sel("#f-ano", anos.map((a) => [a, a]), ano);
  sel("#f-reg", (op.regions || [{ id: "Brasil", name: "Brasil" }]).map((r) => [r.id ?? r.name, r.name]), reg);
  ctx.main.querySelector("#f-ano").hidden = tipo === "rating";
  const mudar = (k) => (e) => { q.set(k, e.target.value); q.delete("pagina"); ctx.atualizarQuery("atletas", q); desenharLista(); };
  ctx.main.querySelector("#f-cat").addEventListener("change", mudar("cat"));
  ctx.main.querySelector("#f-ano").addEventListener("change", mudar("ano"));
  ctx.main.querySelector("#f-reg").addEventListener("change", mudar("regiao"));

  async function desenharLista() {
    const alvo = ctx.main.querySelector("#lista");
    const pagina = +q.get("pagina") || 1;
    alvo.innerHTML = '<div class="carregando">Carregando classificação…</div>';
    try {
      const p = new URLSearchParams({ tipo, categoria: q.get("cat") || cat, ano: tipo === "rating" ? anos[0] : q.get("ano") || ano, regiao: q.get("regiao") || reg, pagina, tamanho: 50 });
      const r = await get(API, `classificacao?${p}`);
      alvo.innerHTML = r.items.length ? `<div class="tabela-wrap"><table><thead><tr><th>#</th><th>Atleta</th><th class="dir">${tipo === "rating" ? "Rating" : "Pontos"}</th></tr></thead><tbody>
        ${r.items.map((a) => `<tr class="clic" data-id="${esc(a.id)}"><td class="pos">${a.posicao}</td><td><span class="clube-nome">${esc(a.nome)}</span><div class="clube-sub">${esc(a.clube)}</div></td><td class="dir num"><b>${fmt(a.pontos)}</b></td></tr>`).join("")}
        </tbody></table></div>
        <div class="paginacao"><span>${fmt(r.total)} atletas · fonte: CBTM</span><span><button class="btn" data-pg="${pagina - 1}" ${pagina <= 1 ? "disabled" : ""}>← Anterior</button> <span class="num">${pagina}/${r.pages}</span> <button class="btn" data-pg="${pagina + 1}" ${pagina >= r.pages ? "disabled" : ""}>Próxima →</button></span></div>`
        : '<div class="card vazio">Nenhum atleta nesta classificação.</div>';
      alvo.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => ctx.irPara(`atleta/${encodeURIComponent(tr.dataset.id)}`)));
      alvo.querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { q.set("pagina", b.dataset.pg); ctx.atualizarQuery("atletas", q); desenharLista(); }));
    } catch (e) { alvo.innerHTML = `<div class="card vazio">${esc(e.message)}</div>`; }
  }
  desenharLista();
}

// ---------------------------------------------------------------- aba "Previsão e metas" do perfil
// dados: { id, d (perfil do worker de ranking), modelo, vivo (worker ao vivo), cal (calendário) }
export function renderPrevisao(ctx, alvo, { id, d, modelo, vivo, cal }) {
  const a = d.atleta;
  const sexo = a.sexo || d.pessoa?.Sexo || "M";
  const oficial = a.rating;
  const saldo = vivo?.saldo || 0;
  const inicial = oficial + saldo;
  const hoje = hojeISO();
  const hist = historico({ games: d.jogos });
  const { forma, jogos: nForma } = estimarForma(hist, modelo, hoje);
  const perfil = perfilDeJogo(hist, hoje);
  const aprov = aproveitamentoEsperado(perfil, modelo, forma);
  const ultimos12 = hist.filter((j) => (Date.parse(hoje) - Date.parse(j.data)) / 864e5 <= 365);
  const vit12 = ultimos12.filter((j) => j.venceu).length;
  const uf = ufDe(d.pessoa?.Federacao) || ufDe(a.clube);

  // calendário: só eventos que ainda não começaram
  const futuros = (cal.eventos || []).filter((e) => e.data > hoje);
  const chave = `casquinha:plano:${id}`;
  const salvo = lerLocal(chave, null);
  const jogaParalimpico = (d.rankings || []).some((r) => r.tipo === "paralimpico");
  // evento só paralímpico (ex.: "... - INDIVIDUAL PARALÍMPICO") só entra no plano de quem joga o paralímpico;
  // "Olímpico e Paralímpico" no nome do campeonato não conta
  const soParalimpico = (nome) => {
    const n = nome.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const para = /PARA ?OLIMPIC\w*|PARALIMPIC\w*/g;
    const ehSo = (s) => { para.lastIndex = 0; const tem = para.test(s); return tem && !/OLIMP/.test(s.replace(para, "")); };
    const fim = n.split(" - ").pop();
    return /PARA ?OLIMPIC|PARALIMPIC/.test(fim) ? ehSo(fim) : ehSo(n);
  };
  const servePara = (e) => !soParalimpico(e.nome) || jogaParalimpico;
  let plano = salvo?.plano || futuros.filter((e) => (e.uf === uf || ["ouro", "prata", "brasileirao", "seletiva"].includes(e.tipo)) && servePara(e)).map((e) => e.id);
  let extras = salvo?.extras || [];
  const classeAtual = classeDe(inicial, sexo);
  const tabelaClasses = CLASSES[sexo] || CLASSES.M;
  const proxima = tabelaClasses[Math.max(0, tabelaClasses.findIndex(([c]) => c === classeAtual) - 1)];
  let meta = salvo?.meta ?? (proxima[0] !== classeAtual ? proxima[1] : inicial + 200);

  const evolucao = (d.eventos || []).filter((e) => e.RatingFinal != null).map((e) => ({ x: String(e.DataFim || e.DataInicio).slice(0, 10), y: e.RatingFinal, rotulo: `${dataBR(e.DataFim || e.DataInicio)} · ${e.EventoNome}<br><b>${fmt(e.RatingFinal)}</b> (${sinal(e.Pontos)})` }))
    .sort((x, y) => x.x.localeCompare(y.x)).filter((p) => (Date.parse(hoje) - Date.parse(p.x)) / 864e5 <= 365);

  alvo.innerHTML = `
    <div class="cab"><div><h2 style="margin:0">Previsão até o fim do ano</h2><p class="mut">Forma recente: <b>${forma > 0.08 ? "acima do esperado" : forma < -0.08 ? "abaixo do esperado" : "no esperado"}</b>${nForma < 15 ? " (poucos jogos)" : ""} · chance média de vitória por jogo: <b>${pct(aprov)}</b></p></div>${botaoCompartilhar("btn-previsao")}</div>
    <div class="card mt"><h3>Rating nos últimos 12 meses e projeção até 31/12</h3><div id="graf-evolucao"></div>
      <div class="legenda"><span><i style="background:var(--s1)"></i>Rating oficial após cada evento</span><span><i style="background:var(--s1);opacity:.35"></i>Projeção (faixa de 80% dos cenários)</span></div></div>

    <div class="aviso mt">${aviso()}</div>
    <div class="grade g2">
      <div class="card"><h3>Eventos no seu plano</h3><p class="mut" style="font-size:13px">Marcamos os eventos do seu estado${uf ? ` (${uf})` : ""} e os nacionais com inscrição aberta. Marque ou desmarque os que você vai jogar.</p>
        <div id="plano"></div>
        <details class="mt"><summary class="btn">+ Adicionar evento que ainda não abriu inscrição</summary>
          <div class="filtros mt"><select id="x-tipo">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${t.nome} (peso ${t.peso})</option>`).join("")}</select>
          <input type="date" id="x-data" class="campo" min="${hoje}" max="${FIM_DO_ANO()}" value="${FIM_DO_ANO().slice(0, 8)}05"><button class="btn prim" id="x-add" type="button">Adicionar</button></div></details>
      </div>
      <div class="card" id="res-previsao"><div class="carregando">Simulando…</div></div>
    </div>

    <h2 style="margin-top:26px">Metas</h2>
    <div class="card"><div class="filtros" style="margin:0">
      <label class="mut" for="meta">Quero chegar a</label>
      <select id="meta-classe" aria-label="Classe">${tabelaClasses.filter(([, min]) => min > -Infinity).map(([c, min]) => `<option value="${min}" ${min === meta ? "selected" : ""}>Classe ${c} (${fmt(min)})</option>`).join("")}<option value="outro">Outro valor…</option></select>
      <input type="number" id="meta" class="campo" value="${meta}" step="10" style="width:110px" aria-label="Rating da meta"> <span class="mut">até 31/12</span>
    </div><div id="res-meta" class="mt"></div></div>

    <h2 style="margin-top:26px">Ranking Nacional até 31/12</h2>
    <div id="res-ranking"></div>
    <p class="mut mt" style="font-size:13px">Fonte: CBTM (rating, rankings, perfis e calendário). Modelo: regressão logística com ${fmt(modelo.jogos)} jogos oficiais e simulação de Monte Carlo. É uma estimativa, não um resultado garantido.</p>`;

  function aviso() {
    return `<div><b>Como lemos o futuro:</b> simulamos milhares de vezes cada jogo dos eventos do seu plano. A chance de vitória vem da diferença de rating (regressão logística) ajustada pela sua forma recente. Os adversários e o número de jogos são sorteados do seu próprio histórico. ${saldo ? `Partimos do rating ao vivo (${fmt(inicial)}), que já inclui jogos ainda não publicados pela CBTM.` : ""}</div>`;
  }

  const eventosDoPlano = () => [
    ...futuros.filter((e) => plano.includes(e.id)),
    ...extras.map((x, i) => ({ id: `extra-${i}`, nome: `${TIPOS[x.tipo].nome} (adicionado por você)`, data: x.data, tipo: x.tipo, extra: i })),
  ];
  const base = () => ({ ratingInicial: inicial, modelo, forma, perfil, eventos: eventosDoPlano() });
  const salvar = () => gravarLocal(chave, { plano, extras, meta });

  function desenharPlano() {
    const el = ctx.main.querySelector("#plano");
    const lista = [...futuros.map((e) => ({ ...e, marcado: plano.includes(e.id) })), ...extras.map((x, i) => ({ id: `extra-${i}`, nome: `${TIPOS[x.tipo].nome} (adicionado por você)`, data: x.data, tipo: x.tipo, peso: TIPOS[x.tipo].peso, marcado: true, extra: i }))]
      .sort((x, y) => (y.marcado - x.marcado) || x.data.localeCompare(y.data));
    el.innerHTML = lista.length ? `<div style="max-height:320px;overflow:auto">${lista.map((e) => `
      <label class="item-plano"><input type="checkbox" data-ev="${esc(e.id)}" ${e.marcado ? "checked" : ""}>
        <span><b>${dataBR(e.data)}</b> · ${esc(e.nome)}<br><span class="mut" style="font-size:12px">${esc(TIPOS[e.tipo]?.nome || "")} · peso ${e.peso}${e.tipoEstimado ? " (estimado)" : ""}${e.uf ? ` · ${esc(e.uf)}` : ""}</span></span></label>`).join("")}</div>`
      : '<p class="mut">Nenhum evento com inscrição aberta. Adicione os que você pretende jogar.</p>';
    el.querySelectorAll("[data-ev]").forEach((c) => c.addEventListener("change", () => {
      const ev = c.dataset.ev;
      if (ev.startsWith("extra-")) extras.splice(+ev.slice(6), 1);
      else plano = c.checked ? [...plano, ev] : plano.filter((x) => x !== ev);
      salvar(); desenharPlano(); recalcular();
    }));
  }

  let ultimaSim = null;
  ctx.main.querySelector("#btn-previsao").addEventListener("click", () => {
    const sim = ultimaSim;
    const ch = sim ? chancesPorClasse(sim, sexo) : [];
    const melhor = ch.filter((c) => c.prob > 0.01).slice(0, 4);
    abrirCartao({
      secao: "Previsão até o fim do ano", nome: d.pessoa?.Nome || a.nome,
      linhas: [a.clube, `${a.categoria} · ${a.posicao}º na classe`],
      destaque: sim?.eventos.length ? { rotulo: "Rating previsto em 31/12", valor: fmt(Math.round(sim.p50)), sub: `Hoje: ${fmt(inicial)} · faixa provável ${fmt(Math.round(sim.p10))} a ${fmt(Math.round(sim.p90))}` } : { rotulo: "Rating", valor: fmt(inicial) },
      metricas: [["jogos em 12 meses", fmt(ultimos12.length)], ["de vitórias", ultimos12.length ? pct(vit12 / ultimos12.length) : "–"], [`chance de chegar a ${fmt(meta)}`, sim ? pct(sim.probMeta ?? 0) : "–"]],
      barras: melhor.length ? { titulo: "Chance de terminar o ano em cada classe", itens: melhor.map((c) => [`Classe ${c.classe}`, c.prob, pct(c.prob)]) } : null,
      texto: `Previsão de rating até o fim do ano para ${a.nome}`, arquivo: `previsao-${normalizar(a.nome).toLowerCase().replace(/\s+/g, "-")}`,
    });
  });

  function recalcular() {
    const sim = simularRating({ ...base(), meta });
    ultimaSim = sim;
    const faixa = [{ x: hoje, lo: inicial, hi: inicial, mid: inicial, rotulo: `Hoje: <b>${fmt(inicial)}</b>` },
      ...sim.eventos.map((e) => ({ x: e.data, lo: e.faixa.p10, hi: e.faixa.p90, mid: e.faixa.p50, rotulo: `${dataBR(e.data)} · ${esc(e.nome)}<br>mediana <b>${fmt(Math.round(e.faixa.p50))}</b> (${fmt(Math.round(e.faixa.p10))} a ${fmt(Math.round(e.faixa.p90))})` }))];
    ctx.main.querySelector("#graf-evolucao").innerHTML = linhaTempo(evolucao, { faixa, referencias: [{ y: meta, rotulo: `meta ${fmt(meta)}` }] }) || '<p class="mut">Sem histórico de eventos.</p>';

    const chances = chancesPorClasse(sim, sexo).filter((c) => c.prob >= 0.005);
    ctx.main.querySelector("#res-previsao").innerHTML = sim.eventos.length ? `
      <h3>Rating em 31/12</h3>
      <div class="placar" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div><div class="v" style="font-size:26px">${fmt(Math.round(sim.p10))}</div><div class="n">cenário ruim (10%)</div></div>
        <div><div class="v" style="font-size:34px">${fmt(Math.round(sim.p50))}</div><div class="n">mais provável</div></div>
        <div><div class="v" style="font-size:26px">${fmt(Math.round(sim.p90))}</div><div class="n">cenário bom (90%)</div></div>
      </div>
      <h3 class="mt">Chance de terminar em cada classe</h3>
      ${chances.map((c) => `<div class="comp-l" style="grid-template-columns:110px minmax(0,1fr) 48px" data-dica="Classe ${c.classe}: <b>${pct(c.prob)}</b>"><span>Classe ${c.classe}${c.classe === classeAtual ? " ·&nbsp;atual" : ""}</span><span class="barra"><i style="width:${c.prob * 100}%"></i></span><b>${pct(c.prob)}</b></div>`).join("")}
      <h3 class="mt">Quanto cada evento deve render</h3>
      ${sim.eventos.map((e) => `<div class="comp-l" style="grid-template-columns:minmax(0,1fr) 70px"><span style="font-size:13px">${dataBR(e.data)} · ${esc(e.nome)}<br><span class="mut">~${fmt(e.jogosMedios, 1)} jogos · ${pct(e.aproveitamento)} de vitórias</span></span><b class="pts ${e.ganhoMedio >= 0 ? "pos" : "neg"}">${sinal(Math.round(e.ganhoMedio))}</b></div>`).join("")}`
      : '<div class="vazio">Marque ou adicione eventos no seu plano para ver a previsão.</div>';
    desenharMeta(sim);
    desenharRanking();
  }

  function desenharMeta(sim) {
    const el = ctx.main.querySelector("#res-meta");
    const falta = meta - inicial;
    if (falta <= 0) { el.innerHTML = `<p>Você já está acima de ${fmt(meta)}. Escolha uma meta mais alta.</p>`; return; }
    const candidatos = [
      ...futuros.filter((e) => !plano.includes(e.id) && servePara(e)),
      ...Object.keys(TIPOS).filter((k) => k !== "seletiva").map((k) => ({ id: `hip-${k}`, nome: `Um ${TIPOS[k].nome} a mais (data a definir)`, data: `${FIM_DO_ANO().slice(0, 8)}10`, tipo: k, hipotetico: true })),
    ];
    const prior = priorizarTorneios({ base: base(), candidatos, meta, sims: 800 }).filter((e) => e.ganhoMedio > 0).slice(0, 8);
    const fNec = formaNecessaria({ base: base(), meta });
    const aprovNec = fNec == null ? null : aproveitamentoEsperado(perfil, modelo, fNec);
    el.innerHTML = `
      <div class="grade g3">
        <div class="card kpi"><div class="v">${sinal(falta)}</div><div class="r">pontos que faltam para ${fmt(meta)}</div></div>
        <div class="card kpi"><div class="v">${pct(sim.probMeta ?? 0)}</div><div class="r">chance de chegar lá com o plano atual</div></div>
        <div class="card kpi" data-dica="Chance média de vitória por jogo que faria a meta virar o resultado mais provável com o plano atual."><div class="v">${aprovNec == null ? "—" : pct(aprovNec)}</div><div class="r">${aprovNec == null ? "inalcançável só com este plano: adicione eventos" : `de vitórias por jogo para a meta ser o mais provável (hoje: ${pct(aprov)})`}</div></div>
      </div>
      <h3 class="mt">Quais torneios priorizar para alcançar a sua meta</h3>
      ${prior.length ? `<div class="tabela-wrap"><table><thead><tr><th>Evento</th><th class="dir">Ganho médio de rating</th><th class="dir">Chance de bater a meta</th></tr></thead><tbody>
        ${prior.map((e) => `<tr><td><span class="clube-nome">${esc(e.nome)}</span><div class="clube-sub">${e.hipotetico ? "sugestão" : `${dataBR(e.data)}${e.uf ? ` · ${esc(e.uf)}` : ""}`} · ${esc(TIPOS[e.tipo].nome)}, peso ${TIPOS[e.tipo].peso}</div></td>
          <td class="dir"><span class="pts pos">${sinal(Math.round(e.ganhoMedio))}</span></td><td class="dir num"><b>${Math.round(e.ganhoChance * 100) > 0 ? `+${Math.round(e.ganhoChance * 100)} p.p.` : "≈ 0 p.p."}</b></td></tr>`).join("")}
        </tbody></table></div><p class="mut" style="font-size:13px">"p.p." = pontos percentuais a mais na chance de bater a meta, se você incluir o evento no plano.</p>`
      : '<p class="mut">Nenhum evento disponível aumenta a sua chance. Com a forma atual, a tendência nos próximos jogos é de perder pontos: o caminho é melhorar o aproveitamento.</p>'}`;
  }

  function desenharRanking() {
    const el = ctx.main.querySelector("#res-ranking");
    const rk = d.rankings || [];
    if (!rk.length) { el.innerHTML = '<div class="card vazio">O atleta não aparece em rankings olímpicos ou paralímpicos deste ano.</div>'; return; }
    const evs = eventosDoPlano();
    el.innerHTML = `<div class="tabela-wrap"><table><thead><tr><th>Ranking</th><th class="dir">Hoje</th><th class="dir">Sem jogar mais</th><th class="dir">Com o plano (mais provável)</th><th class="dir">Faixa</th></tr></thead><tbody>
      ${rk.map((r) => {
        const s = simularRanking({ resultados: r.resultados, eventos: evs, ate: FIM_DO_ANO() });
        const outros = r.pontosDaCategoria.filter((p, i, arr) => !(p === r.pontos && arr.indexOf(p) === i));
        return `<tr><td><span class="clube-nome">${esc(NOMES_TIPO[r.tipo])} · ${esc(r.categoria)}</span><div class="clube-sub">8 melhores resultados nas últimas 52 semanas</div></td>
          <td class="dir num"><b>${r.posicao}º</b><div class="clube-sub">${fmt(r.pontos)} pts</div></td>
          <td class="dir num">~${posicaoEstimada(s.semNovos, outros)}º<div class="clube-sub">${fmt(s.semNovos)} pts</div></td>
          <td class="dir num"><b>~${posicaoEstimada(s.p50, outros)}º</b><div class="clube-sub">${fmt(s.p50)} pts</div></td>
          <td class="dir num">${posicaoEstimada(s.p90, outros)}º a ${posicaoEstimada(s.p10, outros)}º</td></tr>`;
      }).join("")}</tbody></table></div>
      <p class="mut" style="font-size:13px">Resultados com mais de 52 semanas saem da conta. A colocação em cada evento novo é sorteada do seu histórico no mesmo tipo de evento. As posições supõem os outros atletas parados.</p>`;
  }

  // metas
  const inpMeta = ctx.main.querySelector("#meta"), selMeta = ctx.main.querySelector("#meta-classe");
  selMeta.value = [...selMeta.options].some((o) => +o.value === meta) ? String(meta) : "outro";
  selMeta.addEventListener("change", () => { if (selMeta.value !== "outro") { meta = +selMeta.value; inpMeta.value = meta; salvar(); recalcular(); } else inpMeta.focus(); });
  let tm;
  inpMeta.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { const v = Math.round(+inpMeta.value); if (v > 0) { meta = v; selMeta.value = [...selMeta.options].some((o) => +o.value === v) ? String(v) : "outro"; salvar(); recalcular(); } }, 400); });
  ctx.main.querySelector("#x-add").addEventListener("click", () => {
    const tipo = ctx.main.querySelector("#x-tipo").value, data = ctx.main.querySelector("#x-data").value;
    if (!data || data < hoje) return;
    extras.push({ tipo, data }); salvar(); desenharPlano(); recalcular();
  });
  desenharPlano();
  recalcular();
}

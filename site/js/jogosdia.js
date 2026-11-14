// "Jogos do dia": probabilidade de vitória dos jogos que vão acontecer (e dos
// que já aconteceram hoje) nos eventos em andamento, pelo rating ao vivo.
import { esc, fmt, pct } from "./graficos.js";
import { probVitoria } from "./previsao.js";

const AO_VIVO = "https://casquinha-ao-vivo.matheusbruno045.workers.dev/api/";
const normalizar = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const link = (l) => `#/atleta/${encodeURIComponent(`~${normalizar(l.nome)}|${normalizar(l.clube)}`)}?aba=perfil`;
let timer = null;

export async function viewJogosDoDia(ctx, q) {
  ctx.marcarMenu("jogos-do-dia");
  const [dados, modelo] = await Promise.all([fetch(`${AO_VIVO}jogos-do-dia`).then((r) => r.json()).catch(() => ({ eventos: [] })), ctx.carregarModelo()]);
  const filtro = { ev: q.get("ev") || "", q: q.get("q") || "", eq: q.get("eq") === "1" };
  const eventos = dados.eventos || [];
  // probabilidades
  for (const e of eventos) {
    for (const j of e.proximos) j.p = probVitoria(j.a.rating - j.b.rating, modelo);
    for (const j of e.finalizados) j.p = probVitoria(j.a.rating - j.b.rating, modelo);
  }
  const fin = eventos.flatMap((e) => e.finalizados);
  const acertos = fin.filter((j) => (j.p >= 0.5) === j.a.venceu).length;
  const agora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16);
  const amanha = new Date(Date.parse(`${dados.dia || "2000-01-01"}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
  // ordem: hoje antes de amanhã; jogos sem horário por último
  for (const e of eventos) e.proximos.sort((x, y) => (x.dia || "").localeCompare(y.dia || "") || (!x.hora) - (!y.hora) || (x.hora || "").localeCompare(y.hora || "") || String(x.mesa).localeCompare(String(y.mesa), "pt-BR", { numeric: true }));
  const umaHoraAtras = new Date(Date.now() - 4 * 3600e3).toISOString().slice(11, 16);

  const passa = (j) => (!filtro.q || `${j.a.nome} ${j.b.nome}`.includes(normalizar(filtro.q))) && (!filtro.eq || (j.p >= 0.4 && j.p <= 0.6));
  const lado = (l, p, dir) => `<a class="jd-lado ${dir ? "dir" : ""} ${p >= 0.5 ? "fav" : ""}" href="${link(l)}"><b>${esc(l.nome)}</b><small>${esc(l.clube)} · ${fmt(l.rating)}</small></a>`;
  const barra = (p) => `<div class="jd-prob" data-dica="Chance de vitória pela diferença de rating ao vivo (regressão logística)."><span class="num">${pct(p)}</span><div class="duelo"><i style="width:${p * 100}%"></i><i style="width:${(1 - p) * 100}%"></i></div><span class="num">${pct(1 - p)}</span></div>`;
  const proximo = (j) => `<div class="jd-jogo">
      <div class="jd-meta"><b class="num">${j.dia && j.dia !== dados.dia ? `<span class="tag">${j.dia === amanha ? "amanhã" : j.dia.split("-").reverse().slice(0, 2).join("/")}</span> ` : ""}${esc(j.hora || "sem horário")}</b>${j.dia === dados.dia && j.hora && j.hora <= agora && j.hora >= umaHoraAtras ? '<span class="tag zebra">agora</span>' : ""}<small>${j.mesa ? `mesa ${esc(j.mesa)} · ` : ""}${esc(j.categoria)} · ${esc(j.fase)}${j.grupo ? ` ${esc(j.grupo)}` : ""}</small></div>
      ${lado(j.a, j.p, false)}${barra(j.p)}${lado(j.b, 1 - j.p, true)}</div>`;
  const finalizado = (j) => {
    const zebra = (j.p >= 0.5) !== j.a.venceu;
    const pv = j.a.venceu ? j.p : 1 - j.p;
    return `<div class="jd-jogo feito">
      <div class="jd-meta"><b class="num">${esc(j.hora || "")}</b><small>${esc(j.categoria)} · ${esc(j.fase)}</small></div>
      ${lado(j.a, j.p, false)}<div class="jd-res"><b class="num">${j.a.placar ?? ""} × ${j.b.placar ?? ""}</b><small>${zebra ? `<span class="tag zebra">zebra · venceu com ${pct(pv)}</span>` : `deu a lógica (${pct(pv)})`}</small></div>${lado(j.b, 1 - j.p, true)}</div>`;
  };

  const visiveis = eventos.filter((e) => !filtro.ev || e.slug === filtro.ev);
  const totalProx = eventos.reduce((s, e) => s + e.proximos.length, 0);
  ctx.main.innerHTML = `
    <section class="hero-pagina">
      <div><p class="sobretitulo"><span class="ao-vivo-pulso" aria-hidden="true"></span>Atualiza a cada minuto</p><h1>Jogos do dia</h1>
        <p>A chance de cada atleta vencer os jogos que vão acontecer hoje, calculada pela diferença de rating ao vivo (já com os jogos de hoje), e como foram os favoritos nos jogos já disputados.</p></div>
      <div class="grade g2" style="gap:10px">
        <div class="card kpi"><div class="v">${fmt(totalProx)}</div><div class="r">jogos a seguir com os dois atletas definidos</div></div>
        <div class="card kpi" data-dica="Nos jogos já disputados hoje, quantas vezes o favorito (chance acima de 50%) venceu."><div class="v">${fin.length ? pct(acertos / fin.length) : "–"}</div><div class="r">dos favoritos venceram hoje (${acertos}/${fin.length})</div></div>
      </div>
    </section>
    <div class="abas" role="tablist">
      <button role="tab" aria-selected="false" data-ir="pontos">Destaques do dia</button>
      <button role="tab" aria-selected="true">Jogos do dia · probabilidades</button>
      <button role="tab" aria-selected="false" data-ir="ao-vivo">Eventos</button>
    </div>
    <div class="filtros">
      <input type="search" id="f-q" placeholder="Buscar atleta" value="${esc(filtro.q)}" aria-label="Buscar atleta">
      <select id="f-ev" aria-label="Evento"><option value="">Todos os eventos (${eventos.length})</option>${eventos.map((e) => `<option value="${esc(e.slug)}" ${e.slug === filtro.ev ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select>
      <label class="mut" style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" id="f-eq" ${filtro.eq ? "checked" : ""}> só jogos equilibrados (40% a 60%)</label>
    </div>
    ${visiveis.length ? visiveis.map((e) => {
      const prox = e.proximos.filter(passa), feitos = e.finalizados.filter(passa);
      if (!prox.length && !feitos.length) return "";
      return `<section class="card mt jd-evento">
        <div class="cab" style="margin-bottom:6px"><div><h2 style="margin:0">${esc(e.nome)}</h2><p class="mut" style="margin:0">${esc(e.cidade || "")}${e.uf ? ` · ${esc(e.uf)}` : ""} · ${esc(e.tipo)}, peso ${e.peso}</p></div><a class="btn" href="#/ao-vivo/${encodeURIComponent(e.slug)}">Resultados do evento</a></div>
        ${prox.length ? `<h3>A seguir</h3>${prox.slice(0, 8).map(proximo).join("")}${prox.length > 8 ? `<details class="mt"><summary class="btn">Ver mais ${prox.length - 8} jogos</summary><div class="mt">${prox.slice(8).map(proximo).join("")}</div></details>` : ""}` : ""}
        ${feitos.length ? `<details class="mt"><summary class="btn">Já disputados hoje (${feitos.length})</summary><div class="mt">${feitos.map(finalizado).join("")}</div></details>` : ""}
      </section>`;
    }).join("") : '<div class="card vazio">Nenhum evento com jogos hoje.</div>'}
    <p class="mut mt" style="font-size:13px">Só aparecem jogos com os dois atletas já definidos. Jogos de chave ainda dependem dos resultados anteriores. A chance considera só a diferença de rating; o rating de cada atleta já inclui os jogos de hoje.</p>`;
  ctx.main.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => ctx.irPara(b.dataset.ir)));
  const aplicar = () => {
    filtro.q ? q.set("q", filtro.q) : q.delete("q");
    filtro.ev ? q.set("ev", filtro.ev) : q.delete("ev");
    filtro.eq ? q.set("eq", "1") : q.delete("eq");
    ctx.irPara("jogos-do-dia", q);
  };
  let t;
  ctx.main.querySelector("#f-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { filtro.q = e.target.value; aplicar(); }, 400); });
  ctx.main.querySelector("#f-ev").addEventListener("change", (e) => { filtro.ev = e.target.value; aplicar(); });
  ctx.main.querySelector("#f-eq").addEventListener("change", (e) => { filtro.eq = e.target.checked; aplicar(); });
  clearInterval(timer);
  timer = setInterval(() => { if (location.hash.startsWith("#/jogos-do-dia") && !document.hidden && !ctx.main.querySelector("#f-q:focus")) viewJogosDoDia(ctx, q); else if (!location.hash.startsWith("#/jogos-do-dia")) clearInterval(timer); }, 60e3);
}

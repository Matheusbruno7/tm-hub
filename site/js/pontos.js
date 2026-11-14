// Aba "Pontos pós-jogo": destaques do dia, busca de atleta e o histórico de
// jogos com os pontos e a chance de vitória que o atleta tinha antes de cada jogo.
import { abrirCartao, botaoCompartilhar } from "./cartao.js";
import { esc, fmt, linhaTempo, pct } from "./graficos.js";
import { classeDe, historico, probVitoria } from "./previsao.js";

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
const diaSemana = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const sinal = (n) => `${n > 0 ? "+" : ""}${fmt(n)}`;
const pts = (n) => `<span class="pts ${n > 0 ? "pos" : n < 0 ? "neg" : ""}">${sinal(n)}</span>`;
const chance = (p, venceu) => {
  const cls = p >= 0.65 ? "alta" : p <= 0.35 ? "baixa" : "media";
  const zebra = venceu && p < 0.4 ? ' <span class="tag zebra" title="Venceu com menos de 40% de chance">zebra</span>' : "";
  return `<span class="chance ${cls}" data-dica="Chance de vitória antes do jogo, pela diferença de rating (regressão logística)."><i style="width:${Math.round(p * 100)}%"></i><b>${pct(p)}</b></span>${zebra}`;
};

// ---------------------------------------------------------------- página principal
export async function viewPontos(ctx, q) {
  ctx.marcarMenu("pontos");
  ctx.main.innerHTML = `
    <section class="hero-pagina">
      <div><p class="sobretitulo"><span class="ao-vivo-pulso" aria-hidden="true"></span>Atualizado a cada minuto</p>
        <h1>Pontos pós-jogo</h1>
        <p>Digite seu nome e veja os pontos de cada partida assim que o resultado cai no sistema da CBTM, com a chance que você tinha de vencer cada jogo.</p></div>
      <div class="busca-grande"><input type="search" id="busca" placeholder="Seu nome (ex.: Davi Fujii)" aria-label="Nome do atleta" autocomplete="off" value="${esc(q.get("q") || "")}"><div id="sug" class="sugestoes" hidden></div></div>
    </section>
    <div class="abas" role="tablist">
      <button role="tab" aria-selected="true">Destaques do dia</button>
      <button role="tab" aria-selected="false" data-ir="jogos-do-dia">Jogos do dia · probabilidades</button>
      <button role="tab" aria-selected="false" data-ir="ao-vivo">Eventos</button>
    </div>
    <div id="destaques"><div class="carregando">Carregando destaques…</div></div>`;
  ctx.main.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => ctx.irPara(b.dataset.ir)));
  ligarBusca(ctx, ctx.main.querySelector("#busca"), ctx.main.querySelector("#sug"));
  await desenharDestaques(ctx, q);
}

function ligarBusca(ctx, inp, sug) {
  let t;
  const buscar = async () => {
    const termo = inp.value.trim();
    if (termo.length < 3) { sug.hidden = true; return; }
    try {
      const { itens } = await get(RANKING, `busca?q=${encodeURIComponent(termo)}`);
      sug.innerHTML = itens.length ? itens.slice(0, 12).map((a) => `<button type="button" data-id="${esc(a.id)}"><b>${esc(a.nome)}</b> <span class="mut">· ${esc(a.clube)} · ${fmt(a.rating)}</span></button>`).join("")
        : '<div class="vazio">Nenhum atleta encontrado. A CBTM usa nome e último sobrenome (ex.: "DAVI FUJII").</div>';
      sug.hidden = false;
      sug.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => ctx.irPara(`atleta/${encodeURIComponent(b.dataset.id)}?aba=jogos`)));
    } catch (e) { sug.innerHTML = `<div class="vazio">${esc(e.message)}</div>`; sug.hidden = false; }
  };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(buscar, 250); });
  inp.addEventListener("blur", () => setTimeout(() => (sug.hidden = true), 200));
  inp.addEventListener("focus", () => { if (inp.value.trim().length >= 3) buscar(); });
}

async function desenharDestaques(ctx, q) {
  const alvo = ctx.main.querySelector("#destaques");
  let d;
  try { d = await get(AO_VIVO, `destaques${q.get("dia") ? `?dia=${q.get("dia")}` : ""}`); } catch (e) { alvo.innerHTML = `<div class="card vazio">${esc(e.message)}</div>`; return; }
  if (!d.dia) { alvo.innerHTML = '<div class="card vazio">Ainda não há jogos calculados.</div>'; return; }
  const maxPts = Math.max(1, ...(d.ganhadores || []).map((a) => a.pontos));
  alvo.innerHTML = `
    <div class="linha-dias">${d.dias.slice().reverse().map((dia) => `<button type="button" class="chip-dia" data-dia="${dia}" aria-pressed="${dia === d.dia}">${diaSemana(dia)}</button>`).join("")}</div>
    <div class="cab" style="margin-top:6px"><div><h2 style="margin:0">${new Date(`${d.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</h2>
      <p class="mut">${fmt(d.jogos)} jogos em ${fmt(d.eventos)} evento(s) · ${fmt(d.atletas)} atletas</p></div>${botaoCompartilhar("btn-dia")}</div>
    <div class="grade g2">
      <div class="card"><h3>Quem mais ganhou pontos</h3>
        ${(d.ganhadores || []).slice(0, 15).map((a, i) => `<a class="linha-rank" href="#/atleta/${encodeURIComponent(`~${a.chave}`)}?aba=jogos">
          <span class="pos-rank">${i + 1}</span>
          <span class="nome-rank"><b>${esc(a.nome)}</b><small>${esc(a.clube)} · ${a.vitorias}V ${a.jogos - a.vitorias}D</small></span>
          <span class="barra-rank"><i style="width:${(100 * a.pontos) / maxPts}%"></i></span>${pts(a.pontos)}</a>`).join("") || '<p class="mut">Ninguém ganhou pontos neste dia.</p>'}
      </div>
      <div>
        <div class="card"><h3>Maiores zebras</h3>
          ${(d.zebras || []).slice(0, 8).map((z) => `<div class="zebra-l"><div><b>${esc(z.vencedor)}</b> <span class="mut num">(${fmt(z.rating_vencedor)})</span> venceu <b>${esc(z.perdedor)}</b> <span class="mut num">(${fmt(z.rating_perdedor)})</span>
            <small>${esc(z.categoria)} · ${esc(z.fase)} · ${esc(z.evento)}</small></div><div class="dir"><span class="tag zebra">${fmt(z.diferenca)} de diferença</span><br>${pts(z.pontos)}</div></div>`).join("") || '<p class="mut">Nenhuma zebra neste dia.</p>'}
        </div>
        <div class="card mt"><h3>Quem mais perdeu pontos</h3>
          ${(d.perdedores || []).slice(0, 6).map((a) => `<a class="linha-rank simples" href="#/atleta/${encodeURIComponent(`~${a.chave}`)}?aba=jogos"><span class="nome-rank"><b>${esc(a.nome)}</b><small>${esc(a.clube)}</small></span>${pts(a.pontos)}</a>`).join("") || '<p class="mut">Ninguém perdeu pontos.</p>'}
        </div>
      </div>
    </div>`;
  alvo.querySelectorAll("[data-dia]").forEach((b) => b.addEventListener("click", () => { q.set("dia", b.dataset.dia); ctx.atualizarQuery("pontos", q); desenharDestaques(ctx, q); }));
  alvo.querySelector("#btn-dia").addEventListener("click", () => abrirCartao({
    secao: "Pontos pós-jogo · destaques do dia", nome: `Destaques de ${dataBR(d.dia)}`,
    linhas: [`${fmt(d.jogos)} jogos · ${fmt(d.eventos)} evento(s) · ${fmt(d.atletas)} atletas`],
    lista: { titulo: "Quem mais ganhou pontos", itens: (d.ganhadores || []).slice(0, 8).map((a, i) => [i + 1, a.nome, `${a.clube} · ${a.vitorias}V ${a.jogos - a.vitorias}D`, sinal(a.pontos)]) },
    texto: `Quem mais ganhou pontos no tênis de mesa em ${dataBR(d.dia)}`, arquivo: `destaques-${d.dia}`,
  }));
}

// ---------------------------------------------------------------- aba "Jogos e pontos" do perfil
// jogos: lista unificada (perfil.js), do mais recente para o mais antigo
export function renderJogos(ctx, alvo, { jogos, clube, modelo }) {
  const pendentes = jogos.filter((j) => j.pendente);
  const oficiais = jogos.filter((j) => !j.pendente);
  alvo.innerHTML = `
    <h2 class="titulo-secao" style="margin-top:8px">Jogos ainda não publicados pela CBTM</h2>
    ${pendentes.length ? tabelaJogos(pendentes.map((j) => ({ ...j, evento: j.clube && normalizar(j.clube) !== normalizar(clube) ? `${j.evento} · jogou por ${j.clube}` : j.evento, placar: j.placar, exato: true })))
      : '<div class="card vazio">Nenhum jogo pendente: tudo o que o atleta jogou já está no rating oficial.</div>'}
    <h2 class="titulo-secao">Histórico oficial (últimos 12 meses)</h2>
    ${oficiais.length ? tabelaJogos(oficiais.map((j) => ({ ...j, categoria: "", exato: false })))
      : '<div class="card vazio">Sem jogos oficiais nos últimos 12 meses.</div>'}
    <p class="mut mt" style="font-size:13px">Chance de vitória: regressão logística da diferença de rating antes do jogo, ajustada com ${fmt(modelo.jogos)} jogos oficiais. Nos jogos oficiais, o rating do adversário é aproximado pela faixa da tabela da CBTM (≈).</p>`;
}

function placarDeSets(sets) {
  const m = String(sets || "").match(/\)\s*(\d)\s*X\s*(\d)\s*\(/i);
  return m ? `${m[1]} × ${m[2]}` : "";
}

function tabelaJogos(jogos) {
  return `<div class="tabela-wrap"><table class="tab-jogos"><thead><tr><th>Data</th><th>Evento</th><th>Adversário</th><th class="dir">Placar</th><th>Chance de vencer</th><th class="dir">Pontos</th></tr></thead><tbody>
    ${jogos.map((j) => `<tr class="${j.venceu ? "linha-v" : "linha-d"}">
      <td class="num">${dataBR(j.data)}${j.hora ? `<div class="clube-sub">${esc(j.hora)}</div>` : ""}</td>
      <td><span class="clube-nome">${esc(j.categoria || j.evento)}</span>${j.categoria ? `<div class="clube-sub">${esc(j.evento)}</div>` : ""}${j.sets?.length ? `<div class="clube-sub num">${j.sets.map(([x, y]) => `${x}-${y}`).join(" · ")}</div>` : ""}</td>
      <td>${esc(j.adversario || "")}<div class="clube-sub num">${j.exato ? "" : "≈ "}${fmt(Math.round(j.ratingAdv))} · atleta ${fmt(j.antes)}</div></td>
      <td class="dir num"><span class="vd ${j.venceu ? "v" : "d"}">${j.venceu ? "V" : "D"}</span> ${esc(j.placar || "")}</td>
      <td>${chance(j.p, j.venceu)}</td>
      <td class="dir">${pts(j.pontos)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

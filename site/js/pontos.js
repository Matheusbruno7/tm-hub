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
      <button role="tab" aria-selected="false" data-ir="ao-vivo">Eventos e jogos</button>
    </div>
    <div id="destaques"><div class="carregando">Carregando destaques…</div></div>`;
  ctx.main.querySelector("[data-ir]").addEventListener("click", () => ctx.irPara("ao-vivo"));
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
      sug.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => ctx.irPara(`pontos/${encodeURIComponent(b.dataset.id)}`)));
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
        ${(d.ganhadores || []).slice(0, 15).map((a, i) => `<a class="linha-rank" href="#/pontos/${encodeURIComponent(`~${a.chave}`)}">
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
          ${(d.perdedores || []).slice(0, 6).map((a) => `<a class="linha-rank simples" href="#/pontos/${encodeURIComponent(`~${a.chave}`)}"><span class="nome-rank"><b>${esc(a.nome)}</b><small>${esc(a.clube)}</small></span>${pts(a.pontos)}</a>`).join("") || '<p class="mut">Ninguém perdeu pontos.</p>'}
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

// ---------------------------------------------------------------- atleta
export async function viewPontosAtleta(ctx, id) {
  ctx.marcarMenu("pontos");
  ctx.main.innerHTML = '<div class="carregando">Carregando os jogos do atleta…</div>';
  // id "~CHAVE" vem dos destaques (só a chave nome|clube): procura o atleta no índice
  if (id.startsWith("~")) {
    const chave = id.slice(1);
    try {
      const { itens } = await get(RANKING, `busca?q=${encodeURIComponent(chave.split("|")[0])}`);
      const achado = itens.find((a) => `${normalizar(a.nome)}|${normalizar(a.clube)}` === chave) || itens[0];
      if (achado) id = achado.id;
    } catch (e) { /* segue com a chave */ }
  }
  let d = null, modelo, vivo = null;
  try {
    [d, modelo] = await Promise.all([get(RANKING, `atleta/${encodeURIComponent(id)}?v=4`).catch(() => null), ctx.carregarModelo()]);
  } catch (e) { /* trata abaixo */ }
  const chave = d ? `${normalizar(d.atleta.nome)}|${normalizar(d.atleta.clube)}` : id.split("~").pop();
  try { vivo = await get(AO_VIVO, `atleta/${encodeURIComponent(chave)}`); } catch (e) { vivo = null; }
  if (!d && !vivo) {
    ctx.main.innerHTML = `<a class="voltar" href="#/pontos">← Pontos pós-jogo</a><div class="card vazio">Atleta não encontrado.</div>`;
    return;
  }
  const nome = d?.pessoa?.Nome || d?.atleta?.nome || vivo?.nome;
  const clube = d?.atleta?.clube || vivo?.clube;
  const sexo = d?.atleta?.sexo || d?.pessoa?.Sexo || "M";
  const oficial = d?.atleta?.rating ?? vivo?.oficial;
  const saldo = vivo?.saldo || 0;
  const atual = oficial + saldo;

  const pendentes = (vivo?.jogos || []).map((j) => ({ ...j, p: probVitoria(j.antes - j.rating_adversario, modelo) })).reverse();
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const oficiais = historico({ games: d?.jogos || [] }).filter((j) => (Date.parse(hoje) - Date.parse(j.data)) / 864e5 <= 365)
    .map((j) => ({ ...j, p: probVitoria(j.dif, modelo) })).reverse();
  const todos = [...pendentes.map((j) => ({ venceu: j.venceu, p: j.p, pontos: j.pontos })), ...oficiais];
  const vit = todos.filter((j) => j.venceu).length;
  const esperado = todos.reduce((s, j) => s + j.p, 0);
  const zebra = [...pendentes.map((j) => ({ ...j, adv: j.adversario, data: j.dia })), ...oficiais.map((j) => ({ ...j, adv: j.adversario }))].filter((j) => j.venceu).sort((a, b) => a.p - b.p)[0];
  const evolucao = (d?.eventos || []).filter((e) => e.RatingFinal != null).map((e) => ({ x: String(e.DataFim || e.DataInicio).slice(0, 10), y: e.RatingFinal, rotulo: `${dataBR(e.DataFim || e.DataInicio)} · ${e.EventoNome}<br><b>${fmt(e.RatingFinal)}</b> (${sinal(e.Pontos)})` }))
    .sort((a, b) => a.x.localeCompare(b.x)).filter((p) => (Date.parse(hoje) - Date.parse(p.x)) / 864e5 <= 2 * 365);
  if (saldo) evolucao.push({ x: hoje, y: atual, rotulo: `Agora (ao vivo): <b>${fmt(atual)}</b> (${sinal(saldo)} a publicar)` });

  ctx.main.innerHTML = `
    <a class="voltar" href="#/pontos">← Pontos pós-jogo</a>
    <section class="perfil-topo">
      <div class="avatar" aria-hidden="true">${esc(String(nome).split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join(""))}</div>
      <div class="perfil-id"><h1>${esc(nome)}</h1><p class="mut">${esc(clube)}${d?.pessoa?.Idade ? ` · ${d.pessoa.Idade} anos` : ""}</p>
        <div class="lista-chips"><span class="tag">Classe ${classeDe(atual, sexo)}</span>${d ? `<span class="tag">${esc(d.atleta.categoria)} · ${d.atleta.posicao}º</span>` : ""}
        <a class="tag link" href="#/atletas/${encodeURIComponent(id)}">Previsão e metas →</a></div></div>
      <div class="perfil-numeros">
        <div><span>Rating oficial</span><b>${fmt(oficial)}</b></div>
        <div><span>A publicar</span><b class="${saldo > 0 ? "txt-pos" : saldo < 0 ? "txt-neg" : ""}">${sinal(saldo)}</b></div>
        <div class="forte"><span>Rating ao vivo</span><b>${fmt(atual)}</b></div>
      </div>
      <div>${botaoCompartilhar("btn-atleta")}</div>
    </section>
    <div class="grade g4 mt">
      <div class="card kpi"><div class="v">${fmt(todos.length)}</div><div class="r">jogos nos últimos 12 meses</div></div>
      <div class="card kpi"><div class="v">${todos.length ? pct(vit / todos.length) : "–"}</div><div class="r">de vitórias (${vit}V ${todos.length - vit}D)</div></div>
      <div class="card kpi" data-dica="Vitórias reais menos a soma das chances de vitória antes de cada jogo."><div class="v ${vit - esperado >= 0 ? "txt-pos" : "txt-neg"}">${sinal(Math.round(vit - esperado))}</div><div class="r">vitórias acima do esperado pelo rating</div></div>
      <div class="card kpi"><div class="v">${zebra ? pct(zebra.p) : "–"}</div><div class="r">${zebra ? `maior zebra: venceu ${esc(zebra.adv)}` : "sem vitórias"}</div></div>
    </div>
    ${evolucao.length > 1 ? `<div class="card mt"><h3>Rating ao longo do tempo</h3>${linhaTempo(evolucao)}</div>` : ""}
    <h2 class="titulo-secao">Jogos ainda não publicados pela CBTM</h2>
    ${pendentes.length ? tabelaJogos(pendentes.map((j) => ({ data: j.dia, hora: j.hora, evento: normalizar(j.clube) !== normalizar(clube) && j.clube ? `${j.evento} · jogou por ${j.clube}` : j.evento, categoria: `${j.categoria} · ${j.fase}`, adversario: j.adversario, ratingAdv: j.rating_adversario, antes: j.antes, placar: j.placar, venceu: j.venceu, pontos: j.pontos, p: j.p, exato: true })))
      : '<div class="card vazio">Nenhum jogo pendente: tudo o que você jogou já está no rating oficial.</div>'}
    <h2 class="titulo-secao">Histórico oficial (últimos 12 meses)</h2>
    ${oficiais.length ? tabelaJogos(oficiais.map((j) => ({ data: j.data, hora: j.hora, evento: j.evento, categoria: "", adversario: j.adversario, ratingAdv: j.antes - j.dif, antes: j.antes, placar: placarDeSets(j.sets), venceu: j.venceu, pontos: j.pontos, p: j.p, exato: false })))
      : '<div class="card vazio">Sem jogos oficiais nos últimos 12 meses.</div>'}
    <p class="mut mt" style="font-size:13px">Chance de vitória: regressão logística da diferença de rating, ajustada com ${fmt(modelo.jogos)} jogos oficiais. Nos jogos oficiais, o rating do adversário é aproximado pela faixa da tabela da CBTM (≈).</p>`;

  ctx.main.querySelector("#btn-atleta").addEventListener("click", () => abrirCartao({
    secao: "Pontos pós-jogo", nome, linhas: [clube, `Classe ${classeDe(atual, sexo)}${d ? ` · ${d.atleta.posicao}º no ${d.atleta.categoria}` : ""}`],
    destaque: { rotulo: saldo ? "Rating ao vivo" : "Rating oficial", valor: fmt(atual), sub: saldo ? `${sinal(saldo)} pontos nos jogos mais recentes` : "" },
    metricas: [["jogos em 12 meses", fmt(todos.length)], ["de vitórias", todos.length ? pct(vit / todos.length) : "–"], ["vitórias acima do esperado", sinal(Math.round(vit - esperado))]],
    lista: pendentes.length ? { titulo: "Últimos jogos", itens: pendentes.slice(0, 5).map((j) => [j.venceu ? "V" : "D", `x ${j.adversario}`, `${j.placar} · chance ${pct(j.p)}`, sinal(j.pontos)]) } : null,
    texto: `${nome}: rating ${fmt(atual)} no tênis de mesa`, arquivo: `pontos-${normalizar(nome).toLowerCase().replace(/\s+/g, "-")}`,
  }));
}

function placarDeSets(sets) {
  const m = String(sets || "").match(/\)\s*(\d)\s*X\s*(\d)\s*\(/i);
  return m ? `${m[1]} × ${m[2]}` : "";
}

function tabelaJogos(jogos) {
  return `<div class="tabela-wrap"><table class="tab-jogos"><thead><tr><th>Data</th><th>Evento</th><th>Adversário</th><th class="dir">Placar</th><th>Chance de vencer</th><th class="dir">Pontos</th></tr></thead><tbody>
    ${jogos.map((j) => `<tr class="${j.venceu ? "linha-v" : "linha-d"}">
      <td class="num">${dataBR(j.data)}${j.hora ? `<div class="clube-sub">${esc(j.hora)}</div>` : ""}</td>
      <td><span class="clube-nome">${esc(j.categoria || j.evento)}</span>${j.categoria ? `<div class="clube-sub">${esc(j.evento)}</div>` : ""}</td>
      <td>${esc(j.adversario || "")}<div class="clube-sub num">${j.exato ? "" : "≈ "}${fmt(Math.round(j.ratingAdv))} · você ${fmt(j.antes)}</div></td>
      <td class="dir num"><span class="vd ${j.venceu ? "v" : "d"}">${j.venceu ? "V" : "D"}</span> ${esc(j.placar || "")}</td>
      <td>${chance(j.p, j.venceu)}</td>
      <td class="dir">${pts(j.pontos)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

// Cartão de imagem para compartilhar nas redes (Feed 4:5 ou Stories 9:16),
// gerado no navegador, com botões de baixar e compartilhar.
// abrirCartao({ secao, nome, linhas: [..], destaque: {rotulo, valor, sub}, metricas: [[rotulo, valor]],
//               barras: {titulo, itens: [[rotulo, fracao0a1, texto]]}, lista: {titulo, itens: [[pos, nome, sub, valor]]}, arquivo })
const AZUL = "#0f2a47", AZUL2 = "#1c5cab", CLARO = "#86b6ef", AMARELO = "#f5c542", FUNDO = "#f4f6f9", TX = "#0f1b2d", TX2 = "#5b6779";
const SITE = "matheusbruno7.github.io/tm-hub";
let estado = { formato: "feed", dados: null };

function dialogo() {
  let d = document.getElementById("cartao-dialogo");
  if (d) return d;
  d = document.createElement("dialog");
  d.id = "cartao-dialogo";
  d.setAttribute("aria-label", "Imagem para compartilhar");
  d.innerHTML = `<button class="cartao-fechar" type="button" aria-label="Fechar">×</button>
    <h2>Compartilhar</h2>
    <div class="seg" role="group" aria-label="Formato">
      <button type="button" data-fmt="feed" aria-pressed="true">Feed (4:5)</button>
      <button type="button" data-fmt="story" aria-pressed="false">Stories / Status (9:16)</button></div>
    <canvas width="1080" height="1350"></canvas>
    <div class="cartao-acoes">
      <button type="button" class="btn prim" data-acao="compartilhar">Compartilhar imagem</button>
      <button type="button" class="btn" data-acao="baixar">Baixar imagem</button>
      <a class="btn" data-acao="whatsapp" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn" data-acao="x" target="_blank" rel="noopener">X / Twitter</a>
      <button type="button" class="btn" data-acao="link">Copiar link</button>
    </div>
    <p class="mut cartao-dica">No celular, "Compartilhar imagem" abre direto Instagram, WhatsApp e outros apps.</p>`;
  document.body.appendChild(d);
  d.querySelector(".cartao-fechar").onclick = () => d.close();
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  d.querySelectorAll("[data-fmt]").forEach((b) => (b.onclick = () => {
    estado.formato = b.dataset.fmt;
    d.querySelectorAll("[data-fmt]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    desenhar();
  }));
  d.querySelector('[data-acao="baixar"]').onclick = baixar;
  d.querySelector('[data-acao="compartilhar"]').onclick = compartilhar;
  d.querySelector('[data-acao="link"]').onclick = async (e) => {
    try { await navigator.clipboard.writeText(location.href); e.target.textContent = "Link copiado ✓"; } catch (err) { prompt("Copie o link:", location.href); }
  };
  return d;
}

function ajustarFonte(ctx, txt, max, tam, peso = 800) {
  let t = tam;
  ctx.font = `${peso} ${t}px Inter, system-ui, sans-serif`;
  while (ctx.measureText(txt).width > max && t > 20) { t -= 2; ctx.font = `${peso} ${t}px Inter, system-ui, sans-serif`; }
  return t;
}
function cortar(ctx, txt, max) {
  let t = String(txt ?? "");
  const orig = t;
  while (ctx.measureText(t).width > max && t.length > 6) t = t.slice(0, -2);
  return t === orig ? t : `${t}…`;
}
const fonte = (peso, tam) => `${peso} ${tam}px Inter, system-ui, sans-serif`;

function logo(ctx, x, y, s) {
  ctx.fillStyle = AZUL2; ctx.beginPath(); ctx.arc(x + s * 0.4, y + s * 0.45, s * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x + s * 0.62, y + s * 0.78); ctx.rotate(-0.7);
  ctx.fillStyle = CLARO; ctx.beginPath(); ctx.roundRect(-s * 0.06, -s * 0.18, s * 0.12, s * 0.34, s * 0.06); ctx.fill(); ctx.restore();
  ctx.fillStyle = AMARELO; ctx.beginPath(); ctx.arc(x + s * 0.78, y + s * 0.22, s * 0.09, 0, Math.PI * 2); ctx.fill();
}

function desenhar() {
  const D = estado.dados;
  const cv = dialogo().querySelector("canvas");
  const W = 1080, H = estado.formato === "story" ? 1920 : 1350, story = H > 1500, M = 64;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = FUNDO; ctx.fillRect(0, 0, W, H);

  // topo
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, AZUL); g.addColorStop(1, AZUL2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, story ? 190 : 160);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(M, story ? 52 : 40, 84, 84, 20); ctx.fill();
  logo(ctx, M + 6, (story ? 52 : 40) + 6, 72);
  ctx.fillStyle = "#fff"; ctx.font = fonte(900, 46); ctx.fillText("CASQUINHA", M + 108, story ? 106 : 94);
  ctx.fillStyle = "#c9d8ee"; ctx.font = fonte(600, 26); ctx.fillText(cortar(ctx, D.secao || "Tênis de mesa", W - 2 * M - 110), M + 110, story ? 146 : 132);

  let y = story ? 290 : 240;
  // nome e linhas
  ctx.fillStyle = TX; const tn = ajustarFonte(ctx, D.nome, W - 2 * M, story ? 72 : 64, 900); ctx.fillText(D.nome, M, y); y += tn * 0.5 + 18;
  (D.linhas || []).forEach((l, i) => { ctx.fillStyle = TX2; ctx.font = fonte(i ? 500 : 600, i ? 28 : 31); ctx.fillText(cortar(ctx, l, W - 2 * M), M, y + 24); y += 44; });
  y += story ? 40 : 24;

  // destaque (número grande)
  if (D.destaque) {
    const h = story ? 280 : 236;
    const gg = ctx.createLinearGradient(M, y, W - M, y + h); gg.addColorStop(0, AZUL); gg.addColorStop(1, AZUL2);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(M, y, W - 2 * M, h, 28); ctx.fill();
    ctx.fillStyle = "#c9d8ee"; ctx.font = fonte(700, 28); ctx.fillText(String(D.destaque.rotulo || "").toUpperCase(), M + 40, y + 62);
    ctx.fillStyle = "#fff"; ajustarFonte(ctx, D.destaque.valor, W - 2 * M - 80, story ? 132 : 112, 900); ctx.fillText(D.destaque.valor, M + 40, y + (story ? 196 : 168));
    if (D.destaque.sub) { ctx.fillStyle = AMARELO; ctx.font = fonte(700, 30); ctx.fillText(cortar(ctx, D.destaque.sub, W - 2 * M - 80), M + 40, y + h - 30); }
    y += h + (story ? 44 : 30);
  }

  // métricas em grade de 2 ou 3
  const met = (D.metricas || []).slice(0, story ? 6 : 6);
  if (met.length) {
    const cols = met.length >= 3 ? 3 : met.length, gap = 18, w = (W - 2 * M - gap * (cols - 1)) / cols, h = story ? 150 : 128;
    met.forEach(([rot, val], i) => {
      const x = M + (i % cols) * (w + gap), yy = y + Math.floor(i / cols) * (h + gap);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x, yy, w, h, 20); ctx.fill();
      ctx.fillStyle = TX; ajustarFonte(ctx, String(val), w - 40, story ? 52 : 46, 850); ctx.fillText(String(val), x + 24, yy + (story ? 72 : 62));
      ctx.fillStyle = TX2; ctx.font = fonte(600, 22); ctx.fillText(cortar(ctx, rot, w - 40), x + 24, yy + h - 28);
    });
    y += Math.ceil(met.length / cols) * (h + gap) + (story ? 30 : 16);
  }

  const limite = H - 130;
  // barras
  if (D.barras?.itens?.length && y < limite - 160) {
    ctx.fillStyle = TX2; ctx.font = fonte(800, 24); ctx.fillText(String(D.barras.titulo || "").toUpperCase(), M, y + 26); y += 50;
    for (const [rot, frac, txt] of D.barras.itens) {
      if (y > limite - 50) break;
      ctx.fillStyle = TX; ctx.font = fonte(650, 26); ctx.fillText(cortar(ctx, rot, 300), M, y + 26);
      const bx = M + 320, bw = W - 2 * M - 320 - 130;
      ctx.fillStyle = "#e3e8ef"; ctx.beginPath(); ctx.roundRect(bx, y + 6, bw, 24, 12); ctx.fill();
      ctx.fillStyle = AZUL2; ctx.beginPath(); ctx.roundRect(bx, y + 6, Math.max(12, bw * Math.min(1, frac)), 24, 12); ctx.fill();
      ctx.fillStyle = TX; ctx.font = fonte(800, 26); ctx.textAlign = "right"; ctx.fillText(txt, W - M, y + 28); ctx.textAlign = "left";
      y += story ? 54 : 46;
    }
    y += 16;
  }

  // lista (ranking)
  if (D.lista?.itens?.length && y < limite - 120) {
    ctx.fillStyle = TX2; ctx.font = fonte(800, 24); ctx.fillText(String(D.lista.titulo || "").toUpperCase(), M, y + 26); y += 46;
    const h = story ? 92 : 80;
    for (const [pos, nome, sub, val] of D.lista.itens) {
      if (y + h > limite) break;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(M, y, W - 2 * M, h - 10, 16); ctx.fill();
      ctx.fillStyle = AZUL2; ctx.font = fonte(900, 30); ctx.fillText(String(pos), M + 24, y + (h - 10) / 2 + 11);
      ctx.fillStyle = TX; ctx.font = fonte(750, 28); ctx.fillText(cortar(ctx, nome, W - 2 * M - 320), M + 84, y + (sub ? 34 : (h - 10) / 2 + 10));
      if (sub) { ctx.fillStyle = TX2; ctx.font = fonte(500, 21); ctx.fillText(cortar(ctx, sub, W - 2 * M - 320), M + 84, y + 62); }
      ctx.fillStyle = D.lista.neutro ? TX : val && String(val).startsWith("-") ? "#c62828" : "#0a7d0a"; ctx.font = fonte(900, 32); ctx.textAlign = "right";
      ctx.fillText(String(val), W - M - 24, y + (h - 10) / 2 + 11); ctx.textAlign = "left";
      y += h;
    }
  }

  // rodapé
  ctx.fillStyle = AZUL; ctx.fillRect(0, H - 104, W, 104);
  ctx.fillStyle = "#fff"; ctx.font = fonte(800, 30); ctx.fillText(SITE, M, H - 56);
  ctx.fillStyle = "#9fb3cf"; ctx.font = fonte(500, 20); ctx.fillText(cortar(ctx, D.fonte || "Dados públicos da CBTM · projeto independente", W - 2 * M), M, H - 24);
}

const blob = () => new Promise((ok) => dialogo().querySelector("canvas").toBlob(ok, "image/png"));
async function baixar() {
  const b = await blob(), a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = `${estado.dados.arquivo || "casquinha"}.png`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function compartilhar() {
  const b = await blob();
  const arq = new File([b], `${estado.dados.arquivo || "casquinha"}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: "CASQUINHA", text: `${estado.dados.texto || ""} ${location.href}`.trim() }); } catch (e) { /* cancelado */ }
  } else baixar();
}

export async function abrirCartao(dados) {
  estado.dados = dados;
  const d = dialogo();
  const texto = encodeURIComponent(`${dados.texto || dados.nome} — ${location.href}`);
  d.querySelector('[data-acao="whatsapp"]').href = `https://wa.me/?text=${texto}`;
  d.querySelector('[data-acao="x"]').href = `https://twitter.com/intent/tweet?text=${texto}`;
  d.querySelector('[data-acao="link"]').textContent = "Copiar link";
  if (!d.open) d.showModal();
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  desenhar();
}

export const botaoCompartilhar = (id = "btn-compartilhar") =>
  `<button class="btn prim" type="button" id="${id}"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/></svg>Compartilhar</button>`;

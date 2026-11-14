// Gráficos em SVG puro, com dica (tooltip) ao passar o mouse ou tocar.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const fmt = (n, casas = 0) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));
export const pct = (p) => `${Math.round(p * 100)}%`;

// Barras verticais de distribuição (uma série, cor única). dados: [{rotulo, valor}]
export function barrasVerticais(dados, { altura = 170, unidade = "atletas" } = {}) {
  const L = 560, top = 18, base = altura - 22;
  const max = Math.max(1, ...dados.map((d) => d.valor));
  const passo = L / dados.length;
  const larg = Math.min(30, passo - 6);
  let s = `<svg viewBox="0 0 ${L} ${altura}" role="img" aria-label="Distribuição">`;
  s += `<line class="eixo" x1="0" x2="${L}" y1="${base}" y2="${base}"/>`;
  dados.forEach((d, i) => {
    const h = d.valor ? Math.max(3, ((base - top) * d.valor) / max) : 0;
    const x = i * passo + (passo - larg) / 2;
    const dica = `${esc(d.rotulo)}: <b>${fmt(d.valor)}</b> ${unidade}`;
    if (h) s += `<path d="M${x},${base} v${-(h - 4)} q0,-4 4,-4 h${larg - 8} q4,0 4,4 v${h - 4} z" fill="var(--s1)"/>`;
    if (d.valor) s += `<text class="rot" x="${x + larg / 2}" y="${base - h - 5}" text-anchor="middle">${fmt(d.valor)}</text>`;
    s += `<text x="${x + larg / 2}" y="${base + 15}" text-anchor="middle">${esc(d.rotulo)}</text>`;
    s += `<rect class="alvo" x="${i * passo}" y="${top - 10}" width="${passo}" height="${base - top + 30}" data-dica="${esc(dica)}"/>`;
  });
  return `<div class="graf">${s}</svg></div>`;
}

// Barras horizontais agrupadas. grupos: [{rotulo, valores:[n...]}], series: [{nome, cor}]
export function barrasAgrupadas(grupos, series, { maximo = 100, sufixo = "" } = {}) {
  const L = 600, rot = 110, alt = 14, gap = 2, pad = 16;
  const h = grupos.length * (series.length * (alt + gap) + pad) + 6;
  const larg = L - rot - 50;
  let s = `<svg viewBox="0 0 ${L} ${h}" role="img" aria-label="Comparação">`;
  let y = 4;
  grupos.forEach((g) => {
    const altG = series.length * (alt + gap);
    s += `<text class="rot" x="0" y="${y + altG / 2 + 4}">${esc(g.rotulo)}</text>`;
    series.forEach((se, i) => {
      const v = g.valores[i] ?? 0;
      const w = Math.max(v > 0 ? 4 : 0, (larg * v) / maximo);
      const yy = y + i * (alt + gap);
      if (w) s += `<path d="M${rot},${yy} h${w - 4} q4,0 4,4 v${alt - 8} q0,4 -4,4 h${-(w - 4)} z" fill="${se.cor}"/>`;
      s += `<text x="${rot + w + 6}" y="${yy + alt - 3}" class="num">${fmt(v, 1)}${sufixo}</text>`;
      s += `<rect class="alvo" x="${rot}" y="${yy}" width="${larg + 40}" height="${alt}" data-dica="${esc(`${se.nome} · ${g.rotulo}: <b>${fmt(v, 1)}${sufixo}</b>`)}"/>`;
    });
    y += altG + pad;
  });
  return `<div class="graf">${s}</svg></div>`;
}

export function legenda(series) {
  return `<div class="legenda">${series.map((s) => `<span><i style="background:${s.cor}"></i>${esc(s.nome)}</span>`).join("")}</div>`;
}

// Dica global: qualquer elemento com data-dica
export function ativarDicas() {
  const dica = document.getElementById("dica");
  const mostrar = (e) => {
    const alvo = e.target.closest?.("[data-dica]");
    if (!alvo) { dica.hidden = true; return; }
    dica.innerHTML = alvo.getAttribute("data-dica");
    dica.hidden = false;
    const x = Math.min(e.clientX + 14, window.innerWidth - dica.offsetWidth - 8);
    const y = Math.max(8, e.clientY - dica.offsetHeight - 12);
    dica.style.left = `${x}px`;
    dica.style.top = `${y}px`;
  };
  document.addEventListener("mousemove", mostrar);
  document.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (t) mostrar({ clientX: t.clientX, clientY: t.clientY, target: e.target });
  }, { passive: true });
  document.addEventListener("scroll", () => (dica.hidden = true), { passive: true });
}

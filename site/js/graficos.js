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

// Linha do tempo (uma série) com faixa opcional e pontos com dica.
// pontos: [{x: 'AAAA-MM-DD', y, rotulo}], faixa: [{x, lo, hi}] (projeção)
export function linhaTempo(pontos, { faixa = [], referencias = [], altura = 220, formatoY = (v) => fmt(v) } = {}) {
  const L = 640, esq = 46, dir = 12, topo = 14, base = altura - 24;
  const todos = [...pontos.map((p) => p.y), ...faixa.flatMap((f) => [f.lo, f.hi]), ...referencias.map((r) => r.y)];
  if (!todos.length) return "";
  let min = Math.min(...todos), max = Math.max(...todos);
  if (max - min < 50) { min -= 25; max += 25; }
  const pad = (max - min) * 0.08; min -= pad; max += pad;
  const datas = [...pontos.map((p) => Date.parse(p.x)), ...faixa.map((f) => Date.parse(f.x))];
  const t0 = Math.min(...datas), t1 = Math.max(...datas, t0 + 864e5);
  const X = (d) => esq + ((Date.parse(d) - t0) / (t1 - t0)) * (L - esq - dir);
  const Y = (v) => base - ((v - min) / (max - min)) * (base - topo);
  let s = `<svg viewBox="0 0 ${L} ${altura}" role="img" aria-label="Evolução">`;
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    s += `<line class="eixo" x1="${esq}" x2="${L - dir}" y1="${Y(v)}" y2="${Y(v)}" stroke-dasharray="${i ? "2 4" : ""}"/><text x="${esq - 6}" y="${Y(v) + 4}" text-anchor="end">${formatoY(Math.round(v))}</text>`;
  }
  const anos = new Set(pontos.map((p) => p.x.slice(0, 4)));
  for (const a of anos) { const x = X(`${a}-01-01`); if (x > esq && x < L - dir) s += `<text x="${x}" y="${altura - 6}" text-anchor="middle">${a}</text><line class="eixo" x1="${x}" x2="${x}" y1="${base}" y2="${base + 4}"/>`; }
  for (const r of referencias) s += `<line x1="${esq}" x2="${L - dir}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="var(--mut)" stroke-dasharray="5 4"/><text x="${L - dir}" y="${Y(r.y) - 4}" text-anchor="end" class="rot">${esc(r.rotulo)}</text>`;
  if (faixa.length) {
    const ida = faixa.map((f) => `${X(f.x)},${Y(f.hi)}`).join(" ");
    const volta = [...faixa].reverse().map((f) => `${X(f.x)},${Y(f.lo)}`).join(" ");
    s += `<polygon points="${ida} ${volta}" fill="var(--s1)" opacity=".16"/>`;
    s += `<polyline points="${faixa.map((f) => `${X(f.x)},${Y(f.mid)}`).join(" ")}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-dasharray="6 4"/>`;
  }
  if (pontos.length) s += `<polyline points="${pontos.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>`;
  for (const p of pontos) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="var(--s1)" stroke="var(--card)" stroke-width="2"/><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="9" fill="transparent" data-dica="${esc(p.rotulo)}"/>`;
  for (const f of faixa) s += `<circle cx="${X(f.x)}" cy="${Y(f.mid)}" r="9" fill="transparent" data-dica="${esc(f.rotulo || "")}"/>`;
  return `<div class="graf">${s}</svg></div>`;
}

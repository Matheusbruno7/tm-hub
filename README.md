# CASQUINHA (tm-hub)

**CASQUINHA** é o site que reúne os módulos do projeto de tênis de mesa:

| Módulo | Repositório | Status no site |
|---|---|---|
| Ranking de Clubes, comparação e simulador | `tm-clubes` | **no ar** |
| Ranking/rating de atletas, previsões, metas e torneios a priorizar | `tm-ranking` | em breve |
| Pontos logo após as partidas | `tm-pontos-ao-vivo` | em breve |
| Campeonatos informais | (futuro) | guardado em `docs/futuro/campeonatos.md`, sem link no site |

## Estrutura
```
site/              site estático (HTML, CSS e JavaScript puro, sem build)
  index.html
  css/app.css
  js/app.js        telas e roteamento (#/clubes, #/comparar, #/simulador, #/metodologia)
  js/dados.js      leitura dos dados e modelo do simulador
  js/graficos.js   gráficos em SVG
  dados/           cópia dos arquivos publicados pelo tm-clubes
scripts/sincronizar_dados.sh
docs/futuro/       ideias guardadas que ainda não aparecem no site
```

## Ver localmente
```bash
scripts/sincronizar_dados.sh ../tm-clubes   # ou sem argumento, para baixar do GitHub
python3 -m http.server -d site 8000         # abra http://localhost:8000
```

## Publicação (GitHub Pages)
O workflow `.github/workflows/publicar.yml` baixa os dados do `tm-clubes` e
publica a pasta `site/`. Ele roda a cada push e toda segunda-feira, depois da
atualização semanal dos dados.

Para ativar uma vez: **Settings → Pages → Source: GitHub Actions**.

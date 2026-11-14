# Campeonatos informais (guardado para depois)

> **Status:** adiado. Este documento guarda o que foi definido. Não há link
> para ele no site, e ele pode ser movido para um repositório próprio quando
> o trabalho for retomado.

## Objetivo
Ferramenta para criar campeonatos **informais** de tênis de mesa: inscrições,
sorteio, grupos, mata-mata e placares. Atletas federados e não federados
podem participar.

## Decisões já tomadas
- **Quem opera:** um único organizador lança os resultados no dia.
- **Atletas:** busca no ranking/rating da CBTM para preencher os dados
  (nome, clube, estado, rating) ou cadastro manual com a marcação "não federado".
- **Opção por campeonato:** "aceita só federados: sim/não".
- **Separado dos pontos oficiais:** os campeonatos informais não alteram
  rating nem ranking. A calculadora de pontos vale só para eventos oficiais.

## Funcionalidades previstas
1. **Campeonato → categorias** (idade, gênero, classes paralímpicas), com
   formato próprio por categoria.
2. **Inscrições:** pelo ranking ou manuais.
3. **Sorteio de grupos:** cabeças de chave pelo rating, distribuição em
   "serpentina" e, quando possível, sem dois atletas do mesmo clube no mesmo grupo.
4. **Fase de grupos:** tabela de jogos automática e classificação com os
   desempates da ITTF: vitórias, depois confronto entre os empatados, saldo de
   sets e de pontos.
5. **Mata-mata:** montado a partir dos classificados (1º de um grupo × 2º de
   outro), com chave visual.
6. **Placares:** melhor de 5 ou de 7 sets. O vencedor avança automaticamente.
7. **Visualização pública** pelo celular.

## Integração com o hub
- Reaproveitar a base de atletas do `tm-clubes` e do `tm-ranking` para a
  busca de atletas e os cabeças de chave.
- O simulador de confrontos do `tm-clubes` pode prever os jogos do campeonato.

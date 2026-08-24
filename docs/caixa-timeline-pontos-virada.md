# Completação da Experiência Executiva — Caixa, Timeline e Pontos de Virada

> Continuação de [integracao-pipeline-estrategico.md](./integracao-pipeline-estrategico.md).
> Nenhum novo motor de domínio; nenhuma fórmula alterada; `calculo.ts`
> intocado. 663 testes passando (640 + 23 novos), `tsc -b` limpo,
> `vite build` bem-sucedido. Trabalho restrito a `application/` e
> `presentation/`.

## A. ViewModel de Caixa

`presentation/viewModels/caixa.ts::construirCaixaExecutivoViewModel`
consome `ResultadoImpactoCaixa` (splitPayment) diretamente. Preserva as
distinções de domínio: `reducaoDisponibilidade` (nunca "perda"),
`capitalGiroAdicional` (nunca "novo tributo"), `picoCapitalGiro`,
`periodoPico` (só quando `mesPicoCapitalGiro` já existe no domínio —
nunca derivado na UI), `custoFinanceiro`. Cada métrica é uma
`MetricaCaixa { disponivel, valor?, motivo? }`.

## B. Partial success

Três níveis de `status`: `"disponivel"` (todas as 4 métricas
calculadas), `"parcial"` (algumas — ex.: capital calculado, custo
financeiro indisponível por falta de taxa) e `"indisponivel"` (sem
`ResultadoImpactoCaixa` — premissas de split ausentes, OU
`disponivel: false` no domínio). `indisponivel` NUNCA produz `0` em
nenhuma métrica — testado explicitamente (seção 51/52).

## C. Timeline 2026-2033

`presentation/viewModels/timeline.ts::construirTimelineViewModel`
consome `ResultadoCenario` (todos os anos já calculados) +
`HorizonteDecisao` — reaproveitado de
`motorDecisao/temporal.ts::decidirRegimeTributarioNoHorizonte`, já
existente (nenhuma segunda lógica de decisão). A orquestração
(`application/analiseEstrategica/motor.ts`) só ganhou um campo opcional
`incluirHorizonte` que, quando `true`, chama essa função já existente —
isso NÃO é um motor novo, é reuso de uma etapa opcional (seção 2/9).

## D. Indicadores anuais

Um item por ano (`TimelineAnoViewModel`): `carga`, `margem`,
`resultado`, `capitalGiroAdicional` — todos como `IndicadorAno {
disponivel, valor? }`. O regime de referência de cada ano é
`decisoesPorAno[ano].alternativaPreferida` (nunca inventado); quando a
decisão daquele ano não aponta uma alternativa (conflito/dados
insuficientes), TODOS os indicadores daquele ano ficam
`disponivel: false` — nunca herdados do ano anterior (seção 11,
testado explicitamente na seção 54).

## E. Mudanças discretas

`marcos: string[]` — comparação simples entre anos consecutivos
(`statusDecisao`, `alternativaPreferida`, `regimeComparavel`), gerando
frases como "Houve mudança de conclusão." Nunca infere CAUSA (seção 20,
testado: nenhum marco contém "porque"/"causa").

## F. Pontos de Virada

`presentation/viewModels/pontosVirada.ts::construirPontosViradaViewModel`
consome `ResultadoPontoVirada[]` (motorPontosVirada) diretamente — cada
ponto preserva `antes`/`depois` (nunca convertidos em previsão — seção
23, testado), unidade (`reais`/`percentual`/`indice`) mapeada por
variável. Ordenação puramente por período e depois por variável — nunca
um score de importância inventado (seção 30).

## G. Estados indeterminados

`status: "resultado_indeterminado"`/`"dados_insuficientes"` preservam
`intervaloIndeterminado { min, max }` quando disponível — nunca força
uma fronteira única (seção 28, testado). `status: "multiplos_pontos"`
preserva `outrosPontos[]`, todos os intervalos candidatos, nenhum
privilegiado (seção 29, testado).

## H. Responsividade

`TimelineEstrategica` usa `overflow-x: auto` com cards de largura
mínima fixa (`minWidth: 180`) — scroll horizontal no mobile em vez de
comprimir 8 anos ilegíveis (seção 38). `SecaoImpactoCaixa`/
`SecaoPontosVirada` usam `grid-template-columns: repeat(auto-fit,
minmax(...))`, que empilha naturalmente em telas estreitas — nenhum
CSS novo fora do design system, nenhuma biblioteca de gráfico
instalada (seção 68: zero dependências novas).

## I. Acessibilidade

Timeline usa `role="list"`/`role="listitem"` com `aria-label`;
headings (`<h4>`) coerentes por card; `DetailToggle` (já existente no
design system) para detalhes expansíveis, preservando foco/teclado.
Nenhum indicador depende só de cor — todos têm rótulo textual.

## J. Testes

23 testes novos: `caixa.test.ts` (8 — disponível, indisponível nunca
zero, parcial com custo financeiro ausente, premissas visíveis,
qualidade herdada), `timeline.test.ts` (6 — 8 pontos ordenados, ano sem
dado nunca herda do anterior, marcos sem inferir causa, sem
`scoreConsolidado` nesta versão, qualidade herdada),
`pontosVirada.test.ts` (6 — antes/depois preservados, múltiplos pontos,
região indeterminada, Fator R/preço nunca prescritivos, ordenação
determinística), e 3 testes de integração em
`application/analiseEstrategica/__tests__/motor.test.ts` (horizonte
opcional, partial success com caixa indisponível + timeline/decisão
disponíveis).

## K. Limitações conhecidas

1. **Score por ano não incluído na Timeline** — calcular
   `ScoreEstrategico` para cada um dos 8 anos exigiria uma etapa
   adicional no orquestrador (`gerarScoresEstrategicos` por ano); esta
   fase manteve o Score no nível de ano único (seção 3 da fase
   anterior), documentado explicitamente no contrato (`TimelineAnoViewModel`
   não tem campo de score) em vez de fingir um "—" genérico misturado
   com dados reais.
2. **Nenhum ponto de virada é auto-configurado pela página** — a
   seção "Pontos que podem mudar a decisão" só exibe conteúdo quando
   `opcoes.pontosVirada` é explicitamente configurado por quem chama o
   orquestrador. A página `AnaliseEstrategica.tsx` ainda não configura
   nenhuma busca (definir limites de busca — ex.: faturamento ±50% —
   seria uma escolha de produto, não um dado; optei por não inventar
   esses limites nesta fase). O ViewModel/componente estão prontos e
   testados; falta só a decisão de produto sobre quais buscas
   configurar por padrão.
3. **`periodoPico` não é reformatado para "Março/2028"** — o domínio
   só produz o número do mês (1-12); o componente mapeia para o nome
   do mês, mas o ano do pico não está disponível separadamente no
   contrato de `ResultadoImpactoCaixa` (é sempre o mesmo ano da
   análise) — sem invenção, só uma limitação de granularidade do
   contrato de origem.
4. **IA Consultiva, Memória Técnica, Modo Apresentação e revisão do
   Wizard continuam fora de escopo**, conforme instrução explícita.

## Próximas etapas

IA Consultiva visual, Memória Técnica, Modo Apresentação, revisão do
Wizard — nesta ordem, conforme já planejado nas fases anteriores.

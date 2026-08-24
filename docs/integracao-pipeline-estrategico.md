# Integração Ponta a Ponta do Pipeline Estratégico

> Continuação da fase de consolidação da experiência executiva
> (`src/presentation/`). Prova que um `CenarioEmpresa` real percorre o
> pipeline estratégico completo dentro da aplicação — **sem substituir
> o pipeline legado**. 640 testes passando (624 + 16 novos), `tsc -b`
> limpo, `vite build` bem-sucedido.

## A. Situação anterior

Pipeline legado (`calculo.ts` → `ResultadoSimulacao` → `ResultadoExecutivo`/`Analises.tsx`,
alimentado por `ClienteDataContext`) continua **100% intocado e
funcional**. Nenhuma das ~15 fases de domínio construídas nas sessões
anteriores (`CenarioEmpresa` → `motorRegimes` → ... →
`otimizacaoMultidimensional`) estava conectada a qualquer rota real —
confirmado por auditoria: todos os `simular()` calls (Publico.tsx,
ImportarSped.tsx) e toda a UI (`Analises.tsx`, `ResultadoExecutivo.tsx`)
usam exclusivamente `SimulacaoInput`/`ResultadoSimulacao`.

## B. Arquitetura de integração

```
ClienteData (contexto legado)
      ↓ adapter isolado
CenarioEmpresa
      ↓ orquestrador de aplicação
AnaliseEstrategicaCompleta
      ↓ ViewModels (presentation/)
PaginaAnaliseEstrategicaViewModel
      ↓
AnaliseEstrategica.tsx (rota /analises/estrategica)
```

## C. Orquestrador

`src/application/analiseEstrategica/motor.ts::executarAnaliseEstrategica`
— síncrono (todos os motores são funções puras síncronas, seção 34 do
pedido: nenhuma infraestrutura de job foi criada). Chama, na ordem:
`executarCenario` (motorCenarios — já orquestra regimes + comparador +
financeiro + caixa/split juntos, reaproveitado sem duplicação) →
`buscarPontoVirada` (opcional) → `gerarRelatorioAuditoriaEstrategica` →
`gerarPlanoAlternativasEstrategicas` → `decidirRegimeTributario` →
`gerarPlanoAcao` → `gerarScoresEstrategicos` → `otimizar` (opcional).
Nenhuma fórmula de tributo/margem/capital de giro/score/decisão/Pareto
existe neste arquivo — só chamadas aos módulos já existentes.

## D. Contrato agregado

`AnaliseEstrategicaCompleta` (tipos.ts) — cada campo (`resultadoCenario`,
`relatorioAchados`, `planoEstrategico`, `decisao`, `planoAcao`, `scores`,
`otimizacao`) é uma REFERÊNCIA direta ao contrato original do motor
correspondente — nenhum "Mega DTO" com campos copiados/reformatados
(seção 6/7 do pedido). Cada dimensão tem um `EstadoDimensao` próprio
(`disponivel`/`parcial`/`indisponivel`/`erro`/`nao_aplicavel`) — nunca
um booleano.

## E. Entrada do `CenarioEmpresa`

Via `useClienteData()` (contexto legado já existente) +
`adaptarClienteLegadoParaCenarioEmpresa` — **não é fixture**: reaproveita
o `SimulacaoInput` já preenchido pelo wizard legado
(`ImportarSped.tsx`/`Publico.tsx`) como fonte real.

## F. Adapter legado

`src/application/analiseEstrategica/adapters/legadoParaCenarioEmpresa.ts`
— isolado, nunca espalhado pelo domínio (seção 21). Preenche
`identificacao.nomeEmpresa`, `receita.faturamentoAnual`,
`receita.mixMercado.b2b/b2c`, `tributario.regimeAtual`,
`tributario.premissas.pisCofinsPercentualAtual/icmsIpiPercentualAtual`,
`economicoFinanceiro.meioPagamentoPredominante` — todos diretos do
`SimulacaoInput`, sem reformulação. **Nunca inventa**: `pessoas.*`
(FS12), `custos.itens` (crédito por categoria), premissas de split,
saldos/ajustes fiscais do Lucro Real ficam ausentes, com cada perda
documentada em `ResultadoAdapterLegado.perdas` (testado: seção 47).

## G. Status por dimensão

`EstadoDimensao { status, motivo? }` — `regimes_comparador` é a ÚNICA
dependência essencial (`erro` aqui bloqueia toda a análise, seção 15);
todo o resto é opcional. `indisponivel` (dado ausente, ex.: sem
premissa de split) é sempre diferente de `erro` (exceção inesperada) —
testado.

## H. Partial success

Testado explicitamente (seção 44): caixa `indisponivel` nunca impede
achados/decisão/score de ficarem `disponivel`. Falha isolada em
otimização (seção 45, grade excessiva → `LimiteComputacionalExcedidoError`)
produz `statusOtimizacao: "erro"` sem afetar `statusDecisao`/`statusScore`.

## I. Nova rota

`/analises/estrategica` — registrada em `App.tsx`, dentro do mesmo
`AppShell`. Não há convenção de `:id` em nenhuma rota existente (app
tem um único `ClienteData` em memória por sessão), então a nova rota
segue o MESMO padrão sem id, em vez de introduzir uma convenção nova
isolada. Acesso via botão "Ver análise estratégica →" em `/analises`
(legado permanece a rota padrão, sem redirecionamento).

## J. Componentes integrados

`AnaliseEstrategica.tsx` monta, condicionalmente à disponibilidade:
`VisaoGeralExecutiva`, `ComparacaoRegimesTabela`, `SecaoScoreEstrategico`,
`SecaoPlanoAcao`, `SecaoParetoFronteira` — todos já criados na fase
anterior, reaproveitados sem alteração.

## K. Relação com ViewModels

`src/presentation/viewModels/analiseEstrategica.ts::construirPaginaAnaliseEstrategicaViewModel`
é a ÚNICA função que traduz `AnaliseEstrategicaCompleta` para os
ViewModels já existentes (`decisao.ts`, `resumoExecutivo.ts`,
`comparacaoRegimes.ts`, `score.ts`, `pareto.ts`, `planoAcao.ts`) — a
página `AnaliseEstrategica.tsx` NUNCA constrói apresentação própria
(seção 49, testado: os testes do orquestrador+página passam pelos
mesmos ViewModels da fase anterior, sem segunda lógica).

## L. Tratamento de erros

Falha essencial (`statusRegimesComparador: "erro"`) → página mostra
"Não foi possível concluir a análise estratégica (...). O resultado
tradicional continua disponível" (seção 37). Falhas parciais (ex.:
caixa indisponível) → `Alert` informativo, página continua renderizando
o resto (seção 38).

## M. Legado preservado

Nenhuma rota/componente/hook legado foi removido ou redirecionado.
`Analises.tsx` só recebeu um botão adicional de navegação. `calculo.ts`,
`panorama.ts`, `ResultadoSimulacao`, o wizard (`ImportarSped.tsx`,
`Publico.tsx`) — todos intocados. Suíte legada (testes de `calculo.ts`,
`sped/*`, `apresentacao/*`) continua passando integralmente.

## N. Testes

16 testes novos: `src/application/analiseEstrategica/__tests__/motor.test.ts`
(orquestrador completo, cenário mínimo, partial success, falha opcional
isolada, falha essencial, imutabilidade, condição preservada
ponta-a-ponta, conflito/obrigação sem distorção, indisponível ≠ zero,
Score/Pareto não alteram decisão) e `adapter.test.ts` (adapter nunca
inventa FS12/custos/split, campos reais chegam sem reformulação).

## O. Limitações conhecidas

1. **Decisão limitada à família de regime tributário** — o orquestrador
   chama só `decidirRegimeTributario`; as decisões de preço/Fator R
   (`motorDecisao/precoFatorR.ts`) não foram conectadas nesta
   integração (ficam para quando a UI precisar delas).
2. **Sem loading real** — como a execução é síncrona e rápida (motores
   puros, sem I/O), não há estado de "carregando" com macroetapas; se o
   pipeline crescer (cache, persistência, chamadas externas), esse
   estado precisará ser adicionado.
3. **IA Consultiva não é chamada** — conforme instrução explícita (seção
   29/30), a página não depende de nenhuma chamada de IA.
4. **Uma única análise em memória por vez** — segue a arquitetura atual
   do `ClienteDataContext` (sem lista/histórico de análises); não criei
   persistência nem cache (seção 33).
5. **Adapter perde FS12/custos por categoria/split/ajustes fiscais** —
   documentado explicitamente em `perdas[]` e exibido na página; Fator R
   e capital de giro ficam indisponíveis para análises originadas do
   legado até que o wizard seja revisado (fora de escopo desta fase).

## P. Próximas etapas

Caixa completo, Timeline 2026-2033, Pontos de Virada na UI, IA
Consultiva visual, Memória Técnica, Modo Apresentação, revisão do
Wizard — todas explicitamente adiadas por esta instrução. Só depois da
validação desta prova ponta a ponta: decisão sobre descontinuação do
pipeline legado.

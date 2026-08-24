# Otimização Multidimensional

> Continuação de [score-estrategico.md](./score-estrategico.md).
> **Nenhum motor determinístico foi alterado nem importa este módulo**
> (verificado por grep). `calculo.ts` intocado. Nenhuma IA, Plano de
> Ação automático ou UI. 597 testes passando (584 + 13 novos), `tsc`
> limpo. Princípio: busca, dentro de limites explicitamente informados,
> combinações de variáveis já suportadas pelo Motor de Cenários, e
> localiza a fronteira de Pareto entre objetivos configurados — **nunca
> escolhe uma solução como "melhor"**. Essa responsabilidade permanece
> com `motorDecisao`.

## A. Arquitetura

```
src/engine/otimizacaoMultidimensional/
  tipos.ts        — Objetivo, VariavelOtimizacao, PontoAvaliado, ResultadoOtimizacao
  grade.ts          — produto cartesiano com trava computacional dura (MAX_COMBINACOES)
  objetivos.ts        — extrai valores de objetivo de ResultadoCenario já calculado
  restricoes.ts         — restrição jurídica lida do Comparador Consolidado
  pareto.ts               — dominância só sobre objetivos brutos, nunca sobre Score
  motor.ts                 — otimizar(): orquestra tudo acima
```

Fluxo: `VariavelOtimizacao[]` (limites explícitos) → `gerarGrade` →
para CADA combinação, `executarCenario` (motorCenarios, nunca uma
fórmula paralela) → `avaliarRestricaoJuridica` (Comparador Consolidado)
→ `extrairObjetivo` (leitura de `ResultadoRegime`/
`ResultadoAnoEconomicoFinanceiro`/`ResultadoImpactoCaixa` já
calculados) → `calcularFronteiraPareto`.

## B. Toda combinação passa pelo Motor de Cenários

`motor.ts::otimizar` chama `executarCenario` para CADA ponto da grade —
nenhuma fórmula fiscal/econômica/financeira paralela existe neste
módulo (testado: cada `PontoAvaliado.resultado` é um `ResultadoCenario`
completo com `resultadoRegimes` populado). Combinações rejeitadas por
`executarCenario` (`status: "erro_validacao"` — ex.: percentual fora de
0-100%) são contabilizadas em `combinacoesDescartadasPorIndisponibilidade`,
nunca silenciosamente ignoradas.

## C. Restrições jurídicas

`restricoes.ts::avaliarRestricaoJuridica` lê `ResumoComparativoRegimeAno`
(Comparador Consolidado) — combinações cujo regime-alvo fica
`"nao_comparavel"`/`"indeterminado"` são marcadas `bloqueadoJuridicamente:
true` e EXCLUÍDAS da fronteira de Pareto (nunca avaliadas como solução
válida — testado: faturamento que ultrapassa o limite do Simples é
excluído).

## D. Limites das variáveis nunca são inventados

`VariavelOtimizacao { variavel, min, max, passos }` — todos os três
campos são OBRIGATÓRIOS e vêm de quem chama; `grade.ts::gerarGrade`
usa exatamente esses valores via `linspace`, sem nenhum padding ou
valor default (testado: grade com `min: 100_000, max: 200_000,
passos: 3` produz exatamente `[100000, 150000, 200000]`).

## E. `indeterminado` nunca vira zero

`objetivos.ts::extrairObjetivo` retorna `{ disponivel: false }` sem
`valor` quando o dado de origem (`ResultadoRegime.disponivel`,
`ResultadoAnoEconomicoFinanceiro.resultado`,
`ResultadoImpactoCaixa.picoCapitalGiroAdicional`) não existe — testado
explicitamente (sem premissa de split, o objetivo de capital de giro
fica `disponivel: false`/`valor: undefined` em TODOS os pontos, nunca
0). `pareto.ts::domina` exclui da comparação qualquer objetivo
indisponível em qualquer um dos dois pontos do par.

## F. Pareto considera todos os objetivos configurados

`calcularFronteiraPareto(pontos, objetivos)` — um ponto só é removido
da fronteira quando outro o domina em TODOS os objetivos comparáveis
(igual ou melhor) E estritamente melhor em pelo menos um. Testado:
dois objetivos genuinamente conflitantes preservam AMBOS os pontos na
fronteira; dominância clara remove o ponto dominado.

## G. Trade-offs permanecem na fronteira

Nenhuma agregação/soma pondera os objetivos dentro de `pareto.ts` — a
fronteira é a lista de pontos NÃO DOMINADOS, preservando a divergência
dimensional intacta (mesmo princípio já estabelecido no Motor de
Decisão para `conflito_nao_resolvido`, seção reaproveitada
conceitualmente, não uma cópia de código).

## H. Score não interfere na dominância

`pareto.ts::domina`/`calcularFronteiraPareto` recebem exclusivamente
`PontoAvaliado.objetivos` (valores brutos de carga/resultado/capital de
giro) — a assinatura da função NUNCA aceita nem lê nenhum
`ScoreEstrategico` (testado). `objetivos.ts` menciona
`scoreEstrategico/dimensoes/dados.ts` só em COMENTÁRIO de documentação
(o mesmo padrão de coleta é reaproveitado conceitualmente), sem
nenhuma dependência real de código — confirmado por grep.

## I. Nenhuma solução Pareto é chamada de "melhor"

O contrato (`tipos.ts`) não possui nenhum campo
`melhorSolucao`/`solucaoRecomendada`/similar — `PontoParetoFronteira`
só contém o `PontoAvaliado`. Testado: `JSON.stringify(fronteiraPareto)`
nunca contém a palavra "melhor".

## J. Baseline continua imutável

`otimizar` nunca muta `cenarioBase` — cada combinação passa por
`executarCenario`, que já usa `aplicarAlteracoes` (motorCenarios/patch.ts,
`structuredClone`) internamente. Testado: `cenarioBase` permanece
byte-a-byte idêntico após uma otimização completa.

## K. Limites computacionais evitam explosão combinatória

`grade.ts::MAX_COMBINACOES = 2000` — trava dura explícita. Excedê-la
lança `LimiteComputacionalExcedidoError` ANTES de qualquer execução
(nunca trunca silenciosamente parte do espaço de busca, o que
esconderia que uma região não foi avaliada). Testado.

## L. Metodologia versionada e auditável

`ResultadoOtimizacao.metodologiaId` (`"VGR_OTIMIZACAO"`) +
`metodologiaVersao` (`"V1"`) + `contextHash` (hash simples, não
criptográfico, dos parâmetros de entrada) sempre presentes — mesma
disciplina de auditabilidade já usada em `scoreEstrategico`/
`iaConsultiva`.

## M. `calculo.ts` e motores existentes permanecem intactos

Verificado por grep: nenhum arquivo fora de
`src/engine/otimizacaoMultidimensional/` importa este módulo — a
otimização é estritamente uma camada de CONSUMO sobre
`motorCenarios`/`motorRegimes`/tipos.

## N. Testes

13 testes em `src/engine/otimizacaoMultidimensional/__tests__/motor.test.ts`,
organizados diretamente pelos critérios de validação desta fase: toda
combinação passa pelo Motor de Cenários; restrição jurídica bloqueia
combinações reais (Simples acima do limite de faturamento); limites
nunca inventados (grade exata); indeterminado nunca vira zero; Pareto
preserva trade-offs com múltiplos objetivos; dominância clara remove o
ponto dominado; Score não interfere na dominância; nenhuma solução é
"melhor"; baseline imutável; limite computacional lança erro
estruturado; metodologia versionada; determinismo.

## O. Limitações conhecidas

1. **Apenas 3 objetivos na V1** (`minimizar_carga_fiscal`,
   `maximizar_resultado_economico`, `minimizar_capital_giro_adicional`)
   — a união `Objetivo` é fechada; adicionar um objetivo (ex.: margem,
   custo financeiro) exige estender `objetivos.ts::extrairObjetivo` e
   `DIRECAO_POR_OBJETIVO`, sem alterar `pareto.ts`.
2. **Um único regime por execução** — `otimizar` recebe `regime` +
   `motorRegime` fixos; comparar a fronteira de Pareto ENTRE regimes
   diferentes não foi implementado nesta fase (ficaria mais próximo de
   uma composição futura: rodar `otimizar` uma vez por regime e
   comparar as fronteiras resultantes, sem exigir mudança neste
   módulo).
3. **Mesclagem de alterações (`mesclarAlteracoes`) assume que cada
   `VariavelSensibilidade` mapeia para uma subchave distinta** dentro
   de cada grupo de `AlteracoesCenario` — verdadeiro para as 8
   variáveis atualmente suportadas por `motorCenarios/sensibilidade.ts`;
   se uma variável futura colidir com a mesma subchave de outra no
   mesmo combo, a mesclagem shallow por grupo precisaria ser revisada.
4. **`MAX_COMBINACOES = 2000` é um valor único fixo**, não configurável
   por chamada nesta fase — documentado como trava de segurança, não
   uma escolha metodológica sobre performance aceitável para cada caso
   de uso.
5. **Nenhuma paralelização** — a grade é avaliada sequencialmente;
   como cada `executarCenario` já é rápido (motores puramente
   determinísticos, sem I/O), não houve necessidade demonstrada de
   otimizar isso nesta fase.

## P. Próxima etapa recomendada

Com a cadeia completa —
`ANALISAR → DIAGNOSTICAR → COMPARAR → DECIDIR → EXPLICAR → OPERACIONALIZAR
→ SINTETIZAR (Score) → EXPLORAR (Pareto)` — implementada e testada de
ponta a ponta, a recomendação explícita do usuário é NÃO criar
imediatamente outra camada de motor, e sim consolidar a plataforma e
conectar a experiência executiva do produto: Diagnóstico → Comparação
de regimes → Impacto em margem → Impacto em caixa → Cenários → Pontos
de virada → Achados → Alternativas → Decisão → Plano de ação → Score →
Fronteira de Pareto — todos já implementados e testados no domínio,
prontos para serem conectados à interface.

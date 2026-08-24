# Auditoria Estratégica Automatizada / Motor de Achados

> Continuação de [motor-pontos-virada.md](./motor-pontos-virada.md).
> **Nenhum motor fiscal/financeiro/caixa/cenários/pontos-de-virada foi
> alterado. `calculo.ts` intocado.** Nenhuma UI, IA ou Score. 498 testes
> passando (485 + 13 novos), `tsc` limpo. Princípio: "Os motores
> determinísticos produzem números. O Motor de Achados transforma esses
> números em fatos relevantes." — nunca "o que fazer?".

## A. Arquitetura

```
src/engine/motorAchados/
  tipos.ts          — AchadoEstrategico, RelatorioAuditoriaEstrategica
  fiscal.ts          — carga/comparabilidade/elegibilidade (lê ResultadoRegime)
  creditos.ts         — índice de crédito (reaproveita agregarCreditoPorSistema)
  fatorR.ts            — Fator R (reaproveita calcularFs12Anual/calcularRbt12MensalDoAno/LIMITE_FATOR_R)
  financeiroCaixa.ts     — adapters: AchadoFinanceiro/AchadoCaixa → AchadoEstrategico
  divergencias.ts          — achados cruzados (tributo × margem × caixa)
  cenarios.ts                — adapter: ComparacaoCenarios → AchadoEstrategico
  pontosVirada.ts              — adapter: ResultadoPontoVirada → AchadoEstrategico
  dedup.ts                      — deduplicação preservando evidências
  cobertura.ts                   — disponível/indisponível por dimensão
  motor.ts                        — gerarRelatorioAuditoriaEstrategica: orquestra tudo
```

Cada arquivo de achado (`fiscal.ts`, `creditos.ts`, `fatorR.ts`) só LÊ
resultados já produzidos pelos motores existentes; os adapters
(`financeiroCaixa.ts`, `cenarios.ts`, `pontosVirada.ts`) apenas
convertem achados JÁ PRODUZIDOS (`AchadoFinanceiro`, `AchadoCaixa`,
`ComparacaoCenarios`, `ResultadoPontoVirada`) para o contrato universal
— nenhum cálculo fiscal/econômico/financeiro/caixa/cenário/ponto-de-virada
próprio (seção 1/2 do pedido).

## B. Taxonomia

Mapeamento de fontes existentes já consolidadas nesta fase:
`motorFinanceiro/achados.ts::AchadoFinanceiro` (margem, reajuste),
`motorFinanceiro/splitPayment/achados.ts::AchadoCaixa` (caixa, capital de
giro), `motorCenarios/achados.ts` (mudança de estado entre pontos de
sensibilidade — consultado indiretamente via `comparacao.ts`),
`motorPontosVirada/tipos.ts::AchadoPontoVirada`. `panorama.ts` e
`oportunidadesParceiros.ts` (legados, sobre o pipeline SPED/`SimulacaoInput`
antigo) **não foram integrados** — já contêm texto de recomendação
explícita ("conversar com fornecedores", "vale comparar regime
híbrido"), incompatível com o princípio desta fase (seção 51); ver
Limitações (seção N).

## C. Contrato `AchadoEstrategico`

`tipos.ts` — código estruturado (`CodigoAchadoEstrategico`, union
fechada, nunca string livre), categoria (`CategoriaAchado`), valor +
unidade objetivos, período/regime/atividade/cenarioId de contexto,
`evidencias[]` (origem + referência + valor), `qualidade` (herdada,
nunca promovida), `premissas`, `origens` (proveniência preservada, nunca
substituída por "motor_achados"), `status`, `severidadeTecnica` (opcional,
só com fundamento objetivo — `bloqueante`/`informacao_insuficiente`/
`juridicamente_invalido`, nunca "crítico"/"alto risco").

## D. Fontes de achados existentes reutilizadas

`ResultadoRegime` (carga, elegibilidade, qualidade),
`ResultadoComparacaoConsolidado` (comparabilidade),
`ResultadoAnoEconomicoFinanceiro.achados` (margem),
`ResultadoImpactoCaixa.achados` (caixa/capital de giro),
`ComparacaoCenarios` (motorCenarios/comparacao.ts),
`ResultadoPontoVirada` (motorPontosVirada). Fator R e créditos usam
funções exportadas dos motores reais (`calcularFs12Anual`,
`calcularRbt12MensalDoAno`, `LIMITE_FATOR_R`, `agregarCreditoPorSistema`)
em vez de duplicar a lógica — a comparação "distância ≥/< 0" para
afirmar "abaixo"/"acima" do limite é a mesma leitura que qualquer achado
exige (seção 2/19), não uma segunda regra tributária.

## E. Evidências e proveniência

Todo achado carrega `evidencias[]` com a origem exata (`motor_fiscal`,
`comparador_consolidado`, `motor_financeiro`, `motor_split_payment`,
`motor_cenarios`, `motor_pontos_virada`, `motor_creditos`) e a
referência ao campo lido — nunca substituída por "motor_achados" (seção
11). `origens` preserva a proveniência do dado de entrada
(`classificacao_vgr` nesta fase, já que todos os cenários de teste usam
essa origem — o campo aceita qualquer `OrigemInformacao` existente).

## F. Qualidade

Cada achado herda a qualidade do resultado de origem
(`qualidadeParaAchado` em `financeiroCaixa.ts` mapeia
alta/media/baixa/parcial/insuficiente → o mesmo vocabulário do achado) —
nunca promovida (testado implicitamente: um achado de margem com
`qualidade: "insuficiente"` no Motor Financeiro nunca aparece como
achado `"alta"`). A qualidade GERAL do relatório é o PIOR veredito entre
todos os achados (`piorQualidadeGeral`), mesmo padrão de
`motorCenarios/qualidade.ts::piorQualidade` — nunca uma média.

## G. Premissas

Achados condicionados a premissa (split, repasse, margem-alvo, baseline
de cenário) sempre carregam a premissa em `premissas` — nunca só o
resultado. Exemplo: achados de cenário (`cenarios.ts`) sempre trazem
`premissas.baselineId` explícito (seção 45).

## H. Deduplicação

`dedup.ts::deduplicarAchados` agrupa por
`codigo|regime|ano|cenarioId|atividade|premissas` — dois achados
IDÊNTICOS nessa chave são consolidados em um só, com evidências
COMBINADAS (nunca perdidas) e qualidade = pior das duas fontes. Achados
com premissas DIFERENTES (ex.: dois cenários) NUNCA são deduplicados
entre si — a chave inclui as premissas exatamente por isso (seção 41-43).

## I. Achados cruzados

`divergencias.ts` — `MENOR_TRIBUTO_NAO_COINCIDE_COM_MELHOR_CAIXA`,
`MENOR_TRIBUTO_NAO_COINCIDE_COM_MAIOR_MARGEM`,
`MAIOR_MARGEM_NAO_COINCIDE_COM_MELHOR_CAIXA` — só gerados quando TODOS
os regimes envolvidos têm o dado disponível E comparável
(`menorCargaComparavel` já vem `undefined` do Comparador Consolidado
quando a comparabilidade falha, então a ausência propaga naturalmente,
sem lógica extra). Nenhum vencedor é apontado — só o fato da divergência.

## J. Integração setorial

`aplicavelFatorR` (motor.ts) usa `buscarPerfil` + `classificarAnexo`
(já existentes) para decidir se a atividade principal do cenário
DEPENDE de Fator R — o achado só nasce se, além disso, a FS12/RBT12
forem computáveis (seção 37: perfil habilita a verificação, nunca cria o
achado por si só; testado: comércio nunca produz achado de Fator R
mesmo com folha informada).

## K. Cobertura

`cobertura.ts::avaliarCobertura` — `fiscal`/`margem`/`caixa`/`cenarios`/
`pontosVirada`/`setorial`, cada um `disponivel`/`indisponivel`/`parcial`,
nunca inferido pela ausência de achados daquela categoria (testado
explicitamente: cenário sem premissa de split → `cobertura.caixa ===
"indisponivel"` E zero achados de capital de giro — as duas informações
coexistem, uma nunca substitui a outra).

## L. Casos não analisáveis

Regime inelegível/indisponível → achados `REGIME_INELEGIVEL`/
`CARGA_FISCAL_INCOMPLETA`/`REGIMES_NAO_COMPARAVEIS` (nunca omitidos
silenciosamente). Custos ausentes → `CREDITOS_INDETERMINADOS`. FS12
incompleta → Fator R não é calculado, sem achado (nunca um valor
inventado).

## M. Testes

Seções 60-70 do pedido — 13 testes em
`src/engine/motorAchados/__tests__/motor.test.ts`: margem, Fator R
(clínica, com verificação textual de ausência de linguagem de
recomendação), capital de giro (com e sem premissa de split),
divergência tributo×caixa, conversão de ponto de virada sem
recálculo, resultado parcial, deduplicação, cenários distintos por
`cenarioId`, setor (saúde vs. comércio), multiatividade, cobertura
insuficiente.

## N. Limitações conhecidas

1. **`panorama.ts`/`oportunidadesParceiros.ts` (legados) não foram
   consolidados** — operam sobre o pipeline SPED/`SimulacaoInput`
   antigo (pré-`CenarioEmpresa`) e já contêm recomendação textual
   explícita, incompatível com o princípio desta fase. Uma futura
   migração desses módulos para achados sem recomendação é trabalho
   separado, não feito aqui.
2. **`RESULTADO_SENSIVEL_A_VARIAVEL`** (seção 31, sensibilidade) e
   **`REGIME_MENOR_CARGA_MUDA_AO_LONGO_DA_TRANSICAO`**/
   **`VARIACAO_MARGEM_2026_2033`** (seção 34/35, temporal) estão
   declarados no contrato (`tipos.ts`) mas nenhum conversor foi
   implementado nesta fase — ficam como extensão natural, seguindo o
   mesmo padrão dos adapters já existentes (`pontosVirada.ts`,
   `cenarios.ts`), quando o consumidor precisar deles.
3. **Índice de crédito não tem faixa "baixo"/"alto"** — só o número
   (`INDICE_CREDITO_CALCULADO`), deliberadamente, até haver
   benchmark/configuração aprovada (seção 16/17).
4. **Achados fiscais nunca carregam `atividade`** nesta fase — todos os
   cenários de teste são mono-atividade sem receita segregada
   confiável; o campo existe no contrato para quando essa segregação
   existir (seção 38).

## O. Próxima etapa recomendada

Com fatos, achados, cenários, pontos de virada, qualidade e contexto
setorial agora expressos em um único contrato auditável
(`AchadoEstrategico`/`RelatorioAuditoriaEstrategica`), a próxima camada
natural é o **Motor Estratégico**: consumir este relatório para
estruturar possíveis cursos de ação — ainda sem IA.

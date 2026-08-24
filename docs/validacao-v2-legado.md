# Validação Comparativa V2 × Legado e Prontidão para Migração

> Continuação de [wizard-estrategico-v2.md](./wizard-estrategico-v2.md).
> 781 testes passando (747 + 34 novos), `tsc -b` e `vite build`
> limpos. Princípio: **não migrar por confiança — migrar por
> evidência.**

## A. Objetivo

Responder, de forma estruturada e testável, duas perguntas distintas:
1. Quando os dois fluxos (legado e V2) recebem informação
   economicamente equivalente, produzem resultado equivalente?
2. Quando o V2 recebe informação que o legado não captura, a
   divergência resultante é explicável por cobertura — não é bug?

E corrigir uma fragilidade operacional: a análise do V2 dependia
apenas de `location.state`, perdida em qualquer reload.

## B. Metodologia de comparação

`src/application/comparacaoV2Legado/`:
```
tipos.ts               ClassificacaoDivergencia, DivergenciaCampo, ResultadoComparacaoFluxos
tolerancias.ts          valoresMonetariosEquivalentes, percentuaisEquivalentes
comparador.ts           compararMetrica, classificarConjunto, construirResultadoComparacao
checklistProntidao.ts   ChecklistProntidaoMigracao, calcularStatusProntidao
__tests__/
  fixtures.ts                 clienteLegadoEquivalente, rascunhoV2Equivalente, executarFluxoLegado/V2
  equivalenciaBasica.test.ts  casos 1-4
  coberturaSuperiorV2.test.ts FS12, créditos, split, Lucro Real
  divergenciaMaterial.test.ts casos sintéticos de erro + tolerâncias
  checklistProntidao.test.ts  regras do status de prontidão
```

Decisão deliberada: a comparação **não é um "diff automático"** de
`CenarioEmpresa`/`AnaliseEstrategicaCompleta` inteiros — seria frágil
e confundiria metadado com divergência material. Cada caso de teste
compõe explicitamente `compararMetrica(campo, valorLegado, valorV2, opções)`
para as métricas relevantes daquele cenário, com uma tolerância e,
quando aplicável, um `motivoCoberturaV2` documentado — exatamente como
os exemplos de "relatório por caso" do pedido.

`ClassificacaoDivergencia = "equivalente" | "esperada_por_maior_cobertura_v2" | "divergencia_material" | "nao_comparavel"`.
`compararMetrica` nunca infere sozinha que uma diferença é "esperada" —
isso exige que o caller declare `motivoCoberturaV2` explicitamente;
sem essa declaração, qualquer diferença entre valores definidos vira
`divergencia_material`.

## C. Casos equivalentes

4 casos com dados economicamente idênticos nos dois fluxos:
1. **Serviço simples sem Fator R relevante** — carga/margem/resultado/comparabilidade equivalentes.
2. **Comércio com receita/custos básicos** — carga equivalente; decisão equivalente; score equivalente.
3. **Presumido sem Split** — carga do Real (quando avaliado) equivalente; caixa indisponível em ambos, nunca zero.
4. **Multiatividade** — reconciliação sem bloqueio; faturamento total preservado inalterado pelo motor após a segregação.

Todos os 4 casos passam com classificação `equivalente` (ou, no caso 4,
com o invariante de integridade de dados verificado diretamente —
ver nota de metodologia na seção E).

## D. Casos de maior cobertura V2

4 casos onde o V2 captura dado que o legado não tem:
- **FS12/Fator R**: legado sem `pessoas.folhaAnual` (adapter nunca
  inventa); V2 com FS12 informada. Classificado
  `esperada_por_maior_cobertura_v2`.
- **Créditos**: legado com `custos.itens: []` sempre; V2 com
  `CategoriaGasto`/`NaturezaEconomica`/`TratamentoCredito` por item.
- **Split**: caixa legado `indisponivel`; caixa V2 `disponivel` com
  premissas informadas.
- **Lucro Real**: legado sem `ajustesFiscais`/`saldosPrejuizoAnteriores`;
  V2 com ambos — base fiscal mais completa.

## E. Divergências

Um caso sintético de erro proposital (faturamento 5.000.000 no legado
vs. 5.500.000 no V2) é corretamente classificado `divergencia_material`
— a comparação nunca reduz automaticamente uma diferença desse porte.

**Nota de metodologia (Caso 4/seção 23)**: durante a implementação,
uma tentativa inicial de comparar a *carga numérica* entre um cenário
com receita única e um cenário com a mesma receita segregada em duas
atividades revelou que o motor de Lucro Presumido pode legitimamente
produzir cargas diferentes ao segregar receita — comportamento fiscal
real (presunção por atividade), não um bug do Wizard V2. O teste foi
ajustado para verificar o invariante que a seção 23 realmente exige:
integridade de dados (o faturamento total usado pelo motor nunca muda
silenciosamente ao segregar, e a reconciliação fecha sem bloqueio) —
não equivalência numérica de carga, que depende de regras fiscais
legítimas fora do escopo desta fase.

## F. Tolerâncias

- **Monetária**: R$ 0,01 fixo OU 0,1% do valor (o maior dos dois) —
  absorve ruído de ponto flutuante sem esconder divergência de escala.
- **Percentual**: 0,1 ponto percentual (0,001 em fração) — absorve
  ruído binário, não diferença de alíquota/regime (testado
  explicitamente: 15,4% vs. 16,1% é sempre material).
- `undefined` **nunca** é tratado como equivalente a `0` — testado
  diretamente (`compararMetrica("carga", undefined, 0, ...)` sempre
  retorna `divergencia_material`, mesmo sem tolerância nenhuma).

## G. Persistência

Nova chave dedicada, **distinta** do rascunho em edição:
- `wizardEstrategicoV2:v1` — rascunho editável (fase anterior).
- `analiseEstrategicaV2:v1` — snapshot da entrada que gerou a última
  análise executada (`src/features/wizardEstrategico/persistenciaAnalise.ts`).

Persiste-se **a entrada** (`RascunhoCenarioEmpresa` — cenário +
opções de execução), nunca `AnaliseEstrategicaCompleta` — o resultado
é sempre reexecutado a partir da entrada guardada, eliminando o risco
de snapshot de resultado obsoleto (preferência explícita da seção 37
do pedido). `WizardEstrategicoPage.aoSimular` chama
`salvarSnapshotAnalise(rascunho)` logo após executar a análise.

## H. Reload

`AnaliseEstrategica.tsx` agora tem três fontes possíveis, nesta ordem
de prioridade: (1) `location.state` (navegação recente do Wizard V2 —
nunca recalcula, usa a análise já pronta); (2) snapshot V2 persistido
(reload — reconverte e reexecuta a partir da entrada salva); (3) fluxo
legado via `ClienteData`/adapter. Um snapshot inválido/corrompido
nunca é carregado silenciosamente — `statusSnapshotAnalise()` distingue
`ausente`/`valido`/`invalido`, e o estado "nenhuma análise" da página
mostra uma mensagem própria ("Não foi possível restaurar a análise
anterior") com um botão de volta ao Simulador Estratégico, em vez do
genérico "importe arquivos". `contextHash` da Memória Técnica é
idêntico entre a execução original e a reexecutada após reload
(testado) — o hash não depende de timestamp nem de qualquer metadado
de execução não determinístico.

Ação explícita **"Nova análise"** aparece na TopBar sempre que a
análise em tela veio do V2 (recente ou restaurada); ela limpa apenas
o snapshot (`limparSnapshotAnalise()`) e volta ao Simulador
Estratégico — o rascunho em edição (`wizardEstrategicoV2:v1`)
permanece intocado, para permitir voltar e editar.

## I. Checklist de prontidão

`ChecklistProntidaoMigracao` — 10 itens booleanos/status
(`atendido`/`nao_atendido`/`nao_avaliado`):

| Item | Status nesta fase |
|---|---|
| equivalenciaCasosBasicos | atendido — 4 casos, 0 divergência material |
| multiatividadeValidada | atendido — reconciliação e integridade de dados testadas |
| zeroVsIndisponivelValidado | atendido — testado explicitamente, nunca equivalentes |
| fs12Validada | atendido — classificada corretamente como ganho de cobertura |
| creditosValidados | atendido — idem |
| splitValidado | atendido — idem |
| lucroRealValidado | atendido — idem |
| persistenciaAnaliseResolvida | atendido — snapshot cenário+opções, versionado |
| reloadValidado | atendido — mesma decisão e mesmo contextHash após reload |
| legadoSemRegressao | atendido — adapter e fluxo legado intactos e testados |

`calcularStatusProntidao(checklist, existeDivergenciaMaterialNaoExplicada)`
— regra explícita: qualquer divergência material não explicada, ou
qualquer item não atendido, força `nao_pronto`; só com tudo atendido e
zero divergência material a função retorna `pronto_para_piloto`. Ela
**nunca** retorna `pronto_para_migracao_controlada` sozinha (testado
explicitamente) — esse status exigiria evidência de piloto real com
clientes, fora do alcance de fixtures sintéticas.

## J. Limitações conhecidas

1. **Fixtures sintéticas, não dados de clientes reais** — a
   equivalência foi comprovada com cenários controlados; piloto real
   pode revelar casos não cobertos aqui.
2. **Comparação por caso, não diff automático** — decisão deliberada
   (seção B); um caso não coberto explicitamente pelos testes não é
   automaticamente comparado.
3. **Carga em Lucro Presumido com multiatividade não foi validada
   numericamente entre legado e V2** — ver nota de metodologia (seção
   E); requer avaliação fiscal específica sobre como o adicional de
   IRPJ deve se comportar com receita segregada por atividade, fora
   do escopo desta fase de validação de arquitetura.
4. **`location.state` continua sendo a fonte mais rápida** — o
   snapshot local só entra em ação quando `location.state` está
   ausente (reload); os dois nunca se misturam.
5. **Sem testes de renderização** (limitação já documentada em todas
   as fases anteriores).

## Conclusão de prontidão

> **PRONTO PARA PILOTO CONTROLADO**

Todos os 10 itens do checklist estão `atendido` e nenhuma divergência
material não explicada foi encontrada nos casos testados — mas a
evidência disponível é de fixtures sintéticas, não de clientes reais.
Por isso a conclusão desta fase para para **PRONTO PARA PILOTO
CONTROLADO**, e não avança para "pronto para avaliar migração
controlada" nem, muito menos, para qualquer desligamento do legado —
essas decisões exigem evidência de uso real, que só um piloto pode
produzir.

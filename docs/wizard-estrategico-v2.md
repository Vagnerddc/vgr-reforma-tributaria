# Wizard Estratégico V2

> Continuação de [memoria-tecnica.md](./memoria-tecnica.md). 747 testes
> passando (716 + 31 novos), `tsc -b` e `vite build` limpos. Fluxo
> **paralelo** ao Wizard legado — nada foi removido, redirecionado ou
> migrado.

## A. Objetivo

Um novo caminho de entrada, `/simulador-estrategico`, que produz
`CenarioEmpresa` **diretamente**, sem `DadosApuradosCliente` nem o
adapter legado — fechando as perdas estruturais documentadas em
`adapters/legadoParaCenarioEmpresa.ts` (FS12, premissas de split,
ajustes fiscais/saldos de prejuízo, classificação de crédito por
categoria).

## B. Relação com o Wizard legado

```
Wizard legado (existente)          Wizard Estratégico V2 (novo)
        ↓                                    ↓
DadosApuradosCliente            RascunhoCenarioEmpresa (espelha CenarioEmpresa)
        ↓                                    ↓
adapter legado                  validarRascunho + converterRascunhoParaCenario
        ↓                                    ↓
   CenarioEmpresa  ═══════════════════  CenarioEmpresa
        ↓                                    ↓
executarAnaliseEstrategica       executarAnaliseEstrategica
        ↓                                    ↓
  /analises/estrategica  ◄══════  /analises/estrategica (via location.state)
```

Os dois fluxos convergem no mesmo contrato (`CenarioEmpresa`) e na
mesma rota de resultado — nunca em pipelines diferentes visíveis ao
usuário final.

## C. Arquitetura do rascunho

`src/features/wizardEstrategico/`:
```
tipos.ts        RascunhoCenarioEmpresa, StatusEtapaWizard, ETAPAS_WIZARD
estado.ts       reducerWizard (puro) + persistência localStorage versionada
validacao.ts    validarRascunho, converterRascunhoParaCenario (pura)
execucao.ts     construirOpcoesExecucao (rascunho → OpcoesAnaliseEstrategica)
motores.ts      Regime → MotorRegime
selectors/status.ts   calcularStatusEtapa (deriva de dados, nunca de "visitado")
etapas/*.tsx    9 componentes, um por etapa
components/campoManual.ts   helper de proveniência (informado_usuario/confirmado)
page/WizardEstrategicoPage.tsx   stepper, navegação, ação "Simular"
__tests__/
```

`RascunhoCenarioEmpresa` **reaproveita os mesmos tipos** de
`engine/cenarioEmpresa.ts` (`IdentificacaoEmpresa`, `ReceitaEmpresa`,
`PessoasEmpresa`, `TributarioEmpresa`, `EconomicoFinanceiroEmpresa`,
`DadosSetoriais`) — já totalmente opcionais no domínio — e acrescenta
apenas o que é exclusivo da experiência de captura: `regimesSelecionados`,
`ano`, `incluirHorizonte`, `analisarCaixa`/`premissasSplit` (opção de
`executarAnaliseEstrategica`, não do domínio), `otimizacao`,
`pontosVirada`, `etapasVisitadas`. Não existe um segundo formulário
gigante com adapter próprio — o rascunho *é* a mesma forma do cenário.

## D. Etapas

Empresa, Atividades, Receita, Custos e Créditos, Pessoas/FS12, Regimes
e Dados Fiscais, Caixa/Split, Premissas Estratégicas, Revisão e
Qualidade — 9 etapas, `ETAPAS_WIZARD` em `tipos.ts`.

`StatusEtapaWizard` (`incompleta|completa|com_ressalvas|nao_aplicavel`)
deriva sempre dos dados (`selectors/status.ts`), nunca do fato de a
etapa ter sido visitada.

## E. Contextualidade

- **Fator R / FS12** só aparece quando algum regime Simples está
  selecionado (`fatorRAplicavel`, `EtapaPessoasFs12.tsx`) — caso
  contrário, a etapa mostra um aviso e omite os campos.
- **Ajustes fiscais / saldos de prejuízo** só aparecem quando "Lucro
  Real" está entre os regimes selecionados.
- **Split/Caixa** é opcional (`analisarCaixa`); desabilitado, o motor
  de caixa simplesmente fica `indisponivel` — nunca bloqueia.
- **Otimização e pontos de virada** só entram nas opções de execução
  quando o usuário explicitamente os habilita e configura — nenhum
  limite ou intervalo é presumido.
- **Perfil setorial** (`listarPerfis()`, catálogo já existente) sugere
  o campo de atividade; nunca decide regime, crédito ou tratamento
  tributário — a seleção do usuário é sempre o dado final.

## F. Multiatividade

`identificacao.atividadePrincipal` + `atividadesSecundarias[]` (já
existentes no domínio); cada atividade tem sua própria entrada em
`receita.receitaPorAtividade` e seu próprio `DadosSetoriais`. A etapa
Receita reconcilia a soma das atividades contra o faturamento total —
divergência acima de 1% **bloqueia** a simulação (seção 18/95) até o
usuário resolver manualmente; nunca é corrigida silenciosamente.

## G. Custos e Créditos

Reaproveita `GastoInformado`/`CategoriaGasto` de
`engine/creditoTributario.ts` — mesma taxonomia (`NaturezaEconomica`,
`TratamentoCredito` por sistema PIS/COFINS, ICMS/IPI, IBS/CBS). Quando
o usuário não sabe o tratamento, a UI oferece explicitamente "não sei
/ indeterminado" como opção — nunca defaulta para "não creditável".

## H. Fiscal e Lucro Real

Regimes selecionados = "considerar na comparação", nunca "declarar
elegibilidade" — a elegibilidade final é sempre do motor
(`AvaliacaoElegibilidade`). Ajustes fiscais (`AjusteFiscal[]`) e
saldos de prejuízo (`irpj`/`csll`) são capturados apenas quando Lucro
Real está selecionado, preenchendo exatamente as lacunas identificadas
no adapter legado.

## I. Caixa/Split

Etapa opcional; quando habilitada, expõe só os campos que
`PremissasSplitPayment` realmente aceita (`percentualRecebimentosSujeitos`,
`percentualTributoSegregado`, `taxaCustoCapitalMensal` em % a.m.,
`prazoAtualPagamentoTributosDias`, `caixaMinimoOperacional`) — nenhum
percentual (ex.: "100% sujeito") é presumido.

## J. Premissas Estratégicas

Otimização (`VariavelOtimizacao[]`, `Objetivo[]`) e Pontos de Virada
(`PontoViradaRascunho[]`, mesmo formato aceito por
`executarAnaliseEstrategica`) são opcionais e começam vazios — o
usuário informa mínimo/máximo/passos explicitamente; nada é
auto-configurado.

## K. Revisão e qualidade

`EtapaRevisao` chama `validarRascunho` e mostra:
- **Qualidade por área** (`confirmado|estimado|indeterminado|parcial|nao_informado`)
  — categórica, nunca um percentual arbitrário de "completude".
- **Ressalvas** (não bloqueiam: FS12 ausente, split não configurado,
  Lucro Real parcial, otimização sem variáveis).
- **Bloqueios** (impedem simular: receita ausente/negativa, nenhum
  regime selecionado, divergência de reconciliação, custo negativo).

O botão "Simular" fica desabilitado enquanto houver bloqueios.

## L. Conversão e execução

`converterRascunhoParaCenario` é pura (usa `structuredClone`, nunca
muta o rascunho) e devolve `{ cenario, origemCenario: "wizard_v2" }` —
a marcação de origem vive na camada de aplicação, não no domínio
(seção 73). `construirOpcoesExecucao` traduz o rascunho para
`OpcoesAnaliseEstrategica` sem inventar nada além do que foi
explicitamente configurado.

## M. Integração com `/analises/estrategica`

`WizardEstrategicoPage` chama `executarAnaliseEstrategica` diretamente
e navega com `navigate("/analises/estrategica", { state: { analise, nomeEmpresa } })`.
`AnaliseEstrategica.tsx` foi ajustada para aceitar essa análise já
pronta via `location.state` como fonte alternativa ao fluxo legado
(`ClienteData` + adapter) — **nunca recalcula**, apenas usa o que
recebeu. Quando não há `location.state`, o comportamento legado
permanece bit-a-bit o mesmo. Um aviso informa quando a análise em tela
veio do Wizard V2.

## N. Persistência

`localStorage["wizardEstrategicoV2:v1"]` — versionado na própria chave.
Ao carregar, uma verificação estrutural mínima (`ehRascunhoValidoEstruturalmente`)
rejeita qualquer JSON que não tenha o formato esperado, caindo para um
rascunho vazio em vez de confiar cegamente no dado salvo (seção 63/64).

## O. Responsividade e acessibilidade

Reaproveita `Stepper`, `CampoMoeda`, `CampoPercentual`, `Card`,
`Alert`, `Badge`, `Button` do design system — nenhuma dependência
nova. Foco move para o título da etapa a cada navegação (mesmo padrão
do Modo Apresentação); um texto "Etapa X de N" sempre visível serve de
fallback para mobile, independente do comportamento interno do
`Stepper`.

## P. Limitações conhecidas

1. **UI deliberadamente simples** — sem drag-and-drop, sem tabela
   editável densa, sem accordion dedicado para histórico mensal (não
   existe contrato de histórico mensal no domínio — FS12/RBT12 são
   anuais; ver `fs12.ts`/`fs12Mensal.ts`, que derivam a série mensal
   internamente a partir dos totais anuais).
2. **Otimização usa o primeiro regime selecionado como base** — o
   contrato de otimização (`OpcoesOtimizacao`) exige um único
   `regime`/`motorRegime`; o Wizard não tenta adivinhar qual seria "o
   preferido" antes da decisão existir.
3. **Sem importação XML/SPED/ECD/ECF nesta fase** — arquitetura deixada
   preparada (campos com proveniência explícita, prontos para receber
   origem `xml`/`sped` no futuro), mas nenhum importador novo foi
   implementado (fora de escopo, seção 66/124).
4. **`location.state` não sobrevive a um reload de página** — é
   armazenamento em memória do React Router; a análise vinda do Wizard
   V2 precisa ser gerada de novo se a página for recarregada. Isso é
   aceitável nesta fase (sem backend, sem persistência entre sessões).
5. **Sem testes de renderização** (mesma limitação já documentada nas
   fases anteriores — ausência de `@testing-library`/jsdom); a
   cobertura desta fase é sobre rascunho, validação, conversão e
   integração pura com o pipeline.

## Próximas etapas

Revisão do Wizard (legado) e, só depois, qualquer avaliação de
migração do pipeline legado — nesta ordem, conforme instruído.

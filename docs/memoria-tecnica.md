# Memória Técnica / Auditabilidade

> Continuação de [modo-apresentacao.md](./modo-apresentacao.md).
> **Nenhum novo motor, nenhum recálculo.** 716 testes passando
> (695 + 21 novos), `tsc -b` e `vite build` limpos. Princípio: "A
> Memória Técnica não recalcula nada. Ela apenas reconstrói e
> apresenta a trilha de auditoria dos resultados já produzidos."

## A. Objetivo

Permitir que contador, consultor, revisor ou auditor responda, para
qualquer resultado relevante da análise: de onde veio este número,
qual motor o produziu, quais dados e premissas o sustentam, qual a
qualidade, qual a metodologia e quais limitações existem.

## B. Arquitetura

```
CenarioEmpresa
      ↓
Motores determinísticos
      ↓
AnaliseEstrategicaCompleta
      ↓
MemoriaTecnicaAnalise (application/memoriaTecnica)
      ↓
MemoriaTecnicaViewModel (presentation/viewModels/memoriaTecnica.ts)
      ↓
SecaoMemoriaTecnica
```

`construirMemoriaTecnicaAnalise` (`application/memoriaTecnica/motor.ts`)
é um orquestrador — nunca executa fórmula fiscal, financeira ou
decisória. Ele apenas chama 9 adapters (`adapters/fiscal.ts`,
`financeiro.ts`, `caixa.ts`, `decisao.ts`, `score.ts`,
`pontosVirada.ts`, `pareto.ts`, `plano.ts`, `execucao.ts`), cada um
lendo campos já calculados de `AnaliseEstrategicaCompleta` e devolvendo
`ItemMemoriaTecnica[]` — nenhum deles importa `calculo.ts` ou qualquer
motor.

## C. Contratos

`ItemMemoriaTecnica` (`application/memoriaTecnica/tipos.ts`):
`id, codigo, categoria, titulo, descricao, valor?, unidade?, periodo?,
regime?, atividadeId?, origemResultado, origemInformacao,
origemCalculo, motor, motorVersao?, metodologia?, metodologiaVersao?,
status, qualidade, premissas[], evidencias[], fundamentos[],
dependencias[], limitacoes[]`.

`MemoriaTecnicaAnalise`: `analiseId, cenarioId, contextHash, periodo,
resumoCobertura, itens[], premissas[], fontes[], metodologias[],
limitacoes[], auditoriaExecucao, iaMetadado?`.

IDs são determinísticos e nunca usam índice de array como identidade
lógica isolada — seguem o padrão `<categoria>:<chave>:<ano>[:sufixo]`,
por exemplo `fiscal:lucro_presumido:2028:carga_total`,
`decisao:2028`, `score:lucro_presumido:2028:fiscal`. Ordinais
(`ponto_virada:...:00`, `pareto:2028:00`) usam índice apenas como
desambiguador dentro de uma chave já única — nunca como a chave em si
(testado: seção 102).

O orquestrador lança erro se dois itens colidirem no mesmo id,
transformando qualquer regressão de nomenclatura em falha de build
imediata em vez de corrupção silenciosa.

## D. Categorias

`fiscal, economico, caixa, decisao, score, pontos_virada, plano_acao,
otimizacao, execucao` — cobrindo os indicadores executivos
obrigatórios: carga projetada, margem projetada, impacto anual,
capital adicional, custo financeiro, decisão, score, pontos de
virada.

## E. Proveniência

`origemInformacao` (dado) e `origemCalculo` (motor_oficial/motor_vgr)
são campos **separados**, nunca misturados (seção 12/13). Quando o
contrato de origem não registra proveniência, o item usa o texto fixo
"não informado" — nunca uma inferência (seção 15).

## F. Qualidade

Cada item reaproveita a qualidade já produzida pelo motor de origem
(`QualidadeAchado`, `QualidadeFinanceira`, `QualidadeImpactoCaixa`,
`QualidadeResultadoRegime`, conforme o caso) — nunca um score próprio
de auditabilidade, e nunca promovida (uma evidência "media" nunca
aparece como "alta").

## G. Premissas

`MemoriaTecnicaAnalise.premissas` é construída agregando, por item, só
as chaves de premissas que aquele item efetivamente referencia
(`Object.keys(resultado.premissas)` do motor correspondente) — nunca
despejando todas as premissas da análise em todos os itens.

## H. Evidências

Reaproveitadas das estruturas já existentes (`EvidenciaDecisao`,
`EvidenciaScore`, `EvidenciaAcao`, achados dos motores financeiro/
caixa/pontos de virada) — sempre como texto (`descricao`), nunca uma
narrativa nova. No item de decisão, evidências favoráveis e contrárias
são preservadas lado a lado, prefixadas ("Favorável:"/"Contrária:"),
nunca eliminadas por conflito.

## I. Fundamentos

Quando o componente tributário já registra `fundamentoLegal`
(`ValorComponenteTributario`), ele é preservado no item correspondente.
Nenhuma consulta normativa nova é feita nesta fase.

## J. Versionamento

Itens de Score expõem `VGR_SCORE_V1` (id/versão/pesos por dimensão,
importados de `engine/scoreEstrategico/metodologia.ts` — nunca
reescritos). Itens de Pareto expõem `metodologiaId`/`metodologiaVersao`
tal como produzidos por `otimizacaoMultidimensional`.

## K. Execução

`adapters/execucao.ts` traduz `AnaliseEstrategicaCompleta.auditoriaExecucao`
(`etapasExecutadas`, `etapasIndisponiveis`, `erros`) em um item legível
de categoria "execução" — sem exibir stack trace bruto.

## L. Perdas do adapter

Cada `PerdaAdaptacaoLegado` produzida por
`adaptarClienteLegadoParaCenarioEmpresa` gera um item próprio
(`legado:perda:NN`), status sempre `indisponivel`, nunca omitido — a
ausência de dado do pipeline legado é, ela mesma, informação de
auditabilidade (seção 48).

## M. UI

`SecaoMemoriaTecnica` segue *progressive disclosure*: card resumo
(contagens reais, nunca "auditabilidade 87%") → botão "Explorar
memória" → lista filtrável por categoria/busca → `DetailToggle`
(nativo, sem nova dependência) por item → detalhe completo. Integrada
ao final de `/analises/estrategica`, após Pareto. No Modo Apresentação,
apenas um botão discreto "Abrir memória técnica" (que sai do modo
apresentação para a tela normal, onde a seção existe) — nenhuma
auditoria detalhada é capítulo obrigatório da narrativa (seção 61).

## N. Deep-links

`buscarItemPorId(memoria, id)` localiza qualquer item pelo id
determinístico. `MemoriaTecnicaViewModel.linksRapidos` resolve, sem
recalcular nada, os primeiros itens de carga/margem/caixa/decisão/
score; clicar abre a seção, filtra e expande o item, rolando até ele
(`id="memoria-<itemId>"`).

## O. Privacidade

A memória nunca guarda o `CenarioEmpresa` inteiro — apenas
`cenarioId` (string). O `contextHash` é calculado sobre uma assinatura
derivada (status das dimensões, ids/status da decisão, scores,
otimização, pontos de virada) que **não inclui** `nomeEmpresa` ou
qualquer campo do cenário bruto (testado: seção 99). Não há
`chainOfThought`/`internalReasoning`/`reasoningTokens` em nenhum ponto
do contrato (testado: seção 100).

## P. Responsividade

Reaproveita os componentes já existentes do design system
(`Card`, `Tabs`, `DetailToggle`, `Badge`, `Alert`, `Button`) — a mesma
base já responsiva usada em `SecaoIaConsultiva`/`ModoApresentacao`,
sem grid de tabela gigante (lista + detalhe).

## Q. Testes

21 novos testes (`application/memoriaTecnica/__tests__/memoriaTecnica.test.ts`),
cobrindo: carga/margem idênticas ao motor de origem; caixa idêntico a
`ResultadoImpactoCaixa`; indisponível nunca vira zero; condição
permanece na decisão condicionada; evidências favoráveis/contrárias
preservadas em conflito; natureza `obrigacao_juridica` nunca convertida
em "melhor regime"; Score expõe `VGR_SCORE_V1` e pesos; Pareto nunca
cria ranking; pontos de virada preservam método/precisão; perdas do
adapter legado aparecem; `contextHash` distingue análises diferentes;
imutabilidade; determinismo; funciona sem IA; nenhum dado pessoal
vaza; ausência de chain-of-thought; deep-link retorna o item correto;
IDs únicos; Modo Apresentação permanece intacto.

## R. Limitações conhecidas

1. **`contextHash` não é hash do `CenarioEmpresa` bruto** — por
   design de privacidade (seção O), ele reflete uma assinatura dos
   resultados/status, não o cenário completo. Duas análises
   diferentes cujo cenário muda sem afetar nenhum resultado
   observável produziriam o mesmo hash — cenário extremamente raro
   dado que qualquer mudança de entrada tende a alterar ao menos um
   status/resultado.
2. **Algoritmo de hash não-criptográfico** (rolling hash de 31,
   idêntico ao já usado em `hashContexto` da IA Consultiva) — adequado
   para detectar divergência de contexto, não para garantias
   criptográficas.
3. **`origemInformacao`/`origemCalculo` frequentemente "não
   informado"** — vários motores (financeiro, caixa, score, pontos de
   virada, plano) não carregam proveniência de dado/cálculo por campo
   individual; a memória nunca inferiu esse dado, apenas expõe a
   ausência honestamente.
4. **Sem busca/filtro avançado** — apenas texto livre e categoria,
   conforme instruído (seção 79/80: não gastar a fase em filtros
   avançados).
5. **Sem testes de renderização** (mesma limitação já documentada nas
   fases anteriores — ausência de `@testing-library`/jsdom).

## Próximas etapas

Revisão do Wizard e, só depois, avaliação de migração do pipeline
legado.

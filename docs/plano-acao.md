# Plano de Ação Estruturado

> Continuação de [ia-consultiva.md](./ia-consultiva.md). **Nenhum motor
> determinístico foi alterado nem importa este módulo** (verificado por
> grep). `calculo.ts` intocado. Nenhum Score, otimização multidimensional
> ou UI. 567 testes passando (547 + 20 novos), `tsc` limpo. Princípio: "O
> Motor de Decisão responde qual conclusão técnica é defensável. O
> Plano de Ação responde quais providências são necessárias para
> validar, consolidar, formalizar e acompanhar essa conclusão." Nunca
> confunde referência matemática com ação operacional automaticamente
> recomendada.

## A. Arquitetura

```
src/engine/planoAcao/
  tipos.ts        — AcaoEstruturada, PlanoAcaoEstruturado, GatilhoMonitoramento
  catalogo.ts       — metadado por código (categoria/tipo/responsabilidade), sem regra
  regras.ts           — uma função por família (fiscal, Fator R, preço, créditos, capital de giro, custo financeiro, pontos de virada, horizonte, conclusão de regime)
  ordenacao.ts          — topológica determinística + detecção de ciclo
  cobertura.ts            — analisado/não_aplicável/indisponível por dimensão
  motor.ts                  — gerarPlanoAcao: orquestra + deduplica + ordena
```

Fluxo: `ResultadoDecisaoEstrategica` (motorDecisao, obrigatório) +
`RelatorioAuditoriaEstrategica` (motorAchados, opcional) +
`PlanoAlternativasEstrategicas` (motorEstrategico, opcional) +
`ResultadoPontoVirada[]` (opcional) → `gerarPlanoAcao` →
`PlanoAcaoEstruturado`. Nenhuma fórmula fiscal/econômica/financeira é
recalculada — cada regra só lê achados/alternativas/decisão já
prontos (seção 1/2).

## B. Contrato `AcaoEstruturada`

Código estruturado (`CodigoAcao`, união fechada — seção 5), categoria,
`tipo` (`validacao`/`analise`/`simulacao`/`formalizacao`/`monitoramento`
— seção 6), `status` inicial sempre `"pendente"` (seção 44),
`dependeDe[]` (ids desta mesma execução — seção 34), `bloqueios[]`/
`riscos[]` preservados das camadas anteriores (nunca apagados — seção
46), `evidencias[]` com valor estruturado, `criterioConclusao` sempre
verificável (nunca "revisar impostos" — seção 11),
`responsabilidadeSugerida[]` (rótulo, nunca nome de pessoa — seção
40/41), `gatilho?` (`GatilhoMonitoramento`).

## C. Contrato `PlanoAcaoEstruturado`

`acoes[]`, `etapas[]` (agrupamento por nível de dependência — nunca por
prioridade estratégica, seção 39), `bloqueiosGlobais[]`,
`condicoesGlobais[]`, `gatilhosMonitoramento[]`, `cobertura`,
`qualidade` (nunca promovida), `status`
(`pronto_para_validacao`/`bloqueado`/`parcial`/`pronto_para_formalizacao`/
`sem_acoes` — seção 58).

## D. Catálogo de ações

`catalogo.ts::CATALOGO_ACOES` — 25 códigos, cada um só com metadado
(categoria/tipo/título/responsabilidade). Nenhuma regra de ativação
vive aqui — separação deliberada entre "o que a ação É" (catálogo) e
"quando ela nasce" (regras.ts), seguindo a mesma disciplina de todas as
fases anteriores.

## E. Regras de ativação

`regras.ts` — uma função por família, cada uma consumindo um pedaço
específico do contexto: `regraValidacoesFiscais` (achados
`BASE_LUCRO_REAL_PARCIAL`/`COMPONENTE_MATERIAL_AUSENTE`/`REGIMES_NAO_COMPARAVEIS`),
`regraFatorR`/`regraPreco`/`regraCreditos`/`regraCapitalGiro`/
`regraCustoFinanceiro` (alternativas do Motor Estratégico),
`regraPontosVirada`/`regraHorizonte` (Motor de Decisão),
`regraConclusaoRegime` (o núcleo: decide toda a sequência
validação→simulação→formalização, ou as ações de resolução de
conflito, conforme `statusConclusao`/`naturezaConclusao`).

## F. Dependências

Cada ação carrega `dependeDeCodigo` (resolvido para `dependeDe` por
id em `motor.ts::resolverDependencias`, depois da deduplicação —
seção 34). Cadeia central testada (seção 79): validação → simulação →
formalização. `SIMULAR_CENARIO_FINAL` depende de TODAS as ações de
`tipo: "validacao"` geradas por qualquer família nesta execução —
nunca só das fiscais.

## G. Bloqueios

Ações de validação nascidas de achados materialmente insuficientes
(`BASE_LUCRO_REAL_PARCIAL`) carregam `bloqueios` — um plano com
qualquer ação bloqueada nunca chega a `"pronto_para_formalizacao"`
(seção 8, `motor.ts::statusDoPlano`).

## H. Validações

Regra central da fase (seção 7): toda ação de validação bloqueante
antecede qualquer ação de formalização na ordenação topológica —
garantido estruturalmente (via `dependeDeCodigo`), nunca por convenção
textual.

## I. Gatilhos de monitoramento

`GatilhoMonitoramento` (`variavel`/`operador`/`valorReferencia`/
`unidade`/`periodicidadeSugerida`) — sempre construído a partir de um
`ResultadoPontoVirada` JÁ CALCULADO (motorPontosVirada), nunca
recalculado. `periodicidadeSugerida: "indefinida"` é o valor correto
na ausência de metodologia explícita (seção 30) — nunca inventada.
Gatilhos de variáveis diferentes (`faturamento` × `custoCapital`)
nunca são fundidos (seção 52/78, testado).

## J. Ordenação

`ordenacao.ts::ordenarTopologicamente` — Kahn determinístico (ids
ordenados alfabeticamente dentro de cada nível, para reprodutibilidade
— seção 36/85). Ações sem dependência mútua compartilham a mesma
`EtapaPlano` (seção 37/80, testado). Ciclo → `CicloDependenciaError`
estruturado, nunca um plano parcial silenciosamente incompleto (seção
35/81, testado).

## K. Deduplicação

`motor.ts::deduplicarERotular` — chave = `codigo + periodoAplicavel +
gatilho` (seção 52: parâmetros diferentes NUNCA são fundidos). Origens,
achados/alternativas/decisões de origem, evidências, condições,
bloqueios e riscos são todos UNIDOS (nunca perdidos — seção 51),
qualidade final = pior das fontes deduplicadas (testado: seção 77).

## L. Integração setorial

Não implementada nesta fase como regra dedicada — o catálogo e as
regras já são inteiramente genéricos por família (fiscal/Fator R/
preço/créditos/capital de giro/custo financeiro/regime), sem nenhum
`if (segmento === ...)` disperso (seção 38/53/54 cumpridos por
omissão: nenhuma especialização textual por setor foi adicionada, então
não há risco de "setor criar ação sem evidência" — ver Limitações).

## M. Qualidade

`piorQualidade` (motor.ts) — a qualidade do plano é o PIOR veredito
entre a qualidade da decisão de origem e a de TODAS as ações geradas
(nunca promovida, seção 59, testado: seção 82).

## N. Cobertura

`cobertura.ts::avaliarCoberturaPlano` — `analisado` só quando existe
ação daquela categoria; caso contrário `indisponivel` (quando a
dimensão de origem no Motor Estratégico/Achados era indisponível) ou
`nao_aplicavel` (quando simplesmente não havia achado/alternativa
correspondente) — nunca inventa ação para "preencher" uma categoria
(seção 60/61/83, testado: sem alternativa de capital de giro, nenhuma
ação de capital de giro nasce e `cobertura.caixa === "nao_aplicavel"`).

## O. Testes

Seções 67-86 do pedido — 20 testes em
`src/engine/planoAcao/__tests__/motor.test.ts`: preferência
condicionada por custo de capital, PIS/COFINS pendente bloqueando
formalização, Lucro Real parcial bloqueante, Fator R nunca prescreve
pró-labore, preço nunca gera reajuste automático (referência
matemática só como evidência), conflito nunca gera formalização,
obrigação jurídica nunca gera "escolha de regime", preferência robusta
sem bloqueios permite o fluxo completo, ponto de virada como
monitoramento estruturado, mudança temporal gera reavaliação
estruturada, deduplicação preservando múltiplas origens, gatilhos
diferentes nunca fundidos, cadeia validação→simulação→formalização,
ações paralelas na mesma etapa, detecção de ciclo, qualidade nunca
promovida, cobertura nunca inventa ação, nenhuma ação quando não há
providência, determinismo, ausência de prescrição substantiva não
sustentada (verificado contra uma lista de códigos proibidos, nunca
gerados pelo catálogo).

## P. Limitações conhecidas

1. **Integração setorial (seção 53/54)** não foi implementada como
   regra dedicada nesta fase — os templates de ação são genéricos por
   família. Uma extensão futura poderia enriquecer `descricaoTecnica`
   com contexto setorial (ex.: "monitorar capital de giro nos meses de
   concentração de receita" para aviação agrícola), sempre condicionada
   à evidência de sazonalidade já existir no cenário, nunca inventada.
2. **`MONITORAR_FATOR_R`/`ATUALIZAR_PREMISSAS`** estão no catálogo
   (`CodigoAcao`) mas nenhuma regra os ativa nesta fase — ficam
   disponíveis para uso futuro (ex.: quando o Fator R estiver `"próximo
   do limite"` de forma parametrizada, seção 20 da instrução do Motor
   de Achados).
3. **`ATUALIZAR_PREMISSAS`** também não tem regra própria — é um código
   reservado para quando o plano precisar sinalizar que uma premissa
   usada na análise ficou desatualizada (ex.: split payment com data de
   validade), sem mecanismo de expiração implementado ainda.
4. **`VALIDAR_PREMISSAS_SPLIT`** está no catálogo mas não tem regra de
   ativação própria nesta fase — a família de capital de giro já cobre
   o caso via `VALIDAR_PREMISSAS_FLUXO`; o código fica reservado para
   uma eventual regra mais específica sobre premissas de split
   isoladamente (fora do capital de giro).
5. **A IA Consultiva não foi conectada ao Plano de Ação** — por
   desenho (seção 56): a geração das ações é puramente determinística;
   a explicação do plano por IA fica para uma integração futura que
   reutilizaria `iaConsultiva/` sem alterar `motor.ts` deste módulo.

## Q. Próxima etapa recomendada

Com a cadeia completa `ANALISAR → DIAGNOSTICAR → COMPARAR → DECIDIR →
EXPLICAR → OPERACIONALIZAR` implementada de ponta a ponta, as camadas
explicitamente adiadas (Score Estratégico, otimização multidimensional,
UI executiva final) podem agora ser desenhadas sobre uma base completa
de achados, alternativas, decisões, explicações e ações — todas
auditáveis e rastreáveis até os motores fiscais/financeiros originais.

# IA Consultiva Explicativa e Não Decisória

> Continuação de [motor-decisao.md](./motor-decisao.md). **Nenhum motor
> determinístico foi alterado nem importa este módulo** (verificado por
> grep: `motorRegimes`/`motorFinanceiro`/`motorCenarios`/`motorPontosVirada`/
> `motorAchados`/`motorEstrategico`/`motorDecisao` permanecem
> independentes de IA). `calculo.ts` intocado. Nenhum Plano de Ação,
> Score ou otimização multidimensional. 547 testes passando (527 + 20
> novos), `tsc` limpo. Princípio: "Os motores determinísticos calculam,
> analisam e decidem. A IA Consultiva explica." Se a IA for desligada
> por completo, toda a inteligência tributária/econômica/financeira/
> decisória continua funcionando — o fallback determinístico É a
> explicação padrão, não um substituto degradado.

## A. Arquitetura

```
src/engine/iaConsultiva/
  tipos.ts               — ContextoIaConsultiva, RespostaBrutaIa/IaConsultiva, ProvedorIaConsultiva
  contexto.ts              — construirContexto (seleção determinística) + hashContexto
  templatesFallback.ts       — explicação determinística por statusConclusao × nível (funciona sem IA)
  guardrails.ts                 — validarResposta: rejeita contradição/invenção pós-geração
  provedor.ts                     — provedorNulo (referência de interface)
  motor.ts                          — gerarExplicacaoConsultiva / gerarTresNiveis
```

Fluxo: `ResultadoDecisaoEstrategica` (motorDecisao) → `construirContexto`
→ (se houver `ProvedorIaConsultiva` configurado) `provedor.gerar()` →
`validarResposta` → resposta válida OU fallback determinístico. A IA
fica **estritamente depois** do Motor de Decisão — nunca antes, nunca
paralela (seção 1).

## B. Fronteira IA × Motores Determinísticos

Nenhum motor fiscal/financeiro/caixa/cenários/pontos-de-virada/achados/
estratégico/decisão importa `iaConsultiva/` (verificado por grep, seção
6). `iaConsultiva/motor.ts` é o ÚNICO ponto que referencia
`ProvedorIaConsultiva` — o domínio pode trocar modelo/provedor/versão
sem tocar em nenhum motor de negócio (seção 5).

## C. Contratos de entrada e saída

`ContextoIaConsultiva` (tipos.ts) — compacto e controlado: identificação
da análise, status/natureza da conclusão, evidências favoráveis/
contrárias já com `valor`/`unidade` estruturados (nunca só texto — seção
9/35), condições, bloqueios, riscos, validações pendentes, conflitos,
qualidade, pontos de virada, horizonte. `RespostaBrutaIa` — saída
estruturada do provedor (nunca uma string livre, seção 10/40): inclui
campos específicos para validação (`alternativaComunicada`,
`qualidadeComunicada`, `riscosComunicados`) que permitem ao guardrail
verificar CONTRADIÇÃO sem depender de mineração de texto livre.
`RespostaIaConsultiva` adiciona `statusValidacao`/`auditoria`.

## D. Níveis Executivo/Consultivo/Técnico

`gerarTresNiveis` chama `gerarExplicacaoConsultiva` três vezes com o
MESMO `ResultadoDecisaoEstrategica` (nunca três análises independentes —
seção 12, testado: seção 87-89). Nível `executiva` limita
`principaisEvidencias` a poucas entradas; `tecnica` preserva todas as
evidências (favoráveis e contrárias) e `validacoesPendentesCitadas`.

## E. Construção do contexto

`construirContexto` (contexto.ts) decide DETERMINISTICAMENTE o que é
relevante — nunca depende do LLM para descobrir isso em milhares de
campos (seção 8). Cada evidência recebe um `id` estável (`fav-0`,
`con-0`, `cond-0`) usado depois pelo guardrail para rastreabilidade
(seção 42).

## F. Política de dados e privacidade

`PoliticaDadosIa` (`permitirIdentificacaoEmpresa`/`permitirValoresFinanceiros`/
`permitirDadosPessoais`/`anonimizar`) filtra o contexto ANTES de
qualquer chamada externa (seção 49-51, testado: seção 95). Nunca XML/
SPED/ECD/ECF — só o resultado já normalizado pelo Motor de Decisão
(seção 50).

## G. Prompts versionados

`PROMPT_VERSION = "PROMPT_IA_CONSULTIVA_V1"` (motor.ts) — registrado em
toda `RegistroAuditoriaIa` (seção 44/45). Nenhum prompt real foi escrito
nesta fase porque nenhum provedor concreto foi integrado — a constante
existe para já fixar a disciplina de versionamento antes da primeira
integração real.

## H. Structured Output

`RespostaBrutaIa` é o contrato que qualquer `ProvedorIaConsultiva` real
deveria preencher via structured output/JSON Schema do provedor (seção
40/41) — este módulo não depende de parsing de markdown livre.
`ids` de evidência/condição devem ser exatamente os do contexto (seção
42/43).

## I. Guardrails

`validarResposta` (guardrails.ts) rejeita: evidência/condição com `id`
inexistente; `alternativaComunicada` diferente de
`contexto.alternativaPreferida`; `qualidadeComunicada` superior à
qualidade real; preferência condicionada sem nenhuma condição citada;
risco comunicado sem correspondência no contexto; linguagem absoluta
(`definitivamente`, `garantido`...) ou prescritiva (`recomendamos`,
`migre para`, `aumente pró-labore`...); declaração de vencedor em
`conflito_nao_resolvido`; e números no texto que não sejam rastreáveis a
nenhum valor do contexto (extração por regex + comparação com tolerância
— seção 36/79).

## J. Validação pós-geração

Toda chamada a um provedor real passa por `validarResposta` antes de
ser aceita — nunca confia só no prompt (seção 39). Resposta inválida →
`statusValidacao: "rejeitada"` + `motivosRejeicao[]` + fallback
determinístico automaticamente substituído (seção 60, testado: seções
79-84).

## K. Fallback determinístico

`gerarRespostaFallback` (templatesFallback.ts) cobre todos os
`statusConclusao` com texto determinístico, nunca linguagem absoluta/
prescritiva — é o comportamento padrão sem nenhum provedor configurado
(`statusValidacao: "indisponivel"`) e também o fallback após rejeição
ou erro do provedor (seção 52-54, testado: seções 85/86).

## L. Tratamento de erros

`comTimeout` (motor.ts) usa `Promise.race` com um timeout configurável
(default 8s) — provedor que nunca resolve produz
`statusValidacao: "erro_provedor"` com explicação de fallback válida,
nunca quebra a chamada (seção 55, testado: seção 85). Qualquer exceção
do provedor cai no mesmo caminho.

## M. Auditoria

`RegistroAuditoriaIa` — `requestId`, `contextHash` (hash simples não
criptográfico do contexto, base para cache futuro, seção 57),
`resultadoDecisaoId`, `nivelComunicacao`, `promptVersion`, `provider`,
`model?`, `status`, `timestamp`. Nunca armazena chain-of-thought (seção
47/100/101 — o contrato não tem esse campo).

## N. Testes

Seções 73-95 do pedido — 20 testes em
`src/engine/iaConsultiva/__tests__/motor.test.ts`: linguagem absoluta/
prescritiva proibida em cada status, condição sempre citada em
condicionada, conflito nunca declara vencedor, dados insuficientes
nunca escolhe regime, obrigação jurídica nunca usa linguagem de
preferência, equivalência nunca escolhe arbitrariamente, guardrails
rejeitando número inventado/alternativa trocada/condição omitida/
qualidade promovida/risco inventado/evidência inexistente, fallback em
timeout, funcionamento sem provedor, três níveis a partir da mesma
decisão, horizonte temporal nunca vira recomendação única, ponto de
virada como fronteira (nunca "será"), Fator R nunca prescreve
pró-labore, preço nunca prescreve reajuste, política de dados
filtrando o contexto.

## O. Limitações conhecidas

1. **Nenhum provedor real foi integrado nesta fase** — `provedorNulo`
   existe só como referência de interface; a integração com um
   provedor concreto (OpenAI/Anthropic/etc.) é trabalho futuro que só
   precisa implementar `ProvedorIaConsultiva.gerar`, sem tocar em
   nenhum motor determinístico.
2. **Cache não implementado** — `hashContexto` já produz uma chave
   estável (`decisão + nível + contexto`), mas nenhuma infraestrutura de
   cache foi construída (seção 57, deliberadamente fora de escopo).
3. **Retry não implementado** — só timeout único; se necessário no
   futuro, deve ter limite explícito (seção 56).
4. **Guardrail numérico é heurístico** — a extração de números por
   regex e a tolerância de 1% (ou R$0,50) podem, em textos muito
   elaborados, deixar passar um número tecnicamente “próximo” mas
   ainda assim não idêntico a nenhuma evidência; é uma defesa
   determinística e auditável, não uma prova formal.
5. **Contexto setorial (`perfilSetorial`)** é passado adiante mas
   nenhum template usa a linguagem específica de aviação
   agrícola/saúde/frigorífico ainda (seção 29-31) — os templates de
   fallback são genéricos por status; a especialização de linguagem por
   setor é extensão natural, não um limite arquitetural.

## P. Próxima etapa recomendada

Com uma camada de comunicação consultiva madura — sempre depois da
decisão determinística, nunca antes, com fallback garantido e
guardrails que rejeitam contradição/invenção —, a integração de um
provedor real de LLM (via `ProvedorIaConsultiva`) pode ocorrer sem
qualquer mudança nos motores. As próximas camadas fora de escopo desta
fase (Plano de Ação, Score Estratégico, otimização multidimensional, UI
executiva final) podem agora consumir tanto `ResultadoDecisaoEstrategica`
quanto `RespostaIaConsultiva` como insumos.

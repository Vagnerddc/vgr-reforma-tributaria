# Validação com XMLs reais — modo de análise de corpus

> Continuação de [piloto-importacao-xml.md](./piloto-importacao-xml.md).
> **Nenhum código produtivo foi alterado** — `calculo.ts`, Motor VGR,
> pipeline SPED, Dashboard, Simulador continuam como antes. O Motor
> Oficial continua fora do fluxo produtivo. **Nenhum classificador VGR de
> `cClassTrib` foi criado** — nem heurística por NCM/CFOP/CST/descrição,
> como explicitamente pedido. Esta fase só prepara e demonstra o
> mecanismo de medição — a resposta real depende de um corpus de XMLs
> reais que o projeto ainda não tem disponível (ver seção "Limitação de
> amostra" abaixo).
>
> **Status: fase congelada.** Único ajuste feito antes do congelamento foi
> a elegibilidade ponderada por valor financeiro (seção dedicada abaixo),
> pedida explicitamente como acréscimo final. Nenhuma nova evolução deve
> ser feita em `engine/xml/` até que um corpus real de XMLs de clientes
> piloto esteja disponível — o próximo passo é operacional (obter os
> XMLs), não de engenharia.

## O que foi implementado

`src/engine/xml/analiseCorpus.ts` — reutiliza integralmente
`engine/xml/lote.ts` (mesmo parser, mesma dedup, mesmo isolamento de
erro), sem duplicar lógica:

- `analisarLote(lote)`: processa um lote rotulado (`{ rotulo, arquivos
  }`), devolve documentos processados/com erro, itens, operações,
  **percentual RTC** e ranking de motivos de inelegibilidade ordenado do
  maior para o menor.
- `analisarCorpus(lotes[])`: roda `analisarLote` em cada lote e também
  consolida tudo — permite ver a distribuição por cliente/período (seção
  5 do pedido) e o agregado geral ao mesmo tempo.
- `classificarPadrao(operacao)`: critério **objetivo**, não heurístico —
  uma operação é `"rtc"` quando o XML trouxe `cClassTrib`, `"legado"`
  quando não. Não usa NCM, CFOP, CST ou descrição para deduzir nada
  (exigência explícita da seção 7 do pedido).
- `recomendar(percentualRtc)`: mapeia o percentual de adoção RTC medido
  para um dos três cenários (A/B/C) do pedido, com limiares **explícitos
  no código** (≥80% → A, 20–80% → B, <20% → C) — não escondidos, ajustáveis
  se a experiência real dos primeiros clientes sugerir outro corte.

### O que NÃO foi feito (por decisão explícita do pedido)

- Nenhuma regra para inferir/preencher `cClassTrib` a partir de outro
  campo. Ausente no XML = ausente no relatório, ponto.
- Nenhuma conexão do Motor Oficial ao produto.
- Nenhuma alteração em `/importar`, Dashboard, Simulador, `calculo.ts`.

## Privacidade do relatório (seção 9/10 do pedido)

O rótulo de cada lote (`"Cliente A — jul/2026"`) é definido por quem roda
a análise — **nunca** derivado automaticamente do CNPJ do XML. Testado
explicitamente: o CNPJ do emitente/destinatário do fixture de teste não
aparece em nenhum lugar da estrutura de saída de `analisarLote`
(`JSON.stringify` do relatório não contém o CNPJ do documento de teste).

Erros de parsing também são sanitizados antes de entrar no relatório
consolidado: a mensagem original do parser (`fast-xml-parser`) pode
incluir um trecho do XML malformado, útil para depuração técnica mas
não apropriado para um relatório de compartilhamento interno — por isso
`analisarCorpus`/`analisarLote` substituem esse detalhe por uma mensagem
genérica por categoria de erro, mantendo só nome de arquivo + motivo.
Esse comportamento também é testado (o texto original do XML inválido
não aparece no relatório).

Processamento 100% local — nenhuma chamada de rede é feita em qualquer
função deste módulo (mesma característica herdada de `xml/lote.ts` e
`xml/nfe.ts`, que só fazem parsing em memória).

## Demonstração do mecanismo (dados sintéticos — ver limitação abaixo)

Rodando `analisarCorpus` sobre 3 lotes sintéticos com adoção RTC
propositalmente diferente (para exercitar a distribuição por
cliente/período, seção 5 do pedido):

```
Cliente A — comércio — jul/2026
  82% RTC | 82% elegíveis

Cliente B — serviços — jul/2026
  24% RTC | 24% elegíveis

Cliente C — indústria — ago/2026
  91% RTC | 91% elegíveis

=== Consolidado ===
Documentos: 350 | Operações: 350
RTC: 72,6% | Elegível normativa: 72,6%

Ranking de motivos de inelegibilidade:
  cClassTrib ausente — 27,4%
  NCM ausente — 3,1%

=== Recomendação ===
Cenário B — Arquitetura híbrida por operação
"72,6% das operações estão no padrão RTC — parte relevante já pode ir ao
Motor Oficial, parte ainda depende do Motor VGR/estimativa. Enriquecimento
deve ser avaliado só para os gaps que sobrarem, não implementado às ciegas."
```

Isso confirma que o mecanismo produz exatamente a forma de relatório
pedida (distribuição por cliente/período + ranking + recomendação A/B/C
com justificativa numérica) — mas **os números acima são sintéticos**,
gerados para testar o código, não uma medição de clientes reais.

## Limitação de amostra — a mesma ressalva das duas fases anteriores

O projeto não tem hoje um corpus de XMLs reais de clientes disponível.
Isso já havia sido registrado nas duas entregas anteriores
(`fundacao-granular.md` seção H, `piloto-importacao-xml.md` seção D/E/F)
e continua sendo o bloqueio real desta fase — não é possível responder
com dados reais "qual o nível de adoção RTC dos nossos clientes" sem
XMLs reais para alimentar `analisarCorpus`.

**O que está pronto**: basta chamar

```ts
analisarCorpus([
  { rotulo: "Cliente A — jul/2026", arquivos: xmlsDoClienteA },
  { rotulo: "Cliente B — jul/2026", arquivos: xmlsDoClienteB },
  // ...
]);
```

com os XMLs reais (ou `.zip` deles, expandidos via `xml/zip.ts`) assim que
estiverem disponíveis, com um lote por cliente/período. Nenhum código
adicional é necessário — só o corpus.

## Elegibilidade ponderada por valor financeiro (adicionado antes de congelar a fase)

Acréscimo pedido explicitamente antes do congelamento: 10 mil itens de R$
50 não têm o mesmo peso estratégico que 500 operações de R$ 100 mil.
`medirCobertura` (`lote.ts`) agora também soma `valorOperacao` das
operações elegíveis vs. o total conhecido, expondo:

```ts
cobertura.valorPonderado.percentualElegivelPorValor
cobertura.valorPonderado.operacoesSemValorConhecido // quantas não entraram na conta, por falta do próprio valor
cobertura.percentualInelegiveisSoPorCClassTrib       // das inelegíveis, quantas têm cClassTrib como ÚNICO motivo
```

E a recomendação (`analiseCorpus.ts`) deixou de ser um veredito automático
rígido: `recomendacao.cenarioSugerido` continua existindo (mesmos
limiares de referência: ≥80%/20–80%/<20% por item), mas agora vem
acompanhado de `recomendacao.ressalvas` — avisos textuais gerados quando:

- a elegibilidade por valor diverge da elegibilidade por item em 10 pontos
  percentuais ou mais (sinalizando explicitamente se o cenário real é
  **melhor** ou **pior** do que a contagem por item sugere — o exemplo do
  pedido, "70% elegível por item pode ser ótimo se os 30% restantes são só
  5% do valor", é exatamente esse caso);
- `percentualInelegiveisSoPorCClassTrib` está muito alto (≥70%, um
  classificador resolveria a maior parte do gap de uma vez) ou muito baixo
  (<40%, o gap está espalhado e um classificador sozinho não bastaria);
- há operações sem valor conhecido, que ficaram fora da ponderação.

Testado com um caso propositalmente extremo (10 itens pequenos elegíveis +
1 item de R$ 100.000 inelegível): elegibilidade por item ≈ 90,9%,
elegibilidade por valor < 1% — a ressalva de divergência "PIOR" é
disparada corretamente, confirmando que a métrica captura exatamente a
situação que motivou o pedido.

## Testes

`src/engine/xml/__tests__/analiseCorpus.test.ts` (9 testes): classificação
objetiva RTC/legado, ausência de CNPJ no relatório, ranking ordenado,
consolidação de múltiplos lotes preservando a distribuição por lote,
recomendação A quando adoção é alta, recomendação C quando é baixa,
sanitização de erro sem conteúdo de XML, divergência item×valor extrema, e
concentração do gap em cClassTrib. Suite completa: **230 testes passando**
(221 antes desta fase + 9 novos), `tsc -b` e `oxlint` limpos, zero
alteração em teste existente.

## Agrupamento automático por cliente + mês de emissão real (adicionado depois do congelamento — complemento explícito)

O corpus real chega com XMLs de vários clientes e meses misturados, fora
de ordem cronológica de arquivo/pasta. `src/engine/xml/analiseTemporal.ts`
resolve isso sem exigir que quem roda a análise pré-separe nada:

- **Mês**: extraído exclusivamente de `identificacao.data` (a data de
  emissão real, dentro do XML) — nunca da ordem de leitura do arquivo ou
  do nome da pasta. Testado explicitamente: 3 arquivos entregues fora de
  ordem (agosto, depois janeiro, depois março) são classificados no mês
  correto de cada um.
- **Cliente**: identificado localmente pelo CNPJ (emitente quando a
  operação é de saída, destinatário quando é de entrada — a contraparte
  varia por documento, a empresa do próprio cliente se repete), usado só
  para agrupar; o relatório final anonimiza como `"Cliente A"`, `"Cliente
  B"`... em ordem determinística (CNPJ ordenado, não ordem de chegada).
  Testado: o CNPJ real não aparece em nenhum lugar da saída
  (`JSON.stringify` do relatório não contém os CNPJs de teste).
- **Sequência cronológica garantida**: `gerarSequenciaMeses("2026-01",
  "2026-08")` sempre devolve Jan→Ago em ordem, e cada cliente recebe uma
  linha por mês da sequência — mesmo os meses sem documento, marcados
  `semDocumentos: true` (nunca com zero fabricado se o dado simplesmente
  não existe: a estrutura distingue "0% medido" de "não há documento
  nesse mês").
- **Nada é descartado silenciosamente**: documentos com data fora da
  janela informada contam em `documentosForaDoPeriodo`; documentos sem
  data interpretável contam em `documentosSemDataInterpretavel` — nenhum
  dos dois é alocado a um mês por suposição.

Demonstração (corpus sintético, 280 documentos de 2 clientes ao longo de
8 meses, arquivos deliberadamente embaralhados antes de passar pela
função — para provar que a ordem de entrada não importa):

```
Cliente A (simulando adaptação progressiva do ERP)
Jan/2026 |  5% RTC | cClassTrib ausente (95,0%)
Fev/2026 | 10% RTC | cClassTrib ausente (90,0%)
Mar/2026 | 20% RTC | cClassTrib ausente (80,0%)
Abr/2026 | 35% RTC | cClassTrib ausente (65,0%)
Mai/2026 | 50% RTC | cClassTrib ausente (50,0%)
Jun/2026 | 65% RTC | cClassTrib ausente (35,0%)
Jul/2026 | 80% RTC | cClassTrib ausente (20,0%)
Ago/2026 | 90% RTC | cClassTrib ausente (10,0%)
Consolidado do período: 44,4% RTC

Cliente B (simulando adoção estagnada)
Jan/2026 → Ago/2026: 20% RTC em todos os meses, sem variação
Consolidado do período: 20,0% RTC

Consolidado geral (2 clientes, 280 documentos): 33,9% RTC
```

Isso é exatamente o tipo de sinal que motivou o pedido: se a evolução
mensal real mostrar uma curva como a do "Cliente A" sintético acima
(adoção subindo mês a mês por conta natural dos emissores/ERPs), a
decisão de investir num classificador VGR muda — não é mais sobre "temos
33,9% hoje", é sobre "estamos a caminho de 90% sem esforço nosso, só
esperando o mercado se adaptar" vs. "estagnado em 20%, o mercado não vai
resolver isso por conta própria". **Os números acima continuam
sintéticos** — a mesma limitação de amostra registrada nas fases
anteriores se aplica; a função está pronta para os XMLs reais.

### Testes

`src/engine/xml/__tests__/analiseTemporal.test.ts` (7 testes): ordem
cronológica correta independente da ordem dos arquivos, sequência de
meses sempre ordenada, meses sem documento sinalizados sem inventar dado,
separação e anonimização automática de 2 clientes sem expor CNPJ,
documento fora da janela contado e não descartado nem mal-alocado,
consolidado do período sem perder a granularidade mensal. Suite completa:
**237 testes passando** (230 antes deste complemento + 7 novos), `tsc -b`
e `oxlint` limpos, zero alteração em teste existente.

## Recomendação desta fase

Não há uma recomendação A/B/C real ainda — **essa é exatamente a
conclusão correta neste ponto**: o pedido foi explícito que a decisão só
deve ser tomada depois de medir dados reais, e não há dados reais
disponíveis. O próximo passo não é mais engenharia — é **obter uma
amostra real de XMLs de alguns clientes piloto** (idealmente comércio,
indústria e serviço, tamanhos diferentes, mais de um período de 2026,
como pedido na seção "Amostra desejada") e rodar `analisarCorpus` sobre
ela. O resultado dessa execução real é o que deve virar a próxima
entrega — inclusive, potencialmente, o indicador de "Prontidão fiscal
para RTC" mencionado como possível produto futuro, que já é
literalmente `consolidado.percentualElegivelNormativa` deste módulo,
sem trabalho adicional de engenharia além de uma camada de apresentação.

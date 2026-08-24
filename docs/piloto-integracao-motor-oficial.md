# Piloto controlado: OfficialEngineAdapter com XML real (H e K)

> Continuação de [validacao-corpus-real-xml.md](./validacao-corpus-real-xml.md).
> **Nenhuma UI, Dashboard, Simulador ou Resultado foi alterado.** `calculo.ts`
> não foi tocado. O Motor Oficial não foi conectado a nenhum fluxo
> produtivo — chamado apenas por scripts de validação, contra o container
> local, depois removidos. O gate jurídico de licenciamento continua
> vigente (seção 11 abaixo). Cliente J não entrou nesta rodada, por
> decisão explícita.

## 1. Correção do modelo de propriedade do corpus

Implementada em `src/engine/xml/analiseTemporal.ts`: a função agora exige
um `identificarProprietario(nomeArquivo): string` explícito — a empresa
analisada é resolvida pelo **contexto do arquivo** (ex.: prefixo de pasta),
nunca mais inferida de `tpNF`/emitente/destinatário. Um novo teste
(`analiseTemporal.test.ts`) reproduz exatamente o caso real que motivou a
correção: uma nota de devolução emitida pela própria empresa
(`tpNF="0"`) continua atribuída a ela, não à contraparte. Isso não é mais
generalizável como "emitente sempre" — é uma função fornecida por quem
chama a análise, porque só o contexto de onde os arquivos vieram sabe
quem é o proprietário real.

## 2. Três métricas de elegibilidade, agora implementadas

`medirCobertura` (`lote.ts`) passou a expor três conceitos, nunca
confundidos entre si:

| Métrica | Campo | Fonte |
|---|---|---|
| A. Por quantidade de itens | `percentualElegivelNormativa` | contagem simples |
| B. Por valor bruto movimentado | `valorPonderado.percentualElegivelPorValor` | `valores.valorOperacao` (vProd da NF-e) |
| C. Por exposição/base tributária | `exposicaoTributaria.percentualElegivelPorBase` | `valores.baseCalculo` (vBC do grupo ICMS/IBSCBS) — **"não determinada" quando o documento não informa base, nunca aproximada pelo valor bruto** |

### Resultado real (H + K + J, atribuição corrigida)

| | Itens | Valor bruto | Base tributária conhecida |
|---|---:|---:|---:|
| **Cliente J** (0% elegível) | 120 | R$ 8.056.440 | **R$ 1.741.239 — só 21,6% do valor bruto tem base determinada** |
| Cliente K (100% elegível) | 588 | R$ 1.798.709 | R$ 1.785.113 (99,2%) |
| Cliente H (~100% elegível) | 7.709 | R$ 981.395 | R$ 918.641 (93,6%) |

**Achado novo, mais preciso que o valor bruto**: do valor bruto do Cliente
J, quase 80% **não tem base tributária determinável no próprio
documento** — não é que sabemos que há R$ 8 milhões de exposição
tributária inelegível; é que, para a maior parte desse valor, **não
sabemos qual é a base tributária de fato**, porque o documento (remessa/
devolução/depósito) simplesmente não a informa. Isso é uma leitura mais
honesta do que "74% do valor do corpus está exposto": parte relevante do
"expõe" continua sendo, literalmente, "não determinada" — não zero, não
alto, desconhecido. Da fração que **tem** base conhecida (R$ 1,74 milhão),
0% é elegível — o mesmo padrão do Cliente J se confirma mesmo nessa leitura
mais cuidadosa.

## 3–4. Levantamento do que os XMLs permitem medir (sem nova metodologia)

Confirmado empiricamente, sem implementar classificação de "operação sem
efeito econômico" (não implementado, como pedido — apenas levantado):

- **Valor tributável / base de CBS/IBS**: medível quando `gIBSCBS.vBC` (ou
  `ICMS.vBC` legado) está presente — em H e K, quase sempre; em J,
  ausente em 43% dos itens (52 de 120).
- **Valor contábil/venda (vProd)**: sempre presente (é campo obrigatório
  do XML) — mas não equivale à base tributária, como o achado acima
  confirma.
- **Remessas/devoluções/depósitos**: identificáveis pelo CFOP (ex.: 1913,
  5905-5949, 6918 no corpus real do Cliente J), mas **não implementei**
  uma classificação "operação sem efeito econômico" — isso exigiria uma
  tabela de CFOP validada, que não construí nesta fase (ficaria fácil de
  fazer errado sem revisão tributária, exatamente o tipo de regra nova que
  foi pedido para não criar agora).

## 5–10. Piloto real com `OfficialEngineAdapter`

### Implementação

`src/engine/motorOficial/adapter.ts` — `OfficialEngineAdapter.calcularOperacao(op)`:
converte `OperacaoTributariaNormalizada` → contrato real (`regime-geral`),
chama o componente, converte a resposta → `ResultadoCalculoNormalizado`,
carimba `origemCalculo: "motor_oficial"`, versão e timestamp. **Nunca
chama o componente se a operação não estiver normativamente completa**
(verificado antes da requisição). Erros HTTP/rede são devolvidos como
resultado estruturado — nunca um resultado com aparência oficial fabricado.
5 testes isolados (mock de `fetch`, sem dependência de rede/Docker no CI).

### Amostra real (24 operações elegíveis, H e K, diversidade de CFOP e valor)

- **21 sucesso, 3 falha, 0 exceção não tratada.**
- CFOPs cobertos: 5403, 5405, 5102, 5910, 1411, 6202, 1202, 5202 — de
  R$ 2,76 a R$ 26.769,60.

### Dois problemas reais de mapeamento encontrados e corrigidos nesta rodada

1. **`cst` ambíguo entre sistema legado e RTC.** Documentos de transição
   (LC 214/2025) trazem os dois grupos, `ICMS` (legado, 2-3 dígitos) E
   `IBSCBS` (RTC, sempre 3 dígitos) no mesmo item. O parser priorizava o
   legado, e o Motor Oficial rejeitou 100% da primeira tentativa com
   `"cst: size must be between 3 and 3"`. Corrigido em `nfe.ts`: o CST do
   grupo `IBSCBS` agora tem prioridade quando presente — é o que o
   contrato do Motor Oficial de fato espera. Teste de regressão adicionado
   reproduzindo exatamente esse cenário de dois grupos coexistindo.
2. **Extração de fundamento legal incompleta.** O regex só capturava
   citações no formato "Art. X" — a resposta real também cita só a lei
   ("LC 214/2025", sem artigo específico, comum em "tributação integral"
   sem redução). Corrigido; teste adicionado com a resposta real
   observada.

### Problema real encontrado e **não corrigido** nesta rodada (fora de escopo, sem regra inventada)

**3 de 24 operações (CFOP 6202 — devolução interestadual) falharam com
`"Município de código 5002704 não pertence à UF de sigla PR/GO"`.**
Causa: nosso modelo pareia `uf` (lido do destinatário) com `municipio`
(`cMunFG`, município do fato gerador — que para essas operações
específicas continua sendo o município de origem/estabelecimento, não o
do destinatário interestadual). A combinação enviada ao Motor Oficial é
estruturalmente inconsistente para operações interestaduais. **Não
corrigi isso agora** — corrigir corretamente exigiria decidir, com base
tributária real (não uma suposição de engenharia), qual UF deve
acompanhar qual município para cada tipo de CFOP interestadual, e isso é
uma regra tributária, não um bug de parsing. Registrado como limitação
conhecida do adapter.

### O que o Motor Oficial acrescenta (visto na prática, não hipoteticamente)

- **Alíquota efetiva real da fase de transição**: todas as 21 respostas
  bem-sucedidas mostraram carga combinada CBS+IBS em torno de **1,00% da
  base** — consistente com a alíquota-teste reduzida do período de
  transição 2026-2027 da reforma (bem abaixo da alíquota final ~26,5%
  prevista para 2033). O Motor VGR não tem essa informação hoje —
  `calculo.ts` opera sobre alíquotas parametrizadas manualmente em
  `config/parametros.json`, não descobre a alíquota vigente automaticamente
  por operação/período.
- **Fundamento legal por operação** (`LC 214/2025`, e em outras
  situações citação de artigo específico — confirmado no spike anterior
  com "Art. 412"/"Art. 461") — informação que o Motor VGR simplesmente
  não produz, porque não é um motor normativo por operação.
- **Base de cálculo efetivamente considerada** (`gIBSCBS.vBC`), que em
  vários casos reais **diverge do valor bruto do item** (ex.: uma
  operação de R$ 11.073,21 teve base de cálculo de R$ 4.240,28 — o Motor
  Oficial aplicou uma redução/segregação de base que o valor bruto por si
  só não revela). Isso é evidência direta do próprio achado da seção 2:
  valor bruto ≠ base tributária, confirmado agora não só na ausência de
  `vBC` no XML de entrada, mas na PRÓPRIA resposta do motor.

### Sobre comparar Motor Oficial × Motor VGR (itens 13/14 do pedido)

**Não fiz uma comparação numérica — e isso não é uma lacuna, é o
resultado correto.** `calculo.ts` hoje é um motor gerencial agregado
(`faturamento × alíquota × percentualCustosCreditaveis`), sem nenhuma
função que calcule CBS/IBS de uma operação individual. Não existe hoje um
"resultado VGR equivalente" para nenhuma das 21 operações do piloto — não
porque as metodologias divergem em algum número, mas porque **o Motor VGR
não opera nesse nível de granularidade**. Isso confirma diretamente a
decisão de design já registrada em `docs/arquitetura-motor-hibrido.md`
§4 (motor operacional × motor gerencial, papéis distintos, não forçados
numa interface única) — o piloto não achou uma divergência para
explicar; achou a ausência estrutural de uma base de comparação, o que é
informação nova e válida por si.

## 11. Gate jurídico

Não alterado. Todo o piloto rodou contra o container local, iniciado e
depois parado manualmente; nenhum binário foi embutido, redistribuído ou
tornado dependência automática de qualquer ambiente de cliente.

## Respostas objetivas (seção 20 do pedido)

1. **O adapter funciona com XML real?** Sim — 21/24 chamadas reais bem-
   sucedidas contra o componente local, com dados de clientes reais (H/K).
2. **O mapeamento de entrada é suficiente?** **Não totalmente** — dois
   problemas reais foram encontrados e corrigidos nesta própria rodada
   (prioridade de CST, extração de fundamento), e um terceiro (par UF/
   município em operações interestaduais) foi encontrado e **não**
   corrigido, por exigir decisão tributária, não só técnica.
3. **O resultado normalizado preserva toda informação importante?** Sim,
   para os campos mapeados (CBS, IBS, IS, base, alíquota efetiva,
   memória, fundamento) — confirmado com respostas reais, incluindo o
   caso "LC 214/2025" sem artigo específico.
4. **A versão do Motor Oficial fica registrada?** Sim — carimbada pelo
   adapter (`V0039 - 1.2.4-b0e47264 - APR`), nunca extraída da resposta
   (que não se autoidentifica, como já confirmado no spike original).
5. **A memória normativa fica preservada?** Sim, incluindo o caso real
   não coberto pelo regex original (corrigido nesta rodada).
6. **Quais diferenças aparecem entre Motor Oficial e Motor VGR?** Nenhuma
   comparação numérica é possível hoje — ver seção dedicada acima.
7. **Essas diferenças são explicáveis?** N/A pelo motivo acima — não há
   divergência numérica para explicar, há ausência estrutural de
   comparação.
8. **Qual informação adicional o Motor Oficial agrega?** Alíquota
   efetiva real por período de transição, fundamento legal por operação,
   e a base de cálculo real (que diverge do valor bruto) — nenhuma
   dessas três existe hoje no Motor VGR.
9. **Como medir exposição tributária sem confundir com valor bruto?**
   Implementado (`exposicaoTributaria` em `medirCobertura`) — usa
   `baseCalculo` do próprio XML, marca "não determinada" quando ausente,
   nunca aproxima pelo valor bruto. Aplicado ao Cliente J: apenas 21,6%
   do seu valor bruto tem base determinável, e essa fração também é 0%
   elegível.
10. **A arquitetura B1 continua sendo a melhor depois da primeira
    execução oficial com dados reais?** **Sim, reforçada.** O piloto não
    revelou nenhuma limitação do Motor Oficial em si (21/24 sucesso,
    resultados coerentes com a legislação de transição) — revelou que a
    parte que precisa de atenção é a qualidade do **adapter** (2 bugs
    corrigidos, 1 limitação conhecida documentada), não do motor nem do
    Cliente J. B1 continua correta: nenhuma evidência aponta para
    construir um classificador de `cClassTrib` — o gap do Cliente J
    permanece sendo, com mais precisão agora, uma questão de emissor/ERP
    e de tipo de operação (remessa/devolução), confirmada de duas formas
    independentes (ausência de `cClassTrib` no XML bruto E ausência de
    base tributária determinável no mesmo conjunto de documentos).

## O que continua congelado

Classificador VGR de `cClassTrib`, integração com UI/Dashboard,
processamento em massa das ~8.400 operações, redistribuição do
componente oficial — nenhum desses foi iniciado.

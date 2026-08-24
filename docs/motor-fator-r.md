# Fator R — integrado ao Motor do Simples

> Continuação de [motor-simples-nacional.md](./motor-simples-nacional.md).
> **`calculo.ts` não foi alterado.** Nenhum Lucro Real, Motor Financeiro,
> IRPF/INSS estratégico, recomendação ou UI foi tocado. 364 testes
> passando (343 + 21 novos), `tsc`/lint limpos. Fator R é uma regra de
> **decisão de enquadramento**, não um novo `MotorRegime`, novo regime,
> ou componente tributário — implementado dentro do próprio núcleo do
> Simples (seção 1 do pedido).

## A. Arquitetura do Fator R

```
src/engine/motorRegimes/simplesNacional/fatorR/
  fs12.ts        — FS12 ANUAL a partir de CenarioEmpresa.pessoas (componentes tipados)
  fs12Mensal.ts   — FS12 rolante mês a mês (espelha rbt12.ts, módulo próprio — ver seção M)
  fatorR.ts       — decisão mensal: Fator R, Anexo III/V, distância, FS12 necessária/adicional
```

Fluxo real (idêntico ao proposto na seção 1 do pedido):
`nucleo.ts` já classificava atividades via `anexo.ts::classificarAnexo` —
atividades que retornavam `"indeterminado_fator_r"` eram puladas.
Agora, essas mesmas atividades entram em um segundo caminho
(`porAtividadeFatorR`, dentro de `nucleo.ts`) que calcula RBT12 (já
existia) e FS12 (novo) mês a mês, decide o anexo em `fatorR.ts`, e só
então chama `calcularDasMensalComFatorR`/`consolidarDasAnualComFatorR`
(extensões de `das.ts`). O restante do núcleo (IBS/CBS reaproveitado do
Motor VGR, consolidação, `compararRegimes`) não sabe que Fator R existe.

## B. Dados considerados na FS12

Confirmado por busca externa (LC 123/2006, art. 18, §§24/25, com
redação da LC 155/2016): salários e 13º pagos a empregados/temporários,
retiradas de pró-labore, CPP efetivamente recolhida, FGTS efetivamente
recolhido. Mapeados de `CenarioEmpresa.pessoas`: `folhaAnual` (salários),
`encargosAnual` (proxy de CPP+FGTS), `proLaboreAnual`.

## C. Dados deliberadamente excluídos

`PessoasEmpresa.terceirosAutonomosAnual` **nunca** entra na FS12 —
testado explicitamente (mesmo informado com valor alto, não é somado).
Médicos PJ, prestadores PJ, terceirizados e distribuição de lucros não
têm campo equivalente em `CenarioEmpresa` e, se existissem, também não
entrariam (fora da relação de contribuinte individual computável).

## D. Cálculo temporal

`fs12Mensal.ts` replica a mesma janela rolante de 12 meses já usada em
`rbt12.ts` — nunca `folha anual ÷ receita anual` diretamente. Testado
(seção "Janela móvel" abaixo) que o Fator R evolui mês a mês e pode
cruzar 28% dentro do mesmo ano, e que o anexo muda exatamente no mês da
travessia — nunca fixado em janeiro.

## E. Tratamento de início de atividade

**Decisão conservadora, documentada**: apesar de `fs12Mensal.ts`
implementar estruturalmente a mesma proporcionalização usada para RBT12
(LC 123/2006, art. 3º, §2º), **não encontrei fundamento normativo
específico confirmado** para aplicar essa mesma proporcionalização à
FS12. Por isso, `fatorR.ts::calcularFatorRDoAno` recebe um flag
`inicioDeAtividadeNoAno` e, quando verdadeiro, **retorna indeterminado**
(código `HISTORICO_FOLHA_INSUFICIENTE`), independentemente do que
`fs12Mensal.ts` teria calculado. Isso é mais conservador do que assumir
por analogia — exatamente o que a seção 15/16 do pedido pediu ("somente
com fundamento seguro").

## F. Integração com Anexos III/V

`normativa.ts` ganhou a tabela do Anexo V (6 faixas, confirmada por
busca externa) e `LIMITE_FATOR_R` (28%, LC 123/2006, art. 18, §5º-M).
`fatorR.ts::decidirAnexo` arredonda a 4 casas decimais antes de comparar
— testado com um caso concreto de imprecisão de ponto flutuante
(`0.84/3`) para confirmar que não decide o anexo errado por 1 bit de
diferença.

## G. Multiatividade

RBT12 é sempre da **empresa inteira** (soma de todas as atividades
resolvíveis — fixas E dependentes de Fator R, corrigindo uma limitação
implícita da fase anterior, onde só as atividades de anexo fixo entravam
na soma). FS12 também é sempre da empresa inteira (não por atividade —
a lei não prevê "FS12 da atividade X"). Testado: comércio (Anexo I fixo)
+ consultoria (Fator R) no mesmo cenário — cada atividade mantém seu
próprio `regraAplicada` (`anexo_i` vs. `fator_r`), e só a atividade de
serviço é afetada pelo Fator R.

## H. Indicador de distância até 28%

`FatorRMensal.distanciaLimitePp` — negativo abaixo do limite (Anexo V),
positivo acima (Anexo III). Testado nos dois sentidos. Alerta
`FATOR_R_PROXIMO_LIMITE` quando a distância fica dentro de ±2 p.p., só
informativo (não muda a decisão).

## I. FS12 adicional necessária

`FatorRMensal.fs12NecessariaParaLimite` (`RBT12 × 28%`) e
`fs12AdicionalNecessaria` (`max(0, necessária − atual)`) — testado que
nunca fica negativo quando já acima do limite. **Nunca chamado de
"pró-labore necessário"** em nenhum lugar do código — é sempre "FS12",
que pode ser composta por mais de um elemento (seção 23 do pedido).

## J. Economia potencial de DAS

**Não implementado nesta fase.** O pedido (seção 24) permitia como
opcional ("pode ser permitido") — decidi não implementar para manter o
escopo fechado no que a seção 47 exige como resultado mínimo (Fator R,
anexo, DAS, distância, FS12 necessária/adicional, memória). Calcular
"DAS no cenário-limite" exigiria re-executar todo o núcleo com uma FS12
hipotética — mecanicamente simples de adicionar depois, mas não construído
agora para não ampliar escopo sem necessidade.

## K. Casos indeterminados

Três motivos distintos, cada um com código estruturado (seção 20 do
pedido): `FATOR_R_INDETERMINADO` (FS12 totalmente ausente),
`HISTORICO_FOLHA_INSUFICIENTE` (início de atividade, seção E),
`FS12_INCOMPLETA` (FS12 parcial — soma só o que existe, sinaliza o que
falta, nunca aproxima). Testado cada um isoladamente. Quando
indeterminado, a atividade correspondente não é calculada — mesma
disciplina do Presumido.

## L. Fontes normativas

LC 123/2006, arts. 3º (§2º), 18 (§§5º-J a 5º-M, 20, 24, 25), com redação
da LC 155/2016. Tabela do Anexo V e a definição de FS12 **confirmadas
por busca externa nesta fase** (não assumidas de memória) — mesma
disciplina já aplicada à tabela do Anexo I na fase anterior, depois que
um teste matemático revelou uma inconsistência que acabou sendo
confirmada como comportamento real da lei.

## M. Limitações conhecidas

1. **Início de atividade para Fator R é sempre indeterminado** (seção E)
   — decisão conservadora, não uma limitação técnica; poderia ser
   revisitada se uma fonte normativa específica for confirmada.
2. **`fs12Mensal.ts` duplica a estrutura de `rbt12.ts`** em vez de
   generalizar um helper comum — decisão deliberada (documentada no
   próprio arquivo) para não acoplar o cálculo já testado de RBT12 a uma
   refatoração genérica nesta fase.
3. **Economia potencial de DAS não implementada** (seção J) — opcional
   no pedido, deixada para quando a Fase Financeira/Estratégica justificar
   o esforço.
4. **`encargosAnual` é uma aproximação de CPP+FGTS** — `CenarioEmpresa`
   não os separa em campos distintos (mesma limitação já registrada na
   fase do Presumido para outros componentes).
5. **RBT12 total agora inclui atividades Fator-R-dependentes** mesmo
   quando o Fator R delas acaba indeterminado — correto para RBT12 (é
   receita real da empresa), mas significa que a RBT12 usada para as
   atividades de anexo fixo pode mudar ligeiramente em relação ao
   resultado da fase anterior, quando havia atividades Fator R no
   cenário (nenhum teste de regressão anterior tinha esse caso, então não
   foi detectado como quebra — comportamento **mais correto**, não um bug).

---

Critério de sucesso (seção 49 do pedido) confirmado: clínica médica e
SaaS, antes indeterminadas, agora produzem Fator R/anexo/DAS/memória
quando há dados de pessoas; RBT12 e FS12 são tratadas temporalmente
(rolagem mensal real, testada cruzando 28% no meio do ano); a fronteira
de 28% é matematicamente correta (incluindo caso de ponto flutuante);
multiatividade preserva o tratamento independente por atividade; FS12
adicional é calculada sem virar recomendação; nenhuma economia
consolidada, IRPF ou INSS estratégico foi criada; `calculo.ts` e
`compararRegimes` permanecem intocados.

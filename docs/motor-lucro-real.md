# Lucro Real — terceiro MotorRegime real

> Continuação de [motor-fator-r.md](./motor-fator-r.md).
> **`calculo.ts` não foi alterado.** Nenhum Motor Financeiro, ECD/ECF,
> recomendação, Score, IA ou UI foi tocado. 393 testes passando (364 +
> 29 novos), `tsc`/lint limpos. Princípio central: **lucro contábil ≠
> lucro tributável** — nunca `IRPJ = lucro contábil × alíquota`.

## A. Arquitetura do Motor do Lucro Real

```
src/engine/motorRegimes/lucroReal/
  normativa.ts      — reaproveita alíquotas do Presumido; adiciona trava de 30%
  elegibilidade.ts   — obrigatoriedade (nunca "elegivel"/"inelegivel" puros)
  baseFiscal.ts      — lucro contábil → adições/exclusões → lucro líquido ajustado (por tributo)
  prejuizoFiscal.ts  — compensação com trava de 30%, imutável
  irpjCsll.ts        — apuração trimestral sequencial, transporta saldo entre trimestres
  qualidade.ts        — completa/parcial/estimada/insuficiente
  motor.ts           — motorLucroReal: MotorRegime real, resultado sempre consolidado
```

## B. Elegibilidade e obrigatoriedade

`AvaliacaoElegibilidade.status` para o Real nunca é `"elegivel"`/
`"inelegivel"` — testado explicitamente. É sempre `"obrigatorio"`
(receita > R$ 78.000.000, Lei 9.718/1998, art. 14, I — confirmado por
busca externa; ou flag explícita de outra hipótese do art. 14),
`"opcional"` (nenhuma hipótese identificada — Real está sempre
disponível para qualquer empresa) ou `"indeterminado"` (dado ausente, ou
arquétipo financeiro sem confirmação — mesma disciplina já usada nos
outros dois motores). Testado no limite exato de R$ 78.000.000,00.

## C. Formação da base fiscal

`baseFiscal.ts::calcularBaseAjustada(lucroContabilValor, ajustesFiscais,
tributo)` — nunca aplica alíquota direto sobre o lucro contábil. Testado
com adição isolada, exclusão isolada, e a combinação dos dois. Bases de
IRPJ e CSLL são calculadas **separadamente**, e testado explicitamente
que um ajuste com `tributoAplicavel: "csll"` produz bases diferentes
para os dois tributos.

## D. Adições e exclusões

`AjusteFiscal` (extensão do contrato, ver seção O) — só o CONTRATO para
receber ajustes já identificados; nenhuma adição/exclusão específica é
inferida ou catalogada nesta fase (seção 8/37 do pedido: nenhuma
"enciclopédia fiscal hardcoded", nenhuma inferência por nome de
despesa).

## E. Prejuízo fiscal

`prejuizoFiscal.ts::compensarPrejuizo` — trava de 30% do lucro líquido
ajustado (Lei 9.065/1995, art. 15, confirmada por busca externa).
Testado: saldo maior que o limite (só 30% é usado, resto fica como
saldo remanescente), saldo menor que o limite (usa tudo), prejuízo no
próprio período (soma ao saldo, base final zero), e imutabilidade
(nunca modifica o saldo recebido — cada chamada devolve um novo valor).

## F. Base negativa da CSLL

Estrutura simétrica e **separada** de prejuízo fiscal (`saldoBaseNegativaCsllFinal`,
distinto de `saldoPrejuizoIrpjFinal`) — mesma trava de 30% (Lei
9.065/1995, art. 16), mas nunca compartilha o mesmo saldo do IRPJ.
Testado com bases de entrada diferentes produzindo saldos finais
diferentes.

## G. IRPJ e adicional

Reaproveita `ALIQUOTA_IRPJ`/`ALIQUOTA_ADICIONAL_IRPJ`/
`LIMITE_ADICIONAL_IRPJ_TRIMESTRAL` do Presumido (mesmo componente
`"adicional_irpj"` já criado naquela fase — **nenhum segundo tipo
criado**, exatamente como pedido na seção 16). Diferença real: aqui a
base do trimestre já passou pela compensação de prejuízo (seção E)
antes de comparar com o limite de R$ 60.000 — testado que isso pode
reduzir ou eliminar o adicional em relação ao cálculo sem compensação.

## H. CSLL

Componente independente (`"csll"`), base própria, mesma alíquota (9%)
mas nunca a mesma base do IRPJ quando há ajustes específicos por
tributo ou saldos de compensação diferentes — testado.

## I. Periodicidade suportada

**Só trimestral definitivo** (Lei 9.430/1996, art. 1º) — implementado
com um loop real de 4 trimestres, saldo de prejuízo transportado
trimestre a trimestre dentro do próprio ano. **Anual com
estimativas/balanços de suspensão/redução NÃO implementado** —
limitação documentada explicitamente (seção O), nunca escolhida
silenciosamente.

## J. Qualidade da base fiscal

`qualidade.ts` — `"completa"` (lucro real + ajustes informados),
`"parcial"` (lucro real, sem ajustes — nunca lido como "sem ajustes
reais"), `"estimada"` (lucro contábil com `status: "estimado"`),
`"insuficiente"` (lucro contábil ausente). Testado cada caso; a
qualidade aparece como alerta explícito no resultado, nunca escondida.

## K. Multi-ano

8 anos (`ANOS_SIMULACAO`), saldo de prejuízo/base negativa evoluindo
sequencialmente — testado que o cenário original nunca é mutado
(`JSON.stringify` antes/depois idêntico) e que a memória final reporta
o saldo consumido ao longo do período.

## L. Integração com demais motores

IBS/CBS reaproveitados do Motor VGR exatamente como Presumido/Simples
(`cenarioParaSimulacaoInput` + `simular()`, `calculo.ts` intocado).
Testado em `compararRegimes` com os **três motores reais
simultaneamente** (Presumido + Simples + Real) — o comparador não
executa nenhuma fórmula fiscal, só orquestra.

## M. Componentes ainda indisponíveis

PIS/COFINS/ICMS/ISS — mesma limitação já registrada no Presumido/Simples
(`calculo.ts` não os segrega de forma auditável). Alerta explícito no
resultado sempre que a qualidade não é `"completa"`, deixando claro que
`cargaTotal` reflete só os componentes calculados, nunca apresentado
como carga tributária total definitiva (seção 28 do pedido).

## N. Fontes normativas

Lei 9.249/1995 (arts. 3º, 20 — reaproveitadas do Presumido), Lei
9.430/1996 (art. 1º, apuração trimestral; art. 3º, adicional), Lei
9.718/1998 (art. 14, obrigatoriedade — confirmado por busca externa
nesta fase), Lei 9.065/1995 (arts. 15/16, trava de 30% — confirmado por
busca externa, incluindo a constitucionalidade reafirmada pelo STF).

## O. Limitações conhecidas

1. **Extensão de contrato desta fase**: `CenarioEmpresa.tributario`
   ganhou `ajustesFiscais?: AjusteFiscal[]` e
   `saldosPrejuizoAnteriores?: {irpj?, csll?}` — aditiva, documentada no
   próprio `cenarioEmpresa.ts` com o mesmo padrão das extensões
   anteriores (`adicional_irpj`, `dataAberturaEmpresa`). Nenhum campo
   existente foi alterado.
2. **Só apuração trimestral definitiva** — anual com estimativas não
   modelada (seção I).
3. **Obrigatoriedade por atividade financeira fica indeterminada**, nunca
   confirmada por aproximação de arquétipo — mesma decisão já tomada no
   Presumido/Simples para o mesmo tipo de ambiguidade.
4. **Resultado sempre consolidado, nunca por atividade** — decisão
   deliberada (seção 22/23 do pedido): `porAtividade` nem é preenchido
   pelo Lucro Real, porque a apuração de IRPJ/CSLL é jurídica/empresarial,
   não replica a segmentação por atividade do Presumido/Simples.
5. **Nenhuma integração com ECD/ECF/LALUR/LACS** — o contrato (`AjusteFiscal`,
   `saldosPrejuizoAnteriores`, `lucroAtual`) foi desenhado para receber
   esses dados no futuro sem precisar ser substituído, mas nenhuma
   importação foi criada nesta fase.
6. **Distribuição uniforme de lucro contábil entre trimestres** — mesma
   premissa já documentada no Presumido/Simples para receita; aqui
   aplicada ao lucro, sempre com `status: "estimado"`.

## P. Próxima etapa recomendada

Com os três motores reais (Presumido, Simples, Real) completos e
compartilhando o mesmo contrato — validado por `compararRegimes`
executando os três simultaneamente sem nenhuma fórmula fiscal no
orquestrador — o próximo passo natural, seguindo a ordem já definida em
`docs/motor-regimes-contrato.md`, é o **Comparador Consolidado**: hoje
`regimeMenorCarga` já existe, mas é uma redução ingênua sobre
`cargaTotalPeriodo`. A entrega desta fase confirma que os três motores
podem ter coberturas de componentes muito diferentes (Real com
`cargaTotal` explicitamente parcial quando a qualidade não é
`"completa"`, Simples com componentes segregados do DAS na faixa 6,
Presumido sem PIS/COFINS decompostos) — o Comparador Consolidado
precisa formalizar a detecção de **incomparabilidade** (seção 29 do
pedido) antes que qualquer camada futura (Motor Estratégico) possa usar
esses três resultados com segurança.

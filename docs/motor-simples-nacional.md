# Simples Nacional — segundo MotorRegime real (núcleo geral, sem Fator R)

> Continuação de [motor-lucro-presumido.md](./motor-lucro-presumido.md).
> **`calculo.ts` não foi alterado — só reaproveitado.** Nenhum Fator R,
> Lucro Real, Motor Financeiro, Score, IA ou UI foi tocado. 343 testes
> passando (310 antes desta fase + 33 novos), `tsc`/lint limpos.

## A. Arquitetura do Motor do Simples

```
src/engine/motorRegimes/
  receitaPorAtividade.ts     — extraído do Presumido nesta fase (evita duplicar a regra
                                "nunca inventar segregação" entre os dois motores)
  simplesNacional/
    normativa.ts    — RBT12, faixas (6, iguais para todos os anexos), tabelas Anexo I/II/III
    anexo.ts         — perfil/arquétipo → Anexo I/II/III, ou indeterminado(_fator_r)
    rbt12.ts         — RBT12 rolante mensal, início de atividade, sem histórico
    das.ts           — alíquota efetiva, DAS mensal, consolidação anual
    nucleo.ts        — orquestra os módulos acima (compartilhado pelos dois motores)
    motor.ts         — motorSimplesUnificado + motorSimplesHibrido (MotorRegime reais)
```

**Decisão de contrato**: "Simples Nacional" não é um terceiro valor de
`Regime` — é implementado como **dois** `MotorRegime`
(`motorSimplesUnificado`, `motorSimplesHibrido`), porque o tipo `Regime`
(`engine/types.ts`) já distingue exatamente essa bifurcação (motivada
pela própria transição da reforma em `calculo.ts`). O núcleo normativo
do Simples (`nucleo.ts`) é **idêntico** para os dois — só o `Regime`
carimbado e o que é passado ao Motor VGR para CBS/IBS mudam. Testado
explicitamente: mesmo cenário, DAS idêntico nos dois motores.

## B. Elegibilidade implementada

`elegibilidade.ts::avaliarElegibilidadeSimples(cenario, regime)` —
parametrizada pelo regime (unificado/híbrido) só para carimbar o
resultado corretamente; a lógica é uma só. Critérios: limite de RBT12
(aproximado pela receita anual informada, já que o cálculo fino de RBT12
vive em `rbt12.ts`, não na elegibilidade) e impedimento de atividade
(mesmo padrão do Presumido — arquétipo `financeiro` exige confirmação
explícita, nunca presumido pela omissão). Testado no limite exato (R$
4.800.000,00 elegível) e um centavo acima (inelegível).

## C. Como RBT12 é calculada

`rbt12.ts::calcularRbt12MensalDoAno` — **rolante mês a mês**, nunca um
número único por ano. Três casos, todos testados:

1. **Histórico completo, sem crescimento**: RBT12 constante = receita
   anual.
2. **Histórico completo, com crescimento**: RBT12 sobe gradualmente mês
   a mês — `(12-mês)×média mensal do ano anterior + mês×média mensal do
   ano atual`. Testado que é estritamente crescente mês a mês (nunca um
   salto único de ano para ano).
3. **Início de atividade** (`dataAberturaEmpresa` dentro do ano
   calculado): RBT12 proporcionalizada (LC 123/2006, art. 3º, §2º) —
   `(receita do ano parcial ÷ meses ativos) × 12`, constante nos meses
   ativos; meses antes da abertura **não geram entrada** (não
   existiram).

Sempre `status: "estimado"` — nunca apresentada como RBT12 real, porque
`CenarioEmpresa` só tem receita anual, não uma série mensal real.

## D. Como anexos e faixas são determinados

`anexo.ts::classificarAnexo(perfil)` — nunca lê alíquota do
`PerfilSetorial`. Resolve com segurança: comércio→Anexo I,
indústria→Anexo II, transporte de cargas→Anexo III (LC 123/2006, art.
18, §5º-C, VI — uma das poucas atividades que a lei já isenta de
depender do Fator R). Frigorífico (comércio+indústria simultâneos) é
**indeterminado** — ambiguidade real entre duas tabelas diferentes, não
resolvida por conveniência (diferente do Presumido, onde comércio e
indústria compartilham o mesmo percentual e por isso não geram
ambiguidade).

As 6 faixas de RBT12 são as mesmas para todos os anexos (`normativa.ts::
determinarIndiceFaixa`) — só `aliquotaNominal`/`parcelaDeduzir` mudam por
anexo/faixa.

## E. Como a alíquota efetiva é calculada

`das.ts::calcularAliquotaEfetiva`: `(RBT12 × alíquota nominal − parcela a
deduzir) ÷ RBT12` (LC 123/2006, art. 18, §1º-A). Testado com
continuidade na fronteira entre faixas 1/2 (a alíquota efetiva não salta
ao cruzar R$ 180.000,00) — **e testado também o caso real em que ela NÃO
é continua**: na faixa 6, o ICMS (Anexo I) deixa de ser recolhido dentro
do DAS (recolhido separado, LC 123/2006, art. 18, §20), então a alíquota
efetiva pode cair ao entrar nela. Isso foi verificado contra busca real
(não assumido de memória) antes de escrever o teste — está documentado
em código (`das.ts::atingiuFaixaComTributoSegregado`) e gera um alerta
explícito no resultado quando ocorre, porque **esse componente segregado
não é calculado por este motor** (fora do núcleo geral).

## F. Como a receita multiatividade é tratada

Reaproveita `receitaPorAtividade.ts` (extraído do Presumido nesta fase —
mesma regra, um só lugar). RBT12 é sempre da **empresa inteira** (soma de
todas as atividades calculáveis), nunca por atividade — é assim que a
lei funciona: a faixa é decidida pelo RBT12 total, mas cada atividade
paga pela alíquota do SEU PRÓPRIO anexo naquela mesma faixa. Testado:
transporte de cargas (Anexo III, determinável) + frigorífico
(indeterminado) — só o transporte é calculado, o frigorífico fica em
alertas, sem inventar proporção.

## G. Como projeções 2026–2033 funcionam

`ANOS_SIMULACAO` (reaproveitado) — RBT12 de cada ano usa a receita do
ano anterior (projetada pela mesma taxa de crescimento anual) como
`receitaTotalAnoAnterior`. Primeiro ano simulado (2026) sem dado de "2025"
cai no caso 3 de `rbt12.ts` (sem histórico), com alerta explícito.

## H. Como o motor trata histórico insuficiente

Três situações distintas, nunca confundidas (seção 8 do pedido):
`disponivel: false` (nenhuma atividade calculável nesse ano — ex.: todas
indeterminadas), RBT12 com `status: "estimado"` (sempre, dado a limitação
estrutural do `CenarioEmpresa`), e alertas específicos por causa (receita
não segregada, anexo indeterminado, Motor VGR indisponível).

## I. Casos dependentes de Fator R

`anexo.ts` retorna `"indeterminado_fator_r"` para qualquer perfil com
arquétipo `servico`/`digital` sem exceção legal conhecida — testado com
clínica médica e SaaS. **Nenhuma dessas atividades é calculada** (não há
DAS no resultado); o alerta cita explicitamente a dependência do Fator R
e a base legal (LC 123/2006, art. 18, §5º-J). Isso é o comportamento
correto pedido na seção 3/22: nunca um "Anexo III ou V por conveniência".

## J. Regras deliberadamente ainda não suportadas

- Fator R, FS12, folha necessária, Anexos IV e V — íntegra e
  explicitamente fora desta fase.
- Sublimite estadual de ICMS/ISS (R$ 3.600.000) — só o limite geral de
  exclusão (R$ 4.800.000) é avaliado.
- Segregação do tributo indireto (ICMS/ISS/IPI) que sai do DAS na faixa
  6 — sinalizado em alerta, não calculado.
- Decomposição do DAS em IRPJ/CSLL/CPP/ICMS/ISS/CBS/IS internos — o DAS
  é um componente único (`"das"`); a partilha completa exigiria uma
  segunda tabela normativa por faixa/anexo, fora do núcleo geral.
- Regras setoriais especiais (equiparação hospitalar, construção,
  cooperativas, instituições financeiras) — mesma decisão já tomada no
  Presumido.

## K. Fontes normativas

Todas centralizadas em `normativa.ts`: LC 123/2006 (arts. 3º, 18, com
redação da LC 155/2016 — tabelas vigentes desde 2018). O valor da faixa
6/Anexo I (alíquota 19%, PD R$ 378.000) e o comportamento de segregação
do ICMS nessa faixa foram **verificados por busca externa** durante esta
fase (não assumidos de memória) depois que um teste matemático revelou
um resultado que parecia contraintuitivo (queda de alíquota efetiva ao
subir de faixa) — a verificação confirmou que os valores da tabela
estavam corretos e que o comportamento é uma característica real da lei,
não um erro.

## L. Limitações conhecidas

1. **RBT12 é sempre estimada**, nunca calculada a partir de série mensal
   real — `CenarioEmpresa` não modela histórico de receita mês a mês.
2. **Início de atividade só é tratado com precisão no ANO DE ABERTURA.**
   O ano seguinte, mesmo que ainda não tenha completado 12 meses reais
   até janeiro, cai na regra de rolagem normal — simplificação
   documentada, não uma tentativa de precisão que falhou.
3. **Faixa 6 (tributo indireto segregado do DAS)** não gera um
   componente próprio — só um alerta.
4. **Extensão mínima ao contrato**: `IdentificacaoEmpresa.dataAberturaEmpresa`
   (opcional, aditiva) — documentada em `cenarioEmpresa.ts` com o mesmo
   padrão de justificativa usado para `adicional_irpj` no Presumido.
   Nenhum outro campo do contrato foi alterado.
5. Frigorífico (e qualquer perfil com comércio+indústria simultâneos)
   nunca é calculável pelo núcleo geral do Simples sem uma segregação de
   receita mais fina do que `CenarioEmpresa` hoje oferece (por natureza
   da operação, não só por atividade) — diferente do Presumido, onde
   essa ambiguidade não existe (mesma alíquota para os dois).

---

Critério de sucesso (seção 50 do pedido) confirmado: Presumido e Simples
são dois `MotorRegime` reais e distintos; `compararRegimes` não conhece
nenhuma fórmula de nenhum dos dois (testado com os dois reais + um Real
fake, simultaneamente); multiatividade funciona nos dois; o Simples
respeita apuração mensal com RBT12 rolante (testado mudando de faixa no
meio do ano); casos de Fator R são indeterminados, nunca aproximados;
nenhuma regra fiscal está em `PerfilSetorial`; `calculo.ts` intocado.

# Lucro Presumido — primeiro MotorRegime real

> Continuação de [motor-regimes-contrato.md](./motor-regimes-contrato.md).
> **`calculo.ts` não foi alterado — só reaproveitado.** Nenhum Simples,
> Fator R, Lucro Real, Motor Financeiro, Score, IA ou UI foi tocado. 310
> testes passando (272 antes desta fase + 38 novos), `tsc`/lint limpos.

## A. Arquitetura implementada

```
src/engine/motorRegimes/lucroPresumido/
  normativa.ts       — percentuais/alíquotas/limites, cada um com fundamento + vigência
  naturezaReceita.ts — perfil/arquétipo → NaturezaTributariaReceita (nunca perfil → alíquota)
  elegibilidade.ts   — avaliarElegibilidadePresumido (determinística, nunca assume por omissão)
  irpjCsll.ts        — cálculo trimestral agregado a anual, por atividade
  motor.ts           — motorLucroPresumido: MotorRegime real, multiatividade + multi-ano + reuso do Motor VGR
```

Fluxo, exatamente como pedido na seção 6: `Perfil/atividade →
inferirNaturezaTributaria → PERCENTUAIS_PRESUNCAO (normativa.ts) → base
de IRPJ/CSLL`. Nenhum `PerfilSetorial` do catálogo contém percentual —
confirmado por teste (`naturezaReceita.test.ts` só verifica
classificação, nunca lê um número do perfil).

## B. Regras efetivamente suportadas

- Elegibilidade por limite de receita bruta anual (R$ 78.000.000 — Lei
  9.718/1998, art. 13) e por sinalização explícita de atividade
  impeditiva.
- IRPJ (15%) sobre base presumida, apurado **trimestralmente** e
  agregado ao ano.
- Adicional de IRPJ (10% sobre o excedente de R$ 60.000/trimestre — Lei
  9.430/1996, art. 3º).
- CSLL (9%) sobre base presumida própria (percentual de presunção
  diferente do IRPJ quando a lei assim define).
- Presunção para: comércio/indústria/transporte de cargas (8% IRPJ /
  12% CSLL), transporte de passageiros (16% IRPJ / 12% CSLL), prestação
  de serviços em geral (32%/32%).
- Multiatividade com receita segregada por atividade.
- Multi-ano 2026–2033, com projeção por `crescimentoAnualEstimado`
  quando informado.
- Reaproveitamento do Motor VGR (`calculo.ts`, via
  `cenarioParaSimulacaoInput` + `simular()`) para IBS/CBS — nenhum
  cálculo próprio de IBS/CBS foi escrito.

## C. Regras deliberadamente não suportadas (nesta fase)

- Equiparação hospitalar, segregação consulta×procedimento, regras de
  laboratório (seção 24 do pedido) — clínica médica é calculada pela
  presunção geral de serviço (32%), sem tratamento especial.
- Construção civil, locação, instituições financeiras/meios de
  pagamento, agro, imobiliárias, cooperativas, exportação com regime
  especial — todos retornam `NaturezaTributariaReceita: "indeterminada"`
  e a atividade correspondente **não é calculada** (nunca aproximada).
- PIS/COFINS e ICMS/ISS legados como componentes auditáveis — ver seção
  I (limitação real, não trivial de resolver).
- Limite proporcional de receita para empresas com menos de 12 meses de
  atividade no ano — não implementado; presente no cenário, o critério
  de limite de receita fica com a leitura simples (anual cheio).

## D. Fontes/fundamentos utilizados

Todos centralizados em `normativa.ts`, cada um com `fundamento` +
`vigenciaInicio`: Lei 9.249/1995 (arts. 3º, 15, 20), Lei 9.430/1996 (art.
3º), Lei 9.718/1998 (art. 13), Lei 7.689/1988 (art. 3º, com alteração da
Lei 13.169/2015 — CSLL 9%). Nenhum percentual aparece "mágico" dentro de
`irpjCsll.ts` — todos são importados de `normativa.ts`.

## E. Como a multiatividade funciona

`resolverAtividadesComReceita` exige `receita.receitaPorAtividade[perfilId]`
para CADA atividade quando há `atividadesSecundarias` — nenhuma
distribuição proporcional é assumida sobre o faturamento total. Uma
atividade sem receita segregada é excluída do cálculo (não do cenário) e
o motivo entra em `alertas`. Testado: multiatividade completa
(frigorífico + atacado, ambas com receita informada) produz
`porAtividade` com 2 entradas cuja soma bate exatamente com o
consolidado; multiatividade SEM segregação produz `porAtividade:
undefined` e `anos` todos com `disponivel: false` — nunca carga zero
disfarçada de resultado.

Quando só há 1 atividade (mono, sem secundárias), `receita.faturamentoAnual`
é usado diretamente — não há ambiguidade a resolver, e `porAtividade`
fica ausente (testado).

## F. Como a periodicidade foi tratada

`irpjCsll.ts::calcularIrpjCsllAnual` faz um loop real de 4 trimestres —
a base presumida, o IRPJ, o excedente do adicional e a CSLL são
calculados trimestre a trimestre e só então somados ao ano. Isso importa
de verdade: o adicional de IRPJ é um limiar **trimestral** (R$ 60.000),
não anual (R$ 240.000 dividido por 4 dá o mesmo resultado só quando a
receita é uniforme ao longo do ano — o loop preserva a estrutura correta
mesmo que hoje a única fonte de dado seja anual, ver limitação abaixo).

**Limitação conhecida**: como `CenarioEmpresa.receita` só tem granularidade
anual, a distribuição entre os 4 trimestres é uma premissa (uniforme),
sempre marcada `status: "estimado"` e sempre registrada em `alertas`
("receita mantida constante..." ou, quando não há
`crescimentoAnualEstimado`, um alerta específico). Se um cliente tiver
receita real sazonal (ex.: aviação agrícola, com pico em determinados
meses), o adicional de IRPJ calculado aqui pode diferir do real — a
estrutura já está pronta para receber receita trimestral real quando
existir esse dado, sem mudar a fórmula.

## G. Como IBS/CBS e resultados legados foram reutilizados

`motor.ts` chama `cenarioParaSimulacaoInput(cenario)` (criado na fase
anterior) e, se bem-sucedido, `simular(input)` — o mesmo `calculo.ts` de
sempre. De cada `ResultadoAno`, só `efetivoCbs`/`efetivoIbs` são
extraídos e inseridos como componentes `cbs`/`ibs` com `origemCalculo:
"motor_vgr"` e `status: "estimado"`. Testado explicitamente.

**Limitação, no nível da empresa, não da atividade**: `calculo.ts` não
segmenta por atividade — o IBS/CBS reaproveitado é sempre o consolidado
da empresa inteira, nunca decomposto em `porAtividade`. Isso está
documentado no código (`motor.ts`) e é uma limitação estrutural do Motor
VGR atual, não algo que este motor poderia ter resolvido sem alterar
`calculo.ts` (proibido nesta fase).

## H. Casos em que o resultado fica parcial ou indeterminado

- Elegibilidade `indeterminado`: receita anual não informada, ou
  atividade com arquétipo `financeiro` sem confirmação explícita de
  ausência de impedimento (ex.: `meios_pagamento`) — testado.
- `ResultadoAnoRegime.disponivel: false`: quando nenhuma atividade pôde
  ser calculada (receita não segregada em multiatividade, ou natureza
  tributária indeterminada) — nunca confundido com `cargaTotal: 0`
  representando ausência real de tributo.
- IBS/CBS ausentes dos componentes: quando `cenarioParaSimulacaoInput`
  devolve `ok: false` — o alerta lista exatamente os campos faltantes.

## I. Limitações conhecidas

1. **PIS/COFINS/ICMS/ISS legados não são componentes auditáveis nesta
   fase.** `calculo.ts` devolve `pisCofinsProjetado`/`icmsIpiProjetado`
   como valores JÁ COMBINADOS (não segrega PIS de COFINS, nem ICMS de
   ISS) — expor isso como dois `ComponenteTributario` separados exigiria
   inventar uma proporção de divisão, o que violaria a regra central de
   nunca fabricar dado ausente. Documentado como alerta explícito no
   resultado (`"PIS/COFINS e ICMS/ISS legados não são apresentados como
   componentes nesta fase..."`), não escondido silenciosamente.
2. **Contrato estendido em 1 ponto**: `ComponenteTributario` ganhou o
   valor `"adicional_irpj"` (documentado no próprio `tipos.ts` com o
   motivo jurídico — base de incidência diferente do IRPJ principal — e
   com teste de regressão confirmando que os dois aparecem como entradas
   separadas, nunca somadas). Nenhum outro campo do contrato da fase
   anterior foi alterado.
3. **Limite de receita proporcional** (empresas com menos de 12 meses de
   atividade) não implementado — o critério de elegibilidade usa a
   receita anual informada diretamente.
4. **`aviacao_agricola` e outros perfis com arquétipo `"servico"`
   secundário caem na presunção geral de serviço (32%)** — correto como
   tratamento padrão, mas não reflete eventuais regras específicas do
   setor que ainda não foram levantadas normativamente.

## J. Próxima extensão recomendada

Seguindo a ordem já definida (`docs/motor-regimes-contrato.md`):
**Simples Nacional** é o próximo motor real. Ele vai reusar o mesmo
padrão desta implementação (elegibilidade determinística,
`NaturezaTributariaReceita` — ou uma classificação equivalente por
Anexo —, reuso do Motor VGR para IBS/CBS) e vai precisar decidir, pela
primeira vez, o Fator R (que a especificação já isolou como pertencente
ao "Motor do Simples", não a este). Os campos que o Fator R vai
precisar (`CenarioEmpresa.pessoas.folhaAnual`/`proLaboreAnual`) já
existem desde a fase da fundação setorial — nenhuma mudança de contrato
deveria ser necessária para o Simples além de, possivelmente, mais um
valor em `ComponenteTributario` para o **DAS** (que já existe) ser
decomposto internamente por tributo unificado, replicando o mesmo debate
já resolvido aqui para o adicional de IRPJ.

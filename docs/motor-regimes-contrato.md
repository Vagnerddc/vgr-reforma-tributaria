# Contrato do Motor de Regimes

> Continuação de [cenario-empresa-setores.md](./cenario-empresa-setores.md).
> **Nenhuma fórmula tributária de Presumido/Simples/Fator R/Real foi
> implementada.** `calculo.ts` não foi tocado. Esta fase entrega o
> contrato (tipos) e um orquestrador puro (`compararRegimes`), validados
> com motores **falsos** (fakes de teste) — nenhum deles calcula imposto
> de verdade. 279 testes passando (272 antes desta fase + 7 novos),
> `tsc`/lint limpos.

## As seis decisões, resolvidas no contrato

### 1. Elegibilidade não-trivial

```ts
type StatusElegibilidade = "elegivel" | "inelegivel" | "obrigatorio" | "opcional" | "indeterminado";

interface AvaliacaoElegibilidade {
  regime: Regime;
  status: StatusElegibilidade;
  motivo: string;               // sempre presente — nenhum status sem explicação
  criterios: CriterioElegibilidade[];
}

interface CriterioElegibilidade {
  id: string;
  descricao: string;
  atendido: boolean | "indeterminado";
  fonte: CampoComProveniencia<string>;   // de onde veio o dado que decidiu este critério
}
```

`obrigatorio`/`opcional` existem porque Lucro Real pode ser **obrigatório**
(faturamento acima do limite do Presumido, atividade financeira) —
diferente de Simples/Presumido, que só podem ser elegível/inelegível/
indeterminado. Isso está na assinatura do tipo, não é uma regra que
alguém pode esquecer de aplicar depois.

O orquestrador (`comparador.ts`) só chama `calcular()` quando o status é
`elegivel`, `obrigatorio` ou `opcional` — `inelegivel`/`indeterminado`
aparecem no resultado final (nunca desaparecem silenciosamente), mas com
`anos: []`. Testado explicitamente, incluindo o caso em que um regime
inelegível "teria" a menor carga hipotética e ainda assim é excluído de
`regimeMenorCarga`.

### 2. Resultado padronizado — mais rico que `Record<Regime, ResultadoAno[]>`

```ts
interface ResultadoRegime {
  regime: Regime;
  aplicabilidade: AvaliacaoElegibilidade;
  anos: ResultadoAnoRegime[];
  porAtividade?: ResultadoAtividadeRegime[];
  cargaTotalPeriodo: number;
  componentesConsolidados: Partial<Record<ComponenteTributario, number>>;
  premissas: Record<string, CampoComProveniencia<unknown>>;
  qualidade: QualidadeResultadoRegime;
  alertas: string[];
  memoria: string[];
}
```

A decisão da fase anterior ("Motor de Regimes produz `Record<Regime,
ResultadoAno[]>`") não foi abandonada — foi **encapsulada**: internamente,
um regime que reaproveita o Motor VGR para IBS/CBS ainda guarda o
`ResultadoAno` original em `ResultadoAnoRegime.resultadoAnoVgrOrigem`,
sem duplicar lógica. O que mudou é que isso agora é só UM componente
dentro de uma estrutura que também sabe responder "por que esse regime
foi calculado", "qual a composição da carga" e "quão confiável é o
número" — exatamente o que o pedido identificou como faltante (dois
regimes com o mesmo total podem ter estruturas completamente diferentes).

### 3. Carga tributária total, por componentes independentes

```ts
type ComponenteTributario = "irpj" | "csll" | "pis" | "cofins" | "cpp_inss" | "iss" | "icms" | "ibs" | "cbs" | "is" | "das" | "outros";

interface ValorComponenteTributario {
  componente: ComponenteTributario;
  valor: number;
  base?: number;
  aliquota?: number;
  regraAplicada?: string;
  fundamentoLegal?: string;
  memoriaCalculo?: string;
  origemCalculo?: OrigemCalculo;   // só ibs/cbs — reaproveitado, não duplicado
  status: StatusInformacao;         // reaproveitado
}
```

`componentesConsolidados` é `Partial<Record<...>>`, não `Record<...>`
completo — nenhum regime é obrigado a preencher todos os 12 componentes
(Simples não tem IRPJ separado, por exemplo). `origemCalculo` reaproveita
literalmente o tipo criado na arquitetura híbrida (`motor_oficial` |
`motor_vgr`) — só é preenchido para ibs/cbs, porque é o único par de
componentes que tem essa dualidade de motor hoje; os demais (IRPJ, CSLL,
DAS...) não têm um "Motor Oficial" equivalente, e o campo fica
corretamente ausente para eles, não preenchido com um valor inventado.

### 4. Multiatividade — resolvida no contrato, não como exceção

```ts
interface ResultadoAtividadeRegime {
  perfilId: string;
  anos: ResultadoAnoRegime[];
}
```

`ResultadoRegime.porAtividade?` é opcional e só aparece quando um motor
de regime decide que a decomposição é necessária para explicar o
resultado (ex.: ISS de serviço + ICMS de comércio dividido por atividade
dentro do mesmo Simples Híbrido). `anos` no nível raiz **sempre** é o
consolidado — quem só quer o número final nunca precisa saber que a
empresa é multiatividade. Testado: a soma de `porAtividade` bate com
`cargaTotalPeriodo` do consolidado.

Nenhum tipo `ResultadoRegimeMultiatividade` foi criado — é o mesmo
`ResultadoRegime`, com um campo opcional preenchido ou não. Mesma
filosofia já usada em `CenarioEmpresa.dadosSetoriais[]` na fase anterior.

### 5. Multi-ano desde o início — disponibilidade, não silêncio

```ts
interface ResultadoAnoRegime {
  ano: number;
  disponivel: boolean;   // false ≠ carga zero
  componentes: ValorComponenteTributario[];
  cargaTotal: number;
  resultadoAnoVgrOrigem?: ResultadoAno;
}
```

`anos` é sempre pensado para cobrir `ANOS_SIMULACAO` (2026–2033,
`parametros.ts`, reaproveitado). Um motor que só cobre 2026–2028 hoje
preenche os anos de 2029 em diante com `disponivel: false` — testado
explicitamente que isso nunca é lido como "sem imposto naquele ano", e
que `cargaTotalPeriodo` não soma os anos indisponíveis (evita subestimar
silenciosamente a carga total ao comparar um regime "parcialmente
implementado" com outro "completo").

### 6. Auditabilidade — reaproveitada, não reinventada

Toda a cadeia usa tipos que já existiam antes desta fase:
`CampoComProveniencia<T>`, `StatusInformacao`, `OrigemCalculo` — nenhum
conceito novo de rastreabilidade foi criado. Testado: um componente IRPJ
de teste carrega `base`, `aliquota`, `fundamentoLegal` ("Lei 9.430/1996,
art. 15") e `status: "estimado"`; um componente IBS/CBS de teste carrega
`origemCalculo: "motor_vgr"` — a mesma pergunta "de onde veio" tem
resposta estruturada nos dois casos, com o mesmo vocabulário de tipos.

## O orquestrador (`comparador.ts`) — o que ele faz e o que nunca fará

```ts
function compararRegimes(cenario: CenarioEmpresa, motores: MotorRegime[]): ResultadoComparacaoRegimes
```

Sequência exata, sem excepção:
1. Para cada `MotorRegime`, chama `avaliarElegibilidade(cenario)`.
2. Se o status permite (`elegivel`/`obrigatorio`/`opcional`), chama
   `calcular(cenario, aplicabilidade)`. Senão, produz um
   `ResultadoRegime` vazio com a aplicabilidade preenchida.
3. Consolida em `ResultadoComparacaoRegimes.resultados` (todos os
   motores, mesmo os não calculados).
4. `regimeMenorCarga` é uma redução pura sobre `cargaTotalPeriodo` dos
   regimes efetivamente calculados — nunca pondera margem, caixa, risco
   ou complexidade. Isso é **decisão de produto explicitamente adiada**
   para o Motor Estratégico (fase futura, `docs/auditoria-visao-
   estrategica.md` item #18: "regime de menor tributo × regime
   recomendado são respostas diferentes").

Nenhuma regra tributária vive em `comparador.ts` — confirmado pelo fato
de que os 7 testes desta fase usam só motores fake, e passam sem
nenhuma fórmula real de Presumido/Simples/Real.

## Relação com `CenarioEmpresa`

`MotorRegime.avaliarElegibilidade`/`calcular` recebem `CenarioEmpresa`
diretamente — não um tipo de entrada próprio por regime. Isso significa
que qualquer campo já modelado na fase anterior
(`pessoas.folhaAnual`/`proLaboreAnual` para Fator R,
`identificacao.atividadesSecundarias` para multiatividade,
`dadosSetoriais` para características como `possui_equiparacao_hospitalar`)
já está disponível para os motores de regime no dia em que forem
implementados — nenhum campo novo precisou ser adicionado ao
`CenarioEmpresa` nesta fase.

## O que NÃO foi resolvido aqui (de propósito)

- Nenhum critério de elegibilidade real (limite de receita do Simples,
  atividades impeditivas, obrigatoriedade do Real) foi codificado —
  `criterios: []` nos motores fake é o valor correto para esta fase.
- Nenhuma fórmula de IRPJ/CSLL/PIS/COFINS/CPP/ISS foi escrita.
- Fator R não foi modelado como módulo — só confirmado que os dados que
  ele vai precisar (`pessoas.folhaAnual`, `proLaboreAnual`) já existem em
  `CenarioEmpresa` desde a fase anterior.
- Nenhuma UI, Dashboard ou Relatório foi alterado.

## Próximo passo (ordem já definida, não alterada)

```text
Fundação setorial ✅
Contrato Motor de Regimes ✅ (esta fase)
    ↓
Lucro Presumido — primeiro MotorRegime real, usando este contrato
    ↓
Simples Nacional
    ↓
Fator R
    ↓
Lucro Real
    ↓
Comparador consolidado (já existe — compararRegimes — só precisa de motores reais)
    ↓
Motor Econômico-Financeiro
```

Quando o Lucro Presumido for implementado, ele preencherá exatamente
`MotorRegime.avaliarElegibilidade`/`calcular` — nenhuma mudança de
contrato deveria ser necessária, porque o contrato já foi desenhado
pensando nos seis pontos que motivaram esta fase. Se durante a
implementação real do Presumido aparecer uma necessidade genuína de
estender o contrato, isso deve ser tratado como um sinal para revisar
este documento antes de prosseguir para Simples/Real — não como um
ajuste local dentro do módulo do Presumido.

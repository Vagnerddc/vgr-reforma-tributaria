# Arquitetura setorial + Cenário Empresarial Universal

> Continuação de [auditoria-visao-estrategica.md](./auditoria-visao-estrategica.md).
> **Nenhuma regra tributária foi criada ou alterada. `calculo.ts` não foi
> tocado. Nenhuma tela nova.** 272 testes passando (253 antes desta fase +
> 19 novos), `tsc`/lint limpos. Esta fase é representação de domínio, não
> cálculo.

## A. Modelo de domínio

### `PerfilSetorial` (`src/engine/setores/tipos.ts`)

Representa **como uma atividade complementa o núcleo universal** — nunca
uma regra tributária:

```ts
interface PerfilSetorial {
  id: string;                              // slug estável
  macroSetor: string;
  setor?: string;                          // agrupamento intermediário, rótulo livre
  segmento: string;
  subsegmentos?: string[];                 // rótulos livres, não objetos completos
  descricao: string;
  arquetipos: ArquetipoEconomico[];        // nunca só 1 — ver seção 9 do pedido
  caracteristicasDisponiveis: CaracteristicaSetorial[];
  modulosAplicaveis: string[];             // disponibilidade, nunca cálculo
  perguntasEspecificas: PerguntaSetorial[];
  cnaesSugeridos?: string[];               // sugestão, nunca determinação
}
```

`ArquetipoEconomico` é a classificação transversal pedida na seção 9:
`servico | comercio | industria | agro | construcao | transporte |
locacao | financeiro | digital | misto` — uma empresa pode ter mais de
um (frigorífico = `["industria", "comercio"]`, confirmado por teste).

### `CenarioEmpresa` (`src/engine/cenarioEmpresa.ts`)

```ts
interface CenarioEmpresa {
  id: string;
  identificacao: IdentificacaoEmpresa;       // nome, CNAEs, UF, atividade principal/secundárias
  receita: ReceitaEmpresa;                   // faturamento, mix, receita por atividade
  custos: CustosEmpresa;                     // reaproveita GastoInformado (creditoTributario.ts)
  pessoas: PessoasEmpresa;                   // folha, sócios, pró-labore — sem cálculo
  tributario: TributarioEmpresa;             // regime, tratamentos especiais, operações (reaproveita OperacaoTributariaNormalizada)
  economicoFinanceiro: EconomicoFinanceiroEmpresa; // placeholders — Motor Financeiro é fase futura
  dadosSetoriais: DadosSetoriais[];          // um item por atividade — multiatividade sem tipo especial
}
```

Todo campo relevante usa `CampoComProveniencia<T>` (o mesmo tipo criado
para `OperacaoTributariaNormalizada` na fase anterior) — reuso direto,
não um segundo conceito de proveniência.

### Extensões setoriais tipadas, sem `dados: any`

```ts
interface DadosSetoriais {
  perfilId: string;
  valores: Record<string, CampoComProveniencia<boolean | number | string>>;
}

function validarDadosSetoriais(perfil: PerfilSetorial, dados: DadosSetoriais): {
  validos: boolean;
  camposComTipoInvalido: string[];   // ex.: booleano enviado como texto
  camposDesconhecidos: string[];     // não descarta, só sinaliza
}
```

Não existe um tipo TypeScript por segmento (isso quebraria a
extensibilidade pedida — 45 segmentos exigiriam 45 tipos). A garantia é
em runtime, contra a declaração do próprio `PerfilSetorial` — testado
com os três casos (válido, tipo incompatível, campo desconhecido).

### Arquétipos econômicos

Não modelados como enum "obrigatoriamente único" — `PerfilSetorial.arquetipos`
é sempre um array, e o teste do frigorífico confirma que a leitura de
"industria + comercio" funciona sem ramificação especial em nenhum lugar
do código.

## B. Taxonomia inicial

`config/setores/taxonomia.json` — 13 macrosetores, 19 perfis (nem todos
os segmentos citados no pedido foram cadastrados individualmente; a
amplitude é deliberadamente parcial, ver seção F). Cobertura direta dos
10 setores pedidos para teste: `clinica_medica`, `frigorifico`,
`transporte_rodoviario_cargas`, `industria_transformacao`,
`varejo_generico`, `aviacao_agricola`, `construcao_civil`,
`software_saas`, `provedor_internet`, `locadora_bens`.

Os 4 perfis legados (`produtor_rural`, `aviacao_agricola`,
`transporte_rodoviario_cargas`, `construcao_civil`) existem na nova
taxonomia com **exatamente o mesmo id** que já usam em
`src/engine/atividades.ts` — não é coincidência, é a chave de
compatibilidade do adapter (seção D).

## C. Relação com o código existente

| Reaproveitado (não duplicado) | Criado nesta fase |
|---|---|
| `CampoComProveniencia<T>`, `OrigemInformacao`, `StatusInformacao` (`operacaoTributaria.ts`) | `PerfilSetorial`, `MacroSetor`, `CaracteristicaSetorial`, `PerguntaSetorial`, `ArquetipoEconomico` (`setores/tipos.ts`) |
| `GastoInformado`, `agregarCreditoPorSistema` (`creditoTributario.ts`) | Catálogo setorial + `sugerirPerfisPorCnae` (`setores/catalogo.ts`) |
| `OperacaoTributariaNormalizada` (referenciada, não duplicada, dentro de `TributarioEmpresa.operacoes`) | `CenarioEmpresa` e todos os seus blocos (`cenarioEmpresa.ts`) |
| `Regime`, `MeioPagamento`, `SimulacaoInput` (`types.ts`) | `cenarioParaSimulacaoInput` (`cenarioEmpresaAdapter.ts`) |
| `PerfilAtividade` (`atividades.ts`) — usado para o mapeamento 1:1 legado | `validarDadosSetoriais`, `avaliarCompletudeCenario` |

Nenhum tipo existente foi alterado — `operacaoTributaria.ts`,
`creditoTributario.ts`, `types.ts`, `atividades.ts` continuam
exatamente como estavam.

## D. Compatibilidade — prova real, não teórica

`cenarioParaSimulacaoInput(cenario)` converte `CenarioEmpresa` →
`SimulacaoInput`, derivando `percentualCustosCreditaveis*` via
`agregarCreditoPorSistema` (nunca digitado de novo) e mapeando
`atividadePrincipal.perfilId` para `PerfilAtividade` só quando é um dos 4
legados — qualquer outro perfilId (ex.: `software_saas`) cai em
`perfil: undefined`, que já é um valor válido em `SimulacaoInput` hoje.

**Testado de ponta a ponta, não só o tipo**: o teste
`cenarioEmpresa.test.ts` monta um `CenarioEmpresa` de transportadora,
converte via adapter, e chama `simular()` real (o mesmo `calculo.ts` de
sempre, zero linha alterada) — o resultado tem 8 anos (`ANOS_SIMULACAO`),
confirmando que a nova camada de domínio interopera de fato com o motor
existente, não apenas "no papel".

Quando o `CenarioEmpresa` está incompleto para o que `SimulacaoInput`
exige, o adapter devolve a lista exata de campos faltantes — nunca um
`SimulacaoInput` com valor inventado (testado).

## E. Empresas multiatividade

```ts
identificacao: {
  atividadePrincipal: { perfilId: "frigorifico", status: "confirmado", origem: "informado_usuario" },
  atividadesSecundarias: [{ perfilId: "atacado_distribuicao", status: "confirmado", origem: "informado_usuario" }],
},
receita: {
  receitaPorAtividade: { frigorifico: {...700000}, atacado_distribuicao: {...300000} },
},
dadosSetoriais: [
  { perfilId: "frigorifico", valores: { abate_proprio: {...true} } },
  { perfilId: "atacado_distribuicao", valores: {} },
],
```

Nenhum tipo `FrigorificoComDistribuicaoCenario` foi criado — é o mesmo
`CenarioEmpresa`, com um segundo item em `atividadesSecundarias` e um
segundo `DadosSetoriais`. Testado explicitamente.

## F. Extensibilidade — demonstrada, não só afirmada

O teste "pet shop" constrói um `PerfilSetorial` **inteiramente fora do
catálogo** (não está em `taxonomia.json`), usando só os tipos já
exportados por `setores/tipos.ts`, e o valida/representa com as mesmas
funções (`validarDadosSetoriais`) usadas para os perfis cadastrados —
sem tocar em `tipos.ts`, `catalogo.ts` ou `cenarioEmpresa.ts`. É a prova
de que adicionar Pet shop, Academia, Hotel, Farmácia, Posto de
combustível, Escola, Ótica ou Salão de beleza (todos citados no pedido)
é **só um novo item no JSON** — nenhuma alteração de tipo, nenhuma
alteração de código central.

## G. Testes (19 novos)

- `setores/__tests__/catalogo.test.ts` (7): carga do catálogo, busca por
  id, filtro por macrosetor, compatibilidade dos 4 ids legados, sugestão
  por CNAE (nunca determinação), CNAE sem correspondência não inventa
  perfil, especificidade de prefixo.
- `__tests__/cenarioEmpresa.test.ts` (12, incluindo `it.each` para os 10
  setores pedidos): representação uniforme dos 10 setores, validação de
  dados setoriais (válido/tipo inválido/campo desconhecido),
  multiatividade, extensibilidade (pet shop), completude por eixo, e os
  dois testes de adapter — um de rejeição honesta (campos faltantes) e
  **um que chama `simular()` real** confirmando interoperabilidade.

## H. Próximo passo recomendado — como o Motor de Regimes deve consumir `CenarioEmpresa`

Não implementado nesta fase (fora do escopo), mas a interface já está
implícita no que foi construído:

```ts
// Conceitual — Motor de Regimes (fase futura)
function compararRegimes(cenario: CenarioEmpresa): Record<Regime, ResultadoAno[]> {
  const resultados: Partial<Record<Regime, ResultadoAno[]>> = {};
  for (const regime of REGIMES_APLICAVEIS_A(cenario)) {   // filtro por elegibilidade, não implementado ainda
    const cenarioComRegime = { ...cenario, tributario: { ...cenario.tributario, regimeAtual: campo(regime, ...) } };
    const adaptado = cenarioParaSimulacaoInput(cenarioComRegime);
    if (adaptado.ok) resultados[regime] = simular(adaptado.input).anos;
  }
  return resultados as Record<Regime, ResultadoAno[]>;
}
```

Ou seja: o Motor de Regimes **não precisa de um adapter novo** — ele reusa
`cenarioParaSimulacaoInput` e `simular()` exatamente como estão, chamando
N vezes com `regimeAtual` diferente a cada vez (consistente com a decisão
já registrada em `docs/auditoria-visao-estrategica.md`, decisão
prioritária #2: "Motor de Regimes produz `Record<Regime,
ResultadoAno[]>`, reusando o tipo existente"). O trabalho real do Motor
de Regimes fica concentrado em decidir QUAIS regimes são elegíveis para
aquele `CenarioEmpresa` (ex.: Simples só até o limite de receita,
Fator R decidindo entre Anexo III/V) — isso sim depende de regra
tributária e não foi tocado aqui.

Fator R, especificamente, poderá ler `cenario.pessoas.folhaAnual` e
`cenario.pessoas.proLaboreAnual` diretamente — os campos já existem em
`PessoasEmpresa`, só não são usados por nenhum cálculo ainda.

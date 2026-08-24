# Auditoria funcional e estratégica — de "calculadora de reforma" a plataforma de decisão

> **Nada foi implementado nesta fase.** Este documento é uma auditoria do
> código real (`src/engine/`, `src/components/`, `src/pages/`,
> `src/design-system/`, `config/*.json`, testes existentes) contra a visão
> estratégica de 24 capacidades, organizada nos 6 blocos propostos
> (Fiscal/Regimes/Rentabilidade/Caixa/Estratégia/Inteligência). Todo campo
> "componentes existentes" abaixo referencia arquivo e símbolo reais — não
> é uma avaliação genérica.

## Princípio orientador (não muda com esta análise)

> O cálculo tributário é a entrada. A decisão empresarial é a saída.

O código atual já **não é** uma calculadora pura — já tem uma camada de
"achados" embrionária (`gerarPanorama`, `gerarOportunidadesParceiros`) que
transforma número em recomendação textual. A visão estratégica não pede
para criar essa camada do zero; pede para **formalizá-la, estruturá-la e
estendê-la** para os eixos financeiro/estratégico que hoje não existem.
Isso é a descoberta mais importante desta auditoria (ver seção F).

---

## A. Matriz das 24 recomendações

Lista consolidada a partir dos 6 blocos e das seções 8–26 do pedido —
nenhuma lista externa de "24 recomendações" foi fornecida à parte; esta é
a extração direta da especificação recebida.

| # | Recomendação | Situação | Componentes reais existentes | Gap | Dependências | Risco | Próxima ação |
|---|---|---|---|---|---|---|---|
| 1 | Motor Oficial (normativo/operação) | **Parcial** | `src/engine/motorOficial/adapter.ts` (`OfficialEngineAdapter`), `OperacaoTributariaNormalizada`, `ResultadoCalculoNormalizado`, piloto real (21/24 ok) | conectar a um fluxo de agregação por empresa; homologação | jurídico (licenciamento, não resolvido); granularidade XML | alto (jurídico) | manter fora da UI até parecer jurídico |
| 2 | Motor VGR (gerencial/agregado) | **Existe** | `calculo.ts::simular`, `SimulacaoInput`/`ResultadoAno`, `ANOS_SIMULACAO` | nenhum — é o motor mais maduro do projeto | — | baixo | só evoluir por composição (ver B) |
| 3 | Índice de Crédito (créditos÷débitos) | **Parcial** | `ResultadoAno.creditoApuradoCbs/Ibs`, `debitoBrutoCbs/Ibs` já existem por ano; `agregarCreditoPorSistema` (`creditoTributario.ts`) já produz `percentualCreditavel` | fórmula explícita "índice de crédito" como indicador de 1ª classe, não implícita em campos separados | nenhuma (é derivação aritmética do que já existe) | baixo | modelar função pura, sem novo dado |
| 4 | Crédito necessário para neutralizar a Reforma | **Novo** (mas trivial) | `ResultadoAno.deltaCargaReais`, `creditoApuradoCbs/Ibs` | função de busca/inversão (quanto de crédito adicional zera `deltaCargaReais`) | nenhuma nova — é derivação | baixo | modelar função pura |
| 5 | Motor de Regimes (Simples×Presumido×Real) | **Novo** | `Regime` (tipo já existe: 4 valores), `pisCofinsPorRegime` (`tributosAtuais.ts`), estrutura de créditos já separa PIS/COFINS de ICMS/IPI de CBS/IBS | motor comparativo simultâneo (hoje só 1 regime por simulação); IRPJ/CSLL/INSS/folha não modelados | regra tributária (IRPJ/CSLL/Fator R por completo); dados (folha, pró-labore) | alto | modelar arquitetura antes de codificar (seção 10 do pedido) |
| 6 | Fator R | **Novo** | zero — confirmado por grep em todo o repo | tudo: RBT12, FS12, Anexo III↔V, folha necessária | regra tributária (Fator R muda com legislação); dados (histórico de folha 12 meses) | alto | depende do Motor de Regimes existir primeiro |
| 7 | Regras setoriais (núcleo + perfil) | **Existe parcialmente** | `PerfilAtividade` (4 setores), `categoriasDespesaPorPerfil` (`atividades.json`), `identificarPerfilPorCnae`, fallback genérico (`categoriasGenericasPorNatureza`) — **a arquitetura "núcleo geral → perfil setorial → parâmetros" já é literalmente como o projeto funciona hoje** | só 4 dos 6 setores citados (falta Saúde e Indústria como perfis dedicados — Indústria cai no fallback genérico) | regra tributária por setor (ex.: equiparação hospitalar) | médio | estender o padrão já existente, não recriar |
| 8 | Motor Econômico-Financeiro | **Novo** | `projecao.ts::faturamentoParaMargemAlvo`, `panorama.ts::margem2027` — cálculos avulsos, não uma camada dedicada | camada formal que recebe `ResultadoAno` como entrada e nunca recalcula tributo | dados (custos fixos/variáveis separados — hoje só "custos creditáveis" agregados) | médio | extrair para módulo próprio antes de crescer |
| 9 | Margem (atual × projetada, erosão em p.p.) | **Parcial** | `margem2027` já existe em `panorama.ts`; `faturamentoParaMargemAlvo` já inverte a fórmula | "erosão em p.p." e série ano-a-ano não existem — só um ano (2027) | dados econômicos (margem atual real, não estimada) | baixo | estender `panorama.ts`/criar módulo financeiro |
| 10 | Preservação de margem via preço (3 cenários) | **Novo** | `faturamentoParaMargemAlvo` resolve a mesma equação inversa, só que para faturamento, não preço | variável de decisão (preço) em vez de faturamento; 3 cenários (absorção/parcial/integral) | decisão de produto (o que "repasse parcial" significa numericamente) | médio | depende do Motor Financeiro (#8) |
| 11 | Split payment como módulo financeiro | **Parcial** | `calculo.ts::splitPaymentAtivo`, `capitalGiroLiberadoAtualMensal`, `capitalGiroPerdidoComSplitMensal`, parametrizado em `parametros.splitPayment` | "dias equivalentes de caixa", impacto anual consolidado, visão comparativa dedicada | nenhuma nova — dados já existem, falta camada de apresentação/agregação | baixo | extrair indicadores já calculados para um módulo dedicado |
| 12 | Motor de Cenários (orquestrador) | **Parcial** | `ImportarSped.tsx`/`SimuladorWizard.tsx` já têm `ModoProjecao = "crescimento"\|"margem"`; `calculo.ts::simular` já é determinístico e chamável repetidamente | orquestração de múltiplos motores (hoje só chama `simular`, não uma cadeia Fiscal→Regimes→Financeiro) | depende de #5 e #8 existirem | médio | não criar regra fiscal aqui — só orquestrar |
| 13 | Sensibilidade | **Novo** (mecanismo simples) | `simular()` já é puro/determinístico — pré-requisito естrutural já satisfeito | loop de variação de parâmetros + comparação de `recomendacao` entre execuções | depende de #12 | baixo | função pura sobre o que já existe, sem nova regra |
| 14 | Break-even / ponto de virada | **Novo** | mesma base determinística de `simular()`; padrão de busca por inversão já usado em `faturamentoParaMargemAlvo` | busca automática (bisseção/busca linear) sobre múltiplas variáveis | depende de #5 (break-even ENTRE regimes) e #8 (break-even de margem) | médio | depende de #12/#13 existirem primeiro |
| 15 | Auditoria estratégica — achados estruturados | **Parcial, mais madura do que parece** | `gerarOportunidadesParceiros` e `gerarPanorama` **já implementam exatamente o padrão pedido**: threshold → item estruturado `{tipo, titulo, descricao}` | falta padronizar `tipo` como enum com severidade/valor numérico (`{tipo: BAIXO_INDICE_CREDITO, severidade, valor}`), não string livre | nenhuma — é refatoração de formato, não capacidade nova | baixo | generalizar o padrão já usado 2x no código |
| 16 | IA consultiva | **Novo** | zero ocorrências de IA/LLM no repo | tudo — mas a ENTRADA da IA (achados estruturados) está com base no item 15 | decisão de produto (qual provedor, custo, quando chamar) | médio (acoplamento externo) | só depois de #15 estar estruturado |
| 17 | Score Estratégico | **Novo** | comentário explícito em `ResultadoExecutivo.tsx` já rejeita score arbitrário hoje ("não é um score sofisticado") | indicadores objetivos por eixo (eficiência/margem/caixa/segurança) | depende de #3, #9, #11, #19 existirem primeiro (é uma composição, não uma medição nova) | alto (score mal calibrado é o pior tipo de erro — parece autoridade, é opinião) | não implementar antes dos indicadores-base existirem |
| 18 | Regime de menor tributo × regime recomendado | **Novo** (conceito), **decisão de produto** | `Regime` já modela o espaço de opções | separar "menor carga" (função pura sobre #5) de "recomendado" (pondera risco/complexidade/margem/caixa) | depende de #5, #8, #17 (ou pelo menos de indicadores de margem/caixa) | médio | formalizar já — é só uma decisão de assinatura de função, não código |
| 19 | Auditabilidade ponta a ponta | **Existe, mais forte que o resto do projeto** | `CampoComProveniencia<T>` (origem+status), `OrigemCalculo`, `ResultadoCalculoNormalizado.proveniencia` (versaoMotor/executadoEm/qualidade/motivoEstimativa), `StatusClassificacao`/`TratamentoTributarioCategoria.observacao` | estender a MESMA disciplina para os novos motores (financeiro/cenários/estratégico) — não criar um padrão de rastreabilidade novo | nenhuma — é reuso disciplinado | baixo | exigir `proveniencia`-like em todo motor novo desde o dia 1 |
| 20 | Dashboard executivo (novos indicadores) | **Parcial** | `KpiCard/KpiGrid`, `TaxStat/TaxReductionStat`, `CargaLineChart`, `ChartContainer` (design-system) já existem e já renderizam série por ano | não há onde ligar carga+margem+caixa+regime juntos — os componentes existem, os DADOS combinados não | depende de #8, #9, #11, #18 produzirem os números | baixo (é a parte fácil, uma vez que os motores existam) | não redesenhar — só alimentar com dados novos quando existirem |
| 21 | Linha do tempo 2026–2033 estendida | **Existe a espinha, falta o conteúdo** | `ANOS_SIMULACAO`, `ResultadoAno[]`, `metodologiaMultiAno.ts` já é multi-ano real (não só a reforma — cresce com dados de múltiplos anos de SPED) | hoje só carrega carga tributária; margem/caixa/regime por ano não existem | depende de #8/#9/#11/#5 | baixo | estender `ResultadoAno`, não recriar a linha do tempo |
| 22 | Motor Estratégico (decisão final) | **Novo** | `recomendacao`/`avisos` já existem em `ResultadoSimulacao`, mas são texto fixo por regra simples em `calculo.ts::gerarRecomendacao` | camada que pondera múltiplos motores (fiscal+financeiro+cenários) — hoje é uma função, não uma camada | depende de TUDO acima (#5, #8, #12, #17, #18) | alto (é o ponto de maior acoplamento do sistema) | último a construir, não primeiro |
| 23 | Relatório executivo com plano de ação | **Parcial** | `Relatorios.tsx`, `gerarApresentacaoHtml` (testado, HTML autocontido) já geram relatório a partir do `ResultadoSimulacao`/`Panorama` | "plano de ação" estruturado (ações concretas, não só narrativa) não existe | depende de #15/#22 | baixo | estender o gerador de HTML existente |
| 24 | Qualidade/score dos dados de entrada | **Existe embrionário** | comentário em `ResultadoExecutivo.tsx` já tem um "indicador de qualidade da simulação" implícito; `StatusClassificacao`/`ResultadoAgregacaoCredito.percentualIndeterminado`/`percentualSobPremissa` já quantificam isso | formalizar como indicador de 1ª classe, reusável pelo Score Estratégico (#17) | nenhuma — é composição do que já existe | baixo | expor como função pura, não big-bang |

---

## B. Arquitetura funcional proposta (sem implementação)

A proposta do pedido (Fiscal→Créditos→Regimes→Financeiro→Cenários→
Estratégico→Regras/Achados→IA→Recomendação) está **estruturalmente
correta e é quase exatamente como o código já se organiza informalmente**
— só falta nomear as camadas e parar de misturar responsabilidades dentro
de `calculo.ts` e `panorama.ts`. Ajuste proposto (motivo: código real já
mostra que "Motor de Créditos" não é uma camada separada do Motor Fiscal —
é parte do MESMO cálculo por ano, já entrelaçado em `ResultadoAno`):

```text
                    DADOS
                     │
       ┌─────────────┼─────────────┐
       │             │             │
      XML           SPED         MANUAL
       │             │             │
       └─────────────┼─────────────┘
                     ↓
         MODELO VGR NORMALIZADO         (existe: OperacaoTributariaNormalizada,
                     ↓                   DadosApuradosCliente, SimulacaoInput)
      MOTOR FISCAL (inclui créditos)    (existe: calculo.ts::simular +
           ↙            ↘                creditoTributario.ts — já é 1 camada,
    Motor Oficial   Motor VGR            não 2; correção do diagrama do pedido)
                     ↓
             MOTOR DE REGIMES           (NOVO — compara N execuções do Motor
                     ↓                   Fiscal, uma por regime candidato)
        MOTOR ECONÔMICO-FINANCEIRO      (NOVO — recebe ResultadoAno[], nunca
                     ↓                   recalcula tributo)
             MOTOR DE CENÁRIOS          (NOVO — orquestra os 3 motores acima
                     ↓                   com N conjuntos de parâmetros)
             MOTOR ESTRATÉGICO          (NOVO — decide regimeRecomendado,
                     ↓                   pondera risco/complexidade)
           REGRAS / ACHADOS VGR         (PARCIAL — já existe o padrão em
                     ↓                   gerarPanorama/gerarOportunidadesParceiros)
                    IA                  (NOVO — só lê achados estruturados)
                     ↓
        RECOMENDAÇÃO + PLANO DE AÇÃO    (PARCIAL — Relatorios.tsx/gerarApresentacaoHtml)
                     ↓
 Dashboard / Simulador / Relatório      (EXISTE — design-system pronto)
```

**Única correção estrutural ao diagrama do pedido**: Créditos não é uma
camada entre Fiscal e Regimes — no código real, crédito é uma dimensão
DENTRO do cálculo fiscal por ano (`ResultadoAno.creditoApuradoCbs/Ibs`).
Tratar como camada separada criaria duplicação (dois lugares calculando a
mesma coisa). O "Motor de Créditos" da visão estratégica deve ser lido
como **indicadores derivados** (Índice de Crédito, Crédito para
neutralizar) sobre o que o Motor Fiscal já produz — não uma nova
execução de cálculo.

## C. Mapa de módulos (responsabilidade única de cada um)

| Módulo | Responsabilidade | Nunca faz |
|---|---|---|
| Motor Fiscal (`calculo.ts` + `motorOficial/adapter.ts`) | CBS/IBS/créditos/split payment por ano, por regime único informado | não decide qual regime é melhor; não calcula margem |
| Motor de Regimes (novo) | roda o Motor Fiscal N vezes (uma por regime candidato) e devolve `ResultadoAno[]` por regime | não recalcula tributo com lógica própria — só chama o Motor Fiscal com `regimeAtual` diferente |
| Motor Econômico-Financeiro (novo) | margem, preço, caixa, capital de giro — SEMPRE a partir de `ResultadoAno` já calculado | não recalcula CBS/IBS |
| Motor de Cenários (novo) | varia parâmetros de entrada (faturamento, custos, crescimento) e chama os motores acima N vezes | não contém regra fiscal nem financeira própria |
| Motor Estratégico (novo) | pondera resultados de Regimes+Financeiro+Cenários → `regimeRecomendado`, plano de ação | não recalcula nada dos motores abaixo dele |
| Regras/Achados (extensão de `panorama.ts`/`oportunidadesParceiros.ts`) | threshold → achado estruturado tipado | não decide o que fazer — só descreve o que foi observado |
| IA (novo) | achado estruturado → explicação em linguagem natural | não calcula, não descobre indicador novo, não acessa dados brutos |
| Apresentação (`design-system/`, `ResultadoExecutivo.tsx`, `Relatorios.tsx`) | renderizar o que os motores produziram | nunca recalcula (regra já testada e vigente — `resultadoTributario.test.ts`) |

## D. Mapa de dependências (ordem lógica, não prioridade de negócio)

```text
Motor Fiscal (existe)
   ↓
Índice de Crédito / Crédito p/ neutralizar (derivação — pode ser feito já)
   ↓
Motor de Regimes ────────────┐
   ↓                          │
Fator R (precisa do Motor     │
de Regimes existir, porque    │
Fator R decide ENTRE          │
Anexo III e V dentro do       │
Simples, que é 1 dos regimes) │
   ↓                          ↓
Motor Econômico-Financeiro   Break-even ENTRE regimes
   ↓                          ↑
Margem / Preço / Split        │
Payment financeiro            │
   ↓                          │
Motor de Cenários ────────────┘
   ↓
Sensibilidade (variação de parâmetros sobre o Motor de Cenários)
   ↓
Break-even de margem/preço/folha (busca sobre o Motor de Cenários)
   ↓
Achados estruturados (extensão do padrão já existente)
   ↓
Score Estratégico (precisa dos achados/indicadores acima já existirem)
   ↓
Motor Estratégico (regimeRecomendado = f(menor carga, margem, caixa, risco, score))
   ↓
IA consultiva (só lê achados + decisão do Motor Estratégico)
   ↓
Relatório / Plano de ação / Dashboard
```

**Dependência lateral a evitar** (ciclo potencial): o Motor Estratégico
não deve chamar de volta o Motor de Cenários para "testar suas próprias
recomendações" dentro do mesmo ciclo de execução — isso criaria uma
dependência circular Estratégico↔Cenários. Se for necessário simular o
efeito de uma recomendação, isso é uma NOVA chamada ao Motor de Cenários,
iniciada pela UI/usuário, não uma chamada interna do Motor Estratégico.

## E. O que será reutilizado (sem recriar)

- `OperacaoTributariaNormalizada` / `ResultadoCalculoNormalizado` /
  `OrigemCalculo` / `CampoComProveniencia` — base de qualquer motor novo
  que precise de rastreabilidade; já resolvido, não deve ganhar
  equivalente paralelo.
- `SimulacaoInput` / `ResultadoAno` / `ANOS_SIMULACAO` — o Motor de
  Regimes deve produzir `Record<Regime, ResultadoAno[]>`, reusando o
  MESMO tipo `ResultadoAno`, não um tipo novo por regime.
- `creditoTributario.ts` (`NaturezaEconomica`, `TratamentoCredito`,
  `StatusClassificacao`, `agregarCreditoPorSistema`) — já é a base
  correta para o Índice de Crédito; não recriar em outro módulo.
- `metodologiaMultiAno.ts` — já resolve "múltiplos anos", a extensão da
  linha do tempo (#21) deve estender esse arquivo, não criar um novo
  conceito de série temporal.
- `gerarPanorama` / `gerarOportunidadesParceiros` — o padrão de achado
  estruturado já existe 2 vezes; a "Auditoria Estratégica" (#15) é
  generalizar esse padrão, não inventar um novo.
- `design-system/` completo (`KpiCard`, `TaxStat`, `CargaLineChart`,
  `ChartContainer`, `Tabs`, `Drawer`) — nenhum componente novo é
  necessário para exibir os indicadores do Dashboard estendido (#20); é
  reuso de composição, quando os dados existirem.
- `ClienteDataContext` — continua sendo o único lugar que guarda
  `resultadoSimulacao`/`panorama`; motores novos devem alimentar esse
  contexto, não criar um contexto paralelo.
- Padrão de parametrização (`config/*.json` nunca hardcoded em `.ts`) —
  Motor de Regimes/Fator R devem seguir a mesma disciplina
  (`docs/manutencao-parametros.md`), não hardcodar alíquota de IRPJ/CSLL
  em código.

## F. O que é realmente novo

Sem ambiguidade, hoje **não existe nenhuma linha de código** para: Fator
R, IRPJ/CSLL/INSS explícitos, comparação simultânea de regimes,
break-even, score, IA, motor financeiro dedicado (margem/preço/caixa como
camada, não como função avulsa). Isso é a maior parte do esforço de
engenharia futuro — mas é menos do que os 24 itens sugerem à primeira
vista, porque **6 dos 24 itens (#3, #4, #11, #19, #21, #24) são extensões
de dados/indicadores sobre estruturas que já existem**, não capacidades
novas.

## G. Regras setoriais — como se conectam ao núcleo

O padrão **já existe e já funciona exatamente como a seção 11 do pedido
descreve** — não é uma proposta, é uma descrição do código atual:

```text
Núcleo geral (calculo.ts, agnóstico de setor)
     ↓
Perfil setorial (PerfilAtividade: aviacao_agricola | produtor_rural |
                 transporte_rodoviario_cargas | construcao_civil)
     ↓
Parâmetros/categorias específicas (atividades.json →
                 categoriasDespesaPorPerfil[perfil])
```

Saúde e Indústria (citados no pedido) hoje caem no fallback genérico
(`categoriasGenericasPorNatureza.industria` existe como natureza de
operação, mas sem categorias revisadas equivalentes às 4 verticais). Para
adicionar Saúde como 5º perfil dedicado, o caminho é literalmente
`docs/arquitetura.md`'s already-established pattern: uma entrada nova em
`mapeamentoCnaeParaPerfil`, um bloco novo em `categoriasDespesaPorPerfil`,
zero mudança em `calculo.ts`. Isso é o motivo pelo qual a arquitetura
setorial é classificada como "existe parcialmente", não "novo".

## H. Pontos que dependem de validação tributária (não são decisão técnica)

- Fator R (#6): regra de Anexo III↔V, folha mínima — LC 214/2025 e IN da
  Receita, sujeitas a mudança até 2033.
- Motor de Regimes (#5): componentes de IRPJ/CSLL/INSS na comparação —
  exige parecer, não é dedução do código existente.
- Regras setoriais novas (Saúde — equiparação hospitalar, glosas): não
  modeladas em lugar nenhum do projeto hoje; exige revisão jurídica
  específica antes de qualquer `categoriasDespesaPorPerfil.saude`.
- Break-even ENTRE regimes (#14): correto só depois do Motor de Regimes
  estar validado — buscar automaticamente "quando trocar de regime" com
  uma comparação incompleta (sem IRPJ/CSLL) dá uma resposta enganosa.
- Gate jurídico do Motor Oficial (#1): já registrado desde o spike —
  segue vigente, sem mudança nesta auditoria.

## I. Pontos que dependem de novos dados (arquitetura já suporta)

- Margem real por ano (#9): hoje só há `margem2027` estimado; falta
  captura de margem histórica real (provavelmente via DRE — já há um
  parser de DRE em `src/engine/dre/`, subutilizado para isso).
- Fator R (#6): folha dos últimos 12 meses — não capturado em nenhum
  parser hoje (SPED/XML atuais não trazem folha de pagamento).
- Custos fixos × variáveis separados (#8): hoje `percentualCustosCreditaveis`
  é agregado; Motor Financeiro precisa da composição, não só o percentual
  creditável.
- Score Estratégico (#17): qualquer eixo objetivo (ex.: "Proteção do
  Caixa") depende de #9/#11 estarem alimentados com dados reais, não
  estimativas — senão o score mediria a qualidade da estimativa, não da
  empresa.

## J. Roadmap recomendado (fases coerentes com D)

**Fase 1 — Derivações sobre o que já existe (baixo risco, sem regra nova)**
Índice de Crédito (#3), Crédito para neutralizar (#4), extração dos
indicadores de split payment já calculados para um módulo dedicado (#11),
formalização do indicador de qualidade (#24), generalização do padrão de
achado estruturado (#15 — só refatorar `tipo` de string para enum
tipado).

**Fase 2 — Motor de Regimes (o maior módulo novo, mas o mais bem
delimitado)**
Modelar arquitetura (não codificar regra ainda) de comparação
Simples/Presumido/Real; definir os componentes de carga total
(IRPJ/CSLL/INSS) com validação tributária antes de qualquer código.

**Fase 3 — Motor Econômico-Financeiro**
Margem série completa (#9), preservação de margem via preço (#10) —
ambos dependem só de #8 existir como camada, não de #5 estar pronto.
Pode correr em paralelo com a Fase 2.

**Fase 4 — Fator R + Break-even entre regimes**
Só depois da Fase 2 estar validada normativamente.

**Fase 5 — Motor de Cenários + Sensibilidade**
Orquestração pura sobre Fases 2–4 — não introduz regra nova.

**Fase 6 — Score Estratégico + Motor Estratégico + IA**
Última fase — dependem de todos os indicadores anteriores existirem com
dados reais, não estimados, para não formalizar um score sobre premissa
frágil.

**Fase 7 — Dashboard estendido + Relatório com plano de ação**
Camada de apresentação — pode ser feita incrementalmente, tela por tela,
conforme cada motor amadurece; não precisa esperar o roadmap inteiro.

---

## Classificação final

Com base no código real (não em impressão subjetiva):

```text
~20% já implementado e maduro         (Motor Fiscal VGR, Motor Oficial em piloto,
                                        créditos, proveniência/auditabilidade,
                                        regras setoriais para 4 perfis, linha do
                                        tempo multi-ano, design-system completo)

~35% parcialmente suportado           (índice de crédito, split payment financeiro,
                                        margem, achados estruturados, relatório,
                                        dashboard, regras setoriais para novos
                                        setores)

~45% novo                             (Motor de Regimes, Fator R, Motor Financeiro
                                        formal, Motor de Cenários, Sensibilidade,
                                        Break-even, Score, Motor Estratégico, IA)
```

**A arquitetura atual suporta essa evolução incrementalmente.** Nenhuma
parte central precisa ser redesenhada — a única correção estrutural
identificada (seção B) é conceitual: "Motor de Créditos" não deve virar
uma camada de execução separada do Motor Fiscal, porque duplicaria
cálculo já feito em `ResultadoAno`. Fora isso, os tipos existentes
(`SimulacaoInput`, `ResultadoAno`, `OperacaoTributariaNormalizada`,
`ResultadoCalculoNormalizado`) já têm a forma certa para serem a entrada
de todos os motores novos — nenhum precisa ser reescrito, só estendido
(regra já seguida hoje: `docs/manutencao-parametros.md`,
`docs/arquitetura-motor-hibrido.md`).

## Cinco decisões prioritárias (para evitar retrabalho)

1. **Onde "Motor de Créditos" vive.** Decidir agora, por escrito, que
   Índice de Crédito/Crédito-para-neutralizar são **funções derivadas**
   sobre `ResultadoAno`, nunca uma segunda execução de cálculo — evita
   que alguém comece a implementar um "motor" paralelo que duplica
   `creditoApuradoCbs/Ibs`.
2. **Contrato de saída do Motor de Regimes antes de escrever a primeira
   linha.** Decidir que ele produz `Record<Regime, ResultadoAno[]>`
   (reusando o tipo existente, uma execução do Motor Fiscal por regime),
   não um tipo de resultado novo por regime — isso decide toda a
   interface que o Motor de Cenários e o Motor Estratégico vão consumir
   depois.
3. **`tipo` de achado como enum, não string, desde a primeira extensão
   do padrão de `gerarPanorama`.** Se a Fase 1 (#15) usar string livre "só
   por agora", a IA (Fase 6) herda esse débito e vira parsing de texto em
   vez de leitura estruturada — mais caro de corrigir depois do que de
   fazer certo agora.
4. **Fronteira dura entre Motor Financeiro e Motor Fiscal.** Decidir e
   documentar (como já existe para apresentação: "nunca recalcula o
   engine") que o Motor Financeiro **nunca** importa `parametros.json`
   nem `aliquotaCbs`/`aliquotaIbs` diretamente — só consome
   `ResultadoAno` já calculado. Sem essa regra escrita, é fácil alguém
   "só adicionar uma correção rápida" de alíquota dentro do cálculo de
   margem, reintroduzindo acoplamento que a arquitetura atual evitou com
   sucesso entre Motor Oficial e Motor VGR.
5. **Não iniciar Score Estratégico nem Motor Estratégico até os
   indicadores-base terem dado real, não estimado.** Essa é a decisão
   que mais evita retrabalho: um score calibrado sobre estimativas vai
   precisar ser recalibrado (ou pior, vai minar a confiança no produto)
   no dia em que margem/caixa passarem a vir de dado real — melhor
   adiar a existência do score do que entregá-lo cedo e errado.

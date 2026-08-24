# Arquitetura híbrida: Motor Oficial + Motor VGR

> Status: **desenho conceitual, aprovado para prosseguir (Arquitetura C)**.
> Nada neste documento foi implementado. `calculo.ts`, o pipeline SPED e o
> Dashboard/Resultado atuais continuam funcionando exatamente como hoje — ver
> seção 11.
>
> Contexto: este documento é a continuação do spike técnico do Motor Oficial
> (componente "Calculadora de Tributos" da Receita/SERPRO, V0039/1.2.4-b0e47264/APR),
> que validou empiricamente viabilidade técnica, performance, ausência de
> telemetria externa e identificou uma ressalva de licenciamento pendente de
> parecer jurídico (ver gate na seção 12).

## Princípio

> O Motor Oficial conhece a regra da operação. A VGR conhece o contexto da
> empresa. A inteligência do produto nasce da combinação dos dois.

Os dois motores não competem — respondem perguntas diferentes:

| | Motor Oficial | Motor VGR |
|---|---|---|
| Pergunta | Qual é o tratamento tributário **desta operação**? | Qual é o impacto tributário/econômico estimado **para esta empresa**? |
| Granularidade | Item/operação individual | Agregado (categoria, empresa, cenário) |
| Precisa de | Classificação completa (NCM/CST/cClassTrib/município) | Estrutura de custos, faturamento, premissas |
| Cobre | Só o que tem dado suficiente | Sempre — inclusive o que falta ao Oficial |

O Motor VGR **não é substituído nem deprecado**. Ele continua sendo o motor
padrão para simulação manual, prospecção, cenários hipotéticos, projeções
2026–2033, análise de sensibilidade e qualquer empresa sem dados granulares
o bastante — o que hoje é a maioria dos casos reais (ver gap D do spike).

---

## 1. Diagrama da arquitetura híbrida

```
                        FONTES
                          │
          ┌───────────────┼────────────────┐
          │                │                │
         XML             SPED             Manual
          │                │                │
          └───────────────┼────────────────┘
                          ↓
              MODELO NORMALIZADO VGR
              (OperacaoTributariaNormalizada)
                          ↓
              CLASSIFICAÇÃO / ENRIQUECIMENTO
                          ↓
              AVALIAÇÃO DE ELEGIBILIDADE
           (dado suficiente para cálculo normativo?)
                          │
             ┌────────────┴────────────┐
             │ elegível                │ não elegível
             ↓                         ↓
      MOTOR OFICIAL               MOTOR VGR
      (operacional,            (gerencial, agregado,
       por operação)            estimativo, cenários)
             │                         │
             └────────────┬────────────┘
                          ↓
              RESULTADO NORMALIZADO VGR
              (ResultadoCalculoNormalizado)
                          ↓
                     AGREGAÇÃO
                          ↓
                CENÁRIOS 2026–2033
                          ↓
                    DIAGNÓSTICO
                          ↓
        Dashboard / Resultado / Relatório
```

Dashboard, Resultado e Relatório só conhecem `ResultadoCalculoNormalizado`.
Nunca leem o JSON do motor oficial nem uma estrutura interna do `calculo.ts`
diretamente — essa é a garantia estrutural de que a UX não depende de qual
motor produziu o número (requisito do princípio da arquitetura).

---

## 2. Modelos conceituais

### 2.1 Proveniência — o bloco reutilizável

Toda informação que pode vir de lugares diferentes, com confiabilidades
diferentes, é modelada com o mesmo par **origem + status**, nunca misturando
os dois:

```ts
type OrigemInformacao =
  | "xml"                 // extraído de documento fiscal eletrônico
  | "sped"                // extraído de escrituração fiscal/contábil
  | "informado_usuario"    // digitado manualmente
  | "classificacao_vgr"    // inferido pela VGR (ex.: NCM sugerido por heurística)
  | "motor_oficial"        // devolvido pelo cálculo oficial
  | "motor_vgr";           // devolvido pelo cálculo gerencial VGR

type StatusInformacao =
  | "confirmado"     // validado, sem ambiguidade
  | "estimado"       // premissa provisória, explícita
  | "herdado"        // herdado de classificação anterior/legado
  | "importado";     // veio de um documento, ainda não revisado

interface CampoComProveniencia<T> {
  valor: T;
  origem: OrigemInformacao;
  status: StatusInformacao;
}
```

Exemplo (do próprio pedido do usuário):

```ts
ncm: { valor: "12345678", origem: "xml", status: "importado" }
cClassTrib: { valor: "XXXXX", origem: "classificacao_vgr", status: "estimado" }
```

Isso generaliza — e substitui, para este novo domínio — o padrão que já existe
em `creditoTributario.ts` (`TratamentoTributarioCategoria` com
`status: StatusClassificacao`). Não é uma coincidência: é o mesmo princípio
("nunca implícito, sempre com proveniência explícita") aplicado um nível
abaixo, na operação individual em vez da categoria de gasto agregada.

### 2.2 `OperacaoTributariaNormalizada`

Domínio próprio da VGR — não é cópia do DTO da Receita. Pensado para poder
nascer de XML, SPED (quando granular o bastante — ver seção 3), ou entrada
manual, todas convergindo para a mesma forma.

```ts
interface OperacaoTributariaNormalizada {
  identificacao: {
    empresaId: string;
    documentoId?: string;       // nº da NF-e, chave de acesso, registro SPED, etc.
    itemId?: string;            // item dentro do documento, quando existir
    data: CampoComProveniencia<string>;
    tipoOperacao: CampoComProveniencia<string>; // venda, compra, devolução, etc.
  };

  produtoServico: {
    descricao?: CampoComProveniencia<string>;
    ncm?: CampoComProveniencia<string>;
    nbs?: CampoComProveniencia<string>;
    unidade?: CampoComProveniencia<string>;
    quantidade?: CampoComProveniencia<number>;
  };

  classificacaoTributaria: {
    cst?: CampoComProveniencia<string>;
    cClassTrib?: CampoComProveniencia<string>;
    // extensível: demais classificações exigidas por regime/operação
  };

  valores: {
    valorOperacao: CampoComProveniencia<number>;
    baseCalculo?: CampoComProveniencia<number>;
    descontos?: CampoComProveniencia<number>;
    // demais componentes (frete, seguro, outras despesas acessórias) conforme necessidade real
  };

  localidade: {
    uf: CampoComProveniencia<string>;
    municipio?: CampoComProveniencia<number>; // código IBGE — exigido pelo Motor Oficial
    ufOrigem?: CampoComProveniencia<string>;
    ufDestino?: CampoComProveniencia<string>;
  };

  participantes?: {
    fornecedor?: { identificacao?: CampoComProveniencia<string>; regimeTributario?: CampoComProveniencia<string> };
    cliente?: { identificacao?: CampoComProveniencia<string>; regimeTributario?: CampoComProveniencia<string> };
  };

  granularidade: "item" | "agregado"; // ver seção 3 — não presumir pelo formato de origem
}
```

Pontos deliberados:
- Todo campo relevante é `CampoComProveniencia<T>`, não `T` puro — a estrutura
  não permite "esquecer" de onde veio um dado.
- Campos que só existem quando há granularidade item-a-item (NCM, CST,
  cClassTrib, quantidade) são opcionais — uma operação agregada é uma
  `OperacaoTributariaNormalizada` válida, só com menos campos preenchidos.
- Não modela nada que hoje é específico do contrato da Receita (não tem
  `impostoSeletivo.impostoInformado` como campo de primeira classe, por
  exemplo) — isso é responsabilidade do adapter (seção 18).

### 2.3 `OrigemCalculo`

Dimensão independente de `StatusClassificacao` — não aninhada, não misturada.

```ts
type OrigemCalculo =
  | "motor_oficial"
  | "motor_vgr";
```

Nota de desenho: o pedido original sugeriu incluir `classificacao_vgr`,
`informado_usuario` e `importado` dentro de `OrigemCalculo`. Neste desenho eles
ficam em `OrigemInformacao` (seção 2.1), porque descrevem a proveniência de um
**dado de entrada**, não de um **resultado de cálculo** — só existem dois
lugares de onde um resultado de cálculo pode vir. Misturar os dois enfraquece
exatamente a separação que a seção 4 do pedido exige. `OrigemInformacao` e
`OrigemCalculo` são tipos irmãos, não um substituindo o outro.

```ts
// Correto:
{ origem: "motor_oficial", status: "confirmado" }
{ origem: "motor_vgr", status: "estimado" }

// Nunca:
{ origem: "motor_vgr", statusOuOrigem: "estimado_por_motor_vgr" } // ❌ dimensões coladas
```

### 2.4 `ResultadoCalculoNormalizado`

Contrato único que Dashboard/Resultado/Relatório consomem — independe de qual
motor calculou.

```ts
interface ResultadoCalculoNormalizado {
  operacaoId: string;

  valores: {
    debito?: number;
    credito?: number;
    cbs?: number;
    ibs?: number;
    is?: number;          // Imposto Seletivo — só quando aplicável
    baseCalculo: number;
    aliquotaEfetiva?: number;
    reducoes?: { descricao: string; percentual: number }[];
    cargaTributaria: number; // sempre presente — é o número que a UX consome hoje
  };

  memoriaCalculo?: {
    narrativa?: string;       // texto explicativo, quando o motor fornece
    fundamentoLegal?: string; // ex.: "Art. 412, I" — preservado verbatim do Motor Oficial
    regrasAplicadas?: string[];
  };

  alertas?: string[];

  proveniencia: {
    origemCalculo: OrigemCalculo;
    versaoMotor: string;         // ex.: "V0039/1.2.4-b0e47264/APR" ou versão interna do VGR
    executadoEm: string;         // ISO 8601
    qualidade: "confirmado" | "estimativa"; // nunca implícito — ver seção 8
    motivoEstimativa?: string;   // obrigatório quando qualidade === "estimativa"
  };
}
```

Regra de desenho explícita: **campos como `memoriaCalculo.fundamentoLegal`
são opcionais e nunca obrigatórios** — o Motor VGR não é forçado a inventar
uma memória de cálculo que não tem. O contrato comporta informação extra do
Motor Oficial sem exigir que o Motor VGR simule tê-la.

### 2.5 Qualidade/completude — três indicadores, não um score

Conforme pedido, três eixos independentes, sem compô-los ainda em um score
único:

```ts
interface QualidadeOperacao {
  completudeEntrada: "completa" | "parcial" | "insuficiente"; // temos os campos exigidos?
  qualidadeClassificacao: "confirmada" | "herdada" | "estimada"; // os campos foram validados?
  // origemCalculo já vive em ResultadoCalculoNormalizado.proveniencia — não duplicar aqui
}
```

Isso é o que alimenta, no futuro (não agora), um indicador de "qualidade da
simulação" — sem comprometer o desenho atual com um algoritmo de score
prematuro.

---

## 3. Granularidade não é sinônimo de formato de origem

Rejeitando explicitamente a equação `XML = granular` / `SPED = agregado`: a
granularidade é uma propriedade da **operação normalizada resultante**, não
do formato de origem.

```ts
type FonteOperacoes = "granular" | "agregada"; // propriedade da extração, não do formato
```

Uma extração de SPED que preserva registros a nível de item (dependendo do
bloco/registro disponível no arquivo) pode produzir operações `granularidade:
"item"`, candidatas ao Motor Oficial. Uma extração de XML malformado ou
resumido também pode cair em `"agregado"`. O gap real identificado no spike
(seção D) é que o **agregador atual** (`agregador.ts`) soma antes de
individualizar — isso é uma característica do código de hoje, não uma lei
física do formato SPED. A arquitetura não deve codificar essa limitação como
premissa permanente.

---

## 4. Adequação da abstração `CalculationEngine`

**Não forçar uma interface única.** A análise confirma a ressalva do próprio
pedido: Motor Oficial opera por operação/item; Motor VGR opera por
empresa/cenário agregado. Forçar os dois atrás de
`calcular(operacao): Promise<Resultado>` criaria uma abstração artificial —
o Motor VGR teria que fingir que "cenário agregado" é só uma operação, ou o
Motor Oficial teria que fingir que sabe agregar.

Desenho recomendado: **dois papéis, não uma interface**.

```ts
interface MotorOperacional {
  calcularOperacao(op: OperacaoTributariaNormalizada): Promise<ResultadoCalculoNormalizado>;
}

interface MotorGerencial {
  calcularCenario(entrada: EntradaGerencialVgr): Promise<ResultadoCalculoNormalizado[]>; // ou agregado
}

class OfficialCalculationEngine implements MotorOperacional { /* ... */ }
class VgrCalculationEngine implements MotorGerencial { /* ... */ } // e, opcionalmente, MotorOperacional também, se um dia calcular por operação individual em modo gerencial
```

Ambos os papéis devolvem `ResultadoCalculoNormalizado` — a convergência está
no **resultado**, não na assinatura de entrada. Isso preserva a garantia de
que Dashboard/Resultado nunca precisam saber qual motor rodou, sem inventar
uma abstração de entrada que nenhum dos dois motores realmente satisfaz bem.

---

## 5. Regra de elegibilidade para o Motor Oficial

```ts
interface ResultadoElegibilidade {
  elegivel: boolean;
  camposFaltantes: string[]; // ex.: ["municipio", "cst", "cClassTrib"]
}

function avaliarElegibilidadeMotorOficial(op: OperacaoTributariaNormalizada): ResultadoElegibilidade
```

Mínimo exigido (do contrato real confirmado no spike, seção C):
`municipio`, `uf`, `itens[].ncm`, `itens[].cst`, `itens[].cClassTrib`,
`itens[].baseCalculo`, `itens[].quantidade`, `itens[].unidade`. Se qualquer um
estiver ausente, `elegivel: false` com a lista exata — decidido **antes** de
chamar o motor, nunca descoberto por erro de API (conforme seção 7 do pedido).

---

## 6. Estratégia de fallback — sem fallback silencioso

```
Motor Oficial elegível?
  não → Motor VGR, com:
          proveniencia.origemCalculo = "motor_vgr"
          proveniencia.qualidade = "estimativa"
          proveniencia.motivoEstimativa = "dados insuficientes para cálculo normativo: falta CST, cClassTrib"

  sim → chamar Motor Oficial
          sucesso → origemCalculo = "motor_oficial", qualidade = "confirmado"
          falha/erro → registrar erro explicitamente (nunca inventar resultado "com aparência oficial")
                       → Motor VGR como fallback, com:
                          origemCalculo = "motor_vgr"
                          qualidade = "estimativa"
                          motivoEstimativa = "Motor Oficial indisponível: <detalhe do erro>"
```

Regra dura: `qualidade === "estimativa"` é **sempre visível** onde o resultado
aparece (Dashboard/Resultado) — a apresentação (não coberta neste desenho,
que é de dados) precisará de um rótulo visual do tipo "Estimativa VGR" sempre
que essa flag estiver presente. Nunca uma UI que apresente estimativa com a
mesma aparência de resultado oficial.

---

## 7. Cache e versionamento

**Chave de cache** (conceitual, não implementar ainda):

```
chave = hash(camposRelevantesDaOperacao) + versaoMotorOficial + versaoParametrosVgr
```

`camposRelevantesDaOperacao` é um subconjunto determinístico e estável de
`OperacaoTributariaNormalizada` (os campos que realmente entram no cálculo —
não a identificação/proveniência, que pode mudar sem afetar o resultado).
Mesma operação + mesma versão normativa ⇒ resultado reutilizável. Uma
atualização de versão do motor invalida naturalmente (a chave muda), sem
precisar de um mecanismo de invalidação manual.

**Versionamento do resultado**: o spike confirmou que a resposta do Motor
Oficial **não** carrega sua própria versão. Responsabilidade do
`OfficialEngineAdapter` (seção 18): carimbar
`proveniencia.versaoMotor` a partir da versão do pacote/imagem que o adapter
sabe estar rodando — nunca extrair (ou assumir) isso da resposta HTTP.

**Reprocessamento** (desenho para o futuro, não implementar agora):

```
Operação calculada na versão X
  → Motor atualizado para versão Y
  → operação marcada "potencialmente desatualizada" (comparação de versaoMotor armazenada vs. versão corrente)
  → reprocessamento é uma decisão explícita, não automática
```

---

## 8. Fluxo granular (XML/SPED item-a-item)

```
XML / SPED (quando granular — ver seção 3)
        ↓
    Documento
        ↓
      Item
        ↓
Operação normalizada (OperacaoTributariaNormalizada, granularidade: "item")
        ↓
Classificação/enriquecimento (preenche campos com origem "classificacao_vgr" quando a fonte não trouxe)
        ↓
Avaliação de elegibilidade (seção 5)
        ↓
Motor Oficial
        ↓
Resultado por item (ResultadoCalculoNormalizado)
        ↓
Resultado por documento (agregação VGR dos itens)
        ↓
Resultado por empresa
```

Ponto deliberado do pedido, preservado aqui: o item individual não é
descartado antes do cálculo — ele é a unidade que entra no Motor Oficial. A
agregação (documento → empresa) acontece **depois**, sobre resultados já
calculados, não sobre dados de entrada pré-agregados.

## 9. Fluxo gerencial (manual/agregado)

```
ECD / ECF / SPED / Manual
        ↓
  Dados econômicos
        ↓
  Categorias VGR (CategoriaGasto — já existe, creditoTributario.ts)
        ↓
Custos / despesas / faturamento
        ↓
    Motor VGR
        ↓
Projeção gerencial (ResultadoCalculoNormalizado agregado, origemCalculo: "motor_vgr")
```

Os dois fluxos (8 e 9) convergem na mesma camada de agregação/cenários/
diagnóstico do diagrama da seção 1 — nenhum dos dois é "o fluxo principal";
coexistem porque respondem perguntas diferentes (seção do princípio).

## 10. Três modos de análise → mesma UX de Resultado

| Modo | Entrada | Motor | Resultado |
|---|---|---|---|
| Rápida | dados gerenciais resumidos | VGR | estimativa executiva |
| Detalhada | dados fiscais + contábeis + composição econômica | VGR (maior granularidade) | diagnóstico mais confiável |
| Normativa | operações classificadas individualmente | Oficial (+ agregação VGR) | cálculo normativo por operação |

Todos os três terminam em `ResultadoCalculoNormalizado` e na mesma sequência
de apresentação (Carga % → R$ → p.p. → Diagnóstico → Evolução →
Detalhamento) — é o próprio contrato da seção 2.4 que garante isso, sem
exigir nenhuma ramificação na camada de apresentação.

---

## 11. Contrato conceitual do `OfficialEngineAdapter`

Responsabilidades exatas (e só essas — o resto do sistema não deve saber que
o componente existe, nem que roda em Docker):

1. Transformar `OperacaoTributariaNormalizada` (VGR) → payload do contrato
   oficial (`regime-geral`, conforme mapeamento C do spike).
2. Chamar o componente oficial (hoje: `POST localhost:8080/api/calculadora/regime-geral`).
3. Validar a resposta (schema/HTTP status) — tratar erro RFC 7807 (`type`,
   `title`, `status`, `detail`) como erro estruturado, não como texto livre.
4. Transformar resposta oficial → `ResultadoCalculoNormalizado`, preservando
   `memoriaCalculo.fundamentoLegal` e `narrativa` sem perda (seção 17 do
   pedido — confirmado no spike que a resposta real carrega essa informação).
5. Carimbar `proveniencia.versaoMotor` e `proveniencia.executadoEm` (a
   resposta não traz versão — ver seção 7).
6. Registrar erro explicitamente quando a chamada falhar — nunca devolver um
   resultado com `origemCalculo: "motor_oficial"` a partir de uma falha.
7. Identificar `proveniencia.origemCalculo: "motor_oficial"` sempre que a
   chamada tiver sucesso.

O adapter é a **única** peça do sistema que conhece a existência do
container/porta/schema oficial — Dashboard, Resultado, Diagnóstico e o
próprio orquestrador de elegibilidade/fallback (seção 6) só conversam com
`ResultadoCalculoNormalizado` e com a interface do adapter, nunca com o
formato HTTP real. Isso é o que garante a seção 19 do pedido ("não acoplar
o produto ao Docker") — infraestrutura pode virar outro binário, outra porta,
outro protocolo de transporte, sem tocar em nenhum consumidor.

---

## 12. Pontos exatos do código atual que futuramente precisariam mudar

*(mapeados, não alterados nesta etapa)*

| Arquivo | O que mudaria, e quando |
|---|---|
| `src/engine/sped/agregador.ts` | Hoje soma registros por conta/categoria antes de individualizar. Para alimentar o Motor Oficial a partir de SPED, precisaria de um caminho que preserve item/registro antes da agregação (novo código, não alteração do agregador existente — o agregador continua servindo o Motor VGR). |
| `src/engine/creditoTributario.ts` | `NaturezaEconomica`/`TratamentoCredito`/`StatusClassificacao` continuam servindo o Motor VGR sem alteração. Um novo arquivo (ex.: `operacaoTributaria.ts`) receberia `OperacaoTributariaNormalizada`, `OrigemCalculo`, `ResultadoCalculoNormalizado` — sem modificar os tipos existentes. |
| `calculo.ts` | **Não muda.** Continua sendo o `VgrCalculationEngine` de fato (mesmo sem essa interface formal ainda). Passaria a ter seu resultado adaptado para `ResultadoCalculoNormalizado` no momento da integração real — adaptação, não reescrita. |
| Importação manual/XML (`CustosDespesasStep.tsx` e afins) | Um fluxo de importação de XML de NF-e novo (ainda não existe) seria o primeiro produtor real de `OperacaoTributariaNormalizada` com `granularidade: "item"`. Não é alteração de código existente — é código novo, isolado. |
| Dashboard/Resultado (`App.tsx` e componentes de resultado) | Mudariam só no momento em que passassem a exibir `proveniencia`/`qualidade` (rótulo "Estimativa VGR" vs. resultado oficial) — não antes, e não nesta etapa. |

## 13. O que permanece exatamente como está

`calculo.ts`, o pipeline SPED (`agregador.ts`, `ecd.ts`, etc.),
`creditoTributario.ts`, `atividades.ts`, `CustosDespesasStep.tsx`, o
Dashboard e o Resultado — nenhum desses arquivos foi ou precisa ser
modificado para este desenho existir em código, e nenhuma simulação
existente muda de resultado. O `OfficialEngineAdapter`, quando implementado,
é aditivo: um novo módulo isolado, não uma alteração dos módulos acima.

---

## 14. Gates antes da implementação real

Nenhum destes está desbloqueado ainda — são condições, não tarefas em
andamento:

1. **Licenciamento.** `codigo-fonte-backend.zip` não declara licença
   (sem `LICENSE`/`NOTICE`, sem `<licenses>` no `pom.xml`). Distribuição/
   embutimento do binário ou imagem dentro de um produto comercial
   **permanece bloqueado até parecer jurídico**. Arquitetura, adapter,
   testes técnicos, ambiente de desenvolvimento e prova de conceito podem
   continuar.
2. **Granularidade.** Enquanto o pipeline de entrada não produzir
   `OperacaoTributariaNormalizada` com `granularidade: "item"` em volume
   relevante (via XML de NF-e ou SPED suficientemente detalhado), o Motor
   Oficial não tem o que calcular na prática — a maioria dos casos reais
   continuará caindo em `elegivel: false` e usando o Motor VGR.
3. **Versionamento.** Antes de qualquer resultado oficial chegar à UI, o
   adapter precisa carimbar `versaoMotor` de forma confiável (seção 7) —
   sem isso, não há rastreabilidade "qual regra calculou este número".
4. **Infraestrutura.** Decisão de onde o componente oficial roda em
   desenvolvimento vs. produção (hoje: Docker local) precisa de um dono e
   um plano de operação (start/stop, atualização de versão, monitoramento)
   antes de qualquer ambiente além do spike depender dele.

---

## Resumo

Direção aprovada: **Arquitetura C**. Motor Oficial para operações elegíveis
(dado suficiente e classificado); Motor VGR permanente para tudo que hoje é a
maioria dos casos — simulação gerencial, projeções, cenários, dados
incompletos. Os dois convergem em `ResultadoCalculoNormalizado`, nunca em uma
interface de entrada única forçada. Nenhuma alteração de código produtivo foi
feita nesta etapa; o que muda a seguir (quando autorizado) são módulos novos
e isolados, não os existentes.

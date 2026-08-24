# Arquitetura de ingestão de dados fiscais reais (frente "clientes")

**Atualização (05/08/2026): parte deste planejamento foi implementada.**
EFD ICMS/IPI, EFD Contribuições e ECD já são importados e processados em
`/importar` — ver [`docs/importacao-sped.md`](importacao-sped.md) para o que
é extraído de cada um e as limitações. XML de notas (NF-e), ECF (extração
detalhada), DEFIS e extrato do DAS **continuam não implementados** — o
restante deste documento é o planejamento original, ainda válido para essa
parte pendente.

---

Este documento é **planejamento**, não implementação, para a parte que ainda
falta — define como os documentos fiscais restantes que a VGR tem disponíveis
por cliente (XML de notas, DEFIS, extrato do DAS, e a extração detalhada da
ECF) vão alimentar o simulador interno (`/`, `src/pages/Interno.tsx`).

## Por que isso é um projeto à parte

O simulador hoje pede dois números resumidos ao contador (carga atual em % do
faturamento, % de custos creditáveis). Extrair esses números diretamente dos
documentos fiscais exige **parsers de formato**, não apenas mais campos de
formulário — cada documento tem uma estrutura própria, definida por leiaute
oficial do SPED ou schema XML da SEFAZ:

| Documento | Formato | Complexidade de parsing |
|---|---|---|
| XML de notas (NF-e) | XML, schema da SEFAZ | Média — schema estável e bem documentado, mas cada nota é um arquivo |
| Extrato do DAS | Geralmente PDF ou HTML gerado pelo PGDAS-D | Média-alta — não há um XML estruturado padrão; pode exigir OCR ou parsing de HTML específico do portal |
| EFD Contribuições | Texto, registros delimitados por `\|`, leiaute SPED próprio | Alta — dezenas de tipos de registro (bloco A, C, D, M, etc.), regras de qual registro carrega qual informação |
| EFD ICMS/IPI | Texto, registros delimitados por `\|`, leiaute SPED próprio (diferente do Contribuições) | Alta — leiaute distinto, blocos B/C/E/G/H |
| ECD (Escrituração Contábil Digital) | Texto, registros SPED contábil (I, J) | Alta — requer entender plano de contas para extrair base de cálculo |
| ECF (Escrituração Contábil Fiscal) | Texto, registros SPED (Bloco J, M, N, P) | Alta — apuração de IRPJ/CSLL, útil para Lucro Real/Presumido |
| DEFIS | Texto/XML da declaração anual do Simples | Média — leiaute mais simples que EFDs, mas específico do Simples |

## Abordagem recomendada: pipeline de ingestão em fases

Cada documento vira um **parser independente** que converte o arquivo bruto
num objeto intermediário comum (`DadosFiscaisExtraidos`), e um agregador
combina esses objetos para alimentar o motor de cálculo já existente
(`src/engine/calculo.ts`) — o motor não muda; só ganha uma fonte de dados
adicional além do formulário manual.

```
arquivo bruto (.xml / .txt / .pdf)
        │
        ▼
 parser específico do formato   →  DadosFiscaisExtraidos (comum)
        │
        ▼
 agregador (consolida múltiplos documentos/períodos)
        │
        ▼
 SimulacaoInput (mesma interface que o formulário manual já produz)
        │
        ▼
 motor de cálculo (calculo.ts) — inalterado
```

### `DadosFiscaisExtraidos` (proposta de contrato comum)

```ts
interface DadosFiscaisExtraidos {
  origem: "xml_nfe" | "efd_contribuicoes" | "efd_icms_ipi" | "ecd" | "ecf" | "defis" | "extrato_das";
  periodoReferencia: { inicio: string; fim: string }; // ISO date
  faturamentoBruto?: number;
  tributosApurados?: { tributo: string; valor: number }[];
  creditosApurados?: { origem: string; valor: number }[];
  cnae?: string;
  regimeDeclarado?: string;
}
```

Cada parser preenche o que consegue extrair do seu formato; o agregador
decide como priorizar/combinar quando há sobreposição (ex.: faturamento pode
vir tanto do XML de notas quanto da EFD — preferir a fonte mais "oficial"
para o período, com o XML servindo de conferência).

## Ordem de implementação sugerida (a decidir com o usuário antes de começar)

1. **XML de notas (NF-e) + Extrato do DAS** — cobre o essencial de
   faturamento e carga do Simples, com o menor esforço de parsing.
2. **EFD Contribuições** — cobre PIS/Cofins não cumulativo (relevante para
   Lucro Real/Presumido) e créditos.
3. **EFD ICMS/IPI** — cobre a base de ICMS ainda vigente até a transição.
4. **ECD/ECF** — mais úteis para Lucro Real (apuração contábil/fiscal
   completa), mas exigem entender o plano de contas de cada cliente —
   provavelmente o parser de maior esforço relativo a valor entregue no
   contexto deste simulador.
5. **DEFIS** — complementar para clientes do Simples, confirma dados que já
   vêm do DAS/EFDs.

## Onde isso mudaria a arquitetura atual

- Parsing de arquivos grandes (EFDs podem ter dezenas de MB) não deve rodar
  no navegador — precisa de uma função de backend (o mesmo ambiente
  serverless já introduzido para `/api/cnpj` e `/api/lead`) ou um job
  assíncrono, dependendo do volume.
- Upload de documento fiscal de cliente é dado sensível — diferente do
  simulador público, aqui persistência (mesmo que temporária, para
  processar o arquivo) precisa de cuidado com onde o arquivo fica armazenado
  e por quanto tempo, e possivelmente controle de acesso (login do
  contador).
- Isso desloca o app interno de "SPA totalmente estática" para "SPA +
  backend com upload de arquivo" — uma mudança de arquitetura real, que vale
  revisitar com o usuário quando essa frente for para implementação.

## O que falta (não implementado)

- **XML de notas (NF-e)**: útil como conferência cruzada do que já vem das
  EFDs, mas cada nota é um arquivo — exigiria upload em lote.
- **Extrato do DAS**: sem XML estruturado padrão (PDF/HTML), maior esforço.
- **ECF (extração detalhada)**: hoje só confirma que o arquivo é uma ECF, sem
  extrair receita bruta/lucro — o leiaute do Bloco M/Y exige validação
  pontual antes de extrair automaticamente (ver `docs/importacao-sped.md`).
- **DEFIS**: complementar para clientes do Simples.

O padrão de parser independente + agregador já implementado em
`src/engine/sped/` (`tipos.ts`, `parser.ts`, extratores por formato,
`agregador.ts`) é o mesmo a seguir para esses formatos restantes.

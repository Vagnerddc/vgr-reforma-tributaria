# Piloto de importação granular de XML fiscal (NF-e)

> Continuação de [fundacao-granular.md](./fundacao-granular.md) e
> [arquitetura-motor-hibrido.md](./arquitetura-motor-hibrido.md).
> **Nenhum código produtivo foi alterado.** `calculo.ts`, o Motor VGR, o
> pipeline SPED, Dashboard, Simulador, Relatórios e `/importar` continuam
> funcionando exatamente como antes. O Motor Oficial não foi chamado em
> nenhum momento. O gate de licenciamento continua aberto.

## A. Arquitetura do parser — onde começa e onde termina

```
XML de NF-e (individual ou dentro de .zip)
        ↓
xml/zip.ts — expande .zip (UTF-8, específico de XML — não reaproveita
              sped/zip.ts, que ignora .xml de propósito)
        ↓
xml/nfe.ts — parseNfeXml: 1 XML → 1 documento → N itens (<det>)
        ↓
OperacaoTributariaNormalizada[] (MESMO modelo da fase anterior — não é um
                                  segundo domínio específico de XML)
        ↓
xml/lote.ts — processarLoteXml: isola erro por documento, deduplica por ID
              estável, agrega o lote (sem calcular nada)
        ↓
medirCobertura — avaliarCompletudeDupla (gerencial + normativa) por
                  operação → relatório agregado
```

Termina aqui. Não há chamada a motor, não há persistência, não há conexão
com Dashboard/Resultado/`/importar`. `parseNfeXml` roda por documento,
isolado — `processarLoteXml` é a única peça que sabe que existem vários
arquivos.

Cobertura: **NF-e (modelo 55) apenas**, como pedido. Outro modelo retorna
`{ ok: false, motivo: "tipo_nao_suportado" }` em vez de ser interpretado
incorretamente — testado explicitamente (NFC-e/modelo 65 no fixture de
teste).

## B. Exemplo normalizado (documento sintético com 2 itens, anonimizado)

```jsonc
// Item 1
{
  "id": "35260112345678000199550010000001231000001234-1",
  "produtoServico": {
    "ncm": { "valor": "84244900", "origem": "xml", "status": "confirmado" },
    "unidade": { "valor": "UN", "origem": "xml", "status": "confirmado" },
    "quantidade": { "valor": 2, "origem": "xml", "status": "confirmado" }
  },
  "classificacaoTributaria": {
    "cst": { "valor": "00", "origem": "xml", "status": "confirmado" },
    "cClassTrib": undefined,   // documento legado, sem grupo IBSCBS — ausência estrutural, não erro
    "cfop": { "valor": "6101", "origem": "xml", "status": "confirmado" }
  },
  "valores": { "valorOperacao": { "valor": 1000, "origem": "xml", "status": "confirmado" } },
  "localidade": {
    "uf": { "valor": "RJ", "origem": "xml", "status": "confirmado" },      // UF do destinatário
    "municipio": {
      "valor": "3550308", "origem": "xml", "status": "confirmado",
      "observacao": "cMunFG — município do fato gerador, direto do XML (mais confiável que aproximação por empresa)."
    }
  },
  "granularidade": "item"
}

// Item 2 — mesmo documento, grupo ICMS diferente (ICMS40, não ICMS00)
{
  "id": "35260112345678000199550010000001231000001234-2",
  "produtoServico": { "ncm": { "valor": "39235000", "origem": "xml", "status": "confirmado" } },
  "classificacaoTributaria": { "cst": { "valor": "40", "origem": "xml", "status": "confirmado" } }
}
```

Ponto técnico relevante: o grupo ICMS da NF-e tem uma chave filha de nome
variável (`ICMS00`, `ICMS10`, `ICMS40`, `ICMSSN102`...) que só é conhecida
ao ler o documento — o parser lê essa chave dinamicamente em vez de
assumir uma delas.

## C. Mapeamento de campos

| Campo XML (NF-e) | Campo `OperacaoTributariaNormalizada` | Observação |
|---|---|---|
| `infNFe/@Id` (sem prefixo `NFe`) ou `protNFe/infProt/chNFe` | usado na geração do `id` estável | chave de acesso — mesma chave em duas importações = mesma operação |
| `ide/nNF` | `identificacao.documentoId` | |
| `det/@nItem` | `identificacao.itemId` | |
| `ide/dhEmi` (ou `dEmi`) | `identificacao.data` | |
| `ide/tpNF` (`0`=entrada,`1`=saída) | `identificacao.tipoOperacao` | mesma convenção do `IND_OPER` do SPED |
| `det/prod/xProd` | `produtoServico.descricao` | |
| `det/prod/NCM` | `produtoServico.ncm` | |
| `det/prod/NBS` | `produtoServico.nbs` | raro em NF-e; comum em NFS-e (fora do escopo desta fase) |
| `det/prod/uCom` | `produtoServico.unidade` | |
| `det/prod/qCom` | `produtoServico.quantidade` | |
| `det/imposto/ICMS/<grupo dinâmico>/CST` ou `CSOSN`, com fallback para `IBSCBS/CST` | `classificacaoTributaria.cst` | ver seção B |
| `det/imposto/IBSCBS/cClassTrib` | `classificacaoTributaria.cClassTrib` | só presente em documentos emitidos no padrão RTC |
| `det/prod/CFOP` | `classificacaoTributaria.cfop` | |
| `det/prod/vProd` | `valores.valorOperacao` | |
| `ICMS/vBC` ou `IBSCBS/gIBSCBS/vBC` | `valores.baseCalculo` | |
| `det/prod/vDesc` | `valores.descontos` | |
| `dest/enderDest/UF` (com fallback para `emit/enderEmit/UF`) | `localidade.uf` | UF do destinatário — CBS/IBS é tributado no destino |
| `ide/cMunFG` | `localidade.municipio` | município do fato gerador — direto do documento, sem aproximação |
| `emit/CNPJ` ou `CPF` | `participantes.fornecedor.identificacao` | |
| `dest/CNPJ` ou `CPF` | `participantes.cliente.identificacao` | |

Nenhum campo novo foi adicionado a `OperacaoTributariaNormalizada` — o
modelo criado na fase anterior comportou o XML sem alteração (confirma a
premissa da seção 3 do pedido: "o domínio VGR não deve ser cópia do
leiaute de uma fonte específica").

## D/E/F. Cobertura, elegibilidade e gaps

**Amostra usada**: o projeto não tem hoje um corpus de XML real de
cliente disponível para teste (mesma limitação já registrada na fase SPED
— seção 29 do pedido antecipa isso). Gerei uma amostra sintética de 500
documentos com 1 item cada, com 1/3 emitidos no padrão RTC (grupo
`IBSCBS`/`cClassTrib` presente) e 2/3 em padrão legado (só `ICMS`), e ~6%
sem NCM — para exercitar o mecanismo de medição com uma distribuição
plausível, não para representar a carteira real de nenhum cliente.
**Quando houver XMLs reais disponíveis, a mesma função (`medirCobertura`)
deve ser rodada sobre eles — o mecanismo está pronto, falta o corpus.**

```
Documentos processados: 500
Operações normalizadas: 500

Com município:    500 — 100,0%
Com UF:            500 — 100,0%
Com NCM:           471 —  94,2%
Com CST:           500 — 100,0%
Com cClassTrib:    166 —  33,2%
Com quantidade:    500 — 100,0%
Com unidade:       500 — 100,0%
Com valor:         500 — 100,0%

Operações plenamente elegíveis (normativa): 157 — 31,4%
Operações completas para uso gerencial:     500 — 100,0%

Motivos de inelegibilidade (uma operação pode ter mais de um):
  cClassTrib ausente   66,8%
  NCM ausente           5,8%
  demais campos         0,0%
```

Leitura: diferente do SPED (0% elegível, gap estrutural absoluto), XML
**pode** carregar `cClassTrib` — a elegibilidade normativa passa a ser uma
função de **quantos documentos do cliente já são emitidos no padrão RTC**,
não mais uma impossibilidade estrutural do formato. Município deixa de
ser aproximação (era `status: "estimado"` no SPED) e passa a
`"confirmado"` via `cMunFG`, direto do documento — ganho qualitativo, não
só de completude.

## G. Duplicidade

Deduplicação por `id` estável (chave de acesso + número do item) dentro de
`processarLoteXml` — testado explicitamente: o mesmo XML importado sob
dois nomes de arquivo diferentes ("cópia") produz **uma única** operação
no resultado, com o segundo contabilizado em `duplicadosIgnorados`, nunca
descartado silenciosamente (o relatório mostra o número).

## H. Robustez a erro

Cada documento é interpretado isoladamente (`try/catch` por arquivo em
`processarLoteXml`). Testado: um XML sintaticamente inválido no meio de um
lote de 3 não impede os outros 2 de serem processados — o erro aparece em
`documentosComErro`, com `nomeArquivo` + `motivo` (`erro_parse` |
`tipo_nao_suportado`) + `detalhe`, nunca o XML inteiro despejado em log
(seção 25 do pedido).

## I. Performance (medida, não estimada)

```
   10 XMLs:   7.0ms total  (0.70ms/documento)
  100 XMLs:  16.1ms total  (0.16ms/documento)
1.000 XMLs: 119.2ms total  (0.12ms/documento)
```

Sem gargalo evidente até 1.000 documentos (3.000 itens) — tempo por
documento **cai** com escala (custo fixo de inicialização do parser
amortizado), não sobe. Não há necessidade de fila/worker nesta escala;
reavaliar se o volume real de produção ultrapassar ordens de magnitude
maiores.

## J. Conciliação potencial XML × SPED

Não implementada nesta fase (como pedido) — mas a chave que permitiria
fazer isso no futuro já existe nos dois pipelines:

- **XML**: chave de acesso de 44 dígitos (`infNFe/@Id` sem o prefixo `NFe`,
  ou `protNFe/infProt/chNFe`) + número do item (`det/@nItem`).
- **SPED (EFD ICMS/IPI e EFD Contribuições)**: `C100/CHV_NFE` (mesma chave
  de 44 dígitos!) + `C170/NUM_ITEM`.

`gerarIdEstavelOperacao` já usa exatamente essa combinação nos dois
pipelines (`granular.ts` e `nfe.ts`) — **a mesma operação, vinda de XML ou
de EFD, hoje já gera o mesmo `id`** quando a chave de acesso está presente
nos dois. Isso não foi testado com um par XML+SPED real nesta fase (não
há corpus pareado disponível), mas é uma consequência direta de reusar a
mesma função de identidade — não exigiu nenhum código de conciliação
dedicado. O que falta para conciliação robusta de fato (fora do escopo
desta fase): resolver conflito quando os dois discordam em um campo (ver
seção 22 do pedido — registrado como gap conceitual, não implementado) e
decidir qual fonte "ganha" quando ambas têm o mesmo campo com valores
diferentes.

## K. Testes

- `src/engine/xml/__tests__/nfe.test.ts` (8 testes): múltiplos itens,
  grupo ICMS dinâmico, município via `cMunFG`, proveniência `origem:
  "xml"`, ausência de `cClassTrib` em documento legado vs. presença em
  documento RTC, ID estável via chave de acesso, XML inválido isolado,
  modelo não suportado.
- `src/engine/xml/__tests__/lote.test.ts` (4 testes): erro isolado no
  lote, deduplicação, medição de cobertura, lote vazio sem divisão por
  zero.
- Suite completa: **221 testes passando** (209 antes desta fase + 12
  novos), `tsc -b` limpo, `oxlint` sem novos warnings nos arquivos
  criados.
- Regressão: nenhum teste existente foi alterado; todos os 209 testes
  anteriores continuam passando sem modificação.

Dependência nova: `fast-xml-parser` (~pequena, popular, sem dependências
próprias) — necessária porque o ambiente de teste (Vitest, Node) não tem
`DOMParser` disponível, e o projeto não tinha nenhum parser de XML antes
desta fase.

## L. Recomendação

O gap não é mais "não temos o campo" (como no SPED) — é **"quantos
documentos do cliente já saem no padrão RTC"**. Isso muda a natureza do
problema:

1. **A prioridade imediata não é mais importação de XML** — o piloto
   confirma que o mecanismo funciona e que XML resolve o que SPED
   estruturalmente não resolvia (município confiável, potencial de
   `cClassTrib`, NCM na grande maioria dos casos).
2. **A pergunta que decide o próximo passo é empírica e ainda não
   respondida**: qual fração dos XMLs reais dos clientes VGR já é emitida
   no padrão RTC hoje (2026)? Isso não pode ser medido sem um corpus real
   — é o próximo dado a buscar, não mais código a escrever.
3. Enquanto isso não for medido com dados reais, a recomendação técnica
   objetiva é: **integrar `/importar` a aceitar XML/.zip como fonte
   adicional (ainda sem UI definitiva, como pedido) e rodar
   `medirCobertura` sobre a base real de XMLs dos primeiros clientes
   piloto** — isso substitui a suposição por medição, exatamente como
   esta fase fez com SPED.
4. Um motor de classificação VGR para preencher `cClassTrib` em documentos
   legados continua sendo a segunda frente mais provável, mas só depois
   da medição do item 2 — se a maioria dos clientes já emite no padrão
   RTC, o classificador é baixa prioridade; se a maioria ainda não emite,
   ele se torna crítico.

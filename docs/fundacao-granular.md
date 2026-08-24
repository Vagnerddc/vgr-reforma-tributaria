# Fundação granular da arquitetura híbrida — entrega

> Continuação de [arquitetura-motor-hibrido.md](./arquitetura-motor-hibrido.md).
> Esta fase implementa o modelo normalizado VGR e um pipeline granular
> paralelo ao pipeline de agregação SPED existente. **Nenhum código
> produtivo foi alterado** — `calculo.ts`, `agregador.ts`, `efdIcmsIpi.ts`,
> `efdContribuicoes.ts`, Dashboard, Resultado e Simulador continuam
> funcionando exatamente como antes (ver seção I). O Motor Oficial **não**
> foi conectado a nada nesta fase — o gate jurídico de licenciamento
> continua aberto.

## A. Modelo implementado

`src/engine/operacaoTributaria.ts` — `OperacaoTributariaNormalizada`,
`CampoComProveniencia<T>`, `avaliarCompletudeOperacao`,
`gerarIdEstavelOperacao`. Nenhum campo é obrigatório; uma operação
incompleta é um valor válido do tipo.

## B. Proveniência

`OrigemInformacao` = `"xml" | "sped" | "informado_usuario" |
"classificacao_vgr"`. Separada de `StatusInformacao` = `"confirmado" |
"estimado" | "herdado" | "importado"`. Todo campo relevante de
`OperacaoTributariaNormalizada` é `CampoComProveniencia<T>` — nunca um valor
puro sem essas duas dimensões.

## C. Resultado comum

`ResultadoCalculoNormalizado` implementado no mesmo módulo — contrato,
ainda sem produtor real (nenhum motor foi conectado a ele nesta fase,
conforme pedido). `OrigemCalculo` restrito a `"motor_oficial" |
"motor_vgr"`, como aprovado.

## D. Pipeline granular — onde começa e onde termina

```
Arquivo EFD (mesmo bytes que já chegam hoje)
        ↓
tokenizarSped (reaproveitado, sem alteração)
        ↓
extrairOperacoesGranularesEfdIcmsIpi / ...EfdContribuicoes  (NOVO — src/engine/sped/granular.ts)
        ↓
OperacaoTributariaNormalizada[] (uma por item C170)
```

Termina aqui nesta fase — não há agregação, não há chamada a motor, não há
persistência. `granular.ts` lê os mesmos registros tokenizados que
`efdIcmsIpi.ts`/`efdContribuicoes.ts` já leem, de forma **independente**:
nenhuma das duas funções chama a outra, nenhuma delas foi modificada. Os
dois pipelines coexistem lendo a mesma entrada.

## E. Matriz de cobertura real

Baseada na leitura direta dos parsers e leiautes (não hipótese sobre os
formatos):

| Informação | XML de NF-e (não implementado ainda) | EFD ICMS/IPI (C170) | EFD Contribuições (A100/C170) | ECD | ECF |
|---|---:|---:|---:|---:|---:|
| Documento | previsto | ✓ (C100) | ✓ (C100, só quando há C170) | — | — |
| Item | previsto | ✓ (C170) | ✓ (C170, quando presente) | — | — |
| Descrição | previsto | ✓ | — | — | — |
| NCM | previsto | ✓, **só se o item tiver registro 0200** | ✓, mesma condição | — | — |
| CST (legado ICMS) | previsto | ✓ (CST_ICMS, campo 8 do C170) | ✓ | — | — |
| cClassTrib | previsto (RTC) | **✗ — não existe no leiaute** | **✗ — não existe no leiaute** | — | — |
| NBS | previsto (RTC, serviços) | **✗ — não existe no leiaute** | **✗ — não existe no leiaute** | — | — |
| Quantidade/Unidade | previsto | ✓ | ✓ (quando C170 presente) | — | — |
| UF | previsto | ✓ (registro 0000, nível empresa) | ✓ (idem) | — | — |
| Município | previsto | **parcial** — só o da empresa (0000), não da operação | ✗ — 0000 da EFD Contribuições não carrega COD_MUN neste registro | — | — |
| Valor | previsto | ✓ | ✓ | agregado por conta | agregado por conta |

ECD e ECF: confirmado por leitura de `ecd.ts` — a fonte primária é o saldo
por conta contábil (`I050`/`I155`), estruturalmente sem granularidade de
item/operação. Isso não é uma limitação do parser atual; é uma
característica do próprio formato (escrituração contábil, não fiscal
documento-a-documento) — não há "pipeline granular" possível para ECD/ECF
sem cruzar com outra fonte.

**cClassTrib e NBS: ausência estrutural, não uma lacuna de implementação.**
Nenhum leiaute SPED legado (EFD ICMS/IPI, EFD Contribuições) carrega esses
dois campos — são específicos do novo sistema (RTC). Isso só pode ser
resolvido por: (a) importação de XML de NF-e/NFS-e do novo padrão, quando
emitido com os grupos RTC; ou (b) classificação/enriquecimento VGR
(`classificacao_vgr`, ainda não implementado — fase futura explicitamente
adiada pelo pedido, seção 19).

## F. Análise de completude

Os 8 campos mínimos do contrato real do Motor Oficial (confirmados no spike
— `municipio`, `uf`, `ncm`, `cst`, `cClassTrib`, `quantidade`, `unidade`,
`valorOperacao`) são avaliados por `avaliarCompletudeOperacao`. Na prática,
partindo de EFD (a fonte disponível hoje): **`cClassTrib` falta sempre**
(gap estrutural, seção E); `ncm` falta quando o item não tem registro 0200
cadastrado (comum — cadastro de item é opcional/incompleto na prática);
`municipio` só existe como aproximação em nível de empresa, marcado
`status: "estimado"` com observação explícita — nunca como dado confirmado
da operação.

## G. Exemplo real normalizado (dados de teste do próprio projeto, anonimizados)

A partir do fixture EFD ICMS/IPI já usado em `sped.test.ts`:

```jsonc
{
  "id": "CHAVE_XXX-1",
  "identificacao": {
    "documentoId": { "valor": "123", "origem": "sped", "status": "confirmado" },
    "tipoOperacao": { "valor": "saida", "origem": "sped", "status": "confirmado" }
  },
  "produtoServico": {
    "descricao": { "valor": "DESCRICAO PRODUTO", "origem": "sped", "status": "confirmado" },
    "ncm": undefined,               // sem registro 0200 no arquivo — não inventado
    "unidade": { "valor": "UN", "origem": "sped", "status": "confirmado" },
    "quantidade": { "valor": 1, "origem": "sped", "status": "confirmado" }
  },
  "classificacaoTributaria": {
    "cst": { "valor": "000", "origem": "sped", "status": "confirmado" },  // CST_ICMS legado, não cClassTrib
    "cClassTrib": undefined,        // não existe no leiaute — ausente, não estimado
    "cfop": { "valor": "5101", "origem": "sped", "status": "confirmado" }
  },
  "valores": { "valorOperacao": { "valor": 10000, "origem": "sped", "status": "confirmado" } },
  "localidade": {
    "uf": { "valor": "SP", "origem": "sped", "status": "confirmado" },
    "municipio": {
      "valor": "1234", "origem": "sped", "status": "estimado",
      "observacao": "Município da empresa (registro 0000) — o SPED não carrega município por operação; usado como aproximação até confirmação."
    }
  },
  "granularidade": "item"
}
```

## H. Métrica de elegibilidade

Medida diretamente (`avaliarCompletudeOperacao` sobre a saída real de
`extrairOperacoesGranularesEfdIcmsIpi`), não estimada:

```
2 operações encontradas (fixture EFD ICMS/IPI de teste do projeto)

2 com valorOperacao
0 com NCM        (sem registro 0200 no arquivo)
2 com CST         (CST_ICMS legado — não equivalente a cClassTrib)
0 com cClassTrib  (não existe no leiaute EFD)
2 com quantidade
2 com unidade
2 com UF
2 com município   (aproximado por empresa, status "estimado" — não confirmado por operação)

0 plenamente elegíveis ao Motor Oficial
```

**Ressalva de honestidade estatística**: a amostra é o único fixture de
teste do projeto (2 operações) — o repositório não tem hoje um corpus real
de SPED de cliente para medir em escala. O resultado (0% elegível) é
consistente com o gap estrutural mapeado na seção E (cClassTrib
inexistente no leiaute), então não é surpreendente nem depende do tamanho
da amostra — mas não deve ser lido como "medimos X% da carteira real de
clientes". Quando houver arquivos SPED reais de cliente disponíveis para
teste (anonimizados), a mesma função pode ser rodada sobre eles para uma
medição em escala — o mecanismo já está pronto, falta o corpus.

## I. Testes — novos e de regressão

- `src/engine/__tests__/operacaoTributaria.test.ts` (6 testes): completude,
  qualidade separada de completude, não invenção de dado ausente,
  identidade estável.
- `src/engine/sped/__tests__/granular.test.ts` (9 testes): preservação de
  campos granulares (valor/CFOP/CST/quantidade/unidade/documento),
  identidade via chave de NF-e, não invenção de `cClassTrib`/NBS/NCM,
  proveniência honesta de município, **regressão bit-a-bit do pipeline de
  agregação existente** (`processarEfdIcmsIpi`/`processarEfdContribuicoes`
  chamados antes e depois do pipeline granular rodar, resultado comparado
  com `toEqual`), e a métrica de elegibilidade (0/2, coerente com E/H).
- Suite completa: **209 testes passando** (194 antes desta fase + 15
  novos), `tsc -b` limpo, `oxlint` sem novos warnings.

## J. Próxima recomendação

O maior gap identificado é **duplo e sequencial**, não único:

1. **`cClassTrib` é o bloqueio estrutural mais imediato** — nenhuma fonte
   hoje disponível (EFD legado) o carrega; é zero, não "baixo". Sem ele,
   nenhuma operação chega a "completa" independentemente de qualquer outro
   enriquecimento.
2. **Mas resolver só `cClassTrib` não basta**: `ncm` já falha em items sem
   registro 0200 cadastrado, e `município` nunca é confiável por operação
   via EFD (é sempre aproximação por empresa).

Isso aponta para duas frentes, não uma:
- **Importação de XML de NF-e/NFS-e** resolveria `ncm`, `cClassTrib` (quando
  emitido no padrão RTC), `município` e `quantidade`/`unidade` de uma vez —
  é a fonte estruturalmente mais completa, coerente com o que o spike já
  sinalizava.
- Enquanto XML não estiver implementado, um **motor de classificação VGR**
  (preencher `cClassTrib`/`ncm` via heurística, sempre com
  `origem: "classificacao_vgr"` e `status: "estimado"`, nunca
  `"confirmado"`) reduziria o gap parcialmente, mas nunca eliminaria a
  necessidade de XML para uso normativo real — classificação estimada não
  qualifica como dado "confirmado" para envio ao Motor Oficial.

Recomendação objetiva: **priorizar um piloto de importação de XML de NF-e**
sobre um motor de classificação — é o que resolve o maior número de campos
faltantes de uma vez, e é exatamente o gap que o spike já apontava
(`docs/arquitetura-motor-hibrido.md`, seção 3 revisão). Um motor de
classificação VGR continua sendo útil depois, para os casos onde XML não
está disponível — mas como segunda fase, não substituto.

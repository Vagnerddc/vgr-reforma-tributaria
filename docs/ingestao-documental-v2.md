# Ingestão Documental V2 — integração com o Wizard Estratégico V2

## A. Objetivo

Evoluir o Wizard Estratégico V2 de ponto principal de digitação manual para
um fluxo de **revisão e complementação**: importar tudo que for histórico,
cadastral ou fiscal verificável a partir de documentos, e perguntar ao
usuário apenas o que não pode ser obtido com segurança ou é premissa
empresarial.

```
CNPJ + Contrato Social + PGDAS-D/DEFIS + XML/NFS-e + EFD ICMS/IPI +
EFD-Contribuições + ECD + ECF + Folha/eSocial
        ↓
   Extração (adapters/)
        ↓
   Normalização (normalizador.ts)
        ↓
   RascunhoCenarioEmpresa (agregador.ts)
        ↓
   Wizard V2 revisa e complementa
        ↓
   CenarioEmpresa (validacao.ts, inalterado)
        ↓
   Pipeline Estratégico (inalterado)
```

Esta fase é de **ingestão, normalização e proveniência** — nenhuma fórmula,
Score, Pareto, Decisão ou `calculo.ts` foi alterado.

## B. Arquitetura

Nova pasta `src/application/ingestaoDocumental/`:

```
tipos.ts              contrato comum: TipoDocumento, CampoExtraido<T>, ResultadoIngestaoDocumento, ConflitoFonte
proveniencia.ts        tradução ingestão → domínio (paraCampoComProveniencia), gerarIdConflito, PREFERENCIA_POR_CAMPO
normalizador.ts         agrupa CampoExtraido por chave lógica do rascunho
roteadorDocumental.ts   recomenda documentos por regime (nunca bloqueia)
agregador.ts            reconcilia e preenche RascunhoCenarioEmpresa (nunca DadosApuradosCliente)
adapters/               um arquivo por tipo de documento
__tests__/
```

`CampoExtraido<T>` é `{ valor, status, documentoId, tipoDocumento, periodo?,
evidencia?, observacao? }` — reaproveita `StatusInformacao` do domínio
(`engine/operacaoTributaria.ts`) como única escala de qualidade, sem criar
uma escala paralela.

**Decisão de arquitetura importante**: `engine/operacaoTributaria.ts` (e seu
`OrigemInformacao`) **não foram alterados**. A ingestão usa sua própria
taxonomia granular (`TipoDocumento`) e só traduz para um dos 4 valores de
`OrigemInformacao` já existentes na borda (`proveniencia.ts`), quando um
`CampoExtraido` precisa virar um `CampoComProveniencia` do domínio — ver
seção N.

## C. Fontes por regime

`roteadorDocumental.ts` — `recomendarDocumentosPorRegime(regime, contexto)`
devolve um checklist com `obrigatoriedade: "recomendado" | "opcional" |
"nao_aplicavel"`. **Nunca bloqueia** — a análise segue funcional mesmo sem
os documentos recomendados.

| Documento | Simples | Presumido | Real |
|---|---|---|---|
| CNPJ | recomendado | recomendado | recomendado |
| Contrato Social | opcional | opcional | opcional |
| PGDAS-D | recomendado | não aplicável | não aplicável |
| DEFIS | opcional | não aplicável | não aplicável |
| XML/NFS-e | opcional | recomendado | recomendado |
| EFD ICMS/IPI | opcional (se aplicável) | recomendado (se aplicável) | recomendado (se aplicável) |
| EFD-Contribuições | não aplicável | recomendado | recomendado |
| ECD | não aplicável | opcional | recomendado |
| ECF | não aplicável | recomendado | recomendado |
| Folha/FS12 | opcional (recomendado se Fator R relevante) | opcional | recomendado |

## D. CNPJ

`adapters/cnpj.ts` — `ingerirCnpj(cnpj, documentoId)` reaproveita
`lib/cnpj.ts` (que já chama `/api/cnpj`, proxy da BrasilAPI). Nenhuma
consulta externa nova. Preenche razão social, nome fantasia, CNAE, UF,
município, porte, situação cadastral e opção pelo Simples. **Nunca**
determina regime, crédito, benefício ou alíquota sozinho — sempre carrega o
alerta `cnae_nao_determina_regime`.

## E. Contrato Social

`adapters/contratoSocial.ts` — opera sobre **texto já extraído** (colado ou
pré-processado; não há parser de PDF nesta fase). Extrai objeto social,
capital social e administração por rótulo (mesmo estilo de
`engine/dre/parseTextoDre.ts`). Quadro societário (sócios/percentuais) não é
extraído. Ver seção Q (Privacidade).

## F. PGDAS-D

`adapters/pgdas.ts` — **prioridade alta**, fonte nativa do Simples Nacional.
Opera sobre texto já extraído do PDF gerado pelo portal do Simples. Extrai
período, receita do período, RBT12, anexo, alíquota efetiva, DAS apurado e
tributos componentes (IRPJ/CSLL/PIS/COFINS/CPP/ICMS/ISS), quando presentes
no texto. Nunca fabrica um valor quando o rótulo não é encontrado —
ausência de campo é reportada como alerta, nunca como zero. Nomeado
corretamente como "PGDAS-D" em todo o contrato — nunca genericamente como
"Extrato do DAS" (documento diferente, sem formato estruturado, não
implementado). `extrairTextoPgdasPdf(bytes)` está declarada mas **não
implementada** nesta fase (extração de bytes de PDF real).

## G. DEFIS

`adapters/defis.ts` — complementar ao PGDAS-D, nunca o substitui (PGDAS-D é
mensal, DEFIS é anual). Mesmo padrão de parser por rótulo.

## H. XML/NFS-e

`adapters/xml.ts` — wrapper fino de `engine/xml/lote.ts`
(`processarLoteXml`), que já deduplica por id estável e já não aborta o
lote em erro de item. Não reimplementa parser nem deduplicação.
`adapters/nfse.ts` — contrato preparado com a mesma assinatura, mas sem
implementação real: não existe layout nacional único de NFS-e (cada
município adota seu próprio padrão), então nenhum parser foi inventado sem
referência real.

## I. EFD ICMS/IPI, EFD-Contribuições, ECD

`adapters/efdIcmsIpi.ts`, `adapters/efdContribuicoes.ts`, `adapters/ecd.ts`
— wrappers finos que chamam os parsers já existentes em `engine/sped/` e
reempacotam o `ArquivoSpedProcessado` resultante via `adapters/spedComum.ts`
em `ResultadoIngestaoDocumento`. Nenhum recalcula nada; o
`ArquivoSpedProcessado` completo fica disponível em
`metadados.arquivoSpedProcessado` para o agregador reconciliar por
movimento quando necessário.

## J. ECF — extração mínima

`engine/sped/ecf.ts` foi estendido (é parser de ingestão, não motor fiscal
— nunca importado por `calculo.ts`/Score/Pareto/Decisão) para detectar a
**presença** dos registros do Bloco M/Y (`M300`, `M350`, `N500`, `N600`,
`N620`, `N630`, `Y540`) sem extrair nenhum valor deles. Isso é reportado em
`ArquivoSpedProcessado.resumoEcf.blocosDetectadosNaoExtraidos`. **Nenhum
valor de receita bruta, resultado, IRPJ/CSLL, adições/exclusões ou
prejuízo fiscal é fabricado nesta fase** — sem uma fixture real de ECF
disponível para validar as posições de campo com confiança, esses campos
continuam ausentes ("indeterminado"). `adapters/ecf.ts` já mapeia esses
campos para `CampoExtraido` para o dia em que `resumoEcf` os popular, sem
precisar mudar o contrato.

## K. Folha/eSocial → FS12

`adapters/folha.ts` — entrada é um **resumo estruturado** informado pelo
usuário/contador (formulário simples na UI), não um parser de eSocial (fora
de escopo). Nunca converte terceiros/autônomos automaticamente em FS12,
nunca sugere ou calcula pró-labore — só o que vier explícito no resumo.

## L. Testes

87 arquivos/842 testes na suíte completa após esta fase (baseline era
87/795 — as 47 diferenças de contagem vêm apenas dos novos arquivos desta
fase, sem alterar nenhum teste existente). Cobertura por adapter, roteador,
proveniência e agregador em `src/application/ingestaoDocumental/__tests__/`;
integração com o reducer do Wizard V2 em
`src/features/wizardEstrategico/__tests__/ingestaoNoWizard.test.ts`; trava
de ausência do fluxo legado em
`ingestaoDocumental/__tests__/semAdapterLegado.test.ts` (espelha
`wizardEstrategico/__tests__/semAdapterLegado.test.ts`).

## M. Normalização para o Wizard V2

`normalizador.ts` agrupa `CampoExtraido` por chave lógica do rascunho (ex.:
`"identificacao.nomeEmpresa"`, `"tributario.premissas.rbt12"`) via uma
tabela explícita `MAPA_CAMPO_LOGICO`. Campos sem entrada na tabela caem em
`tributario.premissas.<tipoDocumento>.<observacao>` — nunca descartados
silenciosamente. `agregador.ts` (`agregarDocumentosParaRascunho`) aplica os
valores ao `RascunhoCenarioEmpresa`, **nunca passando por
`DadosApuradosCliente` (`sped/agregador.ts`) ou pelo adapter legado**.

### Reconciliação e conflitos

Quando mais de uma fonte diverge para o mesmo campo/período,
`agregador.ts` cria um `ConflitoFonte` em vez de escolher silenciosamente:

- Sem preferência configurada: `status: "pendente"`, valor de melhor
  `StatusInformacao` aplicado provisoriamente, sinalizado como ressalva.
- Com preferência configurada (`PREFERENCIA_POR_CAMPO`, ex.: RBT12→PGDAS-D,
  resultado contábil→ECD): `status: "resolvido_regra"`, aplicado
  automaticamente.
- Valor já confirmado manualmente (`origem: "informado_usuario"`,
  `status: "confirmado"`) e um documento diverge: **nunca sobrescreve** —
  conflito `"pendente"` com `resolucao.valorEscolhido: "informado_usuario"`.
- Conflito já `"resolvido_usuario"` e uma fonte nova diverge da resolução:
  vira `"desatualizado"`, preservando a resolução anterior em `historico` —
  nunca perde uma decisão humana.
- Documentos com períodos diferentes para o mesmo campo: processados
  **separadamente** (nunca fundidos), com `AlertaIngestao` de período
  divergente.

**Conflitos são PERSISTIDOS** dentro de `RascunhoCenarioEmpresa.ingestao`
(decisão explícita do usuário desta fase — sobrevivem a reload de aba, sem
exigir reprocessamento dos documentos). Cada `ConflitoFonte` tem um `id`
determinístico (hash puro de campo+período+fontes, sem `Date.now()`/
`Math.random()`), permitindo reavaliação incremental: só os campos afetados
pelos documentos de uma nova rodada são recalculados; conflitos de campos
não tocados são preservados inalterados. **Nunca é persistido o conteúdo
bruto de nenhum documento** — só metadados leves
(`MetadadoDocumentoProcessado`) e os `CampoExtraido` já processados dentro
dos próprios conflitos.

O Wizard V2 ganhou:
- Nova etapa `"documentos"` (sempre pulável, primeira etapa) —
  `EtapaDocumentos.tsx`: upload/entrada de texto, checklist do roteador,
  status por documento (✓/⚠/○, sem logs técnicos).
- Novas ações no reducer (`estado.ts`): `aplicarResultadoIngestao` (aplica
  o resultado do agregador preservando `id`/`etapasVisitadas` da sessão) e
  `resolverConflitoIngestao` (usuário escolhe uma fonte ou digita o valor
  correto — sempre rastreável).
- `EtapaRevisao.tsx` lista os conflitos pendentes/desatualizados via
  `PainelConflito.tsx` antes de permitir simular.
- Retrocompatibilidade: rascunhos salvos antes desta fase (sem o campo
  `ingestao`) são migrados implicitamente para `estadoIngestaoVazio()` —
  nunca tratados como erro estrutural.

## N. Proveniência

`OrigemInformacao`/`StatusInformacao`/`CampoComProveniencia<T>`
(`engine/operacaoTributaria.ts`) **não foram alterados**. A ingestão usa sua
própria taxonomia granular (`TipoDocumento`, 11 valores) e traduz para um
dos 4 valores existentes só na borda (`proveniencia.ts`,
`paraCampoComProveniencia`):

| TipoDocumento | OrigemInformacao |
|---|---|
| `xml_nfe`, `nfse` | `xml` |
| `efd_icms_ipi`, `efd_contribuicoes`, `ecd`, `ecf`, `pgdas`, `defis` | `sped` (declarações/escriturações fiscais oficiais) |
| `cnpj`, `contrato_social`, `folha_fs12` | `classificacao_vgr` (obtido por processo automatizado da VGR — API/extração de documento) |

`informado_usuario` nunca é usado por esta camada — reservado à digitação
manual real. A origem granular nunca se perde: fica em `CampoExtraido`
(dentro da ingestão) e é citada na `observacao` do `CampoComProveniencia`
resultante (ex.: `"origem: pgdas:2026-01"`).

## O. Conflitos entre fontes

Ver seção M — modelo completo em `tipos.ts` (`ConflitoFonte`,
`StatusConflito`) e lógica em `agregador.ts`. Não existe hierarquia rígida
universal de fontes (ex.: "ECD > XML > PGDAS" para tudo seria errado) — só
preferências explícitas por campo em `PREFERENCIA_POR_CAMPO`
(`proveniencia.ts`).

## P. Normalização para Wizard V2

Ver seção M.

## Q. Taxonomia setorial

Duas taxonomias coexistem no projeto, sem migração nesta fase:
- **Legada** (`engine/atividades.ts`, `PerfilAtividade`, 4 perfis) — usada
  pelo fluxo `/importar` (`ImportarSped.tsx`) e pelo simulador público
  (`Publico.tsx`).
- **Moderna** (`engine/setores/catalogo.ts` + `config/setores/taxonomia.json`)
  — usada pelo Wizard Estratégico V2 e pelos motores de regime.

A camada de ingestão documental desta fase **não introduz uma terceira
taxonomia** — o adapter de CNPJ só devolve o CNAE cru; é a etapa
"Atividades" do Wizard V2 (já existente) que usa `setores/catalogo.ts`
para sugerir o perfil setorial moderno a partir dele. `atividades.ts` não
foi tocado — o legado continua funcionando.

## R. Privacidade

`adapters/contratoSocial.ts` nunca propaga CPF, RG, endereço pessoal ou
estado civil de sócios para o resultado — qualquer trecho extraído passa
por `removerDadosPessoais` (substituição por `"[dado removido]"`) antes de
virar `CampoExtraido`. Testado explicitamente em `contratoSocial.test.ts`.
Quadro societário (nomes/percentuais dos sócios) não é extraído nesta fase.

## S. Testes

Ver seção L.

## T. Limitações conhecidas

- **NFS-e**: sem parser real — não há layout nacional único (cada
  município adota seu próprio padrão). `adapters/nfse.ts` sempre devolve
  `status: "falhou"` com a limitação documentada.
- **ECF**: extração mínima — só detecta presença de registros do Bloco
  M/Y, não extrai valores (receita bruta, resultado, IRPJ/CSLL, prejuízo
  fiscal continuam indeterminados). Requer fixture real validada para
  avançar.
- **Contrato Social, PGDAS-D, DEFIS**: operam sobre texto já extraído —
  não há parser de bytes de PDF nesta fase (`extrairTextoPgdasPdf` está
  declarada, não implementada).
- **Folha/eSocial**: entrada é um resumo estruturado manual, não um
  importador de arquivo de eSocial.
- **Conflitos multi-fonte**: a resolução automática por preferência
  (`PREFERENCIA_POR_CAMPO`) cobre um conjunto inicial de campos
  (RBT12/alíquota/DAS/anexo do Simples via PGDAS-D, receita anual via
  ECD, receita bruta via ECF) — campos fora dessa tabela sempre exigem
  confirmação humana quando há divergência.
- **Bundle de produção**: `pdfjs-dist` continua entrando no bundle
  principal via a mesma cadeia já existente (`App.tsx` →
  `ImportarSped.tsx` → `extrairDrePdf.ts`) — esta fase não usa `pdfjs-dist`
  em nenhum adapter novo, então não piora o problema, mas também não o
  resolve (fora de escopo).

# Piloto Controlado com Empresas Reais e Critérios de Aceitação

> Continuação de [validacao-v2-legado.md](./validacao-v2-legado.md).
> 795 testes passando (781 + 14 novos), `tsc -b` e `vite build`
> limpos. **Esta fase entrega apenas a Parte A (infraestrutura).**
> **Nenhum caso real foi executado** — não há dados reais de empresas
> disponíveis neste ambiente. Ver seção R.

## A. Objetivo

Preparar a infraestrutura que permitirá, quando houver dados reais
disponíveis, responder com evidência operacional: o V2 funciona de
forma confiável, compreensível e tecnicamente defensável em casos
reais? Esta fase **não migra nada** — produz apenas a ferramenta de
avaliação.

## B. Escopo

`src/application/pilotoControlado/`:
```
tipos.ts              CasoPiloto, AvaliacaoCasoPiloto, RelatorioPilotoControlado, severidade
criteriosAceitacao.ts  avaliarCriteriosTecnicos, avaliarCriteriosExperiencia, problemaBloqueiaProntidao
comparacaoCaso.ts      reexporta comparacaoV2Legado — nenhuma segunda metodologia
avaliacaoCaso.ts       construirAvaliacaoCaso
consolidacao.ts        consolidarPiloto, calcularStatusProntidaoPiloto
__tests__/
```

Nenhum motor fiscal novo. Nenhum importador novo. Nenhum backend.

## C. Seleção dos casos

6 perfis mínimos sugeridos (seção 6 do pedido): Serviços/Saúde (Fator
R), Comércio (créditos), Lucro Real (ajustes/prejuízos), Split/Caixa,
Multiatividade (obrigatório), Agro/Aviação (se houver dado real).
Preferência por 5-10 casos bem documentados, não volume. Cada caso
precisa de objetivo explícito (`CasoPiloto.objetivo`) e das áreas que
pretende validar (`areasValidadas: AreaValidacaoPiloto[]`) — nunca
inferidas do nome do segmento.

## D. Contratos

`CasoPiloto` — id anonimizado (`CASO-SAUDE-01`), segmento, período,
objetivo, áreas validadas, origem dos dados, **apenas as fontes
utilizadas** (nunca o documento bruto), status de execução V2/legado,
qualidade da entrada por área, tempo de preenchimento opcional,
feedback de UX estruturado (dificuldades/campos confusos/dados
difíceis/ajudas insuficientes), validação de reload/contextHash,
observações e pendências.

`AvaliacaoCasoPiloto` — validação técnica, de entrada, comparativa
(reaproveitando `ClassificacaoDivergencia`), de apresentação, de
auditabilidade; divergências, problemas, ressalvas, ganhos V2; e
`statusFinal: aprovado | aprovado_com_ressalvas | requer_ajuste | bloqueado`
— avaliação **operacional**, distinta da classificação técnica de
divergência.

`RelatorioPilotoControlado` — contagens (nunca percentual arbitrário),
divergências materiais agregadas, ganhos de cobertura, problemas e
limitações recorrentes (aparecem em mais de um caso), áreas validadas
vs. faltantes, e `statusProntidao`.

## E. Critérios técnicos

`avaliarCriteriosTecnicos(caso, problemas, classificacaoComparativa)` —
falha se: o pipeline V2 não executou; existe problema de severidade
crítica; existe divergência material não explicada por cobertura.

## F. Critérios de UX

`avaliarCriteriosExperiencia` — 7 critérios booleanos (conseguiu
preencher, entendeu warnings, identificou campos obrigatórios, chegou
à análise, conseguiu explicar o resultado, usou o Modo Apresentação,
abriu a Memória Técnica quando questionado). **Nunca** influencia
`validacaoTecnica` — são avaliados de forma independente (seção 22).

## G. Severidade

`SeveridadeProblema = critica | alta | media | baixa | informativa`,
separada de `CategoriaProblema = tecnica | fiscal | dados | ux | apresentacao`
(seção 60). `problemaBloqueiaProntidao` só retorna `true` para
categorias `tecnica`/`fiscal`/`dados` com severidade `critica` ou
`alta` — problemas de `ux`/`apresentacao` nunca bloqueiam sozinhos,
mesmo que graves na experiência (ficam registrados, mas não impedem
prontidão técnica).

## H. Comparação com legado

`comparacaoCaso.ts` **reexporta** `comparacaoV2Legado` — nenhuma
segunda metodologia de comparação foi criada (seção 17/18). Um caso
sem execução legado equivalente (`statusExecucaoLegado` ausente) tem
`validacaoComparativa = "nao_avaliada"`, nunca é forçado a uma
comparação artificial.

## I. Multiatividade

Marcada como área essencial obrigatória
(`AREAS_ESSENCIAIS_PADRAO` inclui `"multiatividade"`). Sem nenhum
caso cobrindo essa área com sucesso, `consolidarPiloto` nunca retorna
`pronto_para_avaliar_migracao_controlada` — testado explicitamente.

## J. FS12

Área `"fs12"`/`"fator_r"` — mesmo tratamento de cobertura essencial.

## K. Créditos

Área `"creditos"` — idem.

## L. Split

Área `"split"` — idem.

## M. Lucro Real

Área `"lucro_real"` — idem; a lista de áreas essenciais é
configurável por chamada (`OpcoesConsolidacao.areasEssenciais`), para
o piloto real poder exigir exatamente os perfis que planejou cobrir.

## N. Memória Técnica

`AvaliacaoCasoPiloto.validacaoAuditabilidade` (`passou`/`ressalva`/`nao_avaliada`)
registra o resultado da checklist manual (seção 33/34 do pedido —
conferir manualmente carga/margem/caixa/decisão/score contra a
memória de pelo menos 5 itens por caso). O contrato está pronto; a
conferência em si depende de casos reais.

## O. Modo Apresentação

`AvaliacaoCasoPiloto.validacaoApresentacao` — mesmo padrão
passou/ressalva/não avaliada, para registrar clareza, informação
excessiva, condição visível e trade-offs compreensíveis por caso.

## P. Critérios de prontidão

`StatusProntidaoPiloto = piloto_em_andamento | piloto_com_pendencias | pronto_para_avaliar_migracao_controlada`
(nunca `pronto_para_desligar_legado` — fora de escopo, seção 75).
`calcularStatusProntidaoPiloto` (dentro de `consolidacao.ts`) segue
regras explícitas e determinísticas, nesta ordem:
1. Zero casos → `piloto_em_andamento`.
2. Algum caso bloqueado (problema crítico) → `piloto_com_pendencias`.
3. Alguma divergência material não explicada → `piloto_com_pendencias`.
4. Algum caso `requer_ajuste` → `piloto_com_pendencias`.
5. Alguma área essencial sem cobertura aprovada → `piloto_com_pendencias`.
6. Só então → `pronto_para_avaliar_migracao_controlada`.

## Q. Template de caso real

```text
CASO ID:            CASO-<SEGMENTO>-<NN>
SEGMENTO:
PERÍODO:

OBJETIVO:

ÁREAS VALIDADAS:    [ ] multiatividade [ ] fs12/fator_r [ ] creditos
                    [ ] split [ ] lucro_real [ ] otimizacao [ ] pontos_virada

FONTES UTILIZADAS:
- Wizard V2 (consultor)
- Wizard legado (comparação), se aplicável

QUALIDADE DA ENTRADA:
  Empresa:      confirmado | estimado | indeterminado | parcial | não informado
  Receita:      ...
  Custos:       ...
  Créditos:     ...
  FS12:         ...
  Fiscal:       ...
  Split:        ...

TEMPO DE PREENCHIMENTO (min):

DIFICULDADES DE ENTRADA:
CAMPOS CONFUSOS:
DADOS DIFÍCEIS DE OBTER:
AJUDAS INSUFICIENTES:

RESULTADO V2:        (resumo executivo — carga/margem/decisão/score)
RESULTADO LEGADO:     (se executado)

CLASSIFICAÇÃO COMPARATIVA:  equivalente | esperada_por_maior_cobertura_v2 | divergencia_material | nao_comparavel
DIVERGÊNCIAS:
GANHOS DE COBERTURA:

CHECKLIST DE AUDITORIA MANUAL (Memória Técnica):
  [ ] carga rastreável
  [ ] margem rastreável
  [ ] capital rastreável
  [ ] decisão rastreável
  [ ] premissa material identificada

MEMÓRIA TÉCNICA:      PASSOU / RESSALVA
APRESENTAÇÃO:         PASSOU / RESSALVA

RELOAD:               validado / não validado
CONTEXTHASH APÓS RELOAD: consistente / inconsistente

PROBLEMAS:
  [severidade] [categoria] descrição

STATUS FINAL:         aprovado | aprovado_com_ressalvas | requer_ajuste | bloqueado
```

## R. Resultados reais, quando existirem

**Nenhum caso real foi executado nesta fase.** Este ambiente não tem
acesso a dados de empresas reais (arquivos fiscais, XML/SPED/ECD/ECF,
ou qualquer sistema externo do consultório) — apenas ao código-fonte
do projeto. Fabricar "casos reais" sintéticos e apresentá-los como
piloto real violaria diretamente o princípio desta fase ("testes
sintéticos não contam como piloto real", seção 88) e vem sendo
explicitamente instruído a não fazer (seção 89: "se não houver dados
reais disponíveis, pare após preparar a infraestrutura").

Quando casos reais estiverem disponíveis, o fluxo operacional é:
1. Consultor preenche o Wizard V2 para a empresa real.
2. Registra um `CasoPiloto` (usando o template da seção Q, anonimizado).
3. Quando possível, roda o fluxo legado com dados equivalentes.
4. Compara com `comparacaoCaso` (reaproveitando `comparacaoV2Legado`).
5. Registra problemas com `ProblemaPiloto` (severidade + categoria).
6. Constrói a avaliação com `construirAvaliacaoCaso`.
7. Após 5-10 casos, consolida com `consolidarPiloto` e obtém o
   `statusProntidao` real.

## S. Limitações

1. **Parte B (execução real) não foi iniciada** — esta é a limitação
   central e deliberada desta entrega.
2. **`AvaliacaoCasoPiloto.validacaoAuditabilidade`/`validacaoApresentacao`
   dependem de conferência manual** — não há automação para "a
   Memória Técnica realmente bate com a origem"; isso é, por design,
   uma checklist humana (seção 33/34), não uma função pura.
3. **Áreas essenciais configuráveis, mas com um padrão fixo** —
   `AREAS_ESSENCIAIS_PADRAO` cobre as 5 áreas centrais do pedido
   (seção 42); Agro/Aviação e otimização/pontos de virada não são
   essenciais por padrão (o próprio pedido trata Agro como opcional
   "se houver dado real disponível" e otimização/pontos de virada
   como não-obrigatórios em todo caso).
4. **Sem testes de renderização** (limitação já documentada em todas
   as fases anteriores).

## Próximas etapas

Quando houver dados reais de empresas disponíveis: executar 5-10
casos cobrindo os perfis essenciais, registrar cada um com o template
da seção Q, e só então produzir o relatório de prontidão real (Parte
B). Só depois disso caberá avaliar migração controlada — nunca
migração automática, mesmo com piloto bem-sucedido (seção 44/93).

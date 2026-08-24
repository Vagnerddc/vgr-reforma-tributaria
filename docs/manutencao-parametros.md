# Como atualizar alíquotas e regras

Todo valor sujeito a mudança legal ou regulatória vive em
`config/parametros.json`. **Nunca edite `src/engine/calculo.ts` para mudar um
número** — se um valor precisa mudar, ele deve estar em `parametros.json`; se
não estiver, é um bug de design a corrigir (abrir uma issue/pedir ajuste).

## Passo a passo para atualizar uma alíquota

1. Abra `config/parametros.json`.
2. Localize o campo (ex.: `aliquotas.cbs["2027"]`).
3. Altere o valor.
4. Rode `npm run test` — os 13 testes automatizados devem continuar passando
   (eles verificam a lógica, não os valores específicos, então uma mudança de
   alíquota não deveria quebrar teste nenhum; se quebrar, algo na lógica
   assumia um valor implícito e precisa ser revisto).
5. Rode `npm run build` e reimplante a pasta `dist/` no local de hospedagem.

## Campos e o que representam

| Campo | O que é | Quando atualizar |
|---|---|---|
| `aliquotas.cbs`, `aliquotas.ibs` | Alíquota por ano (2026-2033) | Nova Nota Técnica do Ministério da Fazenda ou resolução do Senado |
| `anos.*` | Datas do cronograma legal | Só muda se uma lei alterar o cronograma da EC 132/LC 214 |
| `simplesNacional.unificado.percentualCreditoRepassadoPorAnexo` | % de crédito repassado ao cliente por quem fica 100% no DAS | Quando a RFB publicar tabela oficial por anexo/faixa (hoje é estimativa) |
| `simplesNacional.hibrido.*` | Regras do regime híbrido (custo de compliance, % de crédito, janela de opção) | Regulamentação do Comitê Gestor sobre o art. 41 §3º |
| `produtorRural.*` | Limite de receita para não-contribuinte, crédito presumido | Correção anual do limite pelo IPCA; mudança nas regras de crédito presumido |
| `aviacaoAgricola.tratamentoServico` | Se o serviço de pulverização aérea tem alíquota cheia ou reduzida | Se sair ato infralegal equiparando o serviço a insumo agropecuário |
| `splitPayment.*` | Fases, meios de pagamento cobertos, prazos médios de recebimento hoje | Regulamento de cada um dos 12 arranjos de pagamento (Decreto 12.955/2026 e atos posteriores) |

`config/tributosAtuais.json` guarda as alíquotas do **sistema atual** (PIS/Cofins
e ICMS), usadas só para **pré-preencher** os campos do formulário — o usuário
sempre pode sobrescrever manualmente (ver `src/engine/tributosAtuais.ts`):

| Campo | O que é | Quando atualizar |
|---|---|---|
| `pisCofinsPorRegime.lucro_real` / `lucro_presumido` | Alíquota padrão de PIS+Cofins de cada regime | Só muda se a legislação do PIS/Cofins mudar (raro, e mesmo assim extinta em 2027) |
| `pisCofinsPorRegime.simplesPorAnexo` | Estimativa média de PIS+Cofins embutidos no DAS por anexo | Quando a RFB atualizar a tabela de partilha do Simples Nacional |
| `icmsPorUf` | Alíquota interna "modal" de ICMS de cada Estado | Sempre que um Estado alterar seu regulamento de ICMS — **isso muda com frequência e por Estado**, revisar periodicamente |
| `observacoesIcmsPorPerfil` | Texto de advertência específico por atividade (ex.: aviação agrícola normalmente é ISS, não ICMS) | Ao adicionar um novo perfil de atividade ou identificar um enquadramento tributário diferente |

**Atenção com ICMS**: ao contrário de CBS/IBS (regras federais únicas), ICMS
varia por Estado, por CFOP, por produto/serviço e tem inúmeros benefícios
fiscais (diferimento, isenção, redução de base). Os valores em `icmsPorUf` são
alíquotas internas gerais de referência — o sistema sempre exibe o aviso
"confirme com sua contabilidade" ao lado do campo, e isso NÃO deve ser
removido nem enfraquecido em nenhuma alteração futura.

Cada bloco tem, quando aplicável, um campo `_comentario` explicando por que o
valor é uma estimativa e o que motivaria a próxima revisão — isso substitui a
necessidade de comentários no código.

## Onde não editar

- `src/engine/calculo.ts`: só deve mudar se a **lógica** da regra mudar (ex.:
  uma nova fórmula de cálculo de crédito), não quando só o **valor** muda.
- `src/App.tsx`: interface. Não deve conter nenhuma alíquota, data ou
  percentual — se você encontrar um número "mágico" ali, é um bug a corrigir
  movendo o valor para `parametros.json`.

## Atualizando as fontes legais

Ao atualizar um valor, adicione (ou atualize) a fonte correspondente em
`config/parametros.json` → campo `fontes`, e registre a mudança em
`docs/base-legal.md` com a data de consulta.

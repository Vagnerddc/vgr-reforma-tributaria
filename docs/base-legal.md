# Base legal e fontes (consulta em 30/07/2026)

Este documento registra as fontes usadas para modelar o motor de cálculo e os
pontos em que a regulamentação ainda está em aberto — esses pontos foram
transformados em parâmetros editáveis em `config/parametros.json` (marcados
com `_comentario`), justamente para não travar o sistema em uma leitura que
pode mudar.

## 1. EC 132/2023
Estrutura constitucional do IVA dual (CBS federal + IBS subnacional), não
cumulativos, "IVA de destino", split payment previsto (regulamentado em LC),
cronograma geral de transição (teste 2026, extinção ICMS/ISS 2029-2033).
Fonte: [Barbieri Advogados](https://barbieriadvogados.com/lc-214/),
[Estratégia Concursos](https://www.estrategiaconcursos.com.br/blog/aliquotas-referencia-ibs-cbs/).

## 2. LC 214/2025 — cronograma
- 2026: fase de teste, CBS 0,9% / IBS 0,1%, sem efeito de caixa (compensável
  com PIS/Cofins/ISS/ICMS).
- Destaque de IBS/CBS na NF-e: facultativo até 02/08/2026, **obrigatório a
  partir de 03/08/2026** para regime regular (Simples entra em jan/2027).
  Fonte: [Nomus](https://www.nomus.com.br/blog-industrial/reforma-tributaria-obrigatoriedade-de-ibs-e-cbs-nas-notas-fiscais-comeca-em-agosto-de-2026/),
  [Fenafisco](https://fenafisco.org.br/08/04/2026/reforma-tributaria-afinal-quando-o-destaque-de-ibs-e-cbs-na-nota-fiscal-passa-a-ser-realmente-obrigatorio/).
- 2027: cobrança efetiva de CBS, extinção de PIS/Cofins.
- 2029-2032: transição gradual ICMS/ISS → IBS. 2033: sistema pleno.
  Fonte: [Escola Superior SN](https://escolasuperioresn.com.br/lcn-214-2025-guia-cbs-ibs-is/).

### Simples Nacional híbrido (art. 41, §3º)
Janela formal de opção em setembro/2026 (efeitos a partir de jan/2027); depois,
opção semestral. **Regras de irretratabilidade dentro do período optado ainda
divergem entre fontes** — revisar quando o Comitê Gestor publicar regulamento
definitivo. Fonte: [e-Auditoria](https://www.e-auditoria.com.br/blog/regime-hibrido-simples-nacional-ibs-e-cbs-das/),
[Escola Superior SN](https://escolasuperioresn.com.br/regime-hibrido-simples-nacional-ibs-cbs/).

### Simples Nacional unificado
Crédito ao comprador limitado à fração de IBS/CBS presumida no anexo/faixa do
optante, não ao valor cheio da nota. **Tabela oficial consolidada por
anexo/faixa ainda não publicada** — tratado como parâmetro estimado
(`percentualCreditoRepassadoPorAnexo`). Fonte: [e-Auditoria](https://www.e-auditoria.com.br/blog/lc-214-simples-nacional-como-orientar-seus-clientes/),
[reformatributaria.com](https://www.reformatributaria.com/opiniao/simples-nacional-vai-gerar-credito-de-ibs-e-cbs-e-quando-estara-obrigado/).

## 3. Split Payment
Art. 31 LC 214/2025 + Decreto 12.955/2026: instituições de pagamento
segregam e recolhem IBS/CBS na liquidação financeira. **Fase 1 confirmada**:
Pix, boleto e TED/transferências. **Cartão de crédito fica para fase
posterior**, inicialmente voluntária. Fonte: [Fenafisco](https://fenafisco.org.br/30/04/2026/regulamento-da-reforma-tributaria-preve-inicio-do-split-payment-com-pix-boleto-e-transferencias-cartoes-ficam-para-depois/),
[Seu Dinheiro](https://www.seudinheiro.com/2026/economia/reforma-tributaria-entenda-como-funciona-quando-passa-a-valer-split-payment-isca/).
Datas exatas de cada um dos 12 arranjos previstos e regras operacionais finais
**ainda dependem de ato infralegal complementar** — parâmetro a atualizar.

## 4. Agronegócio e aviação agrícola
- Insumos agropecuários (bens: defensivos, fertilizantes, sementes, ração):
  **redução de 60%** na alíquota de IBS+CBS.
- **Serviço** de pulverização aérea (convencional ou drone): não há, nas fontes
  localizadas, redução específica — tratado como serviço comum, alíquota cheia.
  Monitorar eventual ato infralegal que equipare o serviço a insumo. Fonte:
  [Revista Aviação Agrícola](https://revistaavag.org.br/impactos-da-reforma-tributaria-no-setor-aeroagricola/),
  [ConJur](https://www.conjur.com.br/2025-out-08/reforma-tributaria-e-agronegocio-regimes-diferenciados-do-ibs-e-da-cbs/).
- Diferimento de insumos agrícolas desloca o crédito presumido do comprador —
  fonte: [ConJur](https://www.conjur.com.br/2026-jan-17/diferimento-de-ibs-e-cbs-de-insumos-agricolas-a-conta-vai-ficar-para-o-produtor-rural/).
- Produtor rural (PF/PJ) **não é contribuinte** de IBS/CBS se receita anual <
  R$ 3,6 milhões (corrigido anualmente pelo IPCA); pode optar
  voluntariamente, opção irretratável no ano. Fonte: [Jusbrasil](https://www.jusbrasil.com.br/artigos/produtor-rural-na-reforma-tributaria-como-calcular-corretamente-o-limite-de-r-3-6-milhoes-e-o-que-muda-no-enquadramento-de-pjs-com-atividades-mistas/5946783956).

## 5. Alíquotas de referência
Estimativa revisada (atualizada em 03/08/2026) para 2033: **27,91%** somados.
O split oficial CBS/IBS para essa nova estimativa ainda não foi publicado —
o sistema escala proporcionalmente a partir do último split conhecido
(CBS ~8,8% / IBS ~17,7%, de uma estimativa preliminar anterior de ~26,5%),
resultando em CBS ≈ 9,27% / IBS ≈ 18,64%. Sujeito a recálculo anual pelo
TCU/Senado — **não é definitivo**. Fonte: [Nota Técnica Alíquotas — MF](https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria/regulamentacao-da-reforma-tributaria/lei-geral-do-ibs-da-cbs-e-do-imposto-seletivo/notas/nota-tecnica-aliquotas_2024-07-01_sertmf-1.pdf).

## 6. Auditoria de metodologia contábil e comparação com RFB/mercado (03/08/2026)

Revisão feita a pedido do escritório, cruzando a metodologia do motor de cálculo com:
(a) a **Orientação Técnica CFC n.º 01/2026** ("Aspectos contábeis relacionados ao
IBS, à CBS e ao período de teste operacional do exercício de 2026"); (b) o
simulador oficial da Receita Federal / Portal Nacional da Reforma Tributária; e
(c) a metodologia descrita publicamente por sistemas de mercado (TOTVS, Thomson
Reuters/ONESOURCE Mastersaf).

**Confirmado como correto (nenhuma mudança necessária):**
- Apuração de CBS/IBS por **débito x crédito** (não cumulativo), com o tributo
  "cobrado por fora" (não integra a receita nem a base de cálculo) —
  consistente com a Orientação Técnica CFC 01/2026, itens 4.1, 4.2 e 19, e com
  a NBC TG 47/Estrutura Conceitual.
- Efeito de caixa do split payment modelado como perda de capital de giro
  (o débito é reconhecido integralmente na operação; o que muda é o momento da
  baixa do passivo) — consistente com a Orientação Técnica CFC 01/2026, item 22.
- PIS/Cofins integralmente devido em 2026 (sem dispensa) — confirmado pela
  Orientação Técnica CFC 01/2026, item 25, e pelo texto do art. 348 da LC 214/2025.
- Crédito de PIS/Cofins não cumulativo (Lucro Real) e de ICMS de regime normal
  (Lucro Real/Presumido) sobre insumos — já corrigido em versão anterior deste
  motor após revisão de metodologia.

**Corrigido nesta auditoria:**
- **2026 não representa ônus tributário líquido adicional.** O art. 348 da LC
  214/2025 determina que qualquer valor de CBS/IBS apurado sobre fatos
  geradores de 2026 é compensável com PIS/Cofins do mesmo período ou
  ressarcível em até 60 dias — condicionado ao cumprimento das obrigações
  acessórias. A Orientação Técnica CFC 01/2026 (itens 25 e 28-30) confirma essa
  leitura e recomenda evidenciar isso nas notas explicativas. O motor calculava
  o valor de CBS/IBS de 2026 como se fosse carga real, sem essa ressalva —
  agora toda simulação com ano 2026 traz uma observação explícita sobre a
  neutralidade do ônus líquido (mas alertando sobre o possível efeito de caixa
  transitório via split payment até a compensação). Ver `src/engine/calculo.ts`.
- **Observações por ano estavam sendo descartadas na interface.** O motor já
  gerava observações relevantes por ano (ano-teste, split payment ativo,
  alíquota cheia de aviação agrícola, carga zero), mas as telas só exibiam as
  do último ano simulado (ou nenhuma, no simulador interno). Corrigido para
  agregar todas as observações únicas de todos os anos em ambas as telas.

**Fontes**: Orientação Técnica CFC n.º 01/2026 (documento interno do escritório,
`@VGR GROUP/CFC - CBS não compõe o resultado.pdf`); [gov.br/receitafederal — Entenda a Reforma](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/entenda);
[TOTVS — Documento de Referência](https://tdn.totvs.com/pages/releaseview.action?pageId=916420219);
[Thomson Reuters — Contabilização na Reforma Tributária](https://www.thomsonreuters.com.br/pt/tax-accounting/onesource-mastersaf/blog/contabilizacao-reforma-tribut-ria-cbs-ib.html);
[ConJur — obrigações acessórias em 2026](https://www.conjur.com.br/2025-out-08/peso-do-descumprimento-das-obrigacoes-acessorias-da-reforma-tributaria-em-2026/) — acesso 03/08/2026.

## 7. Construção civil — regime de bens imóveis (pesquisa em 05/08/2026)

LC 214/2025, arts. 251-271 ("Operações com Bens Imóveis"):
- **Venda de imóvel e incorporação imobiliária**: redução de **50%** na
  alíquota de CBS/IBS. Fonte: [ConJur (21/07/2025)](https://www.conjur.com.br/), radardareformatributaria.com.
- **Locação, cessão e arrendamento** de imóveis: redução de **70%**.
- **"Redutor de ajuste"**: reduz a BASE de cálculo (não a alíquota) na venda de
  imóvel, pelo valor de aquisição/mercado em 31/12/2026 + ITBI — **não
  modelado neste simulador**, que portanto tende a **sobrestimar** a carga de
  incorporadoras (avisado na tela de resultado).
- **RET** (regime especial de incorporadoras com patrimônio de afetação)
  continua existindo, com regime de transição opcional (art. 485) para
  incorporações iniciadas até 01/01/2029 — não modelado.
- **Construção por empreitada pura** (empresa só executa a obra, não vende o
  imóvel): a pesquisa **não confirmou** se a redução de 50%/70% se estende a
  esse caso — tratada como alíquota cheia até validação jurídica pontual dos
  artigos citados. Sinalizado explicitamente na tela de resultado.
- Não foi encontrada diferenciação de tratamento por CNAE (divisões 41, 42, 43)
  dentro do capítulo de bens imóveis — a lei trata pela natureza da operação
  (venda, locação, incorporação, empreitada), não pelo CNAE.

Fontes: ConJur (21/07/2025 e 20/01/2026), cnm.org.br (nota técnica),
andrademaia.com.br, contabeis.com.br — acesso 05/08/2026.

## Pontos marcados como incertos/configuráveis no sistema
1. Alíquota de referência final (recalculada anualmente).
2. Percentual de crédito do Simples unificado por anexo/faixa.
3. Regras finais de irretratabilidade do regime híbrido.
4. Cronograma detalhado do split payment por arranjo de pagamento.
5. Eventual tratamento diferenciado futuro para o serviço de aplicação aérea.
6. Extensão (ou não) da redução de alíquota do regime de bens imóveis à
   construção por empreitada pura.
7. "Redutor de ajuste" na base de cálculo da venda/incorporação de imóvel —
   não modelado, tende a sobrestimar a carga de incorporadoras.

Todos os pontos estão isolados em `config/parametros.json`, com campo
`_comentario` explicando a incerteza — nenhum valor está hardcoded na lógica
do motor de cálculo ou na interface.

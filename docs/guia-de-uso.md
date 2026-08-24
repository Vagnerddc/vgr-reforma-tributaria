# Guia de uso — para o contador apresentar ao cliente

## Antes de começar

Esta ferramenta é um **simulador gerencial**. Ela ajuda a conversa com o
cliente sobre tendências e cenários, mas **não substitui a apuração fiscal
formal nem um parecer técnico definitivo**. Deixe isso claro ao cliente antes
de mostrar qualquer resultado — o próprio sistema repete esse aviso em toda
tela de resultado.

## Passo a passo

1. **Nome do cliente**: identifica o relatório exportado.
2. **Tipo de operação**: aviação convencional ou por drones — hoje isso só
   muda a observação sobre alíquota do serviço, mas mantém o cenário
   documentado corretamente.
3. **Regime tributário atual**: escolha entre Simples unificado, Simples
   híbrido, Lucro Presumido ou Lucro Real — o que o cliente pratica hoje.
4. **Anexo do Simples** (se aplicável): Anexo III ou V, conforme o
   enquadramento do cliente.
5. **Faturamento anual**: valor aproximado, em reais.
6. **Carga tributária efetiva atual**: percentual do faturamento que o
   cliente hoje recolhe em tributos (PIS/Cofins/ISS/ICMS ou DAS). Esse número
   você já tem do acompanhamento contábil do cliente — é o ponto de partida
   da comparação.
7. **Custos/insumos creditáveis**: percentual do faturamento correspondente a
   combustível, peças, manutenção e mão de obra terceirizada — é a base que
   gera crédito de IBS/CBS no regime não cumulativo.
8. **% de clientes contribuintes**: quanto do faturamento vem de produtores
   rurais que serão contribuintes de IBS/CBS (vendas B2B) versus pessoa física
   ou produtor não-contribuinte. Esse número é o principal motor da pressão
   comercial por crédito integral.
9. **Meio de pagamento predominante**: Pix, boleto, TED ou cartão de crédito
   — define o impacto de caixa do split payment (cartão ainda não entra na
   primeira fase).
10. Se o cliente estiver no Simples, marque **"Comparar lado a lado com
    regime híbrido"** para ver as duas curvas juntas no gráfico.

## Lendo o dashboard

- **Cartões no topo**: carga hoje, carga projetada no ano do sistema pleno
  (2033), variação percentual e o quanto de crédito é repassado ao cliente
  final naquele ano.
- **Gráfico de linha**: evolução da carga tributária projetada, ano a ano,
  comparando com a referência atual (e com o híbrido, se marcado).
- **Gráfico de barras**: quanto de capital de giro mensal deixa de existir com
  o split payment (o valor que hoje a empresa "financia" no intervalo entre a
  venda e o recolhimento do imposto).
- **Recomendação**: texto automático com uma leitura inicial do cenário —
  sempre trate como ponto de partida da conversa, não como conclusão.
- **Avisos**: sempre visíveis, reforçando a natureza gerencial da simulação.

## Exportando para o cliente

O botão **"Exportar relatório (.txt)"** gera um arquivo de texto simples com
a tabela ano a ano e a recomendação, pronta para anexar a um e-mail ou
apresentação — sem depender de nenhuma ferramenta externa.

## Quando desconfiar do resultado

Se o cliente tiver uma situação atípica (múltiplos CNPJs, receita muito
próxima do limite do Simples ou do produtor rural não-contribuinte, contratos
de longo prazo com cláusula de repasse de tributos), trate o resultado como
um indicativo e aprofunde com cálculo específico — os parâmetros de crédito
do Simples e do produtor rural ainda são estimativas (ver
`docs/base-legal.md`), sujeitas a regulamentação futura.

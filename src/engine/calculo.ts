import { parametros, ANOS_SIMULACAO, aliquotaCbs, aliquotaIbs } from "./parametros";
import type {
  SimulacaoInput,
  ResultadoAno,
  ResultadoSimulacao,
  Regime,
} from "./types";

/** PIS/Cofins não cumulativo (com direito a crédito sobre insumos) só se aplica ao Lucro Real — Lucro Presumido é cumulativo (sem crédito) e no Simples PIS/Cofins fica embutido no DAS. */
function pisCofinsCreditavel(regime: Regime): boolean {
  return regime === "lucro_real";
}

/** ICMS é apurado por débito x crédito (não cumulativo) em qualquer regime "normal" — Lucro Real ou Presumido. No Simples, o ICMS fica embutido no DAS, sem crédito próprio visível à empresa. */
function icmsCreditavel(regime: Regime): boolean {
  return regime === "lucro_real" || regime === "lucro_presumido";
}

function splitPaymentAtivo(ano: number, meio: string): boolean {
  const dataFase1 = new Date(parametros.splitPayment.fase1DataInicio);
  const ativoDesdeAno = dataFase1.getFullYear();
  const meiosFase1 = parametros.splitPayment.meiosPagamentoFase1;
  if (!meiosFase1.includes(meio)) return false;
  return ano >= ativoDesdeAno;
}

/**
 * Fração do tributo do sistema antigo que ainda seria devida num dado ano,
 * seguindo o cronograma legal de extinção: PIS/Cofins cai a zero de uma vez a
 * partir do início da cobrança efetiva da CBS (2027); ICMS/IPI (e ISS) se
 * reduz gradualmente de 2029 a 2033, na mesma proporção em que a alíquota de
 * IBS avança em direção ao valor pleno — assim o comparativo acompanha
 * automaticamente qualquer ajuste feito no cronograma/alíquotas de IBS.
 */
function fracaoAntigaRestante(ano: number, tributo: "pisCofins" | "icmsIpi"): number {
  if (tributo === "pisCofins") {
    return ano < parametros.anos.inicioCobrancaEfetiva ? 1 : 0;
  }
  const anoBase = parametros.anos.inicioTransicaoIcmsIss - 1;
  const anoFinal = parametros.anos.sistemaPleno;
  if (ano <= anoBase) return 1;
  if (ano >= anoFinal) return 0;
  const ibsBase = aliquotaIbs(anoBase);
  const ibsFinal = aliquotaIbs(anoFinal);
  if (ibsFinal === ibsBase) return 1;
  const progresso = (aliquotaIbs(ano) - ibsBase) / (ibsFinal - ibsBase);
  return Math.min(1, Math.max(0, 1 - progresso));
}

/**
 * Redução de alíquota do regime de bens imóveis (LC 214/2025, arts. 251-271),
 * aplicável ao perfil "construção civil". Confirmado em pesquisa de fonte
 * primária (07/08/2026): art. 252, V inclui "serviços de construção civil"
 * dentro deste capítulo, e o art. 261, caput, fixa -50% para as operações do
 * capítulo em geral (venda/incorporação e empreitada com fornecimento de
 * material para terceiros); o parágrafo único do art. 261 fixa -70% só para
 * locação/cessão/arrendamento.
 */
function reducaoAliquotaConstrucaoCivil(tipoOperacao: SimulacaoInput["tipoOperacaoConstrucao"]): number {
  switch (tipoOperacao) {
    case "incorporacao":
      return parametros.construcaoCivil.reducaoAliquotaVendaIncorporacao;
    case "locacao":
      return parametros.construcaoCivil.reducaoAliquotaLocacao;
    case "empreitada":
      return parametros.construcaoCivil.reducaoAliquotaEmpreitada;
    default:
      return 0;
  }
}

/**
 * Redução de alíquota de CBS/IBS por atividade econômica (perfil do
 * cliente) — tabela única de regimes diferenciados da LC 214/2025 cobertos
 * pelo simulador. Produtor rural e transporte rodoviário de cargas não têm
 * redução própria sobre a alíquota da empresa aqui (o benefício deles é a
 * condição de não contribuinte / crédito presumido para quem compra deles,
 * já tratado em parametros.produtorRural, não uma redução de alíquota
 * própria), por isso entram com 0.
 */
function reducaoAliquotaAtividadeEconomica(input: SimulacaoInput): { reducao: number; observacao?: string } {
  if (input.perfil === "aviacao_agricola") {
    return {
      reducao: parametros.aviacaoAgricola.reducaoAliquotaServicoPulverizacao,
      observacao: `Serviço de pulverização/controle de pragas (LC 214/2025, art. 138 c/ Anexo IX, item 28 — insumos agropecuários e aquícolas): alíquota de CBS/IBS reduzida em ${(parametros.aviacaoAgricola.reducaoAliquotaServicoPulverizacao * 100).toFixed(0)}%.`,
    };
  }
  if (input.perfil === "construcao_civil") {
    const reducao = reducaoAliquotaConstrucaoCivil(input.tipoOperacaoConstrucao);
    if (!input.tipoOperacaoConstrucao) return { reducao: 0 };
    const descricaoOperacao =
      input.tipoOperacaoConstrucao === "incorporacao"
        ? "venda/incorporação de imóvel"
        : input.tipoOperacaoConstrucao === "locacao"
          ? "locação/cessão/arrendamento"
          : "construção por empreitada com fornecimento de material";
    return {
      reducao,
      observacao: `Regime de bens imóveis (LC 214/2025, art. 252, V + art. 261): alíquota de CBS/IBS reduzida em ${(reducao * 100).toFixed(0)}% para ${descricaoOperacao}. Esta simulação NÃO considera o "redutor de ajuste" na base de cálculo (que reduz ainda mais a base pelo valor de aquisição/mercado do imóvel em 31/12/2026), portanto tende a SOBRESTIMAR a carga de incorporadoras — confirme com a contabilidade. Também não modela o limite de crédito de material quando o tomador é não contribuinte do regime regular.`,
    };
  }
  return { reducao: 0 };
}

/**
 * Combina a redução por PRODUTO (NCM — Anexos da LC 214/2025) com a redução
 * por ATIVIDADE ECONÔMICA (perfil do cliente) numa única alíquota efetiva,
 * ponderada pela fatia de faturamento de cada regime. Os dois regimes não se
 * somam sobre a mesma receita: a fatia com regime de produto (zero ou 60%)
 * usa a redução DELE, e só o resto do faturamento (sem NCM de regime
 * especial identificado) usa a redução de atividade — evita o erro de
 * conceder os dois descontos ao mesmo real de receita.
 */
function reducaoAliquotaEfetivaPonderada(input: SimulacaoInput, reducaoAtividade: number): number {
  const percentualZero = Math.max(0, Math.min(1, input.percentualFaturamentoProdutoZero ?? 0));
  const percentualReduzido60 = Math.max(0, Math.min(1, input.percentualFaturamentoProdutoReduzido60 ?? 0));
  const percentualCheia = Math.max(0, 1 - percentualZero - percentualReduzido60);

  const remanescenteZero = 0; // alíquota zero => nada resta
  const remanescenteReduzido60 = 1 - 0.6;
  const remanescenteCheia = 1 - reducaoAtividade;

  const remanescentePonderado =
    percentualZero * remanescenteZero + percentualReduzido60 * remanescenteReduzido60 + percentualCheia * remanescenteCheia;
  return 1 - remanescentePonderado;
}

function calcularAno(input: SimulacaoInput, ano: number, saldoCredorAcumulado: number): ResultadoAno {
  const observacoes: string[] = [];
  const { reducao: reducaoAtividade, observacao: observacaoAtividade } = reducaoAliquotaAtividadeEconomica(input);
  const reducaoEfetiva = reducaoAliquotaEfetivaPonderada(input, reducaoAtividade);
  const cbs = aliquotaCbs(ano) * (1 - reducaoEfetiva);
  const ibs = aliquotaIbs(ano) * (1 - reducaoEfetiva);
  const aliquotaTotal = cbs + ibs;

  if (observacaoAtividade) observacoes.push(observacaoAtividade);

  const percentualZero = input.percentualFaturamentoProdutoZero ?? 0;
  const percentualReduzido60 = input.percentualFaturamentoProdutoReduzido60 ?? 0;
  if (percentualZero > 0 || percentualReduzido60 > 0) {
    observacoes.push(
      `Regime especial por produto (NCM, Anexos da LC 214/2025): ${(percentualZero * 100).toFixed(0)}% do faturamento em alíquota zero e ${(percentualReduzido60 * 100).toFixed(0)}% com redução de 60% — identificado automaticamente pelo NCM das notas de venda (registro 0200 do SPED). O restante do faturamento segue a alíquota da atividade econômica.`
    );
  }

  const faturamento = input.faturamentoAnual;

  // Percentual de crédito por "mundo" tributário — sistema atual (PIS/COFINS +
  // ICMS/IPI) e novo sistema (CBS/IBS) podem ter tratamento de crédito
  // diferente para o mesmo gasto (ver engine/creditoTributario.ts). Quando os
  // campos específicos não vêm informados, cai no percentual único legado —
  // preserva simulações antigas sem mudar nenhum resultado.
  const percentualCreditoSistemaAtual = input.percentualCustosCreditaveisSistemaAtual ?? input.percentualCustosCreditaveis;
  const percentualCreditoNovoSistema = input.percentualCustosCreditaveisNovoSistema ?? input.percentualCustosCreditaveis;

  // Sistema antigo apurado também por débito x crédito, na mesma base de custos
  // creditáveis usada para CBS/IBS — sem isso, PIS/Cofins não cumulativo (Lucro
  // Real) e o ICMS de regime normal ficariam superestimados na referência atual,
  // distorcendo a comparação com o sistema novo (que já é líquido de crédito).
  const debitoPisCofinsAtual = faturamento * input.pisCofinsPercentualAtual;
  const creditoPisCofinsAtual = pisCofinsCreditavel(input.regimeAtual)
    ? faturamento * percentualCreditoSistemaAtual * input.pisCofinsPercentualAtual
    : 0;
  const efetivoPisCofinsAtual = Math.max(0, debitoPisCofinsAtual - creditoPisCofinsAtual);

  const debitoIcmsAtual = faturamento * input.icmsIpiPercentualAtual;
  const creditoIcmsAtual = icmsCreditavel(input.regimeAtual)
    ? faturamento * percentualCreditoSistemaAtual * input.icmsIpiPercentualAtual
    : 0;
  const efetivoIcmsAtual = Math.max(0, debitoIcmsAtual - creditoIcmsAtual);

  const cargaAtualReferencia = efetivoPisCofinsAtual + efetivoIcmsAtual;

  let cargaNovaPropriaEmpresa = 0;
  let custoComplianceAdicional = 0;
  let percentualCreditoRepassadoAoCliente = 0;
  let debitoBruto = 0;
  let creditoApurado = 0;

  // Crédito presumido do produtor rural (LC 214/2025, art. 168): a fração dos
  // custos creditáveis vinda de produtor rural não contribuinte (identificada
  // automaticamente pelo SPED, não estimada pelo contador) NÃO gera crédito
  // integral (o vendedor não destaca CBS/IBS por não ser contribuinte) — só o
  // crédito presumido, numa alíquota que a lei não fixa (varia por produto,
  // definida por ato do Comitê Gestor) — por isso é o único dos dois números
  // que o contador pode/deve ajustar.
  const percentualCompraProdutorRural = input.percentualComprasProdutorRuralNaoContribuinte ?? 0;
  const percentualCreditoPresumido =
    input.percentualCreditoPresumidoProdutorRural ?? parametros.produtorRural.creditoPresumidoComprasDeNaoContribuinte;
  const taxaEfetivaCreditoInsumos = 1 - percentualCompraProdutorRural * (1 - percentualCreditoPresumido);

  const debitoCheio = faturamento * aliquotaTotal;
  const creditoInsumos = faturamento * percentualCreditoNovoSistema * aliquotaTotal * taxaEfetivaCreditoInsumos;
  if (percentualCompraProdutorRural > 0) {
    observacoes.push(
      `Crédito presumido do produtor rural (LC 214/2025, art. 168): ${(percentualCompraProdutorRural * 100).toFixed(0)}% dos custos creditáveis vêm de produtor rural não contribuinte (identificado pelo SPED), com crédito presumido de ${(percentualCreditoPresumido * 100).toFixed(0)}% (percentual oficial ainda pendente de ato do Comitê Gestor/Ministério da Fazenda — ajuste aqui se o ato já tiver sido publicado para o seu produto) em vez do crédito integral.`
    );
  }

  // Saldo credor acumulado (LC 214/2025, art. 45): crédito que sobrou em anos
  // anteriores (crédito > débito) é mantido e abate o débito deste ano antes
  // de zerar — em vez de ser descartado a cada apuração anual isolada.
  const creditoDisponivel = creditoInsumos + saldoCredorAcumulado;
  const apuracaoRegimeRegular = Math.max(0, debitoCheio - creditoDisponivel);
  const saldoCredorGeradoNoRegimeRegular = Math.max(0, creditoDisponivel - debitoCheio);
  if (saldoCredorAcumulado > 0) {
    observacoes.push(
      `Saldo credor de ${saldoCredorAcumulado.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} carregado do(s) ano(s) anterior(es) (art. 45) foi usado para abater o débito de ${ano}.`
    );
  }

  let saldoCredorAcumuladoFinal = 0;

  switch (input.regimeAtual) {
    case "lucro_real":
    case "lucro_presumido": {
      debitoBruto = debitoCheio;
      creditoApurado = creditoInsumos;
      cargaNovaPropriaEmpresa = apuracaoRegimeRegular;
      percentualCreditoRepassadoAoCliente = 1.0;
      saldoCredorAcumuladoFinal = saldoCredorGeradoNoRegimeRegular;
      break;
    }
    case "simples_unificado": {
      // Regime unificado não separa débito/crédito de IBS/CBS: todo o DAS é tratado
      // como "débito" único, sem mecanismo de crédito para a própria empresa.
      debitoBruto = cargaAtualReferencia;
      creditoApurado = 0;
      cargaNovaPropriaEmpresa = cargaAtualReferencia; // DAS não muda por conta da reforma
      const anexo = input.anexoSimples ?? "anexoIII";
      percentualCreditoRepassadoAoCliente =
        parametros.simplesNacional.unificado.percentualCreditoRepassadoPorAnexo[anexo] ?? 0.3;
      observacoes.push(
        "Regime unificado: cliente contribuinte recebe apenas crédito parcial (estimado, sujeito a tabela oficial da RFB), o que tende a gerar pressão comercial para migração ao híbrido ou regime regular."
      );
      break;
    }
    case "simples_hibrido": {
      const fracaoDas = parametros.simplesNacional.hibrido.fracaoDasReferenteIbsCbs;
      const dasResidual = cargaAtualReferencia * (1 - fracaoDas);
      custoComplianceAdicional =
        parametros.simplesNacional.hibrido.custoComplianceAdicionalMensal * 12 +
        faturamento * parametros.simplesNacional.hibrido.custoComplianceAdicionalPercentualFaturamento;
      debitoBruto = dasResidual + debitoCheio + custoComplianceAdicional;
      creditoApurado = creditoInsumos;
      cargaNovaPropriaEmpresa = dasResidual + apuracaoRegimeRegular + custoComplianceAdicional;
      percentualCreditoRepassadoAoCliente = parametros.simplesNacional.hibrido.percentualCreditoRepassado;
      saldoCredorAcumuladoFinal = saldoCredorGeradoNoRegimeRegular;
      observacoes.push(
        "Regime híbrido: empresa passa a apurar IBS/CBS por fora do DAS (débito x crédito) e assume custo de compliance adicional, mas repassa crédito integral ao cliente contribuinte."
      );
      break;
    }
  }

  const proporcaoCbs = aliquotaTotal > 0 ? cbs / aliquotaTotal : 0;
  const proporcaoIbs = aliquotaTotal > 0 ? ibs / aliquotaTotal : 0;
  const debitoBrutoCbs = debitoBruto * proporcaoCbs;
  const debitoBrutoIbs = debitoBruto * proporcaoIbs;
  const creditoApuradoCbs = creditoApurado * proporcaoCbs;
  const creditoApuradoIbs = creditoApurado * proporcaoIbs;
  const efetivoCbs = cargaNovaPropriaEmpresa * proporcaoCbs;
  const efetivoIbs = cargaNovaPropriaEmpresa * proporcaoIbs;

  const pisCofinsProjetado = efetivoPisCofinsAtual * fracaoAntigaRestante(ano, "pisCofins");
  const icmsIpiProjetado = efetivoIcmsAtual * fracaoAntigaRestante(ano, "icmsIpi");
  const sistemaAntigoProjetadoTotal = pisCofinsProjetado + icmsIpiProjetado;

  if (ano < parametros.anos.inicioCobrancaEfetiva) {
    observacoes.push(
      `${ano} é ano-teste: os valores de CBS/IBS acima são simbólicos e, por desenho legal (art. 348 da LC 214/2025), não representam ônus tributário líquido adicional — qualquer montante apurado é compensável com PIS/Cofins do mesmo período ou ressarcível em até 60 dias, condicionado ao cumprimento das obrigações acessórias. Pode haver efeito de caixa transitório via split payment até a compensação/ressarcimento, mas o ônus final esperado é zero para o contribuinte adimplente.`
    );
  }

  const deltaCargaReais = cargaNovaPropriaEmpresa - cargaAtualReferencia;
  const deltaCargaPercentual =
    cargaAtualReferencia > 0 ? deltaCargaReais / cargaAtualReferencia : 0;
  if (cargaAtualReferencia <= 0 && cargaNovaPropriaEmpresa > 0) {
    observacoes.push(
      "Carga tributária efetiva atual informada como zero (ou não preenchida) — a variação percentual não pôde ser calculada e foi zerada por padrão. Confira o valor em R$ da carga projetada e revise o campo de carga atual."
    );
  }

  const meio = input.meioPagamentoPredominante;
  const splitAtivo = splitPaymentAtivo(ano, meio);
  const prazoAtualDias = parametros.splitPayment.prazoMedioRecebimentoAtualDias[meio] ?? 0;
  const tributoMensal = cargaNovaPropriaEmpresa / 12;
  const capitalGiroLiberadoAtualMensal = tributoMensal * (prazoAtualDias / 30);
  const capitalGiroPerdidoComSplitMensal = splitAtivo ? capitalGiroLiberadoAtualMensal : 0;

  if (splitAtivo) {
    observacoes.push(
      `Split payment ativo para "${meio}" a partir de ${parametros.splitPayment.fase1DataInicio}: o imposto deixa de financiar o capital de giro da empresa, pois é retido no momento da liquidação.`
    );
  }

  return {
    ano,
    aliquotaCbs: cbs,
    aliquotaIbs: ibs,
    aliquotaTotal,
    cargaAtualReferencia,
    debitoBruto,
    creditoApurado,
    cargaNovaPropriaEmpresa,
    debitoBrutoCbs,
    debitoBrutoIbs,
    creditoApuradoCbs,
    creditoApuradoIbs,
    efetivoCbs,
    efetivoIbs,
    pisCofinsProjetado,
    icmsIpiProjetado,
    sistemaAntigoProjetadoTotal,
    debitoPisCofinsAtual,
    creditoPisCofinsAtual,
    debitoIcmsAtual,
    creditoIcmsAtual,
    deltaCargaPercentual,
    deltaCargaReais,
    custoComplianceAdicional,
    percentualCreditoRepassadoAoCliente,
    splitPaymentAtivoParaMeioPredominante: splitAtivo,
    capitalGiroLiberadoAtualMensal,
    capitalGiroPerdidoComSplitMensal,
    saldoCredorAcumuladoFinal,
    observacoes,
  };
}

function gerarRecomendacao(input: SimulacaoInput, anos: ResultadoAno[]): string {
  const anoPleno = anos.find((a) => a.ano === parametros.anos.sistemaPleno) ?? anos[anos.length - 1];
  const clienteContribuinte = input.perfilClientes.percentualClienteContribuinte;

  if (input.regimeAtual === "lucro_real" || input.regimeAtual === "lucro_presumido") {
    return `No regime regular, a empresa já repassa crédito integral ao cliente contribuinte. O foco de atenção deve ser o impacto de caixa do split payment e o acompanhamento anual da variação da carga líquida (delta projetado para ${anoPleno.ano}: ${(anoPleno.deltaCargaPercentual * 100).toFixed(1)}%).`;
  }

  if (input.regimeAtual === "simples_unificado" && clienteContribuinte > 0.4) {
    return `Com ${(clienteContribuinte * 100).toFixed(0)}% do faturamento vindo de clientes contribuintes de IBS/CBS, o repasse parcial de crédito no regime unificado tende a gerar pressão comercial. Vale simular o cenário híbrido lado a lado antes da janela de opção (${parametros.simplesNacional.hibrido.janelaOpcao}) para avaliar se o ganho comercial compensa o custo de compliance adicional.`;
  }

  if (input.regimeAtual === "simples_hibrido") {
    return `O regime híbrido garante crédito integral ao cliente contribuinte, mas eleva a carga própria e adiciona custo de compliance. Compare o delta de carga (${(anoPleno.deltaCargaPercentual * 100).toFixed(1)}% em ${anoPleno.ano}) com o ganho comercial esperado de manter/ampliar a carteira de clientes contribuintes.`;
  }

  return `Com baixa exposição a clientes contribuintes (${(clienteContribuinte * 100).toFixed(0)}%), permanecer no regime unificado tende a ser mais simples e igualmente vantajoso — reavalie se essa proporção subir.`;
}

export function simular(input: SimulacaoInput): ResultadoSimulacao {
  const anos: ResultadoAno[] = [];
  let saldoCredorAcumulado = 0;
  for (const ano of ANOS_SIMULACAO) {
    const resultadoAno = calcularAno(input, ano, saldoCredorAcumulado);
    anos.push(resultadoAno);
    saldoCredorAcumulado = resultadoAno.saldoCredorAcumuladoFinal;
  }
  const avisos = [
    parametros.notaImportante,
    "Esta é uma simulação GERENCIAL. Não substitui apuração fiscal formal nem parecer técnico definitivo do contador responsável.",
  ];
  return {
    input,
    anos,
    recomendacao: gerarRecomendacao(input, anos),
    avisos,
  };
}

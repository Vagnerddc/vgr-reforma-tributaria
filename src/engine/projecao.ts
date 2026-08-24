import type { DadosApuradosCliente } from "./sped/agregador";
import type { Participante } from "./sped/tipos";
import type { SimulacaoInput } from "./types";
import { aliquotaCbs, aliquotaIbs } from "./parametros";
import { identificarPerfilPorCnae } from "./atividades";

/**
 * Campos que o SPED não informa e continuam vindo do formulário/contador:
 * regime tributário, perfil de clientes (quanto já é contribuinte), meio de
 * pagamento predominante e os campos específicos de setor (tipoAviacao,
 * tipoOperacaoConstrucao, anexoSimples).
 */
export type CamposManuaisProjecao = Pick<
  SimulacaoInput,
  | "nomeEmpresa"
  | "perfil"
  | "regimeAtual"
  | "anexoSimples"
  | "tipoAviacao"
  | "tipoOperacaoConstrucao"
  | "perfilClientes"
  | "meioPagamentoPredominante"
  | "percentualComprasProdutorRuralNaoContribuinte"
  | "percentualCreditoPresumidoProdutorRural"
>;

function despesasFixasCreditaveis(dados: DadosApuradosCliente): number {
  return dados.custoMercadoriaInsumo + dados.despesaOperacional + dados.despesaAdministrativa + dados.usoConsumo;
}

/**
 * Um fornecedor conta como "produtor rural" para efeito da sugestão de
 * crédito presumido em dois casos: (a) pessoa física (o SPED já entrega isso
 * direto, sem consulta externa); ou (b) pessoa jurídica cujo CNAE principal
 * (só disponível depois de enriquecerRegimeParceiros consultar a Receita
 * Federal) cai na divisão 01 do CNAE (agropecuária) — cobre o produtor rural
 * PJ não contribuinte, que o CPF/CNPJ isolado não revela. Em ambos os casos
 * é sinal, não certeza: um PJ com CNAE agropecuário pode já ter optado pelo
 * regime regular (art. 165), por isso a UI mantém isso como sugestão a
 * confirmar, nunca aplicado sem revisão do contador.
 */
function ehProdutorRuralParaCreditoPresumido(participante: Participante): boolean {
  if (participante.regime === "pessoa_fisica") return true;
  if (participante.cnaePrincipal != null && identificarPerfilPorCnae(participante.cnaePrincipal) === "produtor_rural") {
    return true;
  }
  return false;
}

/**
 * Sugere o % de compras vindas de produtor rural não contribuinte a partir
 * dos fornecedores já identificados no SPED (parceirosComExposicao) — não
 * pede pro contador adivinhar um número, calcula da exposição real (pessoa
 * física direto do SPED, pessoa jurídica pelo CNAE agropecuário depois da
 * consulta à Receita Federal). É só sugestão: o campo continua editável na
 * tela para o contador confirmar/ajustar antes de simular — combinado com o
 * crédito presumido do art. 168 da LC 214/2025 em calculo.ts.
 */
export function sugerirPercentualComprasProdutorRuralNaoContribuinte(dados: DadosApuradosCliente): number {
  const fornecedores = dados.parceirosComExposicao.filter((p) => p.papel === "fornecedor" || p.papel === "ambos");
  const totalCompras = fornecedores.reduce((s, f) => s + f.valorTotal, 0);
  if (totalCompras <= 0) return 0;
  const comprasProdutorRural = fornecedores
    .filter((f) => ehProdutorRuralParaCreditoPresumido(f.participante))
    .reduce((s, f) => s + f.valorTotal, 0);
  return comprasProdutorRural / totalCompras;
}

/**
 * Faturamento necessário para que a empresa alcance a margem líquida alvo em
 * 2027, MANTENDO as despesas apuradas hoje fixas em R$ (não como % do
 * faturamento) — ou seja, o ganho de margem vem só do crescimento de receita
 * sobre uma base de custo que não aumenta.
 *
 * Fórmula (regime não cumulativo — Lucro Real/Presumido, único caso em que a
 * simplificação "efetivo = alíquota × (faturamento − despesas creditáveis)"
 * vale; para Simples a apuração é outra e este solver não se aplica):
 *   lucro = (faturamento − despesas) × (1 − alíquotaTotal)
 *   margemAlvo × faturamento = (faturamento − despesas) × (1 − alíquotaTotal)
 *   faturamento = despesas × (1 − alíquotaTotal) / [(1 − alíquotaTotal) − margemAlvo]
 *
 * Simplificação assumida: "despesas" aqui cobre custo de mercadoria/insumo,
 * despesa operacional, administrativa e uso/consumo (a mesma base usada para
 * o crédito de CBS/IBS) — não inclui IRPJ/CSLL, depreciação ou despesas
 * financeiras. É uma margem operacional aproximada, não o lucro líquido
 * contábil final; use como referência gerencial, não como meta fiscal exata.
 */
export function faturamentoParaMargemAlvo(
  dados: DadosApuradosCliente,
  margemAlvo: number,
  ano: number = 2027
): { faturamentoProjetado: number; atingivel: boolean } {
  const despesas = despesasFixasCreditaveis(dados);
  const aliquotaTotal = aliquotaCbs(ano) + aliquotaIbs(ano);
  const margemBrutaMaxima = 1 - aliquotaTotal;
  const denominador = margemBrutaMaxima - margemAlvo;

  // Sem despesa fixa apurada, a meta já é trivialmente alcançável em qualquer
  // faturamento (não há custo a diluir) — não é um caso de "impossível".
  if (despesas <= 0) {
    return { faturamentoProjetado: dados.faturamento, atingivel: true };
  }

  // Aqui sim é genuinamente impossível: a meta de margem é maior do que a
  // margem bruta máxima que sobra depois da alíquota da reforma.
  if (denominador <= 0) {
    return { faturamentoProjetado: dados.faturamento, atingivel: false };
  }
  const faturamentoProjetado = (despesas * margemBrutaMaxima) / denominador;
  return { faturamentoProjetado, atingivel: faturamentoProjetado > 0 };
}

/**
 * Monta o SimulacaoInput para 2027 a partir dos dados apurados via SPED.
 * As despesas (custo, operacional, administrativa, uso e consumo) ficam
 * FIXAS em R$ no valor apurado — só o faturamento muda — por isso o
 * percentual de custos creditáveis é recalculado sobre o faturamento
 * PROJETADO, nunca sobre o faturamento-base (esse era o bug: dividir pelo
 * faturamento-base fazia as despesas crescerem junto com a receita).
 */
export function projetarInputDoSped(
  dados: DadosApuradosCliente,
  camposManuais: CamposManuaisProjecao,
  faturamentoProjetado: number
): SimulacaoInput {
  const faturamentoBase = dados.faturamento;
  const despesasFixas = despesasFixasCreditaveis(dados);
  const percentualCustosCreditaveis = faturamentoProjetado > 0 ? Math.min(1, despesasFixas / faturamentoProjetado) : 0;

  // A alíquota (débito) de PIS/Cofins e ICMS não muda com o volume — é a mesma
  // taxa apurada hoje, aplicada sobre o faturamento (base ou projetado, tanto
  // faz: é uma taxa, não um valor absoluto).
  const pisCofinsPercentualAtual =
    faturamentoBase > 0 ? (dados.tributosRecolhidos.pis + dados.tributosRecolhidos.cofins) / faturamentoBase : 0;
  const icmsIpiPercentualAtual = faturamentoBase > 0 ? dados.tributosRecolhidos.icms / faturamentoBase : 0;

  // % do faturamento com regime especial por produto (NCM) — vem direto do que
  // o SPED já identificou (faturamentoPorRegimeProduto), não é estimativa do
  // contador, por isso entra automaticamente na projeção, sem passar por
  // camposManuais. Base = faturamento total apurado (não só a fatia com NCM
  // identificado), para virar % coerente com o restante ficando "cheio".
  const { faturamentoZero, faturamentoReduzido60 } = dados.faturamentoPorRegimeProduto;
  const percentualFaturamentoProdutoZero = faturamentoBase > 0 ? faturamentoZero / faturamentoBase : 0;
  const percentualFaturamentoProdutoReduzido60 = faturamentoBase > 0 ? faturamentoReduzido60 / faturamentoBase : 0;

  return {
    ...camposManuais,
    faturamentoAnual: faturamentoProjetado,
    percentualCustosCreditaveis,
    pisCofinsPercentualAtual,
    icmsIpiPercentualAtual,
    percentualFaturamentoProdutoZero,
    percentualFaturamentoProdutoReduzido60,
  };
}

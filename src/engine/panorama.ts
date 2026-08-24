import type { DadosApuradosCliente } from "./sped/agregador";
import type { ResultadoSimulacao, SimulacaoInput } from "./types";
import { parametros } from "./parametros";

export interface ItemPanorama {
  tipo: "risco" | "oportunidade" | "acao_2026";
  titulo: string;
  descricao: string;
}

export interface Panorama {
  resumo: string;
  itens: ItemPanorama[];
  /** Indicadores prontos para exibir em cartões de dashboard (título curto + valor já formatado) — evita repetir formatação de moeda/percentual na UI. */
  indicadores: { rotulo: string; valor: string; tom: "positivo" | "negativo" | "neutro" }[];
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function pct(v: number) {
  return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}

function regimeRestringeCredito(regime: string): boolean {
  return regime === "simples_nacional" || regime === "pessoa_fisica";
}

/**
 * Combina os dados apurados do SPED (regime já enriquecido dos parceiros) com
 * a simulação da reforma para gerar um panorama em linguagem direta: o que a
 * empresa ganha ou perde, quem são os parceiros de risco, e o que fazer ainda
 * em 2026. Evita jargão técnico — números concretos em vez de termos como
 * "regime não cumulativo" ou "apuração".
 */
export function gerarPanorama(
  dados: DadosApuradosCliente,
  input: SimulacaoInput,
  resultado: ResultadoSimulacao
): Panorama {
  const itens: ItemPanorama[] = [];

  const fornecedores = dados.parceirosComExposicao.filter((p) => p.papel === "fornecedor" || p.papel === "ambos");
  const totalCompras = fornecedores.reduce((s, f) => s + f.valorTotal, 0);
  const comprasRestritas = fornecedores
    .filter((f) => regimeRestringeCredito(f.participante.regime))
    .reduce((s, f) => s + f.valorTotal, 0);
  const percentualComprasRestritas = totalCompras > 0 ? comprasRestritas / totalCompras : 0;

  const clientes = dados.parceirosComExposicao.filter((p) => p.papel === "cliente" || p.papel === "ambos");
  const totalVendas = clientes.reduce((s, c) => s + c.valorTotal, 0);
  const vendasParaContribuintesNormais = clientes
    .filter((c) => c.participante.regime === "normal")
    .reduce((s, c) => s + c.valorTotal, 0);
  const percentualVendasParaNormais = totalVendas > 0 ? vendasParaContribuintesNormais / totalVendas : 0;

  const fornecedoresDesconhecidos = fornecedores.filter((f) => f.participante.regime === "desconhecido").length;

  if (percentualComprasRestritas > 0.15) {
    itens.push({
      tipo: "risco",
      titulo: "Boa parte das compras não gera desconto de imposto",
      descricao: `${pct(percentualComprasRestritas)} do que a empresa compra (${moeda(comprasRestritas)} de ${moeda(totalCompras)}) vem de fornecedores do Simples Nacional ou pessoas físicas. Comprar desses fornecedores dá direito a bem menos desconto no imposto a partir de 2027.`,
    });
    itens.push({
      tipo: "acao_2026",
      titulo: "Conversar com os principais fornecedores restritos ainda em 2026",
      descricao: "Levantar os fornecedores do Simples/pessoa física com maior volume de compra e ver com eles se dá para migrar para o regime híbrido, ou buscar outro fornecedor que já gere o desconto integral — a janela para essa mudança abre em setembro de 2026.",
    });
  }

  if (input.regimeAtual === "simples_unificado" && percentualVendasParaNormais > 0.3) {
    itens.push({
      tipo: "risco",
      titulo: "Clientes importantes podem cobrar mais desconto do que a empresa consegue dar",
      descricao: `${pct(percentualVendasParaNormais)} do faturamento (${moeda(vendasParaContribuintesNormais)}) vai para clientes que precisam de desconto integral de imposto. No Simples de hoje, a empresa só consegue repassar parte desse desconto — risco de perder esses clientes ou ter que negociar preço a partir de 2027.`,
    });
    itens.push({
      tipo: "oportunidade",
      titulo: "Vale comparar o regime híbrido",
      descricao: "Simular lado a lado (já disponível aqui) quanto custaria migrar para o híbrido, e comparar com o risco de perder clientes por não dar desconto integral.",
    });
  }

  if (fornecedoresDesconhecidos > 0) {
    itens.push({
      tipo: "acao_2026",
      titulo: `${fornecedoresDesconhecidos} fornecedor(es) sem confirmação de regime`,
      descricao: "Não foi possível confirmar na Receita Federal se todos os fornecedores são do Simples ou não (rede fora do ar, CNPJ não encontrado, ou consulta ainda não feita). Confirme manualmente antes de decidir com base neste panorama.",
    });
  }

  const cargaAtualApurada = dados.tributosRecolhidos.icms + dados.tributosRecolhidos.pis + dados.tributosRecolhidos.cofins;
  const cargaAtualPercentualApurada = dados.faturamento > 0 ? cargaAtualApurada / dados.faturamento : 0;

  const ano2027 = resultado.anos.find((a) => a.ano === parametros.anos.inicioCobrancaEfetiva);
  const anoPleno = resultado.anos[resultado.anos.length - 1];

  const despesasFixas =
    dados.custoMercadoriaInsumo + dados.despesaOperacional + dados.despesaAdministrativa + dados.usoConsumo;
  const lucro2027 = ano2027 ? input.faturamentoAnual - despesasFixas - ano2027.cargaNovaPropriaEmpresa : null;
  const margem2027 = lucro2027 !== null && input.faturamentoAnual > 0 ? lucro2027 / input.faturamentoAnual : null;

  if (ano2027) {
    itens.push({
      tipo: "acao_2026",
      titulo: "O que a empresa vai pagar de imposto em 2027",
      descricao: `Com o faturamento simulado (${moeda(input.faturamentoAnual)}), a empresa pagaria ${moeda(ano2027.cargaNovaPropriaEmpresa)} de CBS/IBS em 2027${margem2027 !== null ? `, deixando uma margem líquida estimada de ${pct(margem2027)}` : ""}. Use esse número para já ir ajustando preço e orçamento em 2026.`,
    });
  }

  const resumo =
    `Hoje a empresa paga ${moeda(cargaAtualApurada)} de imposto (ICMS + PIS + COFINS), o equivalente a ${pct(cargaAtualPercentualApurada)} do faturamento de ${moeda(dados.faturamento)}. ` +
    (ano2027 ? `Em 2027, com o faturamento simulado de ${moeda(input.faturamentoAnual)}, o imposto passaria a ser ${moeda(ano2027.cargaNovaPropriaEmpresa)}` +
      (margem2027 !== null ? `, com margem líquida estimada de ${pct(margem2027)}. ` : ". ") : "") +
    `Em ${anoPleno.ano} (sistema totalmente novo), o imposto seria ${moeda(anoPleno.cargaNovaPropriaEmpresa)}.`;

  const indicadores: Panorama["indicadores"] = [
    { rotulo: "Imposto pago hoje", valor: moeda(cargaAtualApurada), tom: "neutro" },
    { rotulo: "% do faturamento em imposto hoje", valor: pct(cargaAtualPercentualApurada), tom: "neutro" },
  ];
  if (ano2027) {
    indicadores.push({ rotulo: "Imposto estimado em 2027", valor: moeda(ano2027.cargaNovaPropriaEmpresa), tom: "neutro" });
  }
  if (margem2027 !== null) {
    indicadores.push({
      rotulo: "Margem líquida estimada em 2027",
      valor: pct(margem2027),
      tom: margem2027 >= 0.03 ? "positivo" : margem2027 >= 0 ? "neutro" : "negativo",
    });
  }
  indicadores.push({
    rotulo: "Compras sem desconto integral de imposto",
    valor: pct(percentualComprasRestritas),
    tom: percentualComprasRestritas > 0.3 ? "negativo" : percentualComprasRestritas > 0.15 ? "neutro" : "positivo",
  });

  return { resumo, itens, indicadores };
}

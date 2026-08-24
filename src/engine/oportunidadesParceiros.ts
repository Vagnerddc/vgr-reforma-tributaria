import type { Grupo } from "../components/PainelParceiros";

export interface OportunidadeParceiro {
  tipo: "risco" | "oportunidade" | "acao_2026";
  titulo: string;
  descricao: string;
}

function pct(v: number): string {
  return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}
function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Concentração a partir da qual vale destacar o grupo como item de atenção — abaixo disso, é ruído. */
const LIMIAR_CONCENTRACAO_RELEVANTE = 0.15;

function grupo(grupos: Grupo[], chave: Grupo["chave"]): Grupo | undefined {
  return grupos.find((g) => g.chave === chave);
}

/**
 * Camada de oportunidade sobre o painel de parceiros: transforma a exposição
 * já calculada por montarGrupos() em recomendações concretas. Sem essa
 * camada, o painel só mostra "quanto"; aqui entra o "o que fazer com isso".
 */
export function gerarOportunidadesParceiros(grupos: Grupo[], papel: "fornecedores" | "clientes"): OportunidadeParceiro[] {
  const itens: OportunidadeParceiro[] = [];
  const semCredito = grupo(grupos, "sem_credito");
  const comCredito = grupo(grupos, "com_credito");
  const naoConfirmado = grupo(grupos, "nao_confirmado");

  if (papel === "fornecedores") {
    if (semCredito && semCredito.percentual >= LIMIAR_CONCENTRACAO_RELEVANTE) {
      itens.push({
        tipo: "risco",
        titulo: "Concentração de compras em fornecedores sem geração de crédito",
        descricao: `${pct(semCredito.percentual)} das compras (${moeda(semCredito.valor)}, ${semCredito.quantidade} fornecedor(es)) vêm de empresas do Simples Nacional ou pessoas físicas, que não geram crédito integral de CBS/IBS. Isso eleva o custo real de comprar dessas empresas a partir da reforma — vale entrar na negociação de preço/prazo ou avaliar fornecedores alternativos do regime regular.`,
      });
    }
    if (comCredito && comCredito.percentual >= 0.5) {
      itens.push({
        tipo: "oportunidade",
        titulo: "Maioria das compras já gera crédito integral",
        descricao: `${pct(comCredito.percentual)} das compras (${moeda(comCredito.valor)}) já vêm de fornecedores do regime regular, que geram crédito integral de CBS/IBS — essa base de fornecimento já está alinhada com a reforma, sem ação necessária.`,
      });
    }
  } else {
    if (semCredito && semCredito.percentual >= LIMIAR_CONCENTRACAO_RELEVANTE) {
      itens.push({
        tipo: "oportunidade",
        titulo: "Boa parte do faturamento vai para clientes não contribuintes",
        descricao: `${pct(semCredito.percentual)} do faturamento (${moeda(semCredito.valor)}, ${semCredito.quantidade} cliente(s)) vai para empresas do Simples Nacional ou pessoas físicas — para esse grupo, o repasse de crédito de CBS/IBS não é fator de decisão de compra, o que reduz a pressão comercial da reforma sobre essas vendas.`,
      });
    }
    if (comCredito && comCredito.percentual >= LIMIAR_CONCENTRACAO_RELEVANTE) {
      itens.push({
        tipo: "risco",
        titulo: "Concentração de faturamento em clientes que exigem repasse integral de crédito",
        descricao: `${pct(comCredito.percentual)} do faturamento (${moeda(comCredito.valor)}, ${comCredito.quantidade} cliente(s)) vem de empresas do regime regular, que vão exigir repasse integral do crédito de CBS/IBS destacado na nota. Garanta que o regime tributário da empresa (unificado, híbrido ou regular) permite esse repasse — no unificado o repasse é só parcial, o que pode pressionar essa carteira.`,
      });
    }
  }

  if (naoConfirmado && naoConfirmado.percentual >= LIMIAR_CONCENTRACAO_RELEVANTE) {
    itens.push({
      tipo: "acao_2026",
      titulo: `Confirmar o regime de ${pct(naoConfirmado.percentual)} dos ${papel}`,
      descricao: `${naoConfirmado.quantidade} ${papel === "fornecedores" ? "fornecedor(es)" : "cliente(s)"} (${moeda(naoConfirmado.valor)}) ainda não tiveram o regime tributário confirmado na Receita Federal — use o botão de consulta antes de fechar o panorama de risco/oportunidade, esse volume pode mudar a leitura acima.`,
    });
  }

  return itens;
}

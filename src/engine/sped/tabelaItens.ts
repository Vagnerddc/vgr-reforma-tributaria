import type { NaturezaMovimento } from "./tipos";

export interface ItemCadastrado {
  codItem: string;
  descricao: string;
  tipoItem: string;
  ncm?: string;
}

/**
 * Registro 0200 (Tabela de Identificação do Item) — cadastro único por
 * COD_ITEM, com TIPO_ITEM classificando estruturalmente o que aquele item É
 * (mercadoria para revenda, matéria-prima, uso e consumo, ativo imobilizado,
 * serviço etc.), segundo a tabela oficial do Guia Prático EFD. Isso é
 * informação estrutural do próprio SPED — não depende de interpretar texto
 * de descrição de conta contábil, por isso é a fonte PRIMÁRIA de
 * classificação de natureza sempre que o item estiver cadastrado; CFOP
 * continua como fallback só para quando o item não tem 0200 correspondente.
 *
 * Layout: COD_ITEM|DESCR_ITEM|COD_BARRA|COD_ANT_ITEM|UNID_INV|TIPO_ITEM|COD_NCM|EX_IPI|COD_GEN|COD_LST|ALIQ_ICMS
 */
export function processarRegistro0200(campos: string[]): ItemCadastrado {
  const [codItem, descricao, , , , tipoItem, ncm] = campos;
  return { codItem, descricao: descricao ?? "", tipoItem: tipoItem ?? "", ncm: ncm || undefined };
}

/**
 * Classifica pelo TIPO_ITEM oficial (tabela do Guia Prático EFD):
 * 00 mercadoria p/ revenda, 01 matéria-prima, 02 embalagem, 03 produto em
 * processo, 04 produto acabado, 05 subproduto, 06 produto intermediário,
 * 07 material de uso e consumo, 08 ativo imobilizado, 09 serviços,
 * 10 outros insumos, 11 outras.
 *
 * Retorna null (sem sinal estrutural confiável) para "serviços" e "outras" —
 * nesses casos o chamador deve cair no fallback por CFOP/descrição, já que o
 * TIPO_ITEM por si só não diz se é despesa operacional, administrativa etc.
 */
export function classificarPorTipoItem(tipoItem: string, indOper: "entrada" | "saida"): NaturezaMovimento | null {
  switch (tipoItem) {
    case "00": // mercadoria para revenda
    case "04": // produto acabado
      return indOper === "saida" ? "faturamento" : "custoMercadoriaInsumo";
    case "01": // matéria-prima
    case "02": // embalagem
    case "03": // produto em processo
    case "05": // subproduto
    case "06": // produto intermediário
    case "10": // outros insumos
      return "custoMercadoriaInsumo";
    case "07": // material de uso e consumo
      return "usoConsumo";
    case "08": // ativo imobilizado
      return "imobilizado";
    default: // 09 serviços, 11 outras, ou tipo não informado
      return null;
  }
}

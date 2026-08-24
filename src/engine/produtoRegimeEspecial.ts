import anexoI from "../../config/ncm/anexoI.json";
import anexoIV from "../../config/ncm/anexoIV.json";
import anexoV from "../../config/ncm/anexoV.json";
import anexoVII from "../../config/ncm/anexoVII.json";
import anexoIX from "../../config/ncm/anexoIX.json";
import anexoXV from "../../config/ncm/anexoXV.json";

interface ItemAnexo {
  item: number | string;
  descricao: string;
  ncmCandidatos: string[];
  /** true quando a descrição original tem uma cláusula "exceto/ressalvado/excetuado" que a extração automática não modela com segurança (ex.: "carnes... exceto foie gras") — excluído da tabela ativa por precaução. */
  temExcecaoNaoModelada?: boolean;
}

export interface RegimeProdutoNcm {
  ncmPrefixo: string;
  reducao: number;
  anexo: string;
  artigo: string;
  descricao: string;
}

function digitosSoNumeros(codigo: string): string {
  return codigo.replace(/[^\d]/g, "");
}

function expandirAnexo(itens: ItemAnexo[], anexo: string, artigo: string, reducao: number): RegimeProdutoNcm[] {
  const entradas: RegimeProdutoNcm[] = [];
  for (const item of itens) {
    // Itens com "exceto/ressalvado" que excluem um produto específico de dentro de um
    // código mais amplo (ex.: "carnes... exceto foie gras") ficam de fora da tabela ativa —
    // incluir arriscaria conceder a redução a um produto que a lei explicitamente exclui.
    if (item.temExcecaoNaoModelada) continue;
    for (const candidato of item.ncmCandidatos) {
      const prefixo = digitosSoNumeros(candidato);
      if (prefixo.length < 2) continue;
      entradas.push({ ncmPrefixo: prefixo, reducao, anexo, artigo, descricao: item.descricao });
    }
  }
  return entradas;
}

/**
 * Tabela de regimes especiais por NCM, extraída dos Anexos da LC 214/2025
 * (texto oficial, confirmado em 07/08/2026 — ver config/ncm/*.json para os
 * itens originais). Checada em ordem de prioridade: zero primeiro, depois
 * 60% — um NCM que aparece em mais de um Anexo (ex.: um alimento listado na
 * cesta básica E também no Anexo VII de "alimentos em geral") recebe o
 * tratamento mais favorável (zero), coerente com as ressalvas de exclusão
 * mútua presentes no próprio texto dos Anexos ("ressalvados os produtos
 * relacionados no Anexo I").
 *
 * NÃO inclui o Anexo XIV (medicamentos de lista fechada) — revogado pela LC
 * 227/2026 conforme o próprio cabeçalho do Anexo no texto oficial; incluí-lo
 * aqui aplicaria alíquota zero indevida a medicamentos que não têm mais essa
 * previsão. Ver config/ncm/anexoXIV.json apenas como registro histórico.
 *
 * NÃO inclui a hipótese de alíquota zero do Anexo V (art. 145 — só quando a
 * compra é feita por órgão público/entidade ligada ao SUS): aqui o Anexo V
 * entra só com a redução geral de 60% (art. 132), que é a regra para
 * qualquer comprador.
 */
const REGIME_ZERO: RegimeProdutoNcm[] = [
  ...expandirAnexo(anexoI as ItemAnexo[], "I", "art. 125", 1),
  ...expandirAnexo(anexoXV as ItemAnexo[], "XV", "art. 148", 1),
];

const REGIME_60: RegimeProdutoNcm[] = [
  ...expandirAnexo(anexoIV as ItemAnexo[], "IV", "art. 131", 0.6),
  ...expandirAnexo(anexoV as ItemAnexo[], "V", "art. 132", 0.6),
  ...expandirAnexo(anexoVII as ItemAnexo[], "VII", "art. 128 e seguintes (dispositivo exato não confirmado)", 0.6),
  ...expandirAnexo(anexoIX as ItemAnexo[], "IX", "art. 138", 0.6),
];

/**
 * Identifica o regime especial (zero ou 60% de redução) de um NCM, se
 * houver — por prefixo, já que os Anexos frequentemente listam capítulo
 * (2 dígitos), posição (4) ou subposição (6), não só o código completo (8).
 * Retorna null quando o NCM não consta em nenhum Anexo mapeado (alíquota
 * cheia, tratamento padrão).
 */
export function identificarRegimeProdutoPorNcm(ncm: string): RegimeProdutoNcm | null {
  const digitos = digitosSoNumeros(ncm);
  if (!digitos) return null;

  for (const entrada of REGIME_ZERO) {
    if (digitos.startsWith(entrada.ncmPrefixo)) return entrada;
  }
  for (const entrada of REGIME_60) {
    if (digitos.startsWith(entrada.ncmPrefixo)) return entrada;
  }
  return null;
}

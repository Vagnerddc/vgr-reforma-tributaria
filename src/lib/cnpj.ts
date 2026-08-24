export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnaePrincipalCodigo: string | number;
  cnaePrincipalDescricao: string;
  municipio: string;
  uf: string;
  situacaoCadastral: string;
  porte: string;
  opcaoPeloSimples: boolean | null;
}

export class CnpjLookupError extends Error {}

/**
 * Busca dados cadastrais de CNPJ via a função serverless /api/cnpj (proxy da BrasilAPI).
 * Mantém a chamada de rede fora do motor de cálculo — o motor só recebe o CNAE já resolvido.
 */
export async function buscarDadosCnpj(cnpj: string): Promise<DadosCnpj> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) {
    throw new CnpjLookupError("CNPJ deve ter 14 dígitos.");
  }
  const resposta = await fetch(`/api/cnpj?cnpj=${limpo}`);
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new CnpjLookupError(dados.erro ?? "Não foi possível consultar o CNPJ.");
  }
  return dados as DadosCnpj;
}

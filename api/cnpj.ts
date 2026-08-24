import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Proxy para a BrasilAPI (dados cadastrais da Receita Federal por CNPJ).
 * Existe como função serverless (em vez de fetch direto do navegador) para:
 * - evitar expor a origem do site diretamente à API pública (CORS mais previsível);
 * - permitir cache/normalização de erro num único lugar;
 * - já ter a infraestrutura de backend pronta para a captura de lead (api/lead.ts).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cnpj = String(req.query.cnpj || "").replace(/\D/g, "");

  if (cnpj.length !== 14) {
    res.status(400).json({ erro: "CNPJ inválido. Informe 14 dígitos." });
    return;
  }

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!resposta.ok) {
      const erro =
        resposta.status === 404
          ? "CNPJ não encontrado na base da Receita Federal."
          : resposta.status === 429
            ? "Muitas consultas em um curto período — aguarde alguns instantes e tente novamente."
            : "A consulta à Receita Federal falhou temporariamente. Tente novamente em instantes.";
      res.status(resposta.status).json({ erro });
      return;
    }
    const dados = await resposta.json();
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.status(200).json({
      cnpj: dados.cnpj,
      razaoSocial: dados.razao_social,
      nomeFantasia: dados.nome_fantasia,
      cnaePrincipalCodigo: dados.cnae_fiscal,
      cnaePrincipalDescricao: dados.cnae_fiscal_descricao,
      municipio: dados.municipio,
      uf: dados.uf,
      situacaoCadastral: dados.descricao_situacao_cadastral,
      porte: dados.porte,
      opcaoPeloSimples: dados.opcao_pelo_simples ?? null,
    });
  } catch {
    res.status(502).json({ erro: "Falha ao consultar a BrasilAPI. Tente novamente em instantes." });
  }
}

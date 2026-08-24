/**
 * Adapter de CNPJ — wrapper fino de `lib/cnpj.ts` (que já chama a função
 * serverless `/api/cnpj`, proxy da BrasilAPI). Não faz nova consulta externa
 * duplicada. CNAE ajuda a sugerir perfil setorial (ver `engine/setores/catalogo.ts`,
 * consumido pela etapa "Atividades" do wizard), mas NUNCA determina regime,
 * crédito, benefício ou alíquota sozinho — este adapter só devolve dados
 * cadastrais crus.
 */
import { buscarDadosCnpj, CnpjLookupError } from "../../../lib/cnpj";
import { campoExtraido } from "../tipos";
import type { ResultadoIngestaoDocumento } from "../tipos";

export async function ingerirCnpj(cnpj: string, documentoId: string): Promise<ResultadoIngestaoDocumento> {
  const processadoEm = new Date().toISOString();
  try {
    const dados = await buscarDadosCnpj(cnpj);
    const ctx = { documentoId, tipoDocumento: "cnpj" as const, evidencia: "consulta CNPJ (BrasilAPI)" };

    return {
      documentoId,
      tipoDocumento: "cnpj",
      status: "processado",
      camposExtraidos: [
        campoExtraido(dados.razaoSocial, "confirmado", { ...ctx, observacao: "razaoSocial" }),
        campoExtraido(dados.nomeFantasia, "confirmado", { ...ctx, observacao: "nomeFantasia" }),
        campoExtraido(String(dados.cnaePrincipalCodigo), "confirmado", { ...ctx, observacao: "cnaePrincipalCodigo" }),
        campoExtraido(dados.cnaePrincipalDescricao, "confirmado", { ...ctx, observacao: "cnaePrincipalDescricao" }),
        campoExtraido(dados.municipio, "confirmado", { ...ctx, observacao: "municipio" }),
        campoExtraido(dados.uf, "confirmado", { ...ctx, observacao: "uf" }),
        campoExtraido(dados.situacaoCadastral, "confirmado", { ...ctx, observacao: "situacaoCadastral" }),
        campoExtraido(dados.porte, "confirmado", { ...ctx, observacao: "porte" }),
        campoExtraido(dados.opcaoPeloSimples, "confirmado", { ...ctx, observacao: "opcaoPeloSimples" }),
      ],
      alertas: [{ codigo: "cnae_nao_determina_regime", mensagem: "O CNAE ajuda a sugerir o perfil setorial, mas não determina sozinho regime, crédito, benefício ou alíquota.", gravidade: "info" }],
      inconsistencias: [],
      limitacoes: [],
      metadados: { nomeArquivo: `CNPJ ${cnpj}`, processadoEm },
    };
  } catch (e) {
    const mensagem = e instanceof CnpjLookupError ? e.message : "Não foi possível consultar o CNPJ.";
    return {
      documentoId,
      tipoDocumento: "cnpj",
      status: "falhou",
      camposExtraidos: [],
      alertas: [],
      inconsistencias: [{ campo: "cnpj", mensagem, gravidade: "atencao" }],
      limitacoes: [],
      metadados: { nomeArquivo: `CNPJ ${cnpj}`, processadoEm },
    };
  }
}

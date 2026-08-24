/**
 * Normaliza os `CampoExtraido` de vários `ResultadoIngestaoDocumento` para
 * chaves lógicas do `RascunhoCenarioEmpresa` (ex.: "identificacao.nomeEmpresa",
 * "tributario.premissas.rbt12"). Não decide nada sobre conflito — só agrupa
 * (a decisão é do agregador, Bloco J). Nunca funde períodos diferentes no
 * mesmo grupo sem que o agregador veja os períodos de cada candidato.
 */
import type { CampoExtraido, TipoDocumento } from "./tipos";

export interface CampoAgrupado {
  chave: string;
  candidatos: CampoExtraido<unknown>[];
}

/**
 * Mapa explícito (tipoDocumento:observacao) → chave lógica do rascunho.
 * Campos sem entrada aqui caem no fallback `tributario.premissas.<tipoDocumento>.<observacao>`
 * (nunca descartados silenciosamente — ver `chaveParaCampo`).
 */
const MAPA_CAMPO_LOGICO: Record<string, string> = {
  "cnpj:razaoSocial": "identificacao.nomeEmpresa",
  "cnpj:municipio": "identificacao.municipio",
  "cnpj:uf": "identificacao.uf",
  "cnpj:nomeFantasia": "tributario.premissas.nomeFantasia",
  "cnpj:cnaePrincipalDescricao": "tributario.premissas.cnaePrincipalDescricao",
  "cnpj:porte": "tributario.premissas.porte",
  "cnpj:opcaoPeloSimples": "tributario.premissas.opcaoPeloSimples",
  "cnpj:situacaoCadastral": "tributario.premissas.situacaoCadastral",

  "contrato_social:objetoSocial": "tributario.premissas.objetoSocial",
  "contrato_social:capitalSocial": "tributario.premissas.capitalSocial",
  "contrato_social:administracao": "tributario.premissas.administracao",

  "pgdas:receita.periodoApuracao": "tributario.premissas.receitaPeriodoPgdas",
  "pgdas:rbt12": "tributario.premissas.rbt12",
  "pgdas:aliquotaEfetiva": "tributario.premissas.aliquotaEfetivaSimples",
  "pgdas:dasApurado": "tributario.premissas.dasApurado",
  "pgdas:anexo": "tributario.premissas.anexoSimples",

  "defis:receitaBrutaAnual": "receita.faturamentoAnual",
  "defis:numeroEmpregados": "pessoas.numeroEmpregados",

  "efd_contribuicoes:receitaConsolidada": "receita.faturamentoAnual",
  "ecd:receitaConsolidada": "receita.faturamentoAnual",

  "folha_fs12:numeroEmpregados": "pessoas.numeroEmpregados",
  "folha_fs12:folhaAnual": "pessoas.folhaAnual",
  "folha_fs12:encargosAnual": "pessoas.encargosAnual",
  "folha_fs12:proLaboreAnual": "pessoas.proLaboreAnual",

  "ecf:regimeDeclaradoEcf": "tributario.premissas.regimeDeclaradoEcf",
  "ecf:receitaBrutaEcf": "tributario.premissas.receitaBrutaEcf",
  "ecf:resultadoAntesIrEcf": "tributario.premissas.resultadoAntesIrEcf",
  "ecf:baseIrpjEcf": "tributario.premissas.baseIrpjEcf",
  "ecf:baseCsllEcf": "tributario.premissas.baseCsllEcf",
  "ecf:prejuizoFiscalAcumulado": "tributario.premissas.prejuizoFiscalAcumulado",
  "ecf:baseNegativaCsllAcumulada": "tributario.premissas.baseNegativaCsllAcumulada",
};

/** Campos que nunca são agrupados/aplicados como escalar — são tratados diretamente pelo agregador (arrays: CNAEs, operações XML). */
export const CHAVES_ESPECIAIS: Record<string, TipoDocumento[]> = {
  "identificacao.cnaes": ["cnpj"],
};

function chaveLogica(tipoDocumento: TipoDocumento, observacao: string | undefined): string {
  if (tipoDocumento === "cnpj" && observacao === "cnaePrincipalCodigo") return "identificacao.cnaes";
  const chaveMapa = `${tipoDocumento}:${observacao ?? ""}`;
  return MAPA_CAMPO_LOGICO[chaveMapa] ?? `tributario.premissas.${tipoDocumento}.${observacao ?? "valor"}`;
}

export function normalizarParaCamposRascunho(resultados: import("./tipos").ResultadoIngestaoDocumento[]): CampoAgrupado[] {
  const grupos = new Map<string, CampoExtraido<unknown>[]>();

  for (const resultado of resultados) {
    for (const campo of resultado.camposExtraidos) {
      const chave = chaveLogica(campo.tipoDocumento, campo.observacao);
      const lista = grupos.get(chave) ?? [];
      lista.push(campo);
      grupos.set(chave, lista);
    }
  }

  return [...grupos.entries()].map(([chave, candidatos]) => ({ chave, candidatos }));
}

/**
 * Tradução na BORDA entre a proveniência granular da ingestão (`TipoDocumento`)
 * e o vocabulário existente do domínio (`OrigemInformacao`, engine/operacaoTributaria.ts —
 * não modificado por esta fase). O engine nunca precisa conhecer "pgdas"/"defis"/
 * "contrato_social"/"folha"/"cnpj" — só um dos 4 valores que já existiam antes desta
 * fase. A origem granular real não se perde: fica preservada em `CampoExtraido`
 * (dentro da camada de ingestão/memória técnica) e, ao cruzar para o domínio,
 * também na `observacao` do `CampoComProveniencia` resultante.
 */
import type { OrigemInformacao, CampoComProveniencia } from "../../engine/operacaoTributaria";
import type { CampoExtraido, TipoDocumento, ConflitoFonte } from "./tipos";

/**
 * Cada bucket é uma escolha deliberada do valor de domínio mais genérico
 * compatível, nunca uma invenção de regra tributária:
 * - "xml": documentos de operação item a item (NF-e, NFS-e quando implementado).
 * - "sped": qualquer declaração/escrituração fiscal estruturada oficial — cobre
 *   tanto os arquivos SPED propriamente ditos (EFD ICMS/IPI, EFD-Contribuições,
 *   ECD, ECF) quanto PGDAS-D/DEFIS, que são declarações oficiais da mesma
 *   natureza (apuração/escrituração perante o Fisco), mesmo sem serem SPED.
 * - "classificacao_vgr": dado obtido por um processo automatizado da própria
 *   VGR (consulta a API, extração de texto de um documento cadastral/societário
 *   ou de folha) — não é o Fisco falando por si (como SPED/PGDAS), não é XML de
 *   operação, e não foi digitado pelo usuário.
 * "informado_usuario" nunca é usado aqui — é reservado a digitação manual real
 * no Wizard V2 (components/campoManual.ts), que esta camada não altera.
 */
const MAPA_ORIGEM_PARA_DOMINIO: Record<TipoDocumento, OrigemInformacao> = {
  xml_nfe: "xml",
  nfse: "xml",
  efd_icms_ipi: "sped",
  efd_contribuicoes: "sped",
  ecd: "sped",
  ecf: "sped",
  pgdas: "sped",
  defis: "sped",
  cnpj: "classificacao_vgr",
  contrato_social: "classificacao_vgr",
  folha_fs12: "classificacao_vgr",
};

export function origemDominioParaTipoDocumento(tipoDocumento: TipoDocumento): OrigemInformacao {
  return MAPA_ORIGEM_PARA_DOMINIO[tipoDocumento];
}

/**
 * Único ponto de tradução ingestão → domínio. `status` (StatusInformacao) já é
 * diretamente compatível (mesmo tipo, sem conversão) — só `origem` precisa de
 * mapeamento. A proveniência granular original nunca se perde: vai para
 * `observacao` (rastreabilidade humana), e o `CampoExtraido` de origem
 * continua disponível em `ConflitoFonte`/memória técnica da ingestão.
 */
export function paraCampoComProveniencia<T>(c: CampoExtraido<T>): CampoComProveniencia<T> {
  const origemGranular = `${c.tipoDocumento}${c.periodo ? `:${c.periodo}` : ""}`;
  const observacao = c.observacao ? `${c.observacao} (origem: ${origemGranular})` : `origem: ${origemGranular}`;
  return {
    valor: c.valor,
    origem: origemDominioParaTipoDocumento(c.tipoDocumento),
    status: c.status,
    observacao,
  };
}

/**
 * Hash determinístico e puro (sem Date.now()/Math.random()) — o mesmo conjunto
 * de campo+período+fontes sempre produz o mesmo id, permitindo comparar um
 * conflito recém-calculado com um já persistido no rascunho (ver agregador.ts).
 * FNV-1a de 32 bits é suficiente aqui: não é criptográfico, só precisa ser
 * estável e ter baixa chance de colisão para o volume de campos de um cenário.
 */
export function gerarIdConflito(campo: string, periodo: string | undefined, fontes: { tipoDocumento: TipoDocumento; documentoId: string }[]): string {
  const fontesOrdenadas = [...fontes].sort((a, b) => (a.documentoId === b.documentoId ? a.tipoDocumento.localeCompare(b.tipoDocumento) : a.documentoId.localeCompare(b.documentoId)));
  const chave = `${campo}|${periodo ?? ""}|${fontesOrdenadas.map((f) => `${f.tipoDocumento}:${f.documentoId}`).join(",")}`;

  let hash = 0x811c9dc5;
  for (let i = 0; i < chave.length; i++) {
    hash ^= chave.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `conflito_${(hash >>> 0).toString(16)}`;
}

/**
 * Preferência EXPLÍCITA por campo — nunca uma hierarquia rígida universal
 * (ex.: "ECD > XML > PGDAS" para tudo seria errado: RBT12 é melhor vindo do
 * PGDAS-D, resultado contábil é melhor vindo do ECD). Usada pelo agregador
 * (Bloco J) só para resolver automaticamente (`status: "resolvido_regra"`)
 * quando o campo tem entrada aqui; campos sem entrada ficam `"pendente"` até
 * o usuário decidir.
 */
export const PREFERENCIA_POR_CAMPO: Partial<Record<string, TipoDocumento>> = {
  "tributario.premissas.rbt12": "pgdas",
  "tributario.premissas.aliquotaEfetivaSimples": "pgdas",
  "tributario.premissas.dasApurado": "pgdas",
  "tributario.premissas.anexoSimples": "pgdas",
  "receita.faturamentoAnual": "ecd",
  "tributario.premissas.receitaBrutaEcf": "ecf",
};

export function criarConflitoFonte(params: {
  campo: string;
  periodo?: string;
  valores: CampoExtraido<unknown>[];
  gravidade: ConflitoFonte["gravidade"];
  status: ConflitoFonte["status"];
  resolucao?: ConflitoFonte["resolucao"];
}): ConflitoFonte {
  const fontes = params.valores.map((v) => ({ tipoDocumento: v.tipoDocumento, documentoId: v.documentoId }));
  return {
    id: gerarIdConflito(params.campo, params.periodo, fontes),
    campo: params.campo,
    periodo: params.periodo,
    fontes,
    valores: params.valores,
    gravidade: params.gravidade,
    status: params.status,
    resolucao: params.resolucao,
  };
}

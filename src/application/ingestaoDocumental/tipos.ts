/**
 * Camada de ingestão documental — contrato comum (docs/ingestao-documental-v2.md).
 *
 * Esta pasta é ADITIVA e não altera `src/engine/` (nenhuma fórmula, nenhum motor
 * fiscal, nenhum tipo de `operacaoTributaria.ts` é modificado). A taxonomia de
 * proveniência aqui é DELIBERADAMENTE mais granular que `OrigemInformacao`
 * (engine/operacaoTributaria.ts) — o engine tributário não precisa conhecer
 * "pgdas"/"defis"/"contrato_social"/etc. A tradução para o vocabulário do
 * domínio acontece só na borda, em `proveniencia.ts` (`paraCampoComProveniencia`),
 * nunca dentro do engine.
 *
 * `qualidade` reaproveita `StatusInformacao` do domínio (não cria uma escala
 * paralela) — a granularidade nova é só de ORIGEM (de qual documento o dado
 * veio), não de confiabilidade.
 */
import type { StatusInformacao, CampoComProveniencia } from "../../engine/operacaoTributaria";

export type { StatusInformacao };

/** Tipo de documento aceito pela ingestão — cada um tem um adapter em `adapters/`. */
export type TipoDocumento =
  | "cnpj"
  | "contrato_social"
  | "pgdas"
  | "defis"
  | "xml_nfe"
  | "nfse"
  | "efd_icms_ipi"
  | "efd_contribuicoes"
  | "ecd"
  | "ecf"
  | "folha_fs12";

/** Um campo extraído de UM documento — preserva a proveniência granular (documento + tipo + período), nunca só o valor cru. */
export interface CampoExtraido<T> {
  valor: T;
  /** Confiabilidade do dado — reaproveita o vocabulário já existente do domínio, sem escala paralela. */
  status: StatusInformacao;
  documentoId: string;
  tipoDocumento: TipoDocumento;
  periodo?: string;
  /** Trecho/localização que sustenta o valor (ex.: rótulo encontrado no texto, registro SPED) — para auditoria humana, não para o motor. */
  evidencia?: string;
  observacao?: string;
}

export function campoExtraido<T>(
  valor: T,
  status: StatusInformacao,
  ctx: { documentoId: string; tipoDocumento: TipoDocumento; periodo?: string; evidencia?: string; observacao?: string },
): CampoExtraido<T> {
  return { valor, status, ...ctx };
}

export type GravidadeAlerta = "info" | "atencao" | "bloqueante";

export interface AlertaIngestao {
  codigo: string;
  mensagem: string;
  gravidade: GravidadeAlerta;
}

export interface InconsistenciaIngestao {
  campo: string;
  mensagem: string;
  gravidade: GravidadeAlerta;
}

export interface LimitacaoIngestao {
  descricao: string;
}

export interface ResultadoIngestaoDocumento {
  documentoId: string;
  tipoDocumento: TipoDocumento;
  periodo?: string;
  status: "processado" | "processado_com_ressalvas" | "falhou";
  camposExtraidos: CampoExtraido<unknown>[];
  alertas: AlertaIngestao[];
  inconsistencias: InconsistenciaIngestao[];
  limitacoes: LimitacaoIngestao[];
  metadados: { nomeArquivo: string; processadoEm: string; [chave: string]: unknown };
}

export type StatusConflito = "pendente" | "resolvido_usuario" | "resolvido_regra" | "desatualizado";

/**
 * Divergência de valor para o MESMO campo lógico do rascunho, vinda de mais de
 * uma fonte documental (ou de uma fonte documental contra um valor já
 * confirmado manualmente). Nunca resolvida silenciosamente — ver
 * `agregador.ts`. Persistido dentro de `RascunhoCenarioEmpresa.ingestao`
 * (decisão do usuário: conflitos sobrevivem a reload, sem exigir
 * reprocessamento dos documentos).
 */
export interface ConflitoFonte {
  /** Determinístico — mesmo campo+período+conjunto de fontes sempre gera o mesmo id (ver `gerarIdConflito`). Nunca usa timestamp/random. */
  id: string;
  /** Caminho lógico do campo no rascunho (ex.: "receita.faturamentoAnual", "receita.receitasPorNatureza.consultas"). */
  campo: string;
  periodo?: string;
  fontes: { tipoDocumento: TipoDocumento; documentoId: string }[];
  /** Nunca o documento bruto — só os campos já extraídos que estão em disputa. */
  valores: CampoExtraido<unknown>[];
  gravidade: GravidadeAlerta;
  status: StatusConflito;
  resolucao?: {
    /** "informado_usuario" quando o valor vigente vem de digitação manual anterior (não de um dos `valores` em disputa); senão, um dos candidatos de `valores`. */
    valorEscolhido: CampoExtraido<unknown> | "informado_usuario";
    motivo: string;
    resolvidoEm?: string;
  };
  /** Preserva a resolução anterior quando o conflito passa a "desatualizado" — nunca se perde uma decisão humana. */
  historico?: { status: StatusConflito; resolucao?: ConflitoFonte["resolucao"] }[];
}

/** Metadado leve de um documento já processado — nunca o conteúdo bruto do arquivo. Persistido em `RascunhoCenarioEmpresa.ingestao.documentosProcessados`. */
export interface MetadadoDocumentoProcessado {
  documentoId: string;
  tipoDocumento: TipoDocumento;
  nomeArquivo: string;
  periodo?: string;
  status: ResultadoIngestaoDocumento["status"];
  processadoEm: string;
}

/** Estado de ingestão persistido dentro do rascunho do Wizard V2 — ver Bloco K/`wizardEstrategico/tipos.ts`. */
export interface EstadoIngestaoRascunho {
  documentosProcessados: MetadadoDocumentoProcessado[];
  conflitos: ConflitoFonte[];
}

export function estadoIngestaoVazio(): EstadoIngestaoRascunho {
  return { documentosProcessados: [], conflitos: [] };
}

/** Reexportado para os adapters não precisarem importar de `engine/operacaoTributaria` diretamente por conveniência — mesmo tipo, mesma referência. */
export type { CampoComProveniencia };

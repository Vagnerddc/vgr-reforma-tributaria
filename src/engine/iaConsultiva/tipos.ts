/**
 * Contrato da IA Consultiva — fica SEMPRE depois de
 * `ResultadoDecisaoEstrategica` (motorDecisao), nunca antes (seção 1 do
 * pedido). A IA explica/contextualiza/comunica; nunca recalcula, nunca
 * decide, nunca altera `statusConclusao`/`naturezaConclusao`/
 * `alternativaPreferida`/`bloqueios`/`condicoes`/`qualidade`/`evidencias`/
 * `conflitos` (seção 2, regra inegociável).
 */

import type { QualidadeAchado } from "../motorAchados/tipos";
import type { StatusConclusao, NaturezaConclusao } from "../motorDecisao/tipos";

export type NivelComunicacao = "executiva" | "consultiva" | "tecnica";

export type StatusGeracao = "gerada" | "fallback" | "rejeitada" | "erro_provedor" | "indisponivel";

/** Controla o que é serializado para o provedor externo (seção 51) — nunca documentos brutos (XML/SPED/ECD/ECF), sempre resultados normalizados. */
export interface PoliticaDadosIa {
  permitirIdentificacaoEmpresa: boolean;
  permitirValoresFinanceiros: boolean;
  permitirDadosPessoais: boolean;
  anonimizar: boolean;
}

export const POLITICA_DADOS_PADRAO: PoliticaDadosIa = { permitirIdentificacaoEmpresa: false, permitirValoresFinanceiros: true, permitirDadosPessoais: false, anonimizar: true };

export interface EvidenciaContexto {
  id: string;
  descricao: string;
  valor?: number;
  unidade?: string;
}

export interface CondicaoContexto {
  id: string;
  descricao: string;
  variavel?: string;
  limite?: number;
}

export interface PontoViradaContexto {
  variavel: string;
  valorEncontrado?: number;
  estadoAntes?: string;
  estadoDepois?: string;
}

export interface TransicaoHorizonteContexto {
  anoAntes: number;
  anoDepois: number;
  alternativaAntes?: string;
  alternativaDepois?: string;
}

/**
 * Estrutura compacta e controlada enviada ao provedor (seção 7/8/9) —
 * nunca o estado inteiro da aplicação. Todo número relevante já vem
 * como campo estruturado (`EvidenciaContexto.valor`), nunca só texto —
 * a IA formata, não deriva (seção 9/35).
 */
export interface ContextoIaConsultiva {
  identificacaoAnalise: { cenarioId: string; objetoDecisao: string; ano: number };
  perfilSetorial?: string;
  statusConclusao: StatusConclusao;
  naturezaConclusao?: NaturezaConclusao;
  alternativaPreferida?: string;
  alternativasAvaliadas: string[];
  alternativasEquivalentes: string[];
  evidenciasFavoraveis: EvidenciaContexto[];
  evidenciasContrarias: EvidenciaContexto[];
  condicoes: CondicaoContexto[];
  bloqueios: { tipo: string; descricao: string }[];
  riscos: { tipo: string; descricao: string }[];
  validacoesPendentes: { tipo: string; descricao: string; bloqueante: boolean }[];
  conflitos: string[];
  qualidade: QualidadeAchado;
  pontosVirada: PontoViradaContexto[];
  horizonte?: { conclusaoHorizonte: string; transicoes: TransicaoHorizonteContexto[] };
}

export interface RequisicaoIaConsultiva {
  contexto: ContextoIaConsultiva;
  nivel: NivelComunicacao;
  promptVersion: string;
}

/**
 * Saída BRUTA do provedor — campos estruturados, nunca só uma string
 * livre (seção 10/40/41). `alternativaComunicada`/`qualidadeComunicada`/
 * `riscosComunicados` existem especificamente para permitir validação
 * estrutural pós-geração (guardrails.ts) sem depender de mineração de
 * texto livre.
 */
export interface RespostaBrutaIa {
  titulo: string;
  resumoExecutivo: string;
  explicacao: string;
  /** IDs de `EvidenciaContexto` já existentes no contexto — nunca criados pelo modelo (seção 42/43). */
  principaisEvidencias: string[];
  /** IDs de `CondicaoContexto` já existentes no contexto. */
  condicoesCitadas: string[];
  ressalvas: string[];
  validacoesPendentesCitadas: string[];
  pontosAtencao: string[];
  textoTecnico?: string;
  /** A alternativa que o texto efetivamente comunica como preferida — deve ser idêntica a `contexto.alternativaPreferida` (seção 2/80). */
  alternativaComunicada?: string;
  /** O rótulo de qualidade que o texto efetivamente comunica — nunca pode ser superior a `contexto.qualidade` (seção 62/82). */
  qualidadeComunicada?: QualidadeAchado;
  /** Riscos citados no texto — cada um deve corresponder a um risco real do contexto (seção 64/83). */
  riscosComunicados?: string[];
}

export interface RegistroAuditoriaIa {
  requestId: string;
  contextHash: string;
  resultadoDecisaoId: string;
  nivelComunicacao: NivelComunicacao;
  promptVersion: string;
  provider: string;
  model?: string;
  status: StatusGeracao;
  timestamp: string;
}

export interface RespostaIaConsultiva extends RespostaBrutaIa {
  nivel: NivelComunicacao;
  statusValidacao: StatusGeracao;
  motivosRejeicao?: string[];
  auditoria: RegistroAuditoriaIa;
}

/** Isola o domínio de qualquer provedor/modelo específico (seção 5/6). */
export interface ProvedorIaConsultiva {
  nome: string;
  modelo?: string;
  gerar(request: RequisicaoIaConsultiva): Promise<RespostaBrutaIa>;
}

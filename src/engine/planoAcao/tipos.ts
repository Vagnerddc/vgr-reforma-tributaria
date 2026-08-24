/**
 * Contrato do Plano de Ação Estruturado — operacionaliza o que já foi
 * sustentado por `ResultadoDecisaoEstrategica` (motorDecisao) e
 * `PlanoAlternativasEstrategicas` (motorEstrategico). NUNCA cria
 * estratégia nova, nunca recalcula tributo/Fator R/créditos/margem/
 * preço/capital de giro/custo financeiro/pontos de virada/
 * comparabilidade/decisão (seção 1/2 do pedido).
 */

import type { QualidadeAchado } from "../motorAchados/tipos";
import type { Bloqueio, Risco, ValidacaoNecessaria } from "../motorEstrategico/tipos";

export type { QualidadeAchado };

export type CategoriaAcao = "fiscal" | "creditos" | "fator_r" | "preco" | "capital_giro" | "custo_financeiro" | "regime" | "monitoramento";

export type TipoAcao = "validacao" | "analise" | "simulacao" | "formalizacao" | "monitoramento";

export type StatusAcao = "pendente" | "bloqueada" | "pronta" | "concluida" | "nao_aplicavel";

export type ResponsabilidadeSugerida = "contabil" | "fiscal" | "financeiro" | "juridico" | "comercial" | "gestao";

/**
 * Código estruturado — nunca texto livre como chave de negócio (seção
 * 5). Verbos operacionais (`VALIDAR_`/`SIMULAR_`/`FORMALIZAR_`/
 * `MONITORAR_`/`ACOMPANHAR_`/`REVISAR_`/`REAVALIAR_`/`EXECUTAR_`) são
 * permitidos — estamos criando ações; o que é proibido é prescrição
 * substantiva não sustentada (`AUMENTAR_PRO_LABORE`,
 * `CONTRATAR_EMPRESTIMO`, `MIGRAR_PARA_PRESUMIDO`, seção 86).
 */
export type CodigoAcao =
  | "VALIDAR_COBERTURA_TRIBUTARIA"
  | "VALIDAR_BASE_LUCRO_REAL"
  | "VALIDAR_PIS_COFINS"
  | "VALIDAR_PREMISSAS_SPLIT"
  | "VALIDAR_CUSTO_CAPITAL"
  | "VALIDAR_COMPOSICAO_FS12"
  | "VALIDAR_VIABILIDADE_COMERCIAL_REAJUSTE"
  | "VALIDAR_CLASSIFICACAO_CREDITOS"
  | "VALIDAR_PREMISSAS_FLUXO"
  | "VALIDAR_ENQUADRAMENTO_JURIDICO"
  | "VALIDAR_CRITERIOS_NAO_MENSURADOS"
  | "VALIDAR_PREMISSAS_CAIXA"
  | "REVISAR_ITENS_INDETERMINADOS"
  | "SIMULAR_CENARIO_FINAL"
  | "SIMULAR_FATOR_R_COM_DADOS_VALIDOS"
  | "SIMULAR_REPASSE_FINAL"
  | "SIMULAR_CREDITOS_CONFIRMADOS"
  | "SIMULAR_PICO_CAPITAL_GIRO"
  | "EXECUTAR_CENARIO_ADICIONAL"
  | "FORMALIZAR_DECISAO_TRIBUTARIA"
  | "FORMALIZAR_PLANEJAMENTO_NO_REGIME_OBRIGATORIO"
  | "ACOMPANHAR_PONTO_VIRADA"
  | "MONITORAR_FATOR_R"
  | "MONITORAR_CAPITAL_GIRO"
  | "REAVALIAR_REGIME_NO_HORIZONTE"
  | "ATUALIZAR_PREMISSAS";

/** Nunca inventada sem regra clara (seção 30) — "indefinida" é o valor correto na ausência de metodologia. */
export type PeriodicidadeMonitoramento = "mensal" | "trimestral" | "anual" | "indefinida";

export interface GatilhoMonitoramento {
  variavel: string;
  operador: "menor_que" | "maior_que" | "maior_ou_igual_a" | "menor_ou_igual_a" | "igual_a";
  valorReferencia: number;
  unidade?: string;
  periodicidadeSugerida: PeriodicidadeMonitoramento;
  origem: string;
}

export interface EvidenciaAcao {
  descricao: string;
  valor?: number;
  unidade?: string;
  origem: string;
}

export interface AcaoEstruturada {
  id: string;
  codigo: CodigoAcao;
  categoria: CategoriaAcao;
  titulo: string;
  descricaoTecnica: string;
  origens: string[];
  achadosOrigem: string[];
  alternativasOrigem: string[];
  decisoesOrigem: string[];
  objetivo: string;
  tipo: TipoAcao;
  status: StatusAcao;
  /** IDs de outras `AcaoEstruturada` desta mesma execução — nunca cria dependência com uma ação de outro plano/execução. */
  dependeDe: string[];
  bloqueios: Bloqueio[];
  riscos: Risco[];
  condicoes: string[];
  validacoesNecessarias: ValidacaoNecessaria[];
  evidencias: EvidenciaAcao[];
  responsabilidadeSugerida: ResponsabilidadeSugerida[];
  periodoAplicavel?: { ano: number };
  resultadoEsperado: string;
  criterioConclusao: string;
  qualidade: QualidadeAchado;
  premissas: Record<string, unknown>;
  gatilho?: GatilhoMonitoramento;
}

export interface EtapaPlano {
  numero: number;
  acoes: string[]; // AcaoEstruturada.id[]
}

export type StatusPlano = "pronto_para_validacao" | "bloqueado" | "parcial" | "pronto_para_formalizacao" | "sem_acoes";

export interface CoberturaPlanoAcao {
  fiscal: "analisado" | "nao_aplicavel" | "indisponivel";
  preco: "analisado" | "nao_aplicavel" | "indisponivel";
  creditos: "analisado" | "nao_aplicavel" | "indisponivel";
  fatorR: "analisado" | "nao_aplicavel" | "indisponivel";
  caixa: "analisado" | "nao_aplicavel" | "indisponivel";
  regime: "analisado" | "nao_aplicavel" | "indisponivel";
  monitoramento: "analisado" | "nao_aplicavel" | "indisponivel";
}

export interface PlanoAcaoEstruturado {
  cenarioId: string;
  decisaoId: string;
  statusDecisao: string;
  acoes: AcaoEstruturada[];
  etapas: EtapaPlano[];
  bloqueiosGlobais: Bloqueio[];
  condicoesGlobais: string[];
  gatilhosMonitoramento: GatilhoMonitoramento[];
  cobertura: CoberturaPlanoAcao;
  qualidade: QualidadeAchado;
  status: StatusPlano;
}

/** Erro estruturado de ciclo (seção 35) — nunca um plano parcialmente montado é devolvido como se fosse válido. */
export class CicloDependenciaError extends Error {
  nosCiclo: string[];
  constructor(nosCiclo: string[]) {
    super(`Ciclo de dependência detectado entre ações: ${nosCiclo.join(" -> ")}`);
    this.nosCiclo = nosCiclo;
  }
}

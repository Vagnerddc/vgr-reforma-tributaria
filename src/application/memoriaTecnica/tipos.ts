/**
 * Contratos da Memória Técnica / Auditabilidade. Esta camada NUNCA
 * recalcula — apenas reconstrói e apresenta a trilha de auditoria dos
 * resultados já produzidos pelos motores determinísticos.
 */

export const NAO_INFORMADO = "não informado";

export type CategoriaMemoriaTecnica = "fiscal" | "economico" | "caixa" | "decisao" | "score" | "pontos_virada" | "plano_acao" | "otimizacao" | "execucao";

export type OrigemResultadoMemoria =
  | "motor_regime"
  | "motor_financeiro"
  | "motor_caixa"
  | "motor_decisao"
  | "motor_score"
  | "motor_pontos_virada"
  | "motor_otimizacao"
  | "motor_plano_acao"
  | "orquestrador_execucao"
  | "adapter_legado";

export type StatusItemMemoria = "calculado" | "indisponivel" | "nao_aplicavel" | "parcial";

export interface ItemMemoriaTecnica {
  id: string;
  codigo: string;
  categoria: CategoriaMemoriaTecnica;
  titulo: string;
  descricao: string;

  valor?: number;
  unidade?: string;

  periodo?: { ano: number };
  regime?: string;
  atividadeId?: string;

  origemResultado: OrigemResultadoMemoria;
  /** Origem do dado (proveniência) — não misturar com origem do cálculo (seção 13). */
  origemInformacao: string;
  /** Origem do cálculo (motor_oficial/motor_vgr) — não misturar com origem do dado (seção 12). */
  origemCalculo: string;

  motor: string;
  motorVersao?: string;

  metodologia?: string;
  metodologiaVersao?: string;

  status: StatusItemMemoria;
  /** Qualidade reaproveitada do contrato de origem — nunca promovida (seção 16/17). */
  qualidade: string;

  premissas: string[];
  evidencias: string[];
  fundamentos: string[];
  dependencias: string[];
  limitacoes: string[];
}

export interface PremissaMemoriaTecnica {
  id: string;
  descricao: string;
  itensRelacionados: string[];
}

export interface MetodologiaMemoriaTecnica {
  id: string;
  versao: string;
  aplicavelA: string[];
}

export interface IaMetadadoMemoriaTecnica {
  status: string;
  promptVersion: string;
  contextHash: string;
  origem: string;
}

export interface MemoriaTecnicaAnalise {
  analiseId: string;
  cenarioId: string;
  contextHash: string;
  periodo: { ano: number };

  resumoCobertura: Record<string, string>;
  itens: ItemMemoriaTecnica[];
  premissas: PremissaMemoriaTecnica[];
  fontes: string[];
  metodologias: MetodologiaMemoriaTecnica[];
  limitacoes: string[];

  auditoriaExecucao: {
    duracaoMs: number;
    etapasExecutadas: string[];
    etapasIndisponiveis: string[];
    erros: { etapa: string; mensagem: string }[];
  };

  iaMetadado?: IaMetadadoMemoriaTecnica;
}

/**
 * Wizard Estratégico V2 — produz `CenarioEmpresa` diretamente, sem
 * `DadosApuradosCliente` nem adapter legado. O rascunho espelha a
 * estrutura do cenário (mesmos tipos, todos opcionais) e acrescenta
 * apenas o que é exclusivo da experiência de captura/execução —
 * seleção de regimes a comparar, premissas de split (não fazem parte
 * do domínio, são opção de `executarAnaliseEstrategica`), otimização e
 * pontos de virada a investigar.
 */
import type { IdentificacaoEmpresa, ReceitaEmpresa, PessoasEmpresa, TributarioEmpresa, EconomicoFinanceiroEmpresa, DadosSetoriais } from "../../engine/cenarioEmpresa";
import type { GastoInformado } from "../../engine/creditoTributario";
import type { PremissasSplitPayment } from "../../engine/motorFinanceiro/splitPayment/tipos";
import type { VariavelOtimizacao, Objetivo } from "../../engine/otimizacaoMultidimensional/tipos";
import type { DefinicaoPontoVirada } from "../../engine/motorPontosVirada/tipos";
import type { Regime } from "../../engine/types";
import type { EstadoIngestaoRascunho } from "../../application/ingestaoDocumental/tipos";
import { estadoIngestaoVazio } from "../../application/ingestaoDocumental/tipos";

export type EtapaWizardId = "documentos" | "empresa" | "atividades" | "receita" | "custosCreditos" | "pessoasFs12" | "fiscal" | "caixaSplit" | "premissasEstrategicas" | "revisao";

export const ETAPAS_WIZARD: { id: EtapaWizardId; titulo: string }[] = [
  { id: "documentos", titulo: "Documentos" },
  { id: "empresa", titulo: "Empresa" },
  { id: "atividades", titulo: "Atividades" },
  { id: "receita", titulo: "Receita" },
  { id: "custosCreditos", titulo: "Custos e Créditos" },
  { id: "pessoasFs12", titulo: "Pessoas / FS12" },
  { id: "fiscal", titulo: "Regimes e Dados Fiscais" },
  { id: "caixaSplit", titulo: "Caixa / Split" },
  { id: "premissasEstrategicas", titulo: "Premissas Estratégicas" },
  { id: "revisao", titulo: "Revisão e Qualidade" },
];

export type StatusEtapaWizard = "incompleta" | "completa" | "com_ressalvas" | "nao_aplicavel";

/** Ponto de virada a investigar, sem `cenarioBase`/`motoresRegime` — preenchidos na conversão, igual à opção aceita por `executarAnaliseEstrategica`. */
export type PontoViradaRascunho = Omit<DefinicaoPontoVirada, "cenarioBase" | "motoresRegime">;

export interface OtimizacaoRascunho {
  habilitada: boolean;
  variaveis: VariavelOtimizacao[];
  objetivos: Objetivo[];
}

export interface RascunhoCenarioEmpresa {
  id: string;
  identificacao: IdentificacaoEmpresa;
  receita: ReceitaEmpresa;
  custos: { itens: GastoInformado[] };
  pessoas: PessoasEmpresa;
  tributario: TributarioEmpresa;
  economicoFinanceiro: EconomicoFinanceiroEmpresa;
  dadosSetoriais: DadosSetoriais[];

  /** Regimes a considerar na comparação — selecionar não é declarar elegibilidade (seção 33). */
  regimesSelecionados: Regime[];
  ano?: number;
  incluirHorizonte: boolean;

  /** Só existe quando o usuário quer analisar caixa/split (seção 37) — ausência não bloqueia a análise. */
  analisarCaixa: boolean;
  premissasSplit?: PremissasSplitPayment;

  otimizacao: OtimizacaoRascunho;
  pontosVirada: PontoViradaRascunho[];

  etapasVisitadas: Partial<Record<EtapaWizardId, boolean>>;

  /**
   * Estado da ingestão documental (docs/ingestao-documental-v2.md) — opcional
   * para retrocompatibilidade com rascunhos salvos antes desta fase (ver
   * `ehRascunhoValidoEstruturalmente` em `validacao.ts`: ausência é tratada
   * como `estadoIngestaoVazio()`, nunca como erro estrutural). Nunca contém o
   * conteúdo bruto de nenhum documento — só metadados leves e conflitos.
   */
  ingestao?: EstadoIngestaoRascunho;
}

export function criarRascunhoVazio(id: string): RascunhoCenarioEmpresa {
  return {
    id,
    identificacao: {},
    receita: {},
    custos: { itens: [] },
    pessoas: {},
    tributario: {},
    economicoFinanceiro: {},
    dadosSetoriais: [],
    regimesSelecionados: [],
    incluirHorizonte: false,
    analisarCaixa: false,
    otimizacao: { habilitada: false, variaveis: [], objetivos: [] },
    pontosVirada: [],
    etapasVisitadas: {},
    ingestao: estadoIngestaoVazio(),
  };
}

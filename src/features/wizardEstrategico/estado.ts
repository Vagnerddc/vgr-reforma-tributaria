import { useEffect, useReducer } from "react";
import type { IdentificacaoEmpresa, ReceitaEmpresa, PessoasEmpresa, TributarioEmpresa, EconomicoFinanceiroEmpresa, DadosSetoriais } from "../../engine/cenarioEmpresa";
import type { GastoInformado } from "../../engine/creditoTributario";
import type { PremissasSplitPayment } from "../../engine/motorFinanceiro/splitPayment/tipos";
import type { Regime } from "../../engine/types";
import type { EtapaWizardId, OtimizacaoRascunho, PontoViradaRascunho, RascunhoCenarioEmpresa } from "./tipos";
import { criarRascunhoVazio } from "./tipos";
import type { ResultadoAgregacaoIngestao } from "../../application/ingestaoDocumental/agregador";
import { aplicarValor } from "../../application/ingestaoDocumental/agregador";
import type { CampoExtraido } from "../../application/ingestaoDocumental/tipos";
import { estadoIngestaoVazio } from "../../application/ingestaoDocumental/tipos";
import { paraCampoComProveniencia } from "../../application/ingestaoDocumental/proveniencia";
import { campoManual } from "./components/campoManual";
import type { CampoComProveniencia } from "../../engine/operacaoTributaria";

type CampoComProvenienciaResolucao = CampoComProveniencia<unknown>;

export type AcaoWizard =
  | { tipo: "atualizarIdentificacao"; valores: Partial<IdentificacaoEmpresa> }
  | { tipo: "atualizarReceita"; valores: Partial<ReceitaEmpresa> }
  | { tipo: "atualizarPessoas"; valores: Partial<PessoasEmpresa> }
  | { tipo: "atualizarTributario"; valores: Partial<TributarioEmpresa> }
  | { tipo: "atualizarEconomicoFinanceiro"; valores: Partial<EconomicoFinanceiroEmpresa> }
  | { tipo: "definirCustos"; itens: GastoInformado[] }
  | { tipo: "definirDadosSetoriais"; dados: DadosSetoriais[] }
  | { tipo: "definirRegimesSelecionados"; regimes: Regime[] }
  | { tipo: "definirAno"; ano?: number }
  | { tipo: "definirIncluirHorizonte"; valor: boolean }
  | { tipo: "definirAnalisarCaixa"; valor: boolean }
  | { tipo: "definirPremissasSplit"; premissas?: PremissasSplitPayment }
  | { tipo: "definirOtimizacao"; otimizacao: OtimizacaoRascunho }
  | { tipo: "definirPontosVirada"; pontos: PontoViradaRascunho[] }
  | { tipo: "marcarEtapaVisitada"; etapa: EtapaWizardId }
  | { tipo: "substituirRascunho"; rascunho: RascunhoCenarioEmpresa }
  | { tipo: "reiniciar"; id: string }
  /** Aplica o resultado do agregador de ingestão (Bloco J) — preserva `id`/`etapasVisitadas` da sessão atual, nunca é um `substituirRascunho` cru. */
  | { tipo: "aplicarResultadoIngestao"; resultado: ResultadoAgregacaoIngestao }
  /** Usuário resolve um `ConflitoFonte` pendente/desatualizado — grava a escolha com rastreabilidade, nunca perde a origem original (ela permanece em `conflito.valores`/`historico`). */
  | { tipo: "resolverConflitoIngestao"; conflitoId: string; valorEscolhido: CampoExtraido<unknown> | { digitado: unknown }; motivo: string };

export function reducerWizard(rascunho: RascunhoCenarioEmpresa, acao: AcaoWizard): RascunhoCenarioEmpresa {
  switch (acao.tipo) {
    case "atualizarIdentificacao":
      return { ...rascunho, identificacao: { ...rascunho.identificacao, ...acao.valores } };
    case "atualizarReceita":
      return { ...rascunho, receita: { ...rascunho.receita, ...acao.valores } };
    case "atualizarPessoas":
      return { ...rascunho, pessoas: { ...rascunho.pessoas, ...acao.valores } };
    case "atualizarTributario":
      return { ...rascunho, tributario: { ...rascunho.tributario, ...acao.valores } };
    case "atualizarEconomicoFinanceiro":
      return { ...rascunho, economicoFinanceiro: { ...rascunho.economicoFinanceiro, ...acao.valores } };
    case "definirCustos":
      return { ...rascunho, custos: { itens: acao.itens } };
    case "definirDadosSetoriais":
      return { ...rascunho, dadosSetoriais: acao.dados };
    case "definirRegimesSelecionados":
      return { ...rascunho, regimesSelecionados: acao.regimes };
    case "definirAno":
      return { ...rascunho, ano: acao.ano };
    case "definirIncluirHorizonte":
      return { ...rascunho, incluirHorizonte: acao.valor };
    case "definirAnalisarCaixa":
      return { ...rascunho, analisarCaixa: acao.valor, premissasSplit: acao.valor ? rascunho.premissasSplit : undefined };
    case "definirPremissasSplit":
      return { ...rascunho, premissasSplit: acao.premissas };
    case "definirOtimizacao":
      return { ...rascunho, otimizacao: acao.otimizacao };
    case "definirPontosVirada":
      return { ...rascunho, pontosVirada: acao.pontos };
    case "marcarEtapaVisitada":
      return { ...rascunho, etapasVisitadas: { ...rascunho.etapasVisitadas, [acao.etapa]: true } };
    case "substituirRascunho":
      return acao.rascunho;
    case "reiniciar":
      return criarRascunhoVazio(acao.id);

    case "aplicarResultadoIngestao":
      // Preserva id/etapasVisitadas da sessão atual — o resultado do agregador já traz `ingestao.conflitos`
      // recalculado (Bloco J), mas não deve resetar a navegação do usuário no wizard.
      return { ...acao.resultado.rascunho, id: rascunho.id, etapasVisitadas: rascunho.etapasVisitadas };

    case "resolverConflitoIngestao": {
      const conflitos = (rascunho.ingestao ?? estadoIngestaoVazio()).conflitos;
      const conflito = conflitos.find((c) => c.id === acao.conflitoId);
      if (!conflito) return rascunho;

      const valorEscolhido: CampoComProvenienciaResolucao =
        "digitado" in acao.valorEscolhido ? campoManual(acao.valorEscolhido.digitado) : paraCampoComProveniencia(acao.valorEscolhido);

      const rascunhoComValor = structuredClone(rascunho);
      aplicarValor(rascunhoComValor, conflito.campo, valorEscolhido);

      const conflitoResolvido = {
        ...conflito,
        status: "resolvido_usuario" as const,
        resolucao: { valorEscolhido: "digitado" in acao.valorEscolhido ? ("informado_usuario" as const) : acao.valorEscolhido, motivo: acao.motivo, resolvidoEm: new Date().toISOString() },
      };

      return {
        ...rascunhoComValor,
        ingestao: { ...(rascunhoComValor.ingestao ?? estadoIngestaoVazio()), conflitos: conflitos.map((c) => (c.id === acao.conflitoId ? conflitoResolvido : c)) },
      };
    }
  }
}

export const CHAVE_LOCALSTORAGE_WIZARD_V2 = "wizardEstrategicoV2:v1";

export function ehRascunhoValidoEstruturalmente(valor: unknown): valor is RascunhoCenarioEmpresa {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Record<string, unknown>;
  const custos = v.custos as Record<string, unknown> | undefined;
  return typeof v.id === "string" && typeof v.identificacao === "object" && typeof v.receita === "object" && typeof custos === "object" && Array.isArray(custos?.itens) && Array.isArray(v.regimesSelecionados) && typeof v.otimizacao === "object" && Array.isArray(v.pontosVirada);
}

export function carregarRascunhoSalvo(idPadrao: string): RascunhoCenarioEmpresa {
  try {
    const bruto = typeof localStorage !== "undefined" ? localStorage.getItem(CHAVE_LOCALSTORAGE_WIZARD_V2) : null;
    if (!bruto) return criarRascunhoVazio(idPadrao);
    const parsed = JSON.parse(bruto);
    if (!ehRascunhoValidoEstruturalmente(parsed)) return criarRascunhoVazio(idPadrao);
    // Retrocompatibilidade: rascunhos salvos antes desta fase não têm `ingestao` — migração implícita, nunca um erro estrutural.
    return parsed.ingestao ? parsed : { ...parsed, ingestao: estadoIngestaoVazio() };
  } catch {
    return criarRascunhoVazio(idPadrao);
  }
}

export function salvarRascunho(rascunho: RascunhoCenarioEmpresa): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CHAVE_LOCALSTORAGE_WIZARD_V2, JSON.stringify(rascunho));
  } catch {
    // localStorage indisponível (modo privado, quota excedida) — rascunho permanece válido em memória.
  }
}

export function useWizardEstrategico(idInicial: string) {
  const [rascunho, dispatch] = useReducer(reducerWizard, undefined, () => carregarRascunhoSalvo(idInicial));

  useEffect(() => {
    salvarRascunho(rascunho);
  }, [rascunho]);

  return { rascunho, dispatch };
}

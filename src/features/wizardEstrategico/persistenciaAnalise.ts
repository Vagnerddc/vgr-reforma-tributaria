/**
 * Persistência da análise V2 — corrige a dependência exclusiva de
 * `location.state` (que se perde num reload). Persiste o rascunho que
 * originou a análise (cenário + opções de execução), NUNCA a
 * `AnaliseEstrategicaCompleta` em si — o resultado é sempre
 * reexecutado a partir da entrada guardada, o que elimina o risco de
 * um snapshot de resultado ficar obsoleto/dessincronizado do domínio
 * (seção 37 do pedido). Chave própria, distinta da chave do rascunho
 * em edição (`wizardEstrategicoV2:v1`) — nunca a mesma (seção 40).
 */
import type { RascunhoCenarioEmpresa } from "./tipos";
import { ehRascunhoValidoEstruturalmente } from "./estado";

export const CHAVE_LOCALSTORAGE_ANALISE_V2 = "analiseEstrategicaV2:v1";

export interface SnapshotAnaliseV2 {
  origemCenario: "wizard_v2";
  entrada: RascunhoCenarioEmpresa;
  /** Só informativo (exibição) — nunca usado no contextHash nem em qualquer lógica de comparação/validação (seção 47). */
  criadoEm: string;
}

function ehSnapshotValidoEstruturalmente(valor: unknown): valor is SnapshotAnaliseV2 {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Record<string, unknown>;
  return v.origemCenario === "wizard_v2" && ehRascunhoValidoEstruturalmente(v.entrada) && typeof v.criadoEm === "string";
}

export type StatusSnapshotAnalise = "ausente" | "valido" | "invalido";

function lerBruto(): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(CHAVE_LOCALSTORAGE_ANALISE_V2) : null;
  } catch {
    return null;
  }
}

export function statusSnapshotAnalise(): StatusSnapshotAnalise {
  const bruto = lerBruto();
  if (!bruto) return "ausente";
  try {
    return ehSnapshotValidoEstruturalmente(JSON.parse(bruto)) ? "valido" : "invalido";
  } catch {
    return "invalido";
  }
}

/** Nunca lança e nunca confia cegamente no JSON — snapshot corrompido ou de outra origem retorna `undefined` (seção 42/43). */
export function carregarSnapshotAnalise(): SnapshotAnaliseV2 | undefined {
  const bruto = lerBruto();
  if (!bruto) return undefined;
  try {
    const parsed = JSON.parse(bruto);
    return ehSnapshotValidoEstruturalmente(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function salvarSnapshotAnalise(entrada: RascunhoCenarioEmpresa): void {
  try {
    if (typeof localStorage === "undefined") return;
    const snapshot: SnapshotAnaliseV2 = { origemCenario: "wizard_v2", entrada, criadoEm: new Date().toISOString() };
    localStorage.setItem(CHAVE_LOCALSTORAGE_ANALISE_V2, JSON.stringify(snapshot));
  } catch {
    // localStorage indisponível (modo privado, quota) — a análise ainda funciona nesta navegação via location.state.
  }
}

/** Ação explícita "Nova análise" (seção 51) — nunca limpa o rascunho em edição (seção 52), só o snapshot já executado. */
export function limparSnapshotAnalise(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(CHAVE_LOCALSTORAGE_ANALISE_V2);
  } catch {
    // ignorar — não há estado a limpar de qualquer forma.
  }
}

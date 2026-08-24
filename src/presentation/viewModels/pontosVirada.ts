/**
 * ViewModel de Pontos de Virada — consome `ResultadoPontoVirada`
 * (motorPontosVirada), sem recalcular limiar nenhum. Nunca transforma
 * fronteira em previsão (seção 23): o texto é sempre condicional
 * ("abaixo/acima desse nível"), nunca afirmativo sobre o futuro.
 * Múltiplos pontos da mesma variável são todos preservados (seção 29).
 */

import type { ResultadoPontoVirada, StatusPontoVirada } from "../../engine/motorPontosVirada/tipos";

const UNIDADE_POR_VARIAVEL: Record<string, "reais" | "percentual" | "indice"> = {
  faturamento: "reais",
  crescimento: "percentual",
  creditosIbsCbs: "indice",
  custosFixos: "indice",
  folha: "reais",
  custoCapital: "percentual",
  percentualRecebimentosSujeitosSplit: "percentual",
  percentualTributoSegregadoSplit: "percentual",
};

export interface EvidenciaPontoViradaViewModel {
  descricao: string;
  origem: string;
}

export interface PontoViradaViewModel {
  id: string;
  tipo: string;
  variavel: string;
  status: StatusPontoVirada;
  valorReferencia?: number;
  unidade: "reais" | "percentual" | "indice";
  antes?: string;
  depois?: string;
  intervaloIndeterminado?: { min: number; max: number };
  periodo?: { ano: number };
  qualidade: string;
  evidencias: EvidenciaPontoViradaViewModel[];
  outrosPontos?: { min: number; max: number }[]; // status "multiplos_pontos" — cada intervalo candidato, nenhum privilegiado.
}

/** Ordenação executiva (seção 30): nunca inventa um score de importância — só período (quando houver) e depois variável, como critério estável e determinístico. */
function ordenar(pontos: PontoViradaViewModel[]): PontoViradaViewModel[] {
  return [...pontos].sort((a, b) => {
    const anoA = a.periodo?.ano ?? Number.MAX_SAFE_INTEGER;
    const anoB = b.periodo?.ano ?? Number.MAX_SAFE_INTEGER;
    if (anoA !== anoB) return anoA - anoB;
    return a.variavel.localeCompare(b.variavel);
  });
}

export function construirPontosViradaViewModel(pontos: ResultadoPontoVirada[], ano: number): PontoViradaViewModel[] {
  const vms = pontos.map((p, i) => ({
    id: `${p.tipo}:${p.variavel}:${i}`,
    tipo: p.tipo,
    variavel: p.variavel,
    status: p.status,
    valorReferencia: p.status === "encontrado" ? p.valorEncontrado : undefined,
    unidade: UNIDADE_POR_VARIAVEL[p.variavel] ?? "indice",
    antes: p.estadoAntes?.estadoCategorico,
    depois: p.estadoDepois?.estadoCategorico,
    intervaloIndeterminado: p.status === "resultado_indeterminado" || p.status === "dados_insuficientes" ? p.intervaloFinal && { min: p.intervaloFinal[0], max: p.intervaloFinal[1] } : undefined,
    periodo: { ano },
    qualidade: p.qualidade,
    evidencias: p.alertas.map((a) => ({ descricao: a, origem: "motor_pontos_virada" })),
    outrosPontos: p.status === "multiplos_pontos" ? p.outrosPontos?.map((o) => ({ min: o.intervalo[0], max: o.intervalo[1] })) : undefined,
  }));

  return ordenar(vms);
}

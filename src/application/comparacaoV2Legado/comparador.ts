/**
 * Funções de comparação compostas manualmente por caso de teste — não
 * um "diff automático" de todo o objeto (isso seria frágil e
 * confundiria diferença de metadado com divergência material). Cada
 * caso escolhe explicitamente quais métricas comparar, com qual
 * tolerância e com qual explicação de cobertura, exatamente como o
 * pedido descreve nos exemplos de "relatório por caso".
 */
import type { ClassificacaoDivergencia, DivergenciaCampo, ResultadoComparacaoFluxos } from "./tipos";
import { valoresMonetariosEquivalentes, percentuaisEquivalentes } from "./tolerancias";

export type TipoMetrica = "monetario" | "percentual" | "texto";

export interface OpcoesComparacaoMetrica {
  tipo: TipoMetrica;
  /** Preenchido quando a ausência do valor no legado é esperada por cobertura menor (ex.: "Legado não captura FS12"). */
  motivoCoberturaV2?: string;
}

/**
 * Compara uma única métrica entre os dois fluxos. `undefined` nunca é
 * tratado como `0` — ausência é ausência (seção 67/87 dos pedidos
 * anteriores, reafirmado aqui).
 */
export function compararMetrica(campo: string, valorLegado: number | string | undefined, valorV2: number | string | undefined, opcoes: OpcoesComparacaoMetrica): DivergenciaCampo {
  if (valorLegado === undefined && valorV2 === undefined) {
    return { campo, valorLegado, valorV2, classificacao: "equivalente" };
  }

  // Ausência de um lado só (undefined) é o caso mais comum de cobertura menor no legado.
  if (valorLegado === undefined || valorV2 === undefined) {
    if (opcoes.motivoCoberturaV2) {
      return { campo, valorLegado, valorV2, classificacao: "esperada_por_maior_cobertura_v2", explicacao: opcoes.motivoCoberturaV2 };
    }
    return { campo, valorLegado, valorV2, classificacao: "divergencia_material", explicacao: "Um dos fluxos produziu o indicador e o outro não, sem cobertura declarada que explique a ausência." };
  }

  let equivalentes: boolean;
  if (opcoes.tipo === "monetario") equivalentes = valoresMonetariosEquivalentes(valorLegado as number, valorV2 as number);
  else if (opcoes.tipo === "percentual") equivalentes = percentuaisEquivalentes(valorLegado as number, valorV2 as number);
  else equivalentes = valorLegado === valorV2;

  if (equivalentes) return { campo, valorLegado, valorV2, classificacao: "equivalente" };

  // Ambos os lados têm valor, mas diferem — só é "esperada por cobertura" quando o chamador declara
  // EXPLICITAMENTE o motivo (ex.: "indisponivel" vs "disponivel", "0 itens classificados" vs "1 item").
  // Nunca é inferido automaticamente — a justificativa fica registrada em `explicacao` (seção 5/88).
  if (opcoes.motivoCoberturaV2) {
    return { campo, valorLegado, valorV2, classificacao: "esperada_por_maior_cobertura_v2", explicacao: opcoes.motivoCoberturaV2 };
  }

  return { campo, valorLegado, valorV2, classificacao: "divergencia_material" };
}

/** Metadados de origem/identidade nunca contam como divergência material (seção 8) — usar para descartar campos como `origemCenario`, `id`. */
export function metadadoIgnorado(campo: string, valorLegado: unknown, valorV2: unknown): DivergenciaCampo {
  return { campo, valorLegado, valorV2, classificacao: "equivalente", explicacao: "Metadado de origem/identidade — divergência esperada e irrelevante para o resultado." };
}

export function classificarConjunto(divergencias: DivergenciaCampo[]): ClassificacaoDivergencia {
  if (divergencias.length === 0) return "nao_comparavel";
  if (divergencias.some((d) => d.classificacao === "divergencia_material")) return "divergencia_material";
  if (divergencias.some((d) => d.classificacao === "nao_comparavel")) return "nao_comparavel";
  if (divergencias.some((d) => d.classificacao === "esperada_por_maior_cobertura_v2")) return "esperada_por_maior_cobertura_v2";
  return "equivalente";
}

export function construirResultadoComparacao(opcoes: {
  casoId: string;
  divergenciasEntrada: DivergenciaCampo[];
  divergenciasResultado: DivergenciaCampo[];
  perdasLegado?: string[];
  ganhosCoberturaV2?: string[];
}): ResultadoComparacaoFluxos {
  const todas = [...opcoes.divergenciasEntrada, ...opcoes.divergenciasResultado];
  const classificacao = classificarConjunto(todas);
  const impactosMateriais = todas.filter((d) => d.classificacao === "divergencia_material").map((d) => `${d.campo}: legado=${JSON.stringify(d.valorLegado)} v2=${JSON.stringify(d.valorV2)}`);

  const rotuloClassificacao: Record<ClassificacaoDivergencia, string> = {
    equivalente: "EQUIVALENTE",
    esperada_por_maior_cobertura_v2: "ESPERADA_POR_MAIOR_COBERTURA_V2",
    divergencia_material: "DIVERGENCIA_MATERIAL",
    nao_comparavel: "NAO_COMPARAVEL",
  };

  const conclusaoComparativa =
    classificacao === "divergencia_material"
      ? `Divergência material detectada em: ${impactosMateriais.join("; ")}.`
      : classificacao === "esperada_por_maior_cobertura_v2"
        ? "Divergência explicada integralmente por maior cobertura de dados no V2 — não é regressão."
        : classificacao === "nao_comparavel"
          ? "Caso sem métricas comparáveis entre os dois fluxos."
          : "Os dois fluxos convergem dentro das tolerâncias definidas.";

  return {
    casoId: opcoes.casoId,
    classificacao,
    divergenciasEntrada: opcoes.divergenciasEntrada,
    divergenciasResultado: opcoes.divergenciasResultado,
    perdasLegado: opcoes.perdasLegado ?? [],
    ganhosCoberturaV2: opcoes.ganhosCoberturaV2 ?? [],
    impactosMateriais,
    conclusaoComparativa: `[${rotuloClassificacao[classificacao]}] ${conclusaoComparativa}`,
  };
}

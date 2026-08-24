import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica, StatusItemMemoria } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

function mapStatus(status: string): StatusItemMemoria {
  if (status === "encontrado") return "calculado";
  if (status === "dados_insuficientes") return "indisponivel";
  return "parcial";
}

export function construirItensPontosVirada(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const pontos = analise.pontosVirada ?? [];

  return pontos.map((ponto, indice) => {
    const id = `ponto_virada:${ponto.tipo}:${ponto.variavel}:${analise.ano}:${String(indice).padStart(2, "0")}`;
    const antesDepois = ponto.estadoAntes && ponto.estadoDepois ? ` Antes: ${ponto.estadoAntes.valor}. Depois: ${ponto.estadoDepois.valor}.` : "";

    return {
      id,
      codigo: id,
      categoria: "pontos_virada",
      titulo: `Ponto de virada — ${ponto.tipo}`,
      descricao: `Variável ${ponto.variavel}. Status: ${ponto.status}. Método: ${ponto.origemSolucao}. Precisão: ${ponto.precisao}.${antesDepois}`,
      valor: ponto.valorEncontrado,
      periodo: { ano: analise.ano },
      origemResultado: "motor_pontos_virada",
      origemInformacao: NAO_INFORMADO,
      origemCalculo: NAO_INFORMADO,
      motor: "motorPontosVirada",
      status: mapStatus(ponto.status),
      qualidade: ponto.qualidade,
      premissas: Object.keys(ponto.premissas ?? {}),
      evidencias: (ponto.achados ?? []).map((a) => a.descricao),
      fundamentos: [],
      dependencias: [],
      limitacoes: ponto.alertas ?? [],
    };
  });
}

import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ItemMemoriaTecnica } from "../tipos";
import { NAO_INFORMADO } from "../tipos";

export function construirItensFiscais(analise: AnaliseEstrategicaCompleta): ItemMemoriaTecnica[] {
  const itens: ItemMemoriaTecnica[] = [];
  const resultadoRegimes = analise.resultadoCenario?.resultadoRegimes ?? [];

  for (const resultado of resultadoRegimes) {
    const anoRegime = resultado.anos.find((a) => a.ano === analise.ano);
    if (!anoRegime) continue;

    const idCarga = `fiscal:${resultado.regime}:${analise.ano}:carga_total`;
    itens.push({
      id: idCarga,
      codigo: idCarga,
      categoria: "fiscal",
      titulo: "Carga tributária total",
      descricao: `Carga tributária consolidada do regime ${resultado.regime} no ano ${analise.ano}.`,
      valor: anoRegime.disponivel ? anoRegime.cargaTotal : undefined,
      unidade: "reais",
      periodo: { ano: analise.ano },
      regime: resultado.regime,
      origemResultado: "motor_regime",
      origemInformacao: NAO_INFORMADO,
      origemCalculo: resultado.qualidade.origemIbsCbs,
      motor: "motorRegimes",
      status: anoRegime.disponivel ? "calculado" : "indisponivel",
      qualidade: `${resultado.qualidade.percentualConfirmado.toFixed(0)}% confirmado`,
      premissas: Object.keys(resultado.premissas ?? {}),
      evidencias: [],
      fundamentos: [],
      dependencias: [],
      limitacoes: resultado.alertas ?? [],
    });

    for (const componente of anoRegime.componentes) {
      const idComp = `fiscal:${resultado.regime}:${analise.ano}:componente:${componente.componente}`;
      itens.push({
        id: idComp,
        codigo: idComp,
        categoria: "fiscal",
        titulo: `Componente tributário — ${componente.componente.toUpperCase()}`,
        descricao: `Valor apurado para ${componente.componente} no regime ${resultado.regime}, ano ${analise.ano}.`,
        valor: componente.valor,
        unidade: "reais",
        periodo: { ano: analise.ano },
        regime: resultado.regime,
        origemResultado: "motor_regime",
        origemInformacao: componente.status,
        origemCalculo: componente.origemCalculo ?? NAO_INFORMADO,
        motor: "motorRegimes",
        status: "calculado",
        qualidade: NAO_INFORMADO,
        premissas: [],
        evidencias: componente.regraAplicada ? [componente.regraAplicada] : [],
        fundamentos: componente.fundamentoLegal ? [componente.fundamentoLegal] : [],
        dependencias: [idCarga],
        limitacoes: [],
      });
    }
  }

  return itens;
}

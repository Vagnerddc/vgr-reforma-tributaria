/**
 * Achados fiscais e de comparabilidade — leitura direta de
 * `ResultadoRegime`/`ResultadoComparacaoConsolidado`, nunca recalculada
 * (seção 14/15 do pedido).
 */

import type { ResultadoRegime } from "../motorRegimes/tipos";
import type { ResultadoComparacaoConsolidado } from "../motorRegimes/comparadorConsolidado";
import { ANOS_SIMULACAO } from "../parametros";
import type { AchadoEstrategico } from "./tipos";

const EPSILON_CENTAVOS = 0.01;

/** Compara a carga do ano contra o ano-base (2026) do MESMO ResultadoRegime — mesmo ano-base convention já usada no Motor Financeiro. */
export function gerarAchadosCargaFiscal(resultado: ResultadoRegime, ano: number): AchadoEstrategico[] {
  const anoBase = resultado.anos.find((a) => a.ano === ANOS_SIMULACAO[0]);
  const anoAtual = resultado.anos.find((a) => a.ano === ano);
  if (!anoAtual) return [];

  if (!anoAtual.disponivel) {
    return [
      {
        id: `fiscal:${resultado.regime}:${ano}:CARGA_FISCAL_INCOMPLETA`,
        codigo: "CARGA_FISCAL_INCOMPLETA",
        categoria: "fiscal",
        tituloTecnico: "Carga fiscal indisponível no ano",
        descricaoTecnica: `O ano ${ano} não possui resultado fiscal calculado para o regime ${resultado.regime}.`,
        periodo: { ano },
        regime: resultado.regime,
        evidencias: [{ origem: "motor_fiscal", referencia: `ResultadoRegime.anos[${ano}].disponivel` }],
        qualidade: "insuficiente",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
      },
    ];
  }

  const achados: AchadoEstrategico[] = [];
  if (anoBase?.disponivel && anoBase.ano !== ano) {
    const diferenca = anoAtual.cargaTotal - anoBase.cargaTotal;
    const codigo = Math.abs(diferenca) < EPSILON_CENTAVOS ? "CARGA_TRIBUTARIA_ESTAVEL" : diferenca > 0 ? "CARGA_TRIBUTARIA_AUMENTOU" : "CARGA_TRIBUTARIA_REDUZIU";
    achados.push({
      id: `fiscal:${resultado.regime}:${ano}:${codigo}`,
      codigo,
      categoria: "fiscal",
      tituloTecnico: codigo === "CARGA_TRIBUTARIA_AUMENTOU" ? "Carga tributária aumentou em relação ao ano-base" : codigo === "CARGA_TRIBUTARIA_REDUZIU" ? "Carga tributária reduziu em relação ao ano-base" : "Carga tributária estável em relação ao ano-base",
      descricaoTecnica: `Carga tributária de R$ ${anoAtual.cargaTotal.toFixed(2)} em ${ano}, contra R$ ${anoBase.cargaTotal.toFixed(2)} em ${anoBase.ano} (diferença de R$ ${diferenca.toFixed(2)}).`,
      valor: diferenca,
      unidade: "reais",
      periodo: { ano },
      regime: resultado.regime,
      evidencias: [{ origem: "motor_fiscal", referencia: `ResultadoRegime.${resultado.regime}.anos[${ano}].cargaTotal`, valor: anoAtual.cargaTotal }],
      qualidade: resultado.qualidade.percentualConfirmado >= 80 ? "alta" : resultado.qualidade.percentualConfirmado >= 30 ? "media" : "baixa",
      premissas: {},
      origens: ["classificacao_vgr"],
      status: resultado.qualidade.percentualConfirmado >= 80 ? "confirmado" : "estimado",
    });
  }

  if (resultado.regime === "lucro_real") {
    const alertaQualidade = resultado.alertas.find((a) => a.startsWith("Qualidade da base fiscal:"));
    if (alertaQualidade && (alertaQualidade.includes("parcial") || alertaQualidade.includes("estimada") || alertaQualidade.includes("insuficiente"))) {
      achados.push({
        id: `fiscal:${resultado.regime}:${ano}:BASE_LUCRO_REAL_PARCIAL`,
        codigo: "BASE_LUCRO_REAL_PARCIAL",
        categoria: "dados",
        tituloTecnico: "Base do Lucro Real parcial",
        descricaoTecnica: alertaQualidade,
        periodo: { ano },
        regime: resultado.regime,
        evidencias: [{ origem: "motor_fiscal", referencia: `ResultadoRegime.lucro_real.alertas` }],
        qualidade: alertaQualidade.includes("insuficiente") ? "insuficiente" : "baixa",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
        severidadeTecnica: "informacao_insuficiente",
      });
    }
  }

  if (resultado.aplicabilidade.status === "obrigatorio") {
    achados.push(fatoJuridico(resultado, ano, "REGIME_OBRIGATORIO", "Regime juridicamente obrigatório", resultado.aplicabilidade.motivo));
  } else if (resultado.aplicabilidade.status === "inelegivel") {
    achados.push(fatoJuridico(resultado, ano, "REGIME_INELEGIVEL", "Regime juridicamente inelegível", resultado.aplicabilidade.motivo));
  } else if (resultado.aplicabilidade.status === "indeterminado") {
    achados.push(fatoJuridico(resultado, ano, "ELEGIBILIDADE_INDETERMINADA", "Elegibilidade jurídica indeterminada", resultado.aplicabilidade.motivo));
  }

  return achados;
}

function fatoJuridico(resultado: ResultadoRegime, ano: number, codigo: "REGIME_OBRIGATORIO" | "REGIME_INELEGIVEL" | "ELEGIBILIDADE_INDETERMINADA", titulo: string, motivo: string): AchadoEstrategico {
  return {
    id: `fiscal:${resultado.regime}:${ano}:${codigo}`,
    codigo,
    categoria: "fiscal",
    tituloTecnico: titulo,
    descricaoTecnica: motivo,
    periodo: { ano },
    regime: resultado.regime,
    evidencias: [{ origem: "motor_fiscal", referencia: `ResultadoRegime.${resultado.regime}.aplicabilidade` }],
    qualidade: codigo === "ELEGIBILIDADE_INDETERMINADA" ? "insuficiente" : "alta",
    premissas: {},
    origens: ["classificacao_vgr"],
    status: codigo === "ELEGIBILIDADE_INDETERMINADA" ? "estimado" : "confirmado",
    severidadeTecnica: codigo === "ELEGIBILIDADE_INDETERMINADA" ? "informacao_insuficiente" : undefined,
  };
}

export function gerarAchadosComparabilidade(comparacao: ResultadoComparacaoConsolidado, ano: number): AchadoEstrategico[] {
  const anoComp = comparacao.porAno.find((a) => a.ano === ano);
  if (!anoComp) return [];

  const achados: AchadoEstrategico[] = [];
  for (const r of anoComp.porRegime) {
    if (r.status === "nao_comparavel" || r.status === "indeterminado") {
      achados.push({
        id: `comparabilidade:${r.regime}:${ano}:REGIMES_NAO_COMPARAVEIS`,
        codigo: "REGIMES_NAO_COMPARAVEIS",
        categoria: "comparabilidade",
        tituloTecnico: `Regime ${r.regime} não comparável em ${ano}`,
        descricaoTecnica: r.motivos.map((m) => m.descricao).join(" "),
        periodo: { ano },
        regime: r.regime,
        evidencias: [{ origem: "comparador_consolidado", referencia: `ResumoComparativoRegimeAno.${r.regime}.status` }],
        qualidade: "insuficiente",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
        severidadeTecnica: "informacao_insuficiente",
      });
    } else if (r.status === "comparavel_com_ressalvas") {
      achados.push({
        id: `comparabilidade:${r.regime}:${ano}:REGIMES_COMPARAVEIS_COM_RESSALVAS`,
        codigo: "REGIMES_COMPARAVEIS_COM_RESSALVAS",
        categoria: "comparabilidade",
        tituloTecnico: `Regime ${r.regime} comparável apenas com ressalvas em ${ano}`,
        descricaoTecnica: r.motivos.map((m) => m.descricao).join(" "),
        periodo: { ano },
        regime: r.regime,
        evidencias: [{ origem: "comparador_consolidado", referencia: `ResumoComparativoRegimeAno.${r.regime}.status` }],
        qualidade: "media",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
      });
    }

    if (r.cobertura.ausentesMateriais.length > 0) {
      achados.push({
        id: `comparabilidade:${r.regime}:${ano}:COMPONENTE_MATERIAL_AUSENTE`,
        codigo: "COMPONENTE_MATERIAL_AUSENTE",
        categoria: "comparabilidade",
        tituloTecnico: `Componentes tributários ausentes no resultado de ${r.regime}`,
        descricaoTecnica: `Componentes esperados não calculados em ${ano}: ${r.cobertura.ausentesMateriais.join(", ")}.`,
        periodo: { ano },
        regime: r.regime,
        evidencias: [{ origem: "comparador_consolidado", referencia: `AvaliacaoCobertura.${r.regime}.ausentesMateriais` }],
        qualidade: "baixa",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
      });
    }
  }

  return achados;
}

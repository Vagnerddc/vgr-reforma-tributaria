/**
 * Achados de Fator R — reaproveita `calcularFs12Anual` (fs12.ts),
 * `calcularRbt12MensalDoAno` (rbt12.ts) e a constante `LIMITE_FATOR_R`
 * (normativa.ts), exatamente como o motor real do Simples faz — nunca
 * reimplementa a decisão de anexo (seção 2/19 do pedido). A comparação
 * ">= limite" é inerente a QUALQUER achado que afirme "abaixo"/"acima"
 * do limite — não é uma segunda regra tributária, é a leitura do mesmo
 * fato.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import { calcularFs12Anual } from "../motorRegimes/simplesNacional/fatorR/fs12";
import { calcularRbt12MensalDoAno } from "../motorRegimes/simplesNacional/rbt12";
import { LIMITE_FATOR_R } from "../motorRegimes/simplesNacional/normativa";
import { ANOS_SIMULACAO } from "../parametros";
import type { AchadoEstrategico } from "./tipos";

function receitaDoAno(cenario: CenarioEmpresa, ano: number): number | undefined {
  const base = cenario.receita.faturamentoAnual?.valor;
  if (base === undefined) return undefined;
  const crescimento = cenario.receita.crescimentoAnualEstimado?.valor ?? 0;
  return base * Math.pow(1 + crescimento, ano - ANOS_SIMULACAO[0]);
}

/**
 * Só produz achados quando a empresa tem FS12 computável — nunca
 * assume Fator R para atividades que não dependem dele (isso é
 * responsabilidade do motor do Simples, lido via `ResultadoRegime`, não
 * decidido aqui de novo).
 */
export function gerarAchadosFatorR(cenario: CenarioEmpresa, ano: number, aplicavelParaAtividade: boolean): AchadoEstrategico[] {
  if (!aplicavelParaAtividade) return [];

  const fs12 = calcularFs12Anual(cenario.pessoas);
  const receitaAtual = receitaDoAno(cenario, ano);
  if (fs12.valor === undefined || receitaAtual === undefined) return [];

  const receitaAnterior = ano > ANOS_SIMULACAO[0] ? receitaDoAno(cenario, ano - 1) : undefined;
  const dataAbertura = cenario.identificacao.dataAberturaEmpresa?.valor;
  const meses = calcularRbt12MensalDoAno(receitaAtual, receitaAnterior, dataAbertura, ano);
  const rbt12Medio = meses.reduce((s, m) => s + m.rbt12, 0) / meses.length;
  if (rbt12Medio <= 0) return [];

  const fatorR = fs12.valor / rbt12Medio;
  const distanciaPp = (fatorR - LIMITE_FATOR_R.valor) * 100;
  const fs12Necessaria = rbt12Medio * LIMITE_FATOR_R.valor;
  const status = fs12.status;
  const achados: AchadoEstrategico[] = [];

  const codigo = distanciaPp > 0.001 ? "FATOR_R_ACIMA_LIMITE" : distanciaPp < -0.001 ? "FATOR_R_ABAIXO_LIMITE" : "FATOR_R_EXATAMENTE_NO_LIMITE";
  achados.push({
    id: `fator_r:${ano}:${codigo}`,
    codigo,
    categoria: "fator_r",
    tituloTecnico: codigo === "FATOR_R_ABAIXO_LIMITE" ? "Fator R abaixo do limite de 28%" : codigo === "FATOR_R_ACIMA_LIMITE" ? "Fator R acima do limite de 28%" : "Fator R exatamente no limite de 28%",
    descricaoTecnica: `Fator R médio estimado de ${(fatorR * 100).toFixed(2)}% no ano ${ano} (distância de ${distanciaPp.toFixed(2)} p.p. do limite de 28%, LC 123/2006, art. 18, §5º-J).`,
    valor: distanciaPp,
    unidade: "pontos_percentuais",
    periodo: { ano },
    evidencias: [
      { origem: "motor_fiscal", referencia: "calcularFs12Anual(cenario.pessoas)", valor: fs12.valor },
      { origem: "motor_fiscal", referencia: "calcularRbt12MensalDoAno(...) — média do ano", valor: rbt12Medio },
    ],
    qualidade: status === "confirmado" ? "alta" : "media",
    premissas: fs12.componentesAusentes.length > 0 ? { componentesAusentes: fs12.componentesAusentes.join(", ") } : {},
    origens: ["classificacao_vgr"],
    status,
  });

  if (codigo === "FATOR_R_ABAIXO_LIMITE") {
    const fs12Adicional = Math.max(0, fs12Necessaria - fs12.valor);
    achados.push({
      id: `fator_r:${ano}:FS12_ADICIONAL_NECESSARIA`,
      codigo: "FS12_ADICIONAL_NECESSARIA",
      categoria: "fator_r",
      tituloTecnico: "FS12 adicional necessária para atingir o limite do Fator R",
      descricaoTecnica: `Seriam necessários R$ ${fs12Adicional.toFixed(2)} adicionais em FS12 (folha + encargos + pró-labore) no ano ${ano} para atingir o limite de 28% do Fator R (RBT12 médio × 28%).`,
      valor: fs12Adicional,
      unidade: "reais",
      periodo: { ano },
      evidencias: [{ origem: "motor_pontos_virada", referencia: "calcularFs12NecessariaAnalitica (RBT12 × LIMITE_FATOR_R.valor)", valor: fs12Necessaria }],
      qualidade: status === "confirmado" ? "alta" : "media",
      premissas: {},
      origens: ["classificacao_vgr"],
      status,
    });
  }

  return achados;
}

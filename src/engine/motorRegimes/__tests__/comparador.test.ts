import { describe, it, expect } from "vitest";
import { compararRegimes } from "../comparador";
import type { AvaliacaoElegibilidade, MotorRegime, ResultadoRegime } from "../tipos";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";

/**
 * Estes testes usam motores FALSOS (fakes) — nenhuma fórmula tributária
 * real de Presumido/Simples/Real é exercitada aqui. O objetivo é validar
 * que o CONTRATO (tipos.ts) e o ORQUESTRADOR (comparador.ts) funcionam
 * corretamente para os cenários que motivaram esta fase: elegibilidade
 * não-trivial, multiatividade, multi-ano parcial e auditabilidade.
 */

function cenarioMinimo(): CenarioEmpresa {
  return {
    id: "cenario-teste",
    identificacao: { nomeEmpresa: campo("Empresa Teste", "informado_usuario", "confirmado") },
    receita: { faturamentoAnual: campo(2_000_000, "informado_usuario", "confirmado") },
    custos: { itens: [] },
    pessoas: {},
    tributario: {},
    economicoFinanceiro: {},
    dadosSetoriais: [],
  };
}

function motorFake(regime: MotorRegime["regime"], status: AvaliacaoElegibilidade["status"], cargaTotalPeriodo: number): MotorRegime {
  return {
    regime,
    avaliarElegibilidade: () => ({ regime, status, motivo: `motivo de teste para ${regime}`, criterios: [] }),
    calcular: (): ResultadoRegime => ({
      regime,
      aplicabilidade: { regime, status, motivo: `motivo de teste para ${regime}`, criterios: [] },
      anos: [{ ano: 2026, disponivel: true, componentes: [], cargaTotal: cargaTotalPeriodo }],
      cargaTotalPeriodo,
      componentesConsolidados: {},
      premissas: {},
      qualidade: { percentualConfirmado: 100, origemIbsCbs: "nao_aplicavel" },
      alertas: [],
      memoria: [],
    }),
  };
}

describe("compararRegimes — elegibilidade não-trivial (não é 'calcula os três e escolhe o menor')", () => {
  it("regime inelegível aparece no resultado com aplicabilidade preenchida, mas SEM cálculo (anos vazio)", () => {
    const motorInelegivel = motorFake("simples_unificado", "inelegivel", 0);
    const r = compararRegimes(cenarioMinimo(), [motorInelegivel]);
    expect(r.resultados[0].aplicabilidade.status).toBe("inelegivel");
    expect(r.resultados[0].aplicabilidade.motivo).toBeTruthy();
    expect(r.resultados[0].anos).toEqual([]);
    expect(r.regimeMenorCarga).toBeUndefined(); // nenhum regime calculável
  });

  it("regime 'obrigatorio' é calculado (Lucro Real pode ser obrigatório, não só elegível)", () => {
    const motorObrigatorio = motorFake("lucro_real", "obrigatorio", 500_000);
    const r = compararRegimes(cenarioMinimo(), [motorObrigatorio]);
    expect(r.resultados[0].anos.length).toBe(1);
    expect(r.regimeMenorCarga).toBe("lucro_real");
  });

  it("regime 'indeterminado' não é calculado — o sistema não força uma resposta sem confiança", () => {
    const motorIndeterminado = motorFake("lucro_presumido", "indeterminado", 0);
    const r = compararRegimes(cenarioMinimo(), [motorIndeterminado]);
    expect(r.resultados[0].anos).toEqual([]);
  });

  it("regimeMenorCarga escolhe entre os CALCULÁVEIS, ignorando os inelegíveis/indeterminados mesmo que tivessem valor baixo", () => {
    const r = compararRegimes(cenarioMinimo(), [
      motorFake("simples_unificado", "inelegivel", 0), // não entra na comparação mesmo com carga "0"
      motorFake("lucro_presumido", "elegivel", 300_000),
      motorFake("lucro_real", "opcional", 250_000),
    ]);
    expect(r.regimeMenorCarga).toBe("lucro_real");
    expect(r.resultados).toHaveLength(3); // os 3 aparecem no relatório, mesmo o inelegível
  });
});

describe("Auditabilidade — cada componente responde 'de onde veio'", () => {
  it("um componente tributário carrega base, alíquota, fundamento e origem — nunca só o valor final", () => {
    const motor: MotorRegime = {
      regime: "lucro_presumido",
      avaliarElegibilidade: () => ({ regime: "lucro_presumido", status: "elegivel", motivo: "dentro do limite de receita", criterios: [{ id: "limite_receita", descricao: "Receita bruta anual até R$ 78 milhões", atendido: true, fonte: campo("faturamento confirmado via SPED", "sped", "confirmado") }] }),
      calcular: (_c, aplicabilidade) => ({
        regime: "lucro_presumido",
        aplicabilidade,
        anos: [
          {
            ano: 2026,
            disponivel: true,
            componentes: [
              { componente: "irpj", valor: 12_000, base: 100_000, aliquota: 0.15, regraAplicada: "presumido.irpj.trimestral.v1", fundamentoLegal: "Lei 9.430/1996, art. 15", status: "estimado" },
              { componente: "ibs", valor: 800, origemCalculo: "motor_vgr", status: "confirmado" },
            ],
            cargaTotal: 12_800,
          },
        ],
        cargaTotalPeriodo: 12_800,
        componentesConsolidados: { irpj: 12_000, ibs: 800 },
        premissas: {},
        qualidade: { percentualConfirmado: 50, origemIbsCbs: "motor_vgr" },
        alertas: [],
        memoria: ["IRPJ calculado pela presunção de 8% sobre a receita (atividade padrão)."],
      }),
    };

    const r = compararRegimes(cenarioMinimo(), [motor]);
    const irpj = r.resultados[0].anos[0].componentes.find((c) => c.componente === "irpj")!;
    expect(irpj.base).toBe(100_000);
    expect(irpj.aliquota).toBe(0.15);
    expect(irpj.fundamentoLegal).toContain("9.430");
    expect(irpj.status).toBe("estimado"); // dado real × estimado, nunca escondido

    const ibs = r.resultados[0].anos[0].componentes.find((c) => c.componente === "ibs")!;
    expect(ibs.origemCalculo).toBe("motor_vgr"); // regra VGR × resultado oficial, reaproveitando OrigemCalculo já existente
  });
});

describe("Multi-ano desde o início — disponibilidade parcial não é confundida com carga zero", () => {
  it("um regime pode calcular só parte do período (ex.: 2026-2028) e sinalizar os anos restantes como indisponíveis, nunca como zero", () => {
    const motorParcial: MotorRegime = {
      regime: "lucro_real",
      avaliarElegibilidade: () => ({ regime: "lucro_real", status: "elegivel", motivo: "teste", criterios: [] }),
      calcular: (_c, aplicabilidade) => ({
        regime: "lucro_real",
        aplicabilidade,
        anos: [
          { ano: 2026, disponivel: true, componentes: [], cargaTotal: 100 },
          { ano: 2027, disponivel: true, componentes: [], cargaTotal: 110 },
          { ano: 2028, disponivel: false, componentes: [], cargaTotal: 0 }, // motor ainda não cobre este ano
        ],
        cargaTotalPeriodo: 210, // soma só dos anos disponíveis — 2028 não entra
        componentesConsolidados: {},
        premissas: {},
        qualidade: { percentualConfirmado: 100, origemIbsCbs: "nao_aplicavel" },
        alertas: ["Cálculo de 2028 em diante ainda não implementado neste motor."],
        memoria: [],
      }),
    };

    const r = compararRegimes(cenarioMinimo(), [motorParcial]);
    const ano2028 = r.resultados[0].anos.find((a) => a.ano === 2028)!;
    expect(ano2028.disponivel).toBe(false);
    expect(ano2028.cargaTotal).toBe(0); // valor é 0, mas a estrutura já deixa claro que é "não calculado", não "sem imposto"
    expect(r.resultados[0].alertas).toHaveLength(1);
  });
});

describe("Multiatividade — resultado por atividade sem tipo especial por combinação de setores", () => {
  it("um regime pode decompor o resultado por atividade (porAtividade) quando os componentes divergem entre elas", () => {
    const motorMultiatividade: MotorRegime = {
      regime: "simples_hibrido",
      avaliarElegibilidade: () => ({ regime: "simples_hibrido", status: "elegivel", motivo: "teste", criterios: [] }),
      calcular: (_c, aplicabilidade) => ({
        regime: "simples_hibrido",
        aplicabilidade,
        anos: [{ ano: 2026, disponivel: true, componentes: [{ componente: "das", valor: 15_000, status: "estimado" }], cargaTotal: 15_000 }],
        porAtividade: [
          { perfilId: "frigorifico", anos: [{ ano: 2026, disponivel: true, componentes: [{ componente: "das", valor: 10_000, status: "estimado" }], cargaTotal: 10_000 }] },
          { perfilId: "atacado_distribuicao", anos: [{ ano: 2026, disponivel: true, componentes: [{ componente: "das", valor: 5_000, status: "estimado" }], cargaTotal: 5_000 }] },
        ],
        cargaTotalPeriodo: 15_000,
        componentesConsolidados: { das: 15_000 },
        premissas: {},
        qualidade: { percentualConfirmado: 0, origemIbsCbs: "nao_aplicavel" },
        alertas: [],
        memoria: [],
      }),
    };

    const r = compararRegimes(cenarioMinimo(), [motorMultiatividade]);
    expect(r.resultados[0].porAtividade).toHaveLength(2);
    const somaPorAtividade = r.resultados[0].porAtividade!.reduce((s, a) => s + a.anos[0].cargaTotal, 0);
    expect(somaPorAtividade).toBe(r.resultados[0].cargaTotalPeriodo); // consolidado bate com a soma das atividades
  });
});

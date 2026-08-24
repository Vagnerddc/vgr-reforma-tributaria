import { describe, it, expect } from "vitest";
import { montarGrupos } from "../PainelParceiros";
import type { DadosApuradosCliente } from "../../engine/sped/agregador";

type Parceiro = DadosApuradosCliente["parceirosComExposicao"][number];

function parceiro(overrides: Partial<Parceiro["participante"]>, valorTotal: number, papel: Parceiro["papel"] = "fornecedor"): Parceiro {
  return {
    participante: {
      codPart: overrides.codPart ?? Math.random().toString(),
      nome: "Empresa",
      regime: "normal",
      restringeCreditoDoCliente: false,
      ...overrides,
    },
    papel,
    valorTotal,
  };
}

describe("montarGrupos", () => {
  it("separa em não gera crédito, gera crédito e não confirmado, com percentual sobre o total", () => {
    const lista: Parceiro[] = [
      parceiro({ regime: "simples_nacional", restringeCreditoDoCliente: true }, 3000),
      parceiro({ regime: "pessoa_fisica", restringeCreditoDoCliente: true }, 1000),
      parceiro({ regime: "normal", restringeCreditoDoCliente: false }, 5000),
      parceiro({ regime: "desconhecido", restringeCreditoDoCliente: false }, 1000),
    ];
    const grupos = montarGrupos(lista);

    const semCredito = grupos.find((g) => g.chave === "sem_credito")!;
    const comCredito = grupos.find((g) => g.chave === "com_credito")!;
    const naoConfirmado = grupos.find((g) => g.chave === "nao_confirmado")!;

    expect(semCredito.quantidade).toBe(2);
    expect(semCredito.valor).toBe(4000);
    expect(semCredito.percentual).toBeCloseTo(4000 / 10000);

    expect(comCredito.quantidade).toBe(1);
    expect(comCredito.valor).toBe(5000);

    expect(naoConfirmado.quantidade).toBe(1);
    expect(naoConfirmado.valor).toBe(1000);
  });

  it("omite grupos vazios (ex.: nenhum parceiro não confirmado)", () => {
    const lista: Parceiro[] = [parceiro({ regime: "normal", restringeCreditoDoCliente: false }, 1000)];
    const grupos = montarGrupos(lista);
    expect(grupos.map((g) => g.chave)).toEqual(["com_credito"]);
  });

  it("lista vazia não quebra e não gera grupos", () => {
    expect(montarGrupos([])).toEqual([]);
  });
});

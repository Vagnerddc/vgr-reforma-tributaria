import { describe, it, expect } from "vitest";
import { gerarOportunidadesParceiros } from "../oportunidadesParceiros";
import type { Grupo } from "../../components/PainelParceiros";

function grupo(overrides: Partial<Grupo>): Grupo {
  return {
    chave: "sem_credito",
    titulo: "t",
    tom: "negativo",
    quantidade: 1,
    valor: 1000,
    percentual: 0.2,
    parceiros: [],
    ...overrides,
  };
}

describe("gerarOportunidadesParceiros — fornecedores", () => {
  it("sinaliza risco quando concentração em fornecedores sem crédito é relevante", () => {
    const grupos = [grupo({ chave: "sem_credito", percentual: 0.3, quantidade: 2, valor: 30000 })];
    const itens = gerarOportunidadesParceiros(grupos, "fornecedores");
    expect(itens.some((i) => i.tipo === "risco" && i.titulo.includes("sem geração de crédito"))).toBe(true);
  });

  it("não gera item quando a concentração é baixa (abaixo do limiar)", () => {
    const grupos = [grupo({ chave: "sem_credito", percentual: 0.05 })];
    const itens = gerarOportunidadesParceiros(grupos, "fornecedores");
    expect(itens).toHaveLength(0);
  });

  it("sinaliza oportunidade quando maioria das compras já gera crédito integral", () => {
    const grupos = [grupo({ chave: "com_credito", tom: "positivo", percentual: 0.7 })];
    const itens = gerarOportunidadesParceiros(grupos, "fornecedores");
    expect(itens.some((i) => i.tipo === "oportunidade")).toBe(true);
  });
});

describe("gerarOportunidadesParceiros — clientes", () => {
  it("sinaliza risco quando concentração de clientes contribuintes (regime regular) é relevante", () => {
    const grupos = [grupo({ chave: "com_credito", tom: "positivo", percentual: 0.4 })];
    const itens = gerarOportunidadesParceiros(grupos, "clientes");
    expect(itens.some((i) => i.tipo === "risco" && i.titulo.includes("repasse integral"))).toBe(true);
  });

  it("sinaliza oportunidade quando concentração de clientes não contribuintes é relevante", () => {
    const grupos = [grupo({ chave: "sem_credito", percentual: 0.4 })];
    const itens = gerarOportunidadesParceiros(grupos, "clientes");
    expect(itens.some((i) => i.tipo === "oportunidade" && i.titulo.includes("não contribuintes"))).toBe(true);
  });
});

describe("gerarOportunidadesParceiros — regime não confirmado", () => {
  it("gera ação para confirmar regime quando o volume não confirmado é relevante", () => {
    const grupos = [grupo({ chave: "nao_confirmado", tom: "neutro", percentual: 0.2, quantidade: 3 })];
    const itens = gerarOportunidadesParceiros(grupos, "fornecedores");
    expect(itens.some((i) => i.tipo === "acao_2026")).toBe(true);
  });
});

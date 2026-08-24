import { describe, it, expect } from "vitest";
import { processarRegistro0200, classificarPorTipoItem } from "../tabelaItens";

describe("processarRegistro0200", () => {
  it("extrai codItem, descrição, tipoItem e ncm do registro", () => {
    const item = processarRegistro0200(["PROD001", "CIMENTO CP-II", "", "", "SC", "01", "2523.29.10", "", "", "", "18"]);
    expect(item).toEqual({ codItem: "PROD001", descricao: "CIMENTO CP-II", tipoItem: "01", ncm: "2523.29.10" });
  });
});

describe("classificarPorTipoItem", () => {
  it("mercadoria para revenda (00): custo na entrada, faturamento na saída", () => {
    expect(classificarPorTipoItem("00", "entrada")).toBe("custoMercadoriaInsumo");
    expect(classificarPorTipoItem("00", "saida")).toBe("faturamento");
  });

  it("produto acabado (04): custo na entrada, faturamento na saída", () => {
    expect(classificarPorTipoItem("04", "saida")).toBe("faturamento");
  });

  it("matéria-prima/embalagem/insumos (01,02,10): sempre custo, independente da direção", () => {
    expect(classificarPorTipoItem("01", "entrada")).toBe("custoMercadoriaInsumo");
    expect(classificarPorTipoItem("02", "saida")).toBe("custoMercadoriaInsumo");
    expect(classificarPorTipoItem("10", "entrada")).toBe("custoMercadoriaInsumo");
  });

  it("uso e consumo (07) e ativo imobilizado (08)", () => {
    expect(classificarPorTipoItem("07", "entrada")).toBe("usoConsumo");
    expect(classificarPorTipoItem("08", "entrada")).toBe("imobilizado");
  });

  it("serviços (09) e outras (11) não têm sinal estrutural confiável — retorna null p/ fallback", () => {
    expect(classificarPorTipoItem("09", "entrada")).toBeNull();
    expect(classificarPorTipoItem("11", "saida")).toBeNull();
  });

  it("tipo não informado retorna null", () => {
    expect(classificarPorTipoItem("", "entrada")).toBeNull();
  });
});

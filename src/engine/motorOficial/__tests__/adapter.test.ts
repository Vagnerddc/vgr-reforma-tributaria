import { describe, it, expect, vi } from "vitest";
import { OfficialEngineAdapter } from "../adapter";
import { campoComProveniencia as campo, type OperacaoTributariaNormalizada } from "../../operacaoTributaria";

function operacaoCompleta(): OperacaoTributariaNormalizada {
  return {
    id: "op-1",
    identificacao: { data: campo("2026-01-15T10:00:00-03:00", "xml", "confirmado") },
    produtoServico: {
      ncm: campo("84244900", "xml", "confirmado"),
      quantidade: campo(2, "xml", "confirmado"),
      unidade: campo("UN", "xml", "confirmado"),
    },
    classificacaoTributaria: {
      cst: campo("000", "xml", "confirmado"),
      cClassTrib: campo("550020", "xml", "confirmado"),
    },
    valores: { valorOperacao: campo(1000, "xml", "confirmado") },
    localidade: { uf: campo("SP", "xml", "confirmado"), municipio: campo("3550308", "xml", "confirmado") },
    granularidade: "item",
  };
}

// Resposta real capturada no spike (docs/arquitetura-motor-hibrido.md) — usada aqui como fixture, não uma chamada de rede real.
const RESPOSTA_REAL_SPIKE = {
  objetos: [
    {
      nObj: 1,
      tribCalc: {
        IS: { CSTIS: "000", vBCIS: "1111.00", pIS: "13.00", vIS: "4873.03", memoriaCalculo: "Operação de consumo sujeita à tributação pelo Imposto Seletivo, com enquadramento legal em Art. 412, I, tributada conforme Tributação pelo Imposto Seletivo - Com Cálculo." },
        IBSCBS: {
          CST: "550",
          cClassTrib: "550020",
          gIBSCBS: {
            vBC: "5984.03",
            gIBSUF: { pIBSUF: "0.00", vIBSUF: "0.00", memoriaCalculo: "Operação de consumo com enquadramento legal em Art. 461, tributada conforme Suspensão." },
            gIBSMun: { pIBSMun: "0.00", vIBSMun: "0.00", memoriaCalculo: "Operação de consumo com enquadramento legal em Art. 461, tributada conforme Suspensão." },
            vIBS: "0.00",
            gCBS: { pCBS: "0.00", vCBS: "0.00", memoriaCalculo: "Operação de consumo com enquadramento legal em Art. 461, tributada conforme Suspensão." },
          },
        },
      },
    },
  ],
};

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body });
}

describe("OfficialEngineAdapter.calcularOperacao", () => {
  it("nunca chama o componente oficial quando a operação está incompleta — devolve erro dados_insuficientes sem requisição", async () => {
    const fetchImpl = vi.fn();
    const adapter = new OfficialEngineAdapter({ baseUrl: "http://localhost:8080", versaoMotor: "V0039", fetchImpl });
    const op = operacaoCompleta();
    op.classificacaoTributaria.cClassTrib = undefined; // torna incompleta

    const r = await adapter.calcularOperacao(op);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.tipo).toBe("dados_insuficientes");
    expect(r.erro.camposFaltantes).toContain("cClassTrib");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("converte a operação completa no contrato oficial real (regime-geral) e a resposta de volta em ResultadoCalculoNormalizado, preservando memória e fundamento legal", async () => {
    const fetchImpl = mockFetch(200, RESPOSTA_REAL_SPIKE);
    const adapter = new OfficialEngineAdapter({ baseUrl: "http://localhost:8080", versaoMotor: "V0039 - 1.2.4-b0e47264 - APR", fetchImpl });

    const r = await adapter.calcularOperacao(operacaoCompleta());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // requisição enviada no formato real confirmado no spike
    const [, opcoes] = fetchImpl.mock.calls[0];
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.municipio).toBe(3550308);
    expect(corpo.uf).toBe("SP");
    expect(corpo.itens[0]).toMatchObject({ ncm: "84244900", cst: "000", cClassTrib: "550020", quantidade: 2, unidade: "UN" });

    // resultado normalizado preserva os números e a proveniência
    expect(r.resultado.valores.baseCalculo).toBeCloseTo(5984.03);
    expect(r.resultado.valores.is).toBeCloseTo(4873.03);
    expect(r.resultado.proveniencia.origemCalculo).toBe("motor_oficial");
    expect(r.resultado.proveniencia.versaoMotor).toBe("V0039 - 1.2.4-b0e47264 - APR");
    expect(r.resultado.proveniencia.qualidade).toBe("confirmado");

    // memória de cálculo e fundamento legal preservados, não descartados
    expect(r.resultado.memoriaCalculo?.narrativa).toContain("Imposto Seletivo");
    expect(r.resultado.memoriaCalculo?.fundamentoLegal).toContain("Art. 412");
    expect(r.resultado.memoriaCalculo?.fundamentoLegal).toContain("Art. 461");
  });

  it("extrai fundamento legal também quando a citação é 'LC 214/2025' (sem número de artigo) — forma real observada em operações de tributação integral, sem redução", async () => {
    const RESPOSTA_TRIBUTACAO_INTEGRAL = {
      objetos: [
        {
          tribCalc: {
            IBSCBS: {
              gIBSCBS: {
                vBC: "70.16",
                gIBSUF: { pIBSUF: "0.10", vIBSUF: "0.07", memoriaCalculo: "Operação de consumo com enquadramento legal em LC 214/2025, tributada conforme Tributação integral." },
                gCBS: { pCBS: "0.90", vCBS: "0.63", memoriaCalculo: "Operação de consumo com enquadramento legal em LC 214/2025, tributada conforme Tributação integral." },
              },
            },
          },
        },
      ],
    };
    const fetchImpl = mockFetch(200, RESPOSTA_TRIBUTACAO_INTEGRAL);
    const adapter = new OfficialEngineAdapter({ baseUrl: "http://localhost:8080", versaoMotor: "V0039", fetchImpl });
    const r = await adapter.calcularOperacao(operacaoCompleta());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultado.memoriaCalculo?.fundamentoLegal).toContain("LC 214/2025");
  });

  it("erro HTTP (RFC 7807) nunca produz um resultado com aparência oficial — registra o erro estruturado", async () => {
    const corpoErro = { type: "http://localhost/errors/ncm-nao-encontrada", title: "NCM não encontrada", status: 404, detail: "NCM de código 84244900 não encontrada para a data 2026-01-15" };
    const fetchImpl = mockFetch(404, corpoErro);
    const adapter = new OfficialEngineAdapter({ baseUrl: "http://localhost:8080", versaoMotor: "V0039", fetchImpl });

    const r = await adapter.calcularOperacao(operacaoCompleta());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.tipo).toBe("erro_http");
    expect(r.erro.detalhe).toContain("NCM de código 84244900");
  });

  it("erro de rede (componente indisponível) é registrado explicitamente, nunca silenciado", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    const adapter = new OfficialEngineAdapter({ baseUrl: "http://localhost:8080", versaoMotor: "V0039", fetchImpl });

    const r = await adapter.calcularOperacao(operacaoCompleta());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.tipo).toBe("erro_rede");
    expect(r.erro.detalhe).toContain("ECONNREFUSED");
  });
});

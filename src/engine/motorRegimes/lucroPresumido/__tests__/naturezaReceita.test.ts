import { describe, it, expect } from "vitest";
import { inferirNaturezaTributaria } from "../naturezaReceita";
import { buscarPerfil } from "../../../setores/catalogo";

describe("inferirNaturezaTributaria — nunca lê percentual do perfil, só classifica", () => {
  it("comércio e indústria caem no mesmo bucket (8%/12%), refletindo a própria lei", () => {
    expect(inferirNaturezaTributaria(buscarPerfil("varejo_generico")!)).toBe("comercio_industria_transporte_cargas");
    expect(inferirNaturezaTributaria(buscarPerfil("industria_transformacao")!)).toBe("comercio_industria_transporte_cargas");
  });

  it("frigorífico (industria + comercio) resolve para o mesmo bucket, sem ambiguidade — os dois arquétipos convergem", () => {
    expect(inferirNaturezaTributaria(buscarPerfil("frigorifico")!)).toBe("comercio_industria_transporte_cargas");
  });

  it("transporte de cargas e de passageiros são distinguidos pelo id específico do perfil, não pelo arquétipo genérico", () => {
    expect(inferirNaturezaTributaria(buscarPerfil("transporte_rodoviario_cargas")!)).toBe("comercio_industria_transporte_cargas");
    expect(inferirNaturezaTributaria(buscarPerfil("transporte_passageiros")!)).toBe("transporte_passageiros");
  });

  it("serviço e digital caem em prestação de serviços geral (32%)", () => {
    expect(inferirNaturezaTributaria(buscarPerfil("clinica_medica")!)).toBe("prestacao_servicos_geral");
    expect(inferirNaturezaTributaria(buscarPerfil("software_saas")!)).toBe("prestacao_servicos_geral");
  });

  it("construção civil (arquétipo 'construcao') não tem regra de presunção modelada nesta fase — indeterminada, nunca aproximada", () => {
    expect(inferirNaturezaTributaria(buscarPerfil("construcao_civil")!)).toBe("indeterminada");
  });

  it("locação e financeiro também ficam indeterminados — regimes diferenciados fora de escopo", () => {
    expect(inferirNaturezaTributaria(buscarPerfil("locadora_bens")!)).toBe("indeterminada");
    expect(inferirNaturezaTributaria(buscarPerfil("meios_pagamento")!)).toBe("indeterminada");
  });
});

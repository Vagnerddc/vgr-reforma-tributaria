import { describe, it, expect } from "vitest";
import { classificarAnexo } from "../anexo";
import { buscarPerfil } from "../../../setores/catalogo";

describe("classificarAnexo — nunca lê alíquota/faixa do PerfilSetorial", () => {
  it("comércio → Anexo I", () => {
    expect(classificarAnexo(buscarPerfil("varejo_generico")!)).toEqual({ anexo: "anexo_i" });
  });

  it("indústria pura → Anexo II", () => {
    expect(classificarAnexo(buscarPerfil("industria_transformacao")!)).toEqual({ anexo: "anexo_ii" });
  });

  it("frigorífico (comércio + indústria) é indeterminado — ambiguidade real, não resolvida por conveniência", () => {
    const r = classificarAnexo(buscarPerfil("frigorifico")!);
    expect(r.anexo).toBe("indeterminado");
  });

  it("transporte de cargas → Anexo III SEM depender de Fator R (LC 123/2006, art. 18, §5º-C, VI)", () => {
    expect(classificarAnexo(buscarPerfil("transporte_rodoviario_cargas")!)).toEqual({ anexo: "anexo_iii" });
  });

  it("prestação de serviços em geral → indeterminado_fator_r, nunca um palpite entre III e V", () => {
    const clinica = classificarAnexo(buscarPerfil("clinica_medica")!);
    const software = classificarAnexo(buscarPerfil("software_saas")!);
    expect(clinica.anexo).toBe("indeterminado_fator_r");
    expect(software.anexo).toBe("indeterminado_fator_r");
  });

  it("arquétipo financeiro é indeterminado, mesmo quando também é 'digital'", () => {
    const r = classificarAnexo(buscarPerfil("meios_pagamento")!);
    expect(r.anexo).toBe("indeterminado");
  });

  it("construção civil (arquétipo 'construcao') é indeterminado — fora do núcleo geral", () => {
    expect(classificarAnexo(buscarPerfil("construcao_civil")!).anexo).toBe("indeterminado");
  });
});

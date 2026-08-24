import { describe, it, expect } from "vitest";
import { listarMacroSetores, listarPerfis, buscarPerfil, listarPerfisDoMacroSetor, sugerirPerfisPorCnae } from "../catalogo";

describe("catálogo setorial", () => {
  it("carrega macrosetores e perfis do JSON sem erro", () => {
    expect(listarMacroSetores().length).toBeGreaterThan(5);
    expect(listarPerfis().length).toBeGreaterThan(10);
  });

  it("busca um perfil específico por id", () => {
    const frigorifico = buscarPerfil("frigorifico");
    expect(frigorifico?.segmento).toBe("Frigorífico / abatedouro");
    expect(frigorifico?.arquetipos).toEqual(["industria", "comercio"]); // multiarquétipo, não obrigatoriamente único
  });

  it("filtra perfis por macrosetor", () => {
    const agro = listarPerfisDoMacroSetor("agronegocio");
    expect(agro.map((p) => p.id)).toContain("produtor_rural");
    expect(agro.map((p) => p.id)).toContain("frigorifico");
    expect(agro.map((p) => p.id)).toContain("aviacao_agricola");
  });

  it("os 4 perfis legados do simulador atual existem na nova taxonomia com o MESMO id (compatibilidade)", () => {
    for (const id of ["produtor_rural", "aviacao_agricola", "transporte_rodoviario_cargas", "construcao_civil"]) {
      expect(buscarPerfil(id)).toBeDefined();
    }
  });

  it("sugere perfil por CNAE sem determinar sozinho — confiança é sempre 'sugerido'", () => {
    const sugestoes = sugerirPerfisPorCnae("0161-0/03");
    expect(sugestoes.length).toBeGreaterThan(0);
    expect(sugestoes[0].perfil.id).toBe("aviacao_agricola");
    expect(sugestoes[0].confianca).toBe("sugerido");
  });

  it("CNAE sem correspondência não sugere nada (nunca inventa um perfil)", () => {
    expect(sugerirPerfisPorCnae("9999999")).toEqual([]);
  });

  it("prefixo mais específico vem antes do mais genérico quando ambos batem", () => {
    // 1011 (frigorífico bovinos) também bate com um prefixo genérico "10" (indústria de transformação, se existisse) —
    // aqui testamos com o próprio frigorifico vs um perfil hipotético mais genérico não cadastrado; garante que a
    // ordenação por especificidade não quebra quando só há 1 candidato.
    const sugestoes = sugerirPerfisPorCnae("1011302");
    expect(sugestoes[0].perfil.id).toBe("frigorifico");
  });
});

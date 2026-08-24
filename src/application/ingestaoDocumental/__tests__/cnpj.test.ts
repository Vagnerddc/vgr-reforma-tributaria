import { describe, it, expect, vi, afterEach } from "vitest";
import { ingerirCnpj } from "../adapters/cnpj";

const DADOS_CNPJ = {
  cnpj: "12345678000199",
  razaoSocial: "EMPRESA TESTE LTDA",
  nomeFantasia: "TESTE",
  cnaePrincipalCodigo: "0161800",
  cnaePrincipalDescricao: "Atividades de apoio à agricultura",
  municipio: "SAO PAULO",
  uf: "SP",
  situacaoCadastral: "ATIVA",
  porte: "ME",
  opcaoPeloSimples: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ingerirCnpj — reaproveita api/cnpj.ts via lib/cnpj.ts", () => {
  it("normaliza o payload da API em CampoExtraido com origem 'cnpj' e não fabrica atividadePrincipal/regime", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => DADOS_CNPJ }));

    const resultado = await ingerirCnpj("12.345.678/0001-99", "doc-cnpj-1");

    expect(resultado.status).toBe("processado");
    expect(resultado.tipoDocumento).toBe("cnpj");
    const porObservacao = new Map(resultado.camposExtraidos.map((c) => [c.observacao, c.valor]));
    expect(porObservacao.get("razaoSocial")).toBe("EMPRESA TESTE LTDA");
    expect(porObservacao.get("uf")).toBe("SP");
    expect(porObservacao.get("opcaoPeloSimples")).toBe(true);
    // Nunca decide regime/perfil setorial sozinho — só dados cadastrais crus.
    expect(resultado.alertas.some((a) => a.codigo === "cnae_nao_determina_regime")).toBe(true);
  });

  it("devolve status 'falhou' com inconsistência legível quando a consulta falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ erro: "CNPJ não encontrado." }) }));

    const resultado = await ingerirCnpj("12345678000199", "doc-cnpj-2");

    expect(resultado.status).toBe("falhou");
    expect(resultado.camposExtraidos).toHaveLength(0);
    expect(resultado.inconsistencias[0].mensagem).toContain("não encontrado");
  });
});

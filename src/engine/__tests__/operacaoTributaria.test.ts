import { describe, it, expect } from "vitest";
import { avaliarCompletudeOperacao, gerarIdEstavelOperacao, campoComProveniencia as campo, type OperacaoTributariaNormalizada } from "../operacaoTributaria";

function operacaoVazia(): OperacaoTributariaNormalizada {
  return {
    id: "op-1",
    identificacao: {},
    produtoServico: {},
    classificacaoTributaria: {},
    valores: {},
    localidade: {},
    granularidade: "agregado",
  };
}

describe("avaliarCompletudeOperacao", () => {
  it("operação sem nenhum campo é insuficiente para o Motor Oficial, com todos os campos listados como faltantes", () => {
    const r = avaliarCompletudeOperacao(operacaoVazia());
    expect(r.completudeEntrada).toBe("insuficiente");
    expect(r.camposFaltantes).toEqual(expect.arrayContaining(["municipio", "uf", "ncm", "cst", "cClassTrib", "quantidade", "unidade", "valorOperacao"]));
    expect(r.qualidadeClassificacao).toBe("sem_dados");
  });

  it("operação com todos os campos exigidos, confirmados, é completa e com qualidade confirmada", () => {
    const op = operacaoVazia();
    op.localidade.municipio = campo("3550308", "sped", "confirmado");
    op.localidade.uf = campo("SP", "sped", "confirmado");
    op.produtoServico.ncm = campo("12345678", "sped", "confirmado");
    op.classificacaoTributaria.cst = campo("000", "sped", "confirmado");
    op.classificacaoTributaria.cClassTrib = campo("550020", "informado_usuario", "confirmado");
    op.produtoServico.quantidade = campo(1, "sped", "confirmado");
    op.produtoServico.unidade = campo("UN", "sped", "confirmado");
    op.valores.valorOperacao = campo(1000, "sped", "confirmado");

    const r = avaliarCompletudeOperacao(op);
    expect(r.completudeEntrada).toBe("completa");
    expect(r.camposFaltantes).toEqual([]);
    expect(r.qualidadeClassificacao).toBe("confirmada");
  });

  it("operação completa em campos, mas com cClassTrib apenas estimado, tem qualidadeClassificacao 'estimada' — separado de completude", () => {
    const op = operacaoVazia();
    op.localidade.municipio = campo("3550308", "sped", "confirmado");
    op.localidade.uf = campo("SP", "sped", "confirmado");
    op.produtoServico.ncm = campo("12345678", "sped", "confirmado");
    op.classificacaoTributaria.cst = campo("000", "sped", "confirmado");
    op.classificacaoTributaria.cClassTrib = campo("550020", "classificacao_vgr", "estimado");
    op.produtoServico.quantidade = campo(1, "sped", "confirmado");
    op.produtoServico.unidade = campo("UN", "sped", "confirmado");
    op.valores.valorOperacao = campo(1000, "sped", "confirmado");

    const r = avaliarCompletudeOperacao(op);
    // completa: os 8 campos existem, mesmo que um deles seja estimado
    expect(r.completudeEntrada).toBe("completa");
    expect(r.qualidadeClassificacao).toBe("estimada");
  });

  it("nunca inventa dado ausente: um campo com valor undefined conta como faltante, não como presente-e-vazio", () => {
    const op = operacaoVazia();
    op.classificacaoTributaria.cClassTrib = undefined;
    const r = avaliarCompletudeOperacao(op);
    expect(r.camposFaltantes).toContain("cClassTrib");
  });
});

describe("gerarIdEstavelOperacao", () => {
  it("usa a chave documental (ex.: chave de NF-e) quando disponível — estável mesmo se a ordem de leitura mudar", () => {
    const id1 = gerarIdEstavelOperacao({ chaveDocumental: "CHAVE_XXX", nomeArquivo: "a.txt", numeroDocumento: "123", numeroItem: "1" });
    const id2 = gerarIdEstavelOperacao({ chaveDocumental: "CHAVE_XXX", nomeArquivo: "outro-nome.txt", numeroDocumento: "999", numeroItem: "1" });
    expect(id1).toBe(id2); // mesma chave documental + mesmo item = mesma identidade, independente do arquivo/execução
  });

  it("cai numa chave determinística por arquivo+documento+item quando não há chave documental", () => {
    const id = gerarIdEstavelOperacao({ nomeArquivo: "efd.txt", numeroDocumento: "456", numeroItem: "2" });
    expect(id).toBe("efd.txt:456:2");
  });
});

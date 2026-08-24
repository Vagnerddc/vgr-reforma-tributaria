import { describe, it, expect } from "vitest";
import { analisarCorpusTemporal, formatarMes, gerarSequenciaMeses } from "../analiseTemporal";

function nfe(nNF: number, cnpjEmit: string, cnpjDest: string, dataEmissao: string, cClassTrib: string | undefined, tpNF: "0" | "1" = "1") {
  return `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${String(nNF).padStart(44, "0")}">
      <ide><mod>55</mod><nNF>${nNF}</nNF><dhEmi>${dataEmissao}</dhEmi><tpNF>${tpNF}</tpNF><cMunFG>3550308</cMunFG></ide>
      <emit><CNPJ>${cnpjEmit}</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
      <dest><CNPJ>${cnpjDest}</CNPJ><enderDest><UF>SP</UF></enderDest></dest>
      <det nItem="1">
        <prod><cProd>P</cProd><xProd>ITEM</xProd><NCM>12345678</NCM><CFOP>5101</CFOP><uCom>UN</uCom><qCom>1</qCom><vProd>100.00</vProd></prod>
        <imposto>${cClassTrib ? `<IBSCBS><CST>000</CST><cClassTrib>${cClassTrib}</cClassTrib></IBSCBS>` : `<ICMS><ICMS00><CST>00</CST></ICMS00></ICMS>`}</imposto>
      </det>
    </infNFe>
  </NFe>`;
}

const CNPJ_A = "11111111000100";
const CNPJ_B = "22222222000100";
const CONTRAPARTE = "99999999000100";

/** Resolver de teste: a empresa analisada é o prefixo de pasta do arquivo (ex.: "empresa1/nf1.xml" → "clienteA") — nunca inferida do conteúdo do XML. */
const proprietarioPorPasta = (nomeArquivo: string) => nomeArquivo.split("/")[0];

describe("gerarSequenciaMeses / formatarMes", () => {
  it("gera a sequência cronológica completa Jan/2026 a Ago/2026", () => {
    const meses = gerarSequenciaMeses("2026-01", "2026-08");
    expect(meses).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(meses.map(formatarMes)).toEqual(["Jan/2026", "Fev/2026", "Mar/2026", "Abr/2026", "Mai/2026", "Jun/2026", "Jul/2026", "Ago/2026"]);
  });
});

describe("analisarCorpusTemporal — proprietário do corpus é definido pelo contexto do arquivo, nunca inferido do XML", () => {
  it("uma nota de devolução (tpNF=entrada) EMITIDA pela própria empresa continua atribuída a ela, não ao destinatário — correção do bug encontrado com dados reais", () => {
    // A empresa "clienteA" emite uma devolução (tpNF=0) para uma contraparte externa.
    // A versão anterior (heurística por direção) atribuiria essa operação à CONTRAPARTE,
    // criando um "cliente" fantasma. Agora o proprietário vem do contexto (pasta), sempre clienteA.
    const arquivos = [
      { nomeArquivo: "empresa1/venda.xml", conteudo: nfe(1, CNPJ_A, CONTRAPARTE, "2026-01-05T10:00:00-03:00", "550020", "1") },
      { nomeArquivo: "empresa1/devolucao.xml", conteudo: nfe(2, CNPJ_A, CONTRAPARTE, "2026-01-06T10:00:00-03:00", undefined, "0") },
    ];
    const r = analisarCorpusTemporal(arquivos, "2026-01", "2026-08", proprietarioPorPasta);
    expect(r.porCliente).toHaveLength(1); // não cria um segundo "cliente" a partir da contraparte da devolução
    expect(r.porCliente[0].consolidadoPeriodo.documentos).toBe(2);
    const textoCompleto = JSON.stringify(r);
    expect(textoCompleto).not.toContain(CONTRAPARTE);
  });

  it("classifica corretamente no mês mesmo com os arquivos fora de ordem cronológica", () => {
    const arquivos = [
      { nomeArquivo: "empresa1/z-agosto.xml", conteudo: nfe(3, CNPJ_A, CONTRAPARTE, "2026-08-10T10:00:00-03:00", "550020") },
      { nomeArquivo: "empresa1/a-janeiro.xml", conteudo: nfe(1, CNPJ_A, CONTRAPARTE, "2026-01-05T10:00:00-03:00", undefined) },
      { nomeArquivo: "empresa1/m-marco.xml", conteudo: nfe(2, CNPJ_A, CONTRAPARTE, "2026-03-20T10:00:00-03:00", "550020") },
    ];
    const r = analisarCorpusTemporal(arquivos, "2026-01", "2026-08", proprietarioPorPasta);
    const cliente = r.porCliente[0];
    const jan = cliente.evolucaoMensal.find((l) => l.periodo === "Jan/2026")!;
    const mar = cliente.evolucaoMensal.find((l) => l.periodo === "Mar/2026")!;
    const ago = cliente.evolucaoMensal.find((l) => l.periodo === "Ago/2026")!;
    expect(jan.documentos).toBe(1);
    expect(jan.percentualRtc).toBe(0);
    expect(mar.documentos).toBe(1);
    expect(mar.percentualRtc).toBe(100);
    expect(ago.documentos).toBe(1);
    expect(ago.percentualRtc).toBe(100);
  });

  it("meses sem documento aparecem sinalizados como 'semDocumentos', nunca com dados inventados", () => {
    const arquivos = [{ nomeArquivo: "empresa1/1.xml", conteudo: nfe(1, CNPJ_A, CONTRAPARTE, "2026-01-05T10:00:00-03:00", "550020") }];
    const r = analisarCorpusTemporal(arquivos, "2026-01", "2026-08", proprietarioPorPasta);
    const fevereiro = r.porCliente[0].evolucaoMensal.find((l) => l.periodo === "Fev/2026")!;
    expect(fevereiro.semDocumentos).toBe(true);
    expect(fevereiro.documentos).toBe(0);
    expect(fevereiro.principalGap).toBeNull();
  });

  it("a sequência de meses no relatório é SEMPRE cronológica, independente da ordem de chegada dos arquivos", () => {
    const arquivos = [
      { nomeArquivo: "empresa1/1.xml", conteudo: nfe(3, CNPJ_A, CONTRAPARTE, "2026-08-01T10:00:00-03:00", "550020") },
      { nomeArquivo: "empresa1/2.xml", conteudo: nfe(1, CNPJ_A, CONTRAPARTE, "2026-01-01T10:00:00-03:00", "550020") },
    ];
    const r = analisarCorpusTemporal(arquivos, "2026-01", "2026-08", proprietarioPorPasta);
    expect(r.porCliente[0].evolucaoMensal.map((l) => l.periodo)).toEqual(["Jan/2026", "Fev/2026", "Mar/2026", "Abr/2026", "Mai/2026", "Jun/2026", "Jul/2026", "Ago/2026"]);
  });

  it("separa automaticamente dois clientes pelo contexto (pasta) e anonimiza como Cliente A / Cliente B — nunca expõe identificador real", () => {
    const arquivos = [
      { nomeArquivo: "empresa1/1.xml", conteudo: nfe(1, CNPJ_A, CONTRAPARTE, "2026-01-05T10:00:00-03:00", "550020") },
      { nomeArquivo: "empresa2/2.xml", conteudo: nfe(2, CNPJ_B, CONTRAPARTE, "2026-01-06T10:00:00-03:00", undefined) },
    ];
    const r = analisarCorpusTemporal(arquivos, "2026-01", "2026-08", proprietarioPorPasta);
    expect(r.porCliente).toHaveLength(2);
    expect(r.porCliente.map((c) => c.clienteAnonimo)).toEqual(["Cliente A", "Cliente B"]);
    const textoCompleto = JSON.stringify(r);
    expect(textoCompleto).not.toContain(CNPJ_A);
    expect(textoCompleto).not.toContain(CNPJ_B);
    expect(textoCompleto).not.toContain("empresa1");
    expect(textoCompleto).not.toContain("empresa2");
  });

  it("documento com data fora da janela 01/2026–08/2026 é contado em documentosForaDoPeriodo, não descartado silenciosamente nem alocado a um mês errado", () => {
    const arquivos = [{ nomeArquivo: "empresa1/1.xml", conteudo: nfe(1, CNPJ_A, CONTRAPARTE, "2025-12-15T10:00:00-03:00", "550020") }];
    const r = analisarCorpusTemporal(arquivos, "2026-01", "2026-08", proprietarioPorPasta);
    expect(r.documentosForaDoPeriodo).toBe(1);
    expect(r.consolidadoGeral.documentos).toBe(0);
  });

  it("consolida evolução mensal em um resumo do período completo por cliente, sem perder a granularidade mensal", () => {
    const arquivos = [
      { nomeArquivo: "empresa1/1.xml", conteudo: nfe(1, CNPJ_A, CONTRAPARTE, "2026-01-05T10:00:00-03:00", undefined) },
      { nomeArquivo: "empresa1/2.xml", conteudo: nfe(2, CNPJ_A, CONTRAPARTE, "2026-08-05T10:00:00-03:00", "550020") },
    ];
    const r = analisarCorpusTemporal(arquivos, "2026-01", "2026-08", proprietarioPorPasta);
    const cliente = r.porCliente[0];
    expect(cliente.consolidadoPeriodo.documentos).toBe(2);
    expect(cliente.consolidadoPeriodo.percentualRtc).toBeCloseTo(50);
    expect(cliente.evolucaoMensal.filter((l) => !l.semDocumentos)).toHaveLength(2);
  });
});

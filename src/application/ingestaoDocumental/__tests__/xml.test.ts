import { describe, it, expect } from "vitest";
import { ingerirLoteXml } from "../adapters/xml";
import { ingerirLoteNfse } from "../adapters/nfse";

const NFE_VALIDA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260112345678000199550010000001231000001234">
      <ide><cUF>35</cUF><natOp>VENDA</natOp><mod>55</mod><serie>1</serie><nNF>123</nNF><dhEmi>2026-01-15T10:00:00-03:00</dhEmi><tpNF>1</tpNF><cMunFG>3550308</cMunFG></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>EMPRESA TESTE</xNome><enderEmit><UF>SP</UF><cMun>3550308</cMun></enderEmit></emit>
      <dest><CNPJ>98765432000100</CNPJ><xNome>CLIENTE TESTE</xNome><enderDest><UF>RJ</UF><cMun>3304557</cMun></enderDest></dest>
      <det nItem="1">
        <prod><cProd>PROD001</cProd><xProd>PRODUTO A</xProd><NCM>84244900</NCM><CFOP>6101</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>500.00</vUnCom><vProd>1000.00</vProd><vDesc>0.00</vDesc></prod>
        <imposto><ICMS><ICMS00><CST>00</CST><vBC>1000.00</vBC></ICMS00></ICMS></imposto>
      </det>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>35260112345678000199550010000001231000001234</chNFe><cStat>100</cStat></infProt></protNFe>
</nfeProc>`;

describe("ingerirLoteXml — wrapper fino de engine/xml/lote.ts", () => {
  it("processa o lote e devolve as operações já deduplicadas, sem reimplementar o parser", () => {
    const { resultado, operacoes } = ingerirLoteXml([{ nomeArquivo: "nfe1.xml", conteudo: NFE_VALIDA }]);
    expect(resultado.status).toBe("processado");
    expect(operacoes).toHaveLength(1);
  });

  it("um XML duplicado no lote não duplica a operação resultante", () => {
    const { operacoes, resultado } = ingerirLoteXml([{ nomeArquivo: "nfe1.xml", conteudo: NFE_VALIDA }, { nomeArquivo: "nfe1-copia.xml", conteudo: NFE_VALIDA }]);
    expect(operacoes).toHaveLength(1);
    expect(resultado.metadados.duplicadosIgnorados).toBe(1);
  });

  it("um arquivo inválido no lote não quebra o processamento dos demais", () => {
    const { operacoes, resultado } = ingerirLoteXml([{ nomeArquivo: "invalido.xml", conteudo: "isto nao é um xml válido" }, { nomeArquivo: "nfe1.xml", conteudo: NFE_VALIDA }]);
    expect(operacoes).toHaveLength(1);
    expect(resultado.status).toBe("processado_com_ressalvas");
    expect(resultado.inconsistencias).toHaveLength(1);
  });
});

describe("ingerirLoteNfse — contrato preparado, sem implementação real", () => {
  it("declara explicitamente a limitação, sem fingir suporte", () => {
    const { resultado } = ingerirLoteNfse([{ nomeArquivo: "nfse1.xml", conteudo: "<qualquer/>" }]);
    expect(resultado.status).toBe("falhou");
    expect(resultado.limitacoes.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { parseNfeXml } from "../nfe";

const NFE_LEGADA_2_ITENS = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260112345678000199550010000001231000001234">
      <ide>
        <cUF>35</cUF>
        <natOp>VENDA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>123</nNF>
        <dhEmi>2026-01-15T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <cMunFG>3550308</cMunFG>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>EMPRESA TESTE</xNome>
        <enderEmit><UF>SP</UF><cMun>3550308</cMun></enderEmit>
      </emit>
      <dest>
        <CNPJ>98765432000100</CNPJ>
        <xNome>CLIENTE TESTE</xNome>
        <enderDest><UF>RJ</UF><cMun>3304557</cMun></enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>PROD001</cProd>
          <xProd>PRODUTO A</xProd>
          <NCM>84244900</NCM>
          <CFOP>6101</CFOP>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>500.00</vUnCom>
          <vProd>1000.00</vProd>
          <vDesc>0.00</vDesc>
        </prod>
        <imposto>
          <ICMS><ICMS00><CST>00</CST><vBC>1000.00</vBC></ICMS00></ICMS>
        </imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PROD002</cProd>
          <xProd>PRODUTO B</xProd>
          <NCM>39235000</NCM>
          <CFOP>6101</CFOP>
          <uCom>CX</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>50.00</vUnCom>
          <vProd>500.00</vProd>
        </prod>
        <imposto>
          <ICMS><ICMS40><CST>40</CST></ICMS40></ICMS>
        </imposto>
      </det>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>35260112345678000199550010000001231000001234</chNFe><cStat>100</cStat></infProt></protNFe>
</nfeProc>`;

const NFE_RTC_1_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35260112345678000199550010000004561000005678">
    <ide>
      <mod>55</mod>
      <nNF>456</nNF>
      <dhEmi>2026-06-01T09:00:00-03:00</dhEmi>
      <tpNF>1</tpNF>
      <cMunFG>3550308</cMunFG>
    </ide>
    <emit><CNPJ>12345678000199</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
    <dest><CNPJ>11122233000144</CNPJ><enderDest><UF>SP</UF></enderDest></dest>
    <det nItem="1">
      <prod>
        <cProd>PROD003</cProd>
        <xProd>PRODUTO RTC</xProd>
        <NCM>12345678</NCM>
        <CFOP>5101</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vProd>2000.00</vProd>
      </prod>
      <imposto>
        <IBSCBS><CST>000</CST><cClassTrib>550020</cClassTrib></IBSCBS>
      </imposto>
    </det>
  </infNFe>
</NFe>`;

const XML_INVALIDO = `isto não é um xml <de forma alguma`;

const NFSE_NAO_SUPORTADA = `<?xml version="1.0"?><NFe><infNFe Id="x"><ide><mod>65</mod></ide></infNFe></NFe>`;

describe("parseNfeXml — extrai OperacaoTributariaNormalizada por item", () => {
  it("extrai 2 operações a partir de uma NF-e com 2 itens, preservando NCM/CFOP/quantidade/unidade/valor individualmente", () => {
    const r = parseNfeXml("nfe1.xml", NFE_LEGADA_2_ITENS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.operacoes).toHaveLength(2);

    const item1 = r.operacoes[0];
    expect(item1.produtoServico.ncm?.valor).toBe("84244900");
    expect(item1.classificacaoTributaria.cfop?.valor).toBe("6101");
    expect(item1.produtoServico.quantidade?.valor).toBe(2);
    expect(item1.produtoServico.unidade?.valor).toBe("UN");
    expect(item1.valores.valorOperacao?.valor).toBe(1000);
    expect(item1.classificacaoTributaria.cst?.valor).toBe("00"); // extraído do grupo dinâmico ICMS00

    const item2 = r.operacoes[1];
    expect(item2.produtoServico.ncm?.valor).toBe("39235000");
    expect(item2.classificacaoTributaria.cst?.valor).toBe("40"); // grupo dinâmico ICMS40, nome diferente do item 1
  });

  it("preenche município a partir de cMunFG (fato gerador) — mais confiável que a aproximação por empresa usada no SPED", () => {
    const r = parseNfeXml("nfe1.xml", NFE_LEGADA_2_ITENS);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.operacoes[0].localidade.municipio?.valor).toBe("3550308");
    expect(r.operacoes[0].localidade.municipio?.status).toBe("confirmado"); // não "estimado" como no SPED
  });

  it("marca proveniência de todo campo como origem xml, status confirmado", () => {
    const r = parseNfeXml("nfe1.xml", NFE_LEGADA_2_ITENS);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.operacoes[0].produtoServico.ncm?.origem).toBe("xml");
    expect(r.operacoes[0].produtoServico.ncm?.status).toBe("confirmado");
  });

  it("não inventa cClassTrib em NF-e legada sem o grupo IBSCBS — ausência estrutural, não erro", () => {
    const r = parseNfeXml("nfe1.xml", NFE_LEGADA_2_ITENS);
    if (!r.ok) throw new Error("esperava sucesso");
    for (const op of r.operacoes) {
      expect(op.classificacaoTributaria.cClassTrib).toBeUndefined();
    }
  });

  it("quando ICMS legado E IBSCBS coexistem no mesmo item (documento de transição, LC 214/2025), o CST do grupo IBSCBS tem prioridade — é o que o contrato do Motor Oficial espera (3 dígitos), não o CST legado de 2-3 dígitos", () => {
    const NFE_TRANSICAO_DOIS_GRUPOS = `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe Id="NFeCHAVE_TRANSICAO">
        <ide><mod>55</mod><nNF>1</nNF><tpNF>1</tpNF><cMunFG>3550308</cMunFG></ide>
        <emit><CNPJ>1</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
        <dest><CNPJ>2</CNPJ><enderDest><UF>SP</UF></enderDest></dest>
        <det nItem="1">
          <prod><cProd>P</cProd><xProd>ITEM</xProd><NCM>12345678</NCM><CFOP>5403</CFOP><uCom>UN</uCom><qCom>1</qCom><vProd>100.00</vProd></prod>
          <imposto>
            <ICMS><ICMS00><CST>00</CST></ICMS00></ICMS>
            <IBSCBS><CST>550</CST><cClassTrib>550020</cClassTrib></IBSCBS>
          </imposto>
        </det>
      </infNFe>
    </NFe>`;
    const r = parseNfeXml("transicao.xml", NFE_TRANSICAO_DOIS_GRUPOS);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.operacoes[0].classificacaoTributaria.cst?.valor).toBe("550"); // não "00"
  });

  it("extrai cClassTrib quando o documento tem o grupo IBSCBS (padrão RTC)", () => {
    const r = parseNfeXml("nfe-rtc.xml", NFE_RTC_1_ITEM);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.operacoes[0].classificacaoTributaria.cClassTrib?.valor).toBe("550020");
    expect(r.operacoes[0].classificacaoTributaria.cClassTrib?.origem).toBe("xml");
  });

  it("gera a mesma chave/id a partir do Id do infNFe (com prefixo NFe) e do chNFe do protNFe", () => {
    const r = parseNfeXml("nfe1.xml", NFE_LEGADA_2_ITENS);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.chave).toBe("35260112345678000199550010000001231000001234");
    expect(r.operacoes[0].id).toBe("35260112345678000199550010000001231000001234-1");
  });

  it("XML sintaticamente inválido retorna erro isolado (erro_parse), não lança exceção", () => {
    const r = parseNfeXml("invalido.xml", XML_INVALIDO);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("erro_parse");
  });

  it("documento de modelo diferente (ex.: 65/NFC-e) é reportado como tipo_nao_suportado, não interpretado incorretamente", () => {
    const r = parseNfeXml("nfce.xml", NFSE_NAO_SUPORTADA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("tipo_nao_suportado");
  });
});

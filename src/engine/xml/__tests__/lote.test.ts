import { describe, it, expect } from "vitest";
import { processarLoteXml, medirCobertura } from "../lote";

const NFE_A = `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFeCHAVE_A">
    <ide><mod>55</mod><nNF>1</nNF><tpNF>1</tpNF><cMunFG>3550308</cMunFG></ide>
    <emit><CNPJ>12345678000199</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
    <dest><CNPJ>1</CNPJ><enderDest><UF>SP</UF></enderDest></dest>
    <det nItem="1">
      <prod><cProd>P1</cProd><xProd>ITEM</xProd><NCM>12345678</NCM><CFOP>5101</CFOP><uCom>UN</uCom><qCom>1</qCom><vProd>100.00</vProd></prod>
      <imposto><ICMS><ICMS00><CST>00</CST></ICMS00></ICMS></imposto>
    </det>
  </infNFe>
</NFe>`;

const NFE_B_COMPLETA_RTC = `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFeCHAVE_B">
    <ide><mod>55</mod><nNF>2</nNF><tpNF>1</tpNF><cMunFG>3304557</cMunFG></ide>
    <emit><CNPJ>12345678000199</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
    <dest><CNPJ>2</CNPJ><enderDest><UF>RJ</UF></enderDest></dest>
    <det nItem="1">
      <prod><cProd>P2</cProd><xProd>ITEM RTC</xProd><NCM>87654321</NCM><CFOP>5101</CFOP><uCom>UN</uCom><qCom>1</qCom><vProd>200.00</vProd></prod>
      <imposto><IBSCBS><CST>000</CST><cClassTrib>550020</cClassTrib></IBSCBS></imposto>
    </det>
  </infNFe>
</NFe>`;

const XML_INVALIDO = `<naoehxml sem fechar`;

describe("processarLoteXml", () => {
  it("processa múltiplos documentos, um documento inválido não interrompe o lote", () => {
    const r = processarLoteXml([
      { nomeArquivo: "a.xml", conteudo: NFE_A },
      { nomeArquivo: "invalido.xml", conteudo: XML_INVALIDO },
      { nomeArquivo: "b.xml", conteudo: NFE_B_COMPLETA_RTC },
    ]);
    expect(r.documentosProcessados).toBe(2);
    expect(r.documentosComErro).toHaveLength(1);
    expect(r.documentosComErro[0].nomeArquivo).toBe("invalido.xml");
    expect(r.operacoes).toHaveLength(2);
  });

  it("deduplica o mesmo XML importado duas vezes — mesma chave/item não gera duas operações", () => {
    const r = processarLoteXml([
      { nomeArquivo: "a.xml", conteudo: NFE_A },
      { nomeArquivo: "a-copia.xml", conteudo: NFE_A }, // mesmo conteúdo, nome de arquivo diferente (cópia)
    ]);
    expect(r.operacoes).toHaveLength(1);
    expect(r.duplicadosIgnorados).toBe(1);
    expect(r.documentosProcessados).toBe(2); // os dois arquivos foram lidos com sucesso — a dedup é da operação, não do parse
  });
});

describe("medirCobertura", () => {
  it("mede presença por campo e elegibilidade normativa diretamente sobre as operações extraídas", () => {
    const lote = processarLoteXml([
      { nomeArquivo: "a.xml", conteudo: NFE_A }, // sem cClassTrib
      { nomeArquivo: "b.xml", conteudo: NFE_B_COMPLETA_RTC }, // com cClassTrib
    ]);
    const cobertura = medirCobertura(lote.operacoes);
    expect(cobertura.totalOperacoes).toBe(2);
    expect(cobertura.presencaPorCampo.cClassTrib.quantidade).toBe(1);
    expect(cobertura.presencaPorCampo.cClassTrib.percentual).toBeCloseTo(50);
    expect(cobertura.elegiveisNormativa).toBe(1); // só a operação com IBSCBS está completa
    expect(cobertura.percentualElegivelNormativa).toBeCloseTo(50);
    expect(cobertura.motivosInelegibilidade.cClassTrib).toBeCloseTo(50); // a operação A conta como inelegível por esse motivo
  });

  it("cobertura de lote vazio não divide por zero", () => {
    const cobertura = medirCobertura([]);
    expect(cobertura.totalOperacoes).toBe(0);
    expect(cobertura.percentualElegivelNormativa).toBe(0);
  });

  it("exposição tributária (base) nunca é aproximada pelo valor bruto quando ausente — conta como 'não determinada'", () => {
    // Nenhum dos dois fixtures acima informa vBC — base tributária deve ficar indeterminada, não igual ao vProd.
    const lote = processarLoteXml([{ nomeArquivo: "a.xml", conteudo: NFE_A }]);
    const cobertura = medirCobertura(lote.operacoes);
    expect(cobertura.exposicaoTributaria.operacoesSemBaseDeterminada).toBe(1);
    expect(cobertura.exposicaoTributaria.baseTotalConhecida).toBe(0);
    expect(cobertura.exposicaoTributaria.percentualElegivelPorBase).toBe(0); // "não determinada", não confundido com 0% real
  });

  it("valor bruto movimentado e exposição tributária por base são métricas distintas — um valor alto de NF-e não implica base tributária proporcional", () => {
    const NFE_REMESSA_ALTO_VALOR_SEM_BASE = `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe Id="NFeCHAVE_REMESSA">
        <ide><mod>55</mod><nNF>9</nNF><tpNF>1</tpNF><cMunFG>3550308</cMunFG></ide>
        <emit><CNPJ>1</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
        <dest><CNPJ>2</CNPJ><enderDest><UF>SP</UF></enderDest></dest>
        <det nItem="1">
          <prod><cProd>P</cProd><xProd>REMESSA</xProd><NCM>12345678</NCM><CFOP>5905</CFOP><uCom>UN</uCom><qCom>1</qCom><vProd>1000000.00</vProd></prod>
          <imposto><IBSCBS><CST>550</CST><cClassTrib>550020</cClassTrib></IBSCBS></imposto>
        </det>
      </infNFe>
    </NFe>`; // sem <gIBSCBS><vBC> — base tributária não informada, mesmo com valor bruto alto
    const lote = processarLoteXml([{ nomeArquivo: "remessa.xml", conteudo: NFE_REMESSA_ALTO_VALOR_SEM_BASE }, { nomeArquivo: "b.xml", conteudo: NFE_B_COMPLETA_RTC }]);
    const cobertura = medirCobertura(lote.operacoes);
    // por valor bruto, a remessa domina o total (R$ 1.000.000 vs R$ 200) e está elegível — 100% elegível por valor
    expect(cobertura.valorPonderado.percentualElegivelPorValor).toBeCloseTo(100);
    // por base tributária, a remessa não tem base determinada — só a operação B entra na conta
    expect(cobertura.exposicaoTributaria.operacoesSemBaseDeterminada).toBe(2); // nem a remessa nem a B informam vBC neste fixture
    expect(cobertura.exposicaoTributaria.baseTotalConhecida).toBe(0);
  });
});

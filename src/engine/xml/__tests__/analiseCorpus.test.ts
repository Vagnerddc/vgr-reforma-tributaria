import { describe, it, expect } from "vitest";
import { analisarLote, analisarCorpus } from "../analiseCorpus";

function nfe(nNF: number, cClassTrib: string | undefined, ncm: string | undefined = "12345678") {
  return `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${String(nNF).padStart(44, "0")}">
      <ide><mod>55</mod><nNF>${nNF}</nNF><tpNF>1</tpNF><cMunFG>3550308</cMunFG></ide>
      <emit><CNPJ>12345678000199</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
      <dest><CNPJ>1</CNPJ><enderDest><UF>SP</UF></enderDest></dest>
      <det nItem="1">
        <prod><cProd>P</cProd><xProd>ITEM</xProd>${ncm ? `<NCM>${ncm}</NCM>` : ""}<CFOP>5101</CFOP><uCom>UN</uCom><qCom>1</qCom><vProd>100.00</vProd></prod>
        <imposto>${cClassTrib ? `<IBSCBS><CST>000</CST><cClassTrib>${cClassTrib}</cClassTrib></IBSCBS>` : `<ICMS><ICMS00><CST>00</CST></ICMS00></ICMS>`}</imposto>
      </det>
    </infNFe>
  </NFe>`;
}

describe("analisarLote", () => {
  it("classifica padrão RTC/legado pela presença de cClassTrib — critério objetivo, sem inferir por NCM/CFOP/CST", () => {
    const lote = {
      rotulo: "Cliente Teste — jul/2026",
      arquivos: [
        { nomeArquivo: "1.xml", conteudo: nfe(1, "550020") }, // RTC
        { nomeArquivo: "2.xml", conteudo: nfe(2, "550020") }, // RTC
        { nomeArquivo: "3.xml", conteudo: nfe(3, undefined) }, // legado
        { nomeArquivo: "4.xml", conteudo: nfe(4, undefined) }, // legado
      ],
    };
    const r = analisarLote(lote);
    expect(r.rotulo).toBe("Cliente Teste — jul/2026");
    expect(r.operacoesNormalizadas).toBe(4);
    expect(r.percentualRtc).toBeCloseTo(50);
  });

  it("o rótulo é o único identificador do lote no relatório — nada de CNPJ/razão social é exposto na estrutura de saída", () => {
    const r = analisarLote({ rotulo: "Cliente X", arquivos: [{ nomeArquivo: "1.xml", conteudo: nfe(1, "550020") }] });
    const chaves = JSON.stringify(r);
    expect(chaves).not.toContain("12345678000199"); // CNPJ do emitente do fixture não aparece no relatório
  });

  it("ranking de motivos de inelegibilidade vem ordenado do maior para o menor percentual", () => {
    const r = analisarLote({
      rotulo: "L",
      arquivos: [
        { nomeArquivo: "1.xml", conteudo: nfe(1, undefined) }, // falta cClassTrib
        { nomeArquivo: "2.xml", conteudo: nfe(2, undefined, undefined) }, // falta cClassTrib E NCM
      ],
    });
    expect(r.rankingMotivosInelegibilidade[0].campo).toBe("cClassTrib");
    expect(r.rankingMotivosInelegibilidade[0].percentual).toBeGreaterThanOrEqual(r.rankingMotivosInelegibilidade[1]?.percentual ?? 0);
  });
});

describe("analisarCorpus — distribuição por cliente/período + recomendação", () => {
  it("consolida múltiplos lotes e recomenda cenário A quando adoção RTC é alta", () => {
    const arquivosRtc = Array.from({ length: 9 }, (_, i) => ({ nomeArquivo: `${i}.xml`, conteudo: nfe(i + 1, "550020") }));
    const arquivosLegado = [{ nomeArquivo: "9.xml", conteudo: nfe(10, undefined) }];
    const r = analisarCorpus([{ rotulo: "Cliente A — jul/2026", arquivos: [...arquivosRtc, ...arquivosLegado] }]);
    expect(r.consolidado.percentualRtc).toBeCloseTo(90);
    expect(r.recomendacao.cenarioSugerido).toBe("A");
  });

  it("recomenda cenário C quando adoção RTC é baixa", () => {
    const r = analisarCorpus([{ rotulo: "Cliente B", arquivos: [{ nomeArquivo: "1.xml", conteudo: nfe(1, undefined) }] }]);
    expect(r.consolidado.percentualRtc).toBe(0);
    expect(r.recomendacao.cenarioSugerido).toBe("C");
  });

  it("mantém a distribuição por lote separada, mesmo consolidando o total", () => {
    const r = analisarCorpus([
      { rotulo: "Cliente A", arquivos: [{ nomeArquivo: "a.xml", conteudo: nfe(1, "550020") }] },
      { rotulo: "Cliente B", arquivos: [{ nomeArquivo: "b.xml", conteudo: nfe(2, undefined) }] },
    ]);
    expect(r.porLote).toHaveLength(2);
    expect(r.porLote.find((l) => l.rotulo === "Cliente A")?.percentualRtc).toBe(100);
    expect(r.porLote.find((l) => l.rotulo === "Cliente B")?.percentualRtc).toBe(0);
    expect(r.consolidado.operacoesNormalizadas).toBe(2);
  });

  it("erros de documentos inválidos aparecem só como nome de arquivo + motivo, nunca o conteúdo do XML", () => {
    const r = analisarCorpus([{ rotulo: "Cliente C", arquivos: [{ nomeArquivo: "ruim.xml", conteudo: "<naofecha" }] }]);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0].nomeArquivo).toBe("ruim.xml");
    expect(JSON.stringify(r.erros)).not.toContain("naofecha");
  });
});

function nfeComValor(nNF: number, cClassTrib: string | undefined, valor: number) {
  return `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${String(nNF).padStart(44, "0")}">
      <ide><mod>55</mod><nNF>${nNF}</nNF><tpNF>1</tpNF><cMunFG>3550308</cMunFG></ide>
      <emit><CNPJ>1</CNPJ><enderEmit><UF>SP</UF></enderEmit></emit>
      <dest><CNPJ>2</CNPJ><enderDest><UF>SP</UF></enderDest></dest>
      <det nItem="1">
        <prod><cProd>P</cProd><xProd>ITEM</xProd><NCM>12345678</NCM><CFOP>5101</CFOP><uCom>UN</uCom><qCom>1</qCom><vProd>${valor.toFixed(2)}</vProd></prod>
        <imposto>${cClassTrib ? `<IBSCBS><CST>000</CST><cClassTrib>${cClassTrib}</cClassTrib></IBSCBS>` : `<ICMS><ICMS00><CST>00</CST></ICMS00></ICMS>`}</imposto>
      </det>
    </infNFe>
  </NFe>`;
}

describe("elegibilidade ponderada por valor financeiro", () => {
  it("10 mil itens de baixo valor elegíveis e 1 item de alto valor inelegível pesam diferente por item e por valor", () => {
    // 10 itens pequenos (R$ 10 cada, elegíveis) + 1 item grande (R$ 100.000, inelegível)
    const pequenos = Array.from({ length: 10 }, (_, i) => ({ nomeArquivo: `p${i}.xml`, conteudo: nfeComValor(i + 1, "550020", 10) }));
    const grande = [{ nomeArquivo: "grande.xml", conteudo: nfeComValor(100, undefined, 100_000) }];
    const r = analisarCorpus([{ rotulo: "Cliente Concentrado", arquivos: [...pequenos, ...grande] }]);

    // por item: 10/11 elegíveis ≈ 90,9%
    expect(r.consolidado.percentualElegivelNormativa).toBeCloseTo((10 / 11) * 100, 0);
    // por valor: só R$ 100 dos R$ 100.100 totais são elegíveis ≈ 0,1% — divergência enorme do percentual por item
    expect(r.consolidado.percentualElegivelPorValor).toBeLessThan(1);
    // a ressalva de divergência item×valor deve aparecer, sinalizando que o cenário é PIOR do que 90,9% sugere
    expect(r.recomendacao.ressalvas.some((texto) => texto.includes("PIOR"))).toBe(true);
  });

  it("percentualInelegiveisSoPorCClassTrib identifica quando o gap é resolvido só com classificação de cClassTrib", () => {
    const r = analisarCorpus([
      {
        rotulo: "Cliente Único Gap",
        arquivos: [
          { nomeArquivo: "1.xml", conteudo: nfeComValor(1, undefined, 100) }, // só falta cClassTrib
          { nomeArquivo: "2.xml", conteudo: nfeComValor(2, undefined, 100) }, // só falta cClassTrib
        ],
      },
    ]);
    expect(r.consolidado.percentualInelegiveisSoPorCClassTrib).toBe(100);
    expect(r.recomendacao.ressalvas.some((texto) => texto.includes("resolveria a maior parte do gap"))).toBe(true);
  });
});

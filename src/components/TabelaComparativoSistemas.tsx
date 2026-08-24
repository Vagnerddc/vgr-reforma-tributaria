import type { ResultadoAno } from "../engine/types";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function pct(v: number, faturamento: number) {
  if (faturamento <= 0) return "—";
  return ((v / faturamento) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}
function celula(v: number, faturamento: number) {
  return `${moeda(v)} (${pct(v, faturamento)})`;
}

interface TabelaComparativoSistemasProps {
  anos: ResultadoAno[];
  faturamentoAnual: number;
}

/**
 * Compara, ano a ano, o que seria devido no sistema antigo (PIS/Cofins +
 * ICMS/IPI, seguindo o cronograma legal de extinção) com o sistema novo
 * (CBS + IBS efetivo já apurado). Cada valor em R$ e em % do faturamento.
 */
export function TabelaComparativoSistemas({ anos, faturamentoAnual }: TabelaComparativoSistemasProps) {
  return (
    <div className="tabela-scroll">
      <table className="tabela-detalhamento">
        <thead>
          <tr>
            <th rowSpan={2}>Ano</th>
            <th colSpan={3} className="grupo-inicio">Sistema antigo</th>
            <th colSpan={1} className="grupo-inicio">Sistema novo</th>
            <th colSpan={2} className="grupo-inicio">Diferença</th>
          </tr>
          <tr>
            <th className="grupo-inicio">PIS/COFINS</th>
            <th>ICMS/IPI</th>
            <th>Total</th>
            <th className="grupo-inicio">CBS + IBS</th>
            <th className="grupo-inicio">R$</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {anos.map((a) => {
            const diferenca = a.cargaNovaPropriaEmpresa - a.sistemaAntigoProjetadoTotal;
            const diferencaPct =
              a.sistemaAntigoProjetadoTotal > 0 ? diferenca / a.sistemaAntigoProjetadoTotal : 0;
            return (
              <tr key={a.ano}>
                <td>{a.ano}</td>
                <td className="grupo-inicio">{celula(a.pisCofinsProjetado, faturamentoAnual)}</td>
                <td>{celula(a.icmsIpiProjetado, faturamentoAnual)}</td>
                <td>
                  <strong>{celula(a.sistemaAntigoProjetadoTotal, faturamentoAnual)}</strong>
                </td>
                <td className="grupo-inicio">
                  <strong>{celula(a.cargaNovaPropriaEmpresa, faturamentoAnual)}</strong>
                </td>
                <td className="grupo-inicio">{moeda(diferenca)}</td>
                <td>{(diferencaPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tabela-nota">
        Sistema antigo projetado a partir das alíquotas informadas hoje, já líquido de
        crédito sobre os insumos/custos creditáveis quando aplicável — PIS/Cofins não
        cumulativo (Lucro Real) e ICMS de regime normal (Lucro Real/Presumido) geram
        crédito; PIS/Cofins cumulativo (Lucro Presumido) e o DAS do Simples não. Segue o
        cronograma legal: PIS/Cofins some integralmente em 2027 (substituído pela CBS);
        ICMS/IPI cai gradualmente de 2029 a 2033, na mesma proporção em que o IBS avança
        (substituído pelo IBS).
      </p>
    </div>
  );
}

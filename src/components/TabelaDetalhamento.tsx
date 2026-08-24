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

interface TabelaDetalhamentoProps {
  anos: ResultadoAno[];
  faturamentoAnual: number;
}

/**
 * Tabela ano a ano de débito, crédito e carga efetiva — desmembrada em CBS,
 * IBS e Total, cada valor em R$ e em % do faturamento. Complementa o gráfico
 * com o detalhamento numérico exato.
 */
export function TabelaDetalhamento({ anos, faturamentoAnual }: TabelaDetalhamentoProps) {
  return (
    <div className="tabela-scroll">
      <table className="tabela-detalhamento">
        <thead>
          <tr>
            <th rowSpan={2}>Ano</th>
            <th colSpan={3} className="grupo-inicio">CBS</th>
            <th colSpan={3} className="grupo-inicio">IBS</th>
            <th colSpan={3} className="grupo-inicio">Total (CBS + IBS)</th>
          </tr>
          <tr>
            <th className="grupo-inicio">Débito</th>
            <th>Crédito</th>
            <th>Efetivo</th>
            <th className="grupo-inicio">Débito</th>
            <th>Crédito</th>
            <th>Efetivo</th>
            <th className="grupo-inicio">Débito</th>
            <th>Crédito</th>
            <th>Efetivo</th>
          </tr>
        </thead>
        <tbody>
          {anos.map((a) => (
            <tr key={a.ano}>
              <td>{a.ano}</td>
              <td className="grupo-inicio">{celula(a.debitoBrutoCbs, faturamentoAnual)}</td>
              <td>{celula(a.creditoApuradoCbs, faturamentoAnual)}</td>
              <td>{celula(a.efetivoCbs, faturamentoAnual)}</td>
              <td className="grupo-inicio">{celula(a.debitoBrutoIbs, faturamentoAnual)}</td>
              <td>{celula(a.creditoApuradoIbs, faturamentoAnual)}</td>
              <td>{celula(a.efetivoIbs, faturamentoAnual)}</td>
              <td className="grupo-inicio">{celula(a.debitoBruto, faturamentoAnual)}</td>
              <td>{celula(a.creditoApurado, faturamentoAnual)}</td>
              <td>
                <strong>{celula(a.cargaNovaPropriaEmpresa, faturamentoAnual)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tabela-nota">
        Para o Simples Nacional (unificado e a parcela de DAS residual do híbrido), o
        desmembramento entre CBS e IBS é uma alocação proporcional pela alíquota de
        referência — a lei não separa os dois tributos dentro do DAS.
      </p>
    </div>
  );
}

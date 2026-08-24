/**
 * Tabela comparativa de regimes (seção 6 do pedido) — indisponível
 * nunca aparece como `0`; cada motivo tem um rótulo próprio.
 */

import { Card } from "../../design-system";
import { formatarPercentualPt, formatarReais, ROTULO_FORA_DA_COMPARACAO, ROTULO_INDISPONIVEL, ROTULO_NAO_CALCULADO } from "../formatters";
import type { CelulaTabela, LinhaComparacaoRegime } from "../viewModels/comparacaoRegimes";

function celulaTexto(celula: CelulaTabela, formatar: (v: number) => string): string {
  if (celula.disponivel) return formatar(celula.valor);
  if (celula.motivo === "fora_da_comparacao") return ROTULO_FORA_DA_COMPARACAO;
  if (celula.motivo === "nao_calculado") return ROTULO_NAO_CALCULADO;
  return ROTULO_INDISPONIVEL;
}

export function ComparacaoRegimesTabela({ linhas }: { linhas: LinhaComparacaoRegime[] }) {
  if (linhas.length === 0) return null;

  return (
    <Card title="Comparação entre regimes">
      <table className="vgr-table">
        <thead>
          <tr>
            <th>Indicador</th>
            {linhas.map((l) => (
              <th key={l.regime}>{l.regime}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Carga</td>
            {linhas.map((l) => (
              <td key={l.regime}>{celulaTexto(l.carga, formatarReais)}</td>
            ))}
          </tr>
          <tr>
            <td>Margem</td>
            {linhas.map((l) => (
              <td key={l.regime}>{celulaTexto(l.margem, (v) => formatarPercentualPt(v * 100))}</td>
            ))}
          </tr>
          <tr>
            <td>Resultado</td>
            {linhas.map((l) => (
              <td key={l.regime}>{celulaTexto(l.resultado, formatarReais)}</td>
            ))}
          </tr>
          <tr>
            <td>Capital de giro</td>
            {linhas.map((l) => (
              <td key={l.regime}>{celulaTexto(l.capitalGiro, formatarReais)}</td>
            ))}
          </tr>
          <tr>
            <td>Custo financeiro</td>
            {linhas.map((l) => (
              <td key={l.regime}>{celulaTexto(l.custoFinanceiro, formatarReais)}</td>
            ))}
          </tr>
          <tr>
            <td>Qualidade</td>
            {linhas.map((l) => (
              <td key={l.regime}>{l.qualidade}</td>
            ))}
          </tr>
          <tr>
            <td>Status jurídico</td>
            {linhas.map((l) => (
              <td key={l.regime}>{l.statusJuridico}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

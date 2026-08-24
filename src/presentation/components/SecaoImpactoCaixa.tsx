/**
 * "Impacto no Caixa" (seção 5-8 do pedido) — indisponível nunca aparece
 * como R$ 0; premissas materiais ficam visíveis na própria seção,
 * nunca só em tooltip.
 */

import { Alert, Card } from "../../design-system";
import { formatarReais, ROTULO_INDISPONIVEL } from "../formatters";
import type { CaixaExecutivoViewModel, MetricaCaixa } from "../viewModels/caixa";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function celula(m: MetricaCaixa): string {
  if (m.disponivel) return formatarReais(m.valor!);
  return m.motivo ? `${ROTULO_INDISPONIVEL} — ${m.motivo}` : ROTULO_INDISPONIVEL;
}

export function SecaoImpactoCaixa({ vm }: { vm: CaixaExecutivoViewModel }) {
  if (vm.status === "indisponivel") {
    return (
      <Card title="Impacto no caixa">
        <Alert tone="info">
          Impacto de caixa não calculado.
          <br />
          Motivo: {vm.motivoIndisponibilidade}
        </Alert>
      </Card>
    );
  }

  return (
    <Card title="Impacto no caixa">
      {vm.status === "parcial" && <Alert tone="warn">Parte desta análise financeira ainda não está disponível — os indicadores abaixo mostram só o que já foi calculado.</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div>
          <div>Redução de disponibilidade</div>
          <div>{celula(vm.reducaoDisponibilidade)}</div>
        </div>
        <div>
          <div>Capital de giro adicional</div>
          <div>{celula(vm.capitalGiroAdicional)}</div>
        </div>
        <div>
          <div>Pico de capital adicional</div>
          <div>{celula(vm.picoCapitalGiro)}</div>
          {vm.periodoPico !== undefined && <div>{MESES[vm.periodoPico - 1]}</div>}
        </div>
        <div>
          <div>Custo financeiro estimado</div>
          <div>{celula(vm.custoFinanceiro)}</div>
        </div>
      </div>

      {vm.premissas.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Premissas utilizadas</strong>
          <ul>
            {vm.premissas.map((p, i) => (
              <li key={i}>
                {p.descricao} {!p.informada && <em>(não informada)</em>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {vm.qualidade && <p>Qualidade: {vm.qualidade}</p>}
      {vm.alertas.map((a, i) => (
        <Alert key={i} tone="info">
          {a}
        </Alert>
      ))}
    </Card>
  );
}

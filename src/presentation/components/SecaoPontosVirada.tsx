/**
 * "Pontos que podem mudar a decisão" (seção 21-31 do pedido) — cada
 * ponto é uma fronteira condicional, NUNCA uma previsão ("abaixo/acima
 * desse nível", nunca "vai chegar a"). Estados indeterminados/múltiplos
 * pontos são exibidos honestamente, nunca forçados a uma fronteira
 * única.
 */

import { Alert, Card, DetailToggle } from "../../design-system";
import { formatarPercentualPt, formatarReais } from "../formatters";
import type { PontoViradaViewModel } from "../viewModels/pontosVirada";

function formatarValor(valor: number | undefined, unidade: PontoViradaViewModel["unidade"]): string | undefined {
  if (valor === undefined) return undefined;
  if (unidade === "reais") return formatarReais(valor);
  if (unidade === "percentual") return formatarPercentualPt(valor * 100, 2);
  return `${valor}`;
}

function PontoViradaCard({ ponto }: { ponto: PontoViradaViewModel }) {
  const valorFormatado = formatarValor(ponto.valorReferencia, ponto.unidade);

  return (
    <div className="vgr-card">
      <h4>{ponto.variavel}</h4>

      {ponto.status === "encontrado" && valorFormatado && (
        <>
          <p>
            Ponto de virada: <strong>{valorFormatado}</strong>
          </p>
          {ponto.antes && ponto.depois && (
            <p>
              Abaixo desse nível: {ponto.antes}
              <br />
              Acima desse nível: {ponto.depois}
            </p>
          )}
        </>
      )}

      {ponto.status === "multiplos_pontos" && ponto.outrosPontos && (
        <Alert tone="info">
          {ponto.outrosPontos.length} mudanças de estado foram identificadas no intervalo avaliado — nenhuma foi tratada como a fronteira única.
        </Alert>
      )}

      {(ponto.status === "resultado_indeterminado" || ponto.status === "dados_insuficientes") && (
        <Alert tone="warn">{ponto.intervaloIndeterminado ? `Entre ${formatarValor(ponto.intervaloIndeterminado.min, ponto.unidade)} e ${formatarValor(ponto.intervaloIndeterminado.max, ponto.unidade)}: resultado indeterminado com os dados disponíveis.` : "Resultado indeterminado com os dados disponíveis."}</Alert>
      )}

      {ponto.status === "nao_encontrado" && <p>Nenhuma mudança de estado foi identificada no intervalo avaliado.</p>}

      <p>Qualidade: {ponto.qualidade}</p>

      {ponto.evidencias.length > 0 && (
        <DetailToggle label="Ver evidência">
          <ul>
            {ponto.evidencias.map((e, i) => (
              <li key={i}>{e.descricao}</li>
            ))}
          </ul>
        </DetailToggle>
      )}
    </div>
  );
}

export function SecaoPontosVirada({ pontos }: { pontos: PontoViradaViewModel[] }) {
  if (pontos.length === 0) return null;

  return (
    <Card title="Pontos que podem mudar a decisão">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {pontos.map((p) => (
          <PontoViradaCard key={p.id} ponto={p} />
        ))}
      </div>
    </Card>
  );
}

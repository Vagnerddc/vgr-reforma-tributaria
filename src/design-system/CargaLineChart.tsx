import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { PontoCargaAno } from "./resultadoTributario";
import { formatarPercentualPt, formatarReais } from "./TaxStat";

function TooltipCarga({ active, payload }: { active?: boolean; payload?: { payload: PontoCargaAno }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const ponto = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--vgr-ink)",
        color: "#fff",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 11.5,
        boxShadow: "var(--vgr-shadow)",
      }}
    >
      <div style={{ opacity: 0.85 }}>Carga tributária projetada — {ponto.ano}</div>
      <div style={{ fontFamily: "var(--vgr-mono)", fontSize: 15, fontWeight: 700 }}>{formatarPercentualPt(ponto.percent * 100, 2)}</div>
      <div style={{ fontFamily: "var(--vgr-mono)", opacity: 0.85 }}>{formatarReais(ponto.reais)}</div>
    </div>
  );
}

/**
 * Evolução da carga tributária — eixo e destaque em %, com o R$ disponível
 * no hover (mesma hierarquia %+R$ do resto da plataforma). A série vem de
 * `serieCargaPorAno` (design-system/resultadoTributario.ts), então o gráfico
 * nunca pode mostrar um número diferente do que os KPIs mostram.
 */
export function CargaLineChart({ dados }: { dados: PontoCargaAno[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--vgr-border)" vertical={false} />
        <XAxis dataKey="ano" stroke="var(--vgr-text-faint)" tick={{ fontSize: 11.5 }} axisLine={false} tickLine={false} />
        <YAxis
          stroke="var(--vgr-text-faint)"
          tick={{ fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatarPercentualPt(Number(v) * 100, 2)}
          width={62}
        />
        <Tooltip content={<TooltipCarga />} />
        <Line
          type="monotone"
          dataKey="percent"
          stroke="var(--vgr-accent)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "var(--vgr-accent)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

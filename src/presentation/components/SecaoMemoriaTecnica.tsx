/**
 * "Memória Técnica" — trilha de auditoria dos resultados já
 * produzidos (seção 1/2/52 do pedido). Nunca recalcula; apenas lê o
 * `MemoriaTecnicaViewModel` já construído. Progressive disclosure:
 * visão inicial → lista por categoria → item → detalhe (seção 64).
 */
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, DetailToggle, Tabs } from "../../design-system";
import type { MemoriaTecnicaViewModel } from "../viewModels/memoriaTecnica";

export function SecaoMemoriaTecnica({ vm }: { vm: MemoriaTecnicaViewModel }) {
  const [aberta, setAberta] = useState(false);
  const [categoria, setCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState<string | undefined>();

  const opcoesCategoria = useMemo(() => [{ value: "todas", label: "Todas" }, ...vm.categorias.map((c) => ({ value: c, label: c }))], [vm.categorias]);

  const itensFiltrados = useMemo(() => {
    return vm.itens.filter((item) => {
      if (categoria !== "todas" && item.categoria !== categoria) return false;
      if (busca && !`${item.titulo} ${item.categoria} ${item.id}`.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [vm.itens, categoria, busca]);

  useEffect(() => {
    if (!destaque) return;
    const elemento = document.getElementById(`memoria-${destaque}`);
    elemento?.scrollIntoView({ block: "center" });
  }, [destaque]);

  function abrirItem(itemId: string) {
    setAberta(true);
    setCategoria("todas");
    setDestaque(itemId);
  }

  if (!aberta) {
    return (
      <Card title="Memória Técnica">
        <p>Origem, premissas e rastreabilidade dos resultados.</p>
        <p>
          {vm.totalItens} itens auditáveis · {vm.totalPremissas} premissas materiais · {vm.totalMetodologias} metodologias utilizadas · {vm.totalLimitacoes} limitações registradas
        </p>
        <Button variant="secondary" onClick={() => setAberta(true)}>
          Explorar memória
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Memória Técnica">
      <p>Origem, premissas e rastreabilidade dos resultados. Esta seção não recalcula nada — apresenta a trilha de auditoria já produzida pelos motores.</p>

      <h4>Cobertura por categoria</h4>
      <ul>
        {Object.entries(vm.resumoCobertura).map(([label, status]) => (
          <li key={label}>
            {label}: {status}
          </li>
        ))}
      </ul>

      {vm.linksRapidos.length > 0 && (
        <p>
          Ir direto para:{" "}
          {vm.linksRapidos.map((link, i) => (
            <span key={link.itemId}>
              {i > 0 && " · "}
              <button type="button" onClick={() => abrirItem(link.itemId)} style={{ background: "none", border: "none", color: "var(--vgr-ink)", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>
                {link.rotulo}
              </button>
            </span>
          ))}
        </p>
      )}

      <Tabs options={opcoesCategoria} value={categoria} onChange={setCategoria} />

      <input
        type="text"
        placeholder="Buscar por título, categoria ou código"
        aria-label="Buscar item da memória técnica"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ width: "100%", margin: "8px 0", padding: 8 }}
      />

      {itensFiltrados.length === 0 && <Alert tone="info">Nenhum item encontrado para este filtro.</Alert>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {itensFiltrados.map((item) => (
          <li key={item.id} id={`memoria-${item.id}`}>
            <DetailToggle key={item.id === destaque ? `${item.id}-destaque` : item.id} label={`${item.titulo}${item.valorFormatado ? ` — ${item.valorFormatado}` : ""}`} defaultOpen={item.id === destaque}>
              <p>
                <Badge tone="neutral">{item.status}</Badge> <Badge tone="neutral">Qualidade: {item.qualidade}</Badge>
              </p>
              <p>{item.resumo}</p>
              <p>Origem do dado: {item.detalhe.origemInformacao}</p>
              <p>Origem do cálculo: {item.detalhe.origemCalculo}</p>
              <p>Motor: {item.detalhe.motor}</p>
              {item.detalhe.metodologia && <p>Metodologia: {item.detalhe.metodologia}</p>}
              {item.detalhe.premissas.length > 0 && (
                <div>
                  <strong>Premissas</strong>
                  <ul>
                    {item.detalhe.premissas.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.detalhe.evidencias.length > 0 && (
                <div>
                  <strong>Evidências</strong>
                  <ul>
                    {item.detalhe.evidencias.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.detalhe.fundamentos.length > 0 && (
                <div>
                  <strong>Fundamentos</strong>
                  <ul>
                    {item.detalhe.fundamentos.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.detalhe.limitacoes.length > 0 && (
                <div>
                  <strong>Limitações</strong>
                  <ul>
                    {item.detalhe.limitacoes.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </DetailToggle>
          </li>
        ))}
      </ul>
    </Card>
  );
}

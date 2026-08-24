import { Alert, Badge, Button, Card } from "../../../design-system";
import { validarRascunho } from "../validacao";
import { PainelConflito } from "../components/PainelConflito";
import type { AcaoWizard } from "../estado";
import type { RascunhoCenarioEmpresa } from "../tipos";

const ROTULO_QUALIDADE: Record<string, string> = {
  confirmado: "Confirmado",
  estimado: "Estimado",
  indeterminado: "Indeterminado",
  parcial: "Parcial",
  nao_informado: "Não informado",
};

export function EtapaRevisao({ rascunho, dispatch, onSimular }: { rascunho: RascunhoCenarioEmpresa; dispatch?: (acao: AcaoWizard) => void; onSimular: () => void }) {
  const resultado = validarRascunho(rascunho);
  const conflitosPendentes = (rascunho.ingestao?.conflitos ?? []).filter((c) => c.status === "pendente" || c.status === "desatualizado");

  return (
    <Card title="Revisão e Qualidade">
      <p>Antes de simular, confira o que está confirmado, estimado ou ainda indeterminado — sem métrica arbitrária de "completude".</p>

      {conflitosPendentes.length > 0 && dispatch && (
        <>
          <h4>Divergências entre documentos importados — revisão necessária</h4>
          {conflitosPendentes.map((conflito) => (
            <PainelConflito
              key={conflito.id}
              conflito={conflito}
              onResolver={({ valorEscolhido, motivo }) => dispatch({ tipo: "resolverConflitoIngestao", conflitoId: conflito.id, valorEscolhido, motivo })}
            />
          ))}
        </>
      )}

      <h4>Qualidade por área</h4>
      <ul>
        {Object.entries(resultado.qualidadePorArea).map(([area, qualidade]) => (
          <li key={area}>
            {area}: <Badge tone="neutral">{ROTULO_QUALIDADE[qualidade] ?? qualidade}</Badge>
          </li>
        ))}
      </ul>

      {resultado.ressalvas.length > 0 && (
        <Alert tone="warn">
          <strong>Lacunas materiais — não impedem a simulação</strong>
          <ul>
            {resultado.ressalvas.map((ressalva, i) => (
              <li key={i}>⚠ {ressalva}</li>
            ))}
          </ul>
        </Alert>
      )}

      {resultado.bloqueios.length > 0 && (
        <Alert tone="danger">
          <strong>Pendências que impedem a simulação</strong>
          <ul>
            {resultado.bloqueios.map((bloqueio, i) => (
              <li key={i}>{bloqueio}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Button variant="primary" onClick={onSimular} disabled={!resultado.valido}>
        Simular
      </Button>
    </Card>
  );
}

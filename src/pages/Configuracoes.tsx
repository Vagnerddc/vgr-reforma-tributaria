import { useEffect, useState } from "react";
import { useClienteData } from "../context/ClienteDataContext";
import { TopBar, Body, Card, aplicarTema, lerTemaSalvo, CHAVE_TEMA, type Tema } from "../design-system";

export default function Configuracoes() {
  const { cliente } = useClienteData();
  const [tema, setTema] = useState<Tema>(lerTemaSalvo);

  useEffect(() => {
    aplicarTema(tema);
    localStorage.setItem(CHAVE_TEMA, tema);
  }, [tema]);

  return (
    <>
      <TopBar crumb="Configurações" title="Preferências do sistema" />
      <Body>
        <div className="vgr-section-title" style={{ marginTop: 0 }}>Simulação atual</div>
        <Card>
          {cliente ? (
            <>
              <div className="vgr-field-row"><span>Empresa</span><span>{cliente.nomeEmpresa}</span></div>
              <div className="vgr-field-row"><span>Período</span><span>{cliente.dados.periodoInicio ?? "—"} a {cliente.dados.periodoFim ?? "—"}</span></div>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: 0 }}>
              Nenhuma simulação carregada nesta sessão. Importe os arquivos fiscais em /importar.
            </p>
          )}
        </Card>

        <div className="vgr-section-title">Aparência</div>
        <Card>
          <div className="vgr-field-row" style={{ alignItems: "center" }}>
            <span>Tema</span>
            <select
              className="vgr-select"
              style={{ width: 160 }}
              value={tema}
              onChange={(e) => setTema(e.target.value as Tema)}
            >
              <option value="sistema">Padrão do sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>
        </Card>

        <p style={{ fontSize: 11, color: "var(--vgr-text-faint)", marginTop: 20 }}>
          Este sistema não tem backend próprio — não há usuários, permissões ou notificações para configurar ainda. As
          únicas preferências reais disponíveis nesta etapa são a simulação carregada na sessão e o tema visual.
        </p>
      </Body>
    </>
  );
}

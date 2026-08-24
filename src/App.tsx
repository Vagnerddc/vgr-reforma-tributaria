import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import Publico from "./pages/Publico";
import ImportarSped from "./pages/ImportarSped";
import Dashboard from "./pages/Dashboard";
import Analises from "./pages/Analises";
import AnaliseEstrategica from "./pages/AnaliseEstrategica";
import WizardEstrategicoPage from "./features/wizardEstrategico/page/WizardEstrategicoPage";
import Parceiros from "./pages/Parceiros";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import { AppShell, ToastProvider } from "./design-system";
import { ClienteDataProvider } from "./context/ClienteDataContext";

function NotFound() {
  return (
    <div style={{ padding: 32 }}>
      <p>Página não encontrada.</p>
      <Link to="/">Voltar ao início</Link>
    </div>
  );
}

export default function App() {
  return (
    <ClienteDataProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* /simulador é a calculadora pública voltada ao lead — fora do casco interno de propósito. */}
            <Route path="/simulador" element={<Publico />} />
            <Route
              path="*"
              element={
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/importar" element={<ImportarSped />} />
                    {/* /simulador-interno foi incorporado ao wizard de /importar (opção "Inserir dados manualmente") — mantém o link antigo funcionando. */}
                    <Route path="/simulador-interno" element={<Navigate to="/importar" replace />} />
                    <Route path="/analises" element={<Analises />} />
                    {/* Rota estratégica paralela (pipeline novo: CenarioEmpresa → motores estratégicos) — não substitui /analises. */}
                    <Route path="/analises/estrategica" element={<AnaliseEstrategica />} />
                    {/* Wizard Estratégico V2 — produz CenarioEmpresa diretamente, sem DadosApuradosCliente/adapter legado. Fluxo paralelo, não substitui /importar. */}
                    <Route path="/simulador-estrategico" element={<WizardEstrategicoPage />} />
                    <Route path="/parceiros" element={<Parceiros />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/configuracoes" element={<Configuracoes />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppShell>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ClienteDataProvider>
  );
}

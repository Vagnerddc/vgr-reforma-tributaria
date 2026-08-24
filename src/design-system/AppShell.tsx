import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LogoVgr } from "./Logo";

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

const NAV_PRINCIPAL: NavItem[] = [
  { to: "/", icon: "▤", label: "Dashboard" },
  // O simulador manual foi incorporado ao wizard de /importar (opção "Inserir
  // dados manualmente" no primeiro passo) — não há mais uma entrada própria
  // de "Simulador" na sidebar, para não duplicar o mesmo fluxo em dois lugares.
  { to: "/importar", icon: "⇪", label: "Simulador / Importação" },
  { to: "/analises", icon: "◆", label: "Análises" },
  { to: "/parceiros", icon: "☰", label: "Parceiros" },
  { to: "/relatorios", icon: "▢", label: "Relatórios" },
  { to: "/configuracoes", icon: "⚙", label: "Configurações" },
];

/** Layout global (sidebar + navegação) — baseline visual = protótipo aprovado. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="vgr-shell">
      <nav className="vgr-sidebar">
        <div className="vgr-brand-row">
          <LogoVgr variant="negative" />
        </div>
        <div className="vgr-side-label">Principal</div>
        {NAV_PRINCIPAL.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `vgr-navlink ${isActive ? "active" : ""}`}
          >
            <span className="ic">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <div className="vgr-side-foot">VGR · Inteligência Tributária</div>
      </nav>
      <main className="vgr-workspace">{children}</main>
    </div>
  );
}

export function TopBar({
  crumb,
  title,
  meta,
  actions,
}: {
  crumb: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="vgr-topbar">
      <div className="vgr-topbar-left">
        <span className="vgr-crumb">{crumb}</span>
        <h2>{title}</h2>
        {meta && <div className="vgr-topbar-meta">{meta}</div>}
      </div>
      {actions && <div className="vgr-topbar-right">{actions}</div>}
    </div>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <div className="vgr-body">{children}</div>;
}

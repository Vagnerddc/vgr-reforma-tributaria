import "./tokens.css";
import "./components.css";

export { LogoVgr } from "./Logo";
export {
  Button,
  Badge,
  Card,
  Tooltip,
  Alert,
  ProgressBar,
  Skeleton,
  EmptyState,
  ChartContainer,
  Field,
  Input,
  Select,
  Tabs,
  ProcessingState,
  DetailToggle,
} from "./primitives";
export { TaxStat, TaxReductionStat, compararCargaTributaria, formatarPercentualPt, formatarReais } from "./TaxStat";
export type { ComparativoCargaTributaria } from "./TaxStat";
export { comparativoDoResultado, serieCargaPorAno, cargaPercentualDoAno } from "./resultadoTributario";
export type { PontoCargaAno } from "./resultadoTributario";
export { CargaLineChart } from "./CargaLineChart";
export { FileDropzone } from "./FileDropzone";
export { KpiCard, KpiGrid } from "./KpiCard";
export { Stepper } from "./Stepper";
export { ToastProvider, useToast } from "./Toast";
export { Modal } from "./Modal";
export { Drawer, DrawerRow } from "./Drawer";
export { AppShell, TopBar, Body } from "./AppShell";
export { lerTemaSalvo, aplicarTema, CHAVE_TEMA } from "./tema";
export type { Tema } from "./tema";
// CampoMoeda/CampoPercentual já existem em lib/campos.tsx — reexportados aqui
// para não duplicar a lógica de máscara em dois lugares.
export { CampoMoeda, CampoPercentual, formatarMoeda, formatarPercentual } from "../lib/campos";

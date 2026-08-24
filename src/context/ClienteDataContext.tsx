import { createContext, useContext, useState, type ReactNode } from "react";
import type { DadosApuradosCliente } from "../engine/sped/agregador";
import type { ResultadoSimulacao } from "../engine/types";
import type { Panorama } from "../engine/panorama";

/**
 * Estado do cliente atualmente carregado, compartilhado entre /importar e as
 * telas executivas (Dashboard, Análises, Parceiros...). Não recalcula nada —
 * só guarda o que /importar já computou com o engine, para as outras telas
 * lerem os MESMOS objetos em vez de duplicar a apuração/cálculo (regra do
 * item 7 do plano de migração: "UI nova → mesma função/regra de negócio
 * existente", nunca uma segunda implementação do cálculo).
 */
export interface ClienteData {
  nomeEmpresa: string;
  dados: DadosApuradosCliente;
  resultadoSimulacao: ResultadoSimulacao | null;
  panorama: Panorama | null;
}

interface ClienteDataApi {
  cliente: ClienteData | null;
  setCliente: (cliente: ClienteData | null) => void;
}

const ClienteDataContext = createContext<ClienteDataApi | null>(null);

export function ClienteDataProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  return <ClienteDataContext.Provider value={{ cliente, setCliente }}>{children}</ClienteDataContext.Provider>;
}

export function useClienteData(): ClienteDataApi {
  const ctx = useContext(ClienteDataContext);
  if (!ctx) throw new Error("useClienteData precisa estar dentro de um <ClienteDataProvider>.");
  return ctx;
}

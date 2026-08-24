export type Tema = "sistema" | "light" | "dark";
export const CHAVE_TEMA = "vgr-tema";

export function lerTemaSalvo(): Tema {
  const salvo = typeof localStorage !== "undefined" ? localStorage.getItem(CHAVE_TEMA) : null;
  return salvo === "light" || salvo === "dark" ? salvo : "sistema";
}

/**
 * Aplica o tema no elemento raiz (data-theme). Precisa rodar uma vez no boot
 * do app (não só quando a tela de Configurações monta) — senão a preferência
 * salva não é respeitada ao recarregar a página ou abrir direto outra rota.
 */
export function aplicarTema(tema: Tema) {
  if (tema === "sistema") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", tema);
}

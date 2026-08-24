import logoVgrSvgTexto from "../assets/vgr/logo-vgr.svg?raw";

/**
 * Logo oficial da VGR, embutida sem alteração (mesmo arquivo usado em
 * gerarApresentacaoHtml.ts). Não redesenhar, recriar por código/IA, alterar
 * cores/proporções/tipografia ou reorganizar os elementos — regra fixa
 * definida no protótipo aprovado.
 */
export function LogoVgr({ variant = "default" }: { variant?: "default" | "negative" }) {
  const svg = variant === "negative" ? logoVgrSvgTexto.replace(/#29235C/gi, "#f4f3fb") : logoVgrSvgTexto;
  return <span className="vgr-logo" dangerouslySetInnerHTML={{ __html: svg }} />;
}

import { useEffect, useState, type ChangeEvent } from "react";

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Extrai os dígitos do texto exibido e trata como centavos — padrão de máscara de moeda ("digitar da direita para a esquerda"). */
export function paraNumeroDigitadoMoeda(textoExibido: string): number {
  const soDigitos = textoExibido.replace(/\D/g, "");
  return soDigitos ? Number(soDigitos) / 100 : 0;
}

/**
 * Padrão único de percentual do sistema: vírgula como separador decimal,
 * sempre com 2 casas (2,01% / 7,50% / 18,75%) — nunca arredonda para inteiro.
 * Centralizado aqui porque é usado por toda alíquota/percentual/proporção/
 * crédito do sistema (CampoPercentual), para não haver comportamento
 * divergente entre telas.
 */
export function formatarPercentual(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Aceita vírgula como separador decimal (padrão brasileiro). */
export function paraNumeroDigitadoPercentual(texto: string): number {
  const normalizado = texto.replace(/[^\d,.-]/g, "").replace(",", ".");
  const valor = parseFloat(normalizado);
  return Number.isFinite(valor) ? valor : 0;
}

interface CampoMoedaProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}

export function CampoMoeda({ label, value, onChange, placeholder }: CampoMoedaProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(paraNumeroDigitadoMoeda(e.target.value));
  }
  return (
    <label className="vgr-field">
      <span className="vgr-field-label">{label}</span>
      <input
        className="vgr-input"
        type="text"
        inputMode="decimal"
        value={value ? formatarMoeda(value) : ""}
        onChange={handleChange}
        placeholder={placeholder ?? "R$ 0,00"}
      />
    </label>
  );
}

interface CampoPercentualProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  erro?: string;
  hint?: string;
}

/**
 * Campo de percentual — aceita digitação livre de decimais com vírgula
 * (2,01 / 7,5 / 18,75) e só normaliza para 2 casas quando o campo perde o
 * foco. Enquanto o campo está focado, o texto digitado não é reformatado a
 * cada tecla — reformatar em cima do que o usuário está digitando é o que
 * antes "engolia" a vírgula e travava o valor em número inteiro.
 */
export function CampoPercentual({ label, value, onChange, erro, hint }: CampoPercentualProps) {
  const [texto, setTexto] = useState(formatarPercentual(value));
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(formatarPercentual(value));
  }, [value, focado]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setTexto(e.target.value);
    onChange(paraNumeroDigitadoPercentual(e.target.value));
  }

  return (
    <label className={`vgr-field ${erro ? "has-error" : ""}`}>
      <span className="vgr-field-label">{label}</span>
      <span className="vgr-percent-wrap">
        <input
          className="vgr-input"
          type="text"
          inputMode="decimal"
          value={texto}
          onFocus={() => setFocado(true)}
          onBlur={() => {
            setFocado(false);
            setTexto(formatarPercentual(value));
          }}
          onChange={handleChange}
        />
        <span className="vgr-percent-suffix">%</span>
      </span>
      {erro ? <span className="vgr-field-error">{erro}</span> : hint ? <span className="vgr-field-hint">{hint}</span> : null}
    </label>
  );
}

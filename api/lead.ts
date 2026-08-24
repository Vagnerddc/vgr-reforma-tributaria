import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";

/**
 * Recebe o lead capturado no simulador público e adiciona uma linha na planilha
 * Google Sheets configurada pela VGR. Credenciais nunca ficam no frontend —
 * só existem como variáveis de ambiente desta função serverless.
 *
 * Setup necessário (ver docs/leads-setup.md):
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL
 *  - GOOGLE_PRIVATE_KEY
 *  - GOOGLE_SHEET_ID
 */
interface LeadPayload {
  nome: string;
  email: string;
  telefone: string;
  tipoPessoa: "PJ" | "PF";
  cnpjOuCpf: string;
  perfilAtividade: string;
  regimeAtual: string;
  faturamentoAnual: number;
  cargaProjetada2033: number;
  deltaCargaPercentual2033: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ erro: "Método não permitido." });
    return;
  }

  const body = req.body as LeadPayload;
  if (!body?.nome || !body?.email) {
    res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
    return;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !privateKey || !sheetId) {
    res.status(500).json({ erro: "Integração com Google Sheets não configurada (variáveis de ambiente ausentes)." });
    return;
  }

  try {
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Leads!A:L",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            body.nome,
            body.email,
            body.telefone,
            body.tipoPessoa,
            body.cnpjOuCpf,
            body.perfilAtividade,
            body.regimeAtual,
            body.faturamentoAnual,
            body.cargaProjetada2033,
            body.deltaCargaPercentual2033,
            "simulador-publico",
          ],
        ],
      },
    });

    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ erro: "Falha ao registrar o lead. Tente novamente em instantes." });
  }
}

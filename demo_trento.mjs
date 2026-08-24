import { chromium } from "playwright";
import { readdirSync } from "node:fs";

const BASE = "/tmp/trento-visual";

function arquivosDaPasta(caminho) {
  const resultado = [];
  for (const mes of readdirSync(caminho)) {
    const pastaMes = `${caminho}/${mes}`;
    for (const nome of readdirSync(pastaMes)) {
      if (nome.endsWith(".txt")) resultado.push(`${pastaMes}/${nome}`);
    }
  }
  return resultado;
}

const efdIcms = arquivosDaPasta(`${BASE}/EFD ICMS-IPI/2026`);
const efdContrib = arquivosDaPasta(`${BASE}/EFD Contribuições (PIS-COFINS)/2026`);
const ecd2025 = `${BASE}/ECD/2025/01326359000116-01326359000116-20250101-20251231-G-1C634D04184A964327C54E847D33C6AF16D988C7-7-SPED-ECD.txt`;

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });

await page.goto("http://localhost:5173/importar");
await page.waitForSelector("text=Importar arquivos");

const inputs = await page.locator('input[type="file"]').all();
await inputs[0].setInputFiles(ecd2025);
await page.waitForTimeout(600);
await inputs[1].setInputFiles([...efdIcms, ...efdContrib]);
await page.waitForTimeout(1200);

await page.fill('input[type="text"]', "Trento Soluções em Construções Ltda");
await page.selectOption("select", { label: "Construção civil" });
await page.waitForTimeout(300);
const selects = await page.locator("select").all();
for (const s of selects) {
  const opcoes = await s.locator("option").allTextContents();
  if (opcoes.includes("Empreitada")) {
    await s.selectOption({ label: "Empreitada" });
    break;
  }
}

await page.click('button:has-text("Ver o painel")');
await page.waitForTimeout(1200);

await page.screenshot({ path: "/tmp/trento-visual/painel.png", fullPage: true });
console.log("Screenshot salvo. Navegador fica aberto — feche manualmente quando terminar de olhar, ou deixe rodando.");

// mantém aberto por um bom tempo pra dar tempo de olhar
await new Promise((r) => setTimeout(r, 600000));
await browser.close();

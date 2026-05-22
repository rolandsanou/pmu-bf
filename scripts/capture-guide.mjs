import { chromium } from "playwright-core";
import { mkdir } from "fs/promises";

const BASE = "http://localhost:3000";
const OUT = "scripts/guide-shots";

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 412, height: 880 },
    deviceScaleFactor: 2,
  });

  // 1. Home
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot(page, "01-accueil");

  // 2. Course + formules
  await page.goto(`${BASE}/jouer`, { waitUntil: "networkidle" });
  await page.getByText("Report 4+1").first().waitFor();
  await shot(page, "02-course");

  // 3. Pick horses + add to ticket
  for (const n of ["ILIO MANNETOT", "JAIN MAB", "JIMINY CRICKET", "JACOMO BELLO", "IMELDA"]) {
    await page.locator("button", { hasText: n }).first().click();
  }
  await shot(page, "03-chevaux");
  await page.getByRole("button", { name: /Ajouter au ticket/ }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByText("Paiement").first().waitFor();
  await shot(page, "04-paiement");

  // 4. Fill + submit -> receipt
  await page.getByPlaceholder("Ex: Awa Ouédraogo").fill("Awa Ouédraogo");
  const phones = page.getByPlaceholder("Ex: 70 00 00 00");
  await phones.nth(0).fill("70 12 34 56");
  await phones.nth(1).fill("70 12 34 56");
  await page.getByPlaceholder(/Ex: PP/).fill("PP260522.1700.A12345");
  await page.getByRole("button", { name: /Valider et obtenir/ }).click();
  await page.waitForURL("**/commande/**");
  await page.getByText("Mes paris").first().waitFor();
  await shot(page, "05-recu");

  // 5. Track order
  await page.goto(`${BASE}/suivi`, { waitUntil: "networkidle" });
  await shot(page, "06-suivi");

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

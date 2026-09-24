import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contactOf, placeUrl, type Place, type StatusCopy, type StatusScreenText } from "../../src/index";
import {
  CallBar,
  Coverage,
  Faq,
  Field,
  FieldLabel,
  Input,
  LangSwitch,
  NativeSelect,
  NativeSelectOption,
  PlaceDirectory,
  QuoteFormShell,
  StatusScreen,
  Button,
} from "../../src/react/index";
import { FormSelectView } from "../../src/react/FormSelect";
import { fixtureSite } from "../support/fixtures";

/**
 * The widget gallery: each scenario rendered to a static page, the way the
 * server renders it, over the kit's shipped `tokens.css` and Tailwind's
 * browser engine. `nix run .#kitstart-visual` sets `KITSTART_VISUAL_OUT`,
 * screenshots every page on Linux and compares byte for byte against
 * `__screenshots__/`; the PNGs come from the CI artifact, never from a mac.
 * Without the variable this only checks that every scenario renders.
 */
const aquafix = fixtureSite("aquafix");
const cleaning = fixtureSite("cleaning");
const royat = aquafix.places[0] as Place<"fr" | "en">;
const paris = cleaning.places[0] as Place<"fr" | "en">;
type F = { phone: string };
const f: F = { phone: "+33 4 23 50 06 40" };

const statusText: StatusScreenText<F> = {
  callLabel: x => `Appeler le ${x.phone}`,
  backHome: "Retour à l’accueil",
  tryAgain: "Réessayer",
  statusStrip: ["Prix fixe écrit", "Arrivée en 2 h", "Garantie 12 mois"],
  facts: () => ["Aquafix SAS", "SIRET 000 000 000 00000"],
};
const notFound: StatusCopy<F> = {
  code: "404",
  title: "Page introuvable",
  eyebrow: "PAGE INTROUVABLE",
  headline: ["Cette page a pris ", "la fuite."],
  body: x => `Le lien est peut-être ancien. Le plombier, lui, répond au ${x.phone}.`,
  primary: "call",
  secondary: "home",
};

const JOBS = [
  { value: "leak", label: "Fuite d’eau" },
  { value: "boiler", label: "Chaudière en panne" },
];

/** `mobile`: 390 px only (the widget is `md:hidden`); `both`: 390 and 1280. */
type Widths = "mobile" | "both";

const SCENARIOS: readonly { name: string; widths: Widths; node: ReactElement }[] = [
  { name: "lang-switch", widths: "both", node: <LangSwitch current="fr" locales={["fr", "en"]} hrefs={{ fr: "/fr", en: "/en" }} className="text-sm text-ink" /> },
  {
    name: "call-bar",
    widths: "mobile",
    node: (
      <CallBar
        copy={{ locale: "fr", f, t: { callLabel: x => `Appeler ${x.phone}`, whatsappMessage: () => "Bonjour", whatsappShort: "WhatsApp", ctaShort: "Devis" } }}
        phone={f.phone}
        whatsapp={f.phone}
        quoteHref="/fr#quote" label="Contact"
      />
    ),
  },
  {
    name: "status-screen",
    widths: "both",
    node: (
      <StatusScreen
        copy={{ locale: "fr", t: statusText, f }}
        status={notFound}
        target={{ phone: f.phone, home: "/fr", retry: "/fr", langHrefs: { fr: "/fr", en: "/en" } }}
        locales={["fr", "en"]}
        brandName="Aquafix"
      />
    ),
  },
  {
    name: "place-directory",
    widths: "both",
    node: (
      <PlaceDirectory
        places={aquafix.places.slice(0, 3)}
        locale="fr"
        hrefOf={p => placeUrl(aquafix, p.slug, "fr", "")}
        phoneOf={p => contactOf(aquafix, p).phone}
        openLabel="Ouvrir la page"
      />
    ),
  },
  {
    name: "coverage-storefront",
    widths: "both",
    node: (
      <Coverage
        place={{ ...royat, serviceArea: [{ kind: "localities", names: ["Royat", "Chamalières", "Ceyrat", "Durtol"] }] }}
        locale="fr"
        map={{ title: "Carte", show: "Afficher la carte" }}
      />
    ),
  },
  { name: "coverage-service-area", widths: "both", node: <Coverage place={paris} locale="fr" map={{ title: "Carte", show: "Afficher la carte" }} /> },
  {
    name: "quote-form-shell",
    widths: "both",
    node: (
      <QuoteFormShell placeSlug="royat" locale="fr" renderedAt={0} honeypotLabel="Site web" className="max-w-md rounded-xl bg-card p-6">
        <Field className="flex flex-col gap-2">
          <FieldLabel>Intervention</FieldLabel>
          <NativeSelect name="job" size="lg" defaultValue="other">
            <NativeSelectOption value="other">Autre</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field className="flex flex-col gap-2">
          <FieldLabel>Commune ou code postal</FieldLabel>
          <Input name="zip" size="lg" placeholder="63130" />
        </Field>
        <Button type="submit" size="xl">
          Recevoir le prix
        </Button>
      </QuoteFormShell>
    ),
  },
  {
    // The two states of one field, stacked: before hydration (the native
    // select) and after (the kit's trigger) must be the same box.
    name: "form-select",
    widths: "both",
    node: (
      <div className="flex max-w-md flex-col gap-5 rounded-xl bg-card p-6">
        {([false, true] as const).flatMap(scripted => [
          <Field key={`${scripted}-value`} className="flex flex-col gap-2">
            <FieldLabel>{scripted ? "Intervention (après hydratation)" : "Intervention (sans JavaScript)"}</FieldLabel>
            <FormSelectView scripted={scripted} name="job" size="lg" defaultValue="boiler" options={JOBS} />
          </Field>,
          <Field key={`${scripted}-empty`} className="flex flex-col gap-2">
            <FieldLabel>Type de bien</FieldLabel>
            <FormSelectView scripted={scripted} name="home" size="lg" placeholder="Choisir" required options={JOBS} />
          </Field>,
        ])}
      </div>
    ),
  },
  {
    name: "faq",
    widths: "both",
    node: (
      <Faq
        items={[
          { q: "Les 89 € de déplacement s’ajoutent-ils ?", a: "Non, ils sont déduits de tout travail que vous approuvez." },
          { q: "Et si vous arrivez en retard ?", a: "Le déplacement est offert." },
        ]}
      />
    ),
  },
];

const require = createRequire(import.meta.url);
const TOKENS = readFileSync(join(require.resolve("@evinvest/uikit/styles/tokens.css")), "utf8");

function page(title: string, body: string): string {
  return `<!doctype html>
<html class="light" lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script src="./tailwind.js"></script>
<style type="text/tailwindcss">
@import "tailwindcss";
${TOKENS}
</style>
<style>html, body { background: var(--background); color: var(--ink); margin: 0; }</style>
</head>
<body><div id="stage" style="padding: 24px">${body}</div></body>
</html>
`;
}

describe("the widget gallery", () => {
  it("has flat tokens — the browser engine rejects @import", () => {
    expect(TOKENS).not.toContain("@import");
  });

  it.each(SCENARIOS.map(s => [s.name, s] as const))("renders %s", (_, s) => {
    expect(renderToStaticMarkup(s.node).length).toBeGreaterThan(0);
  });

  const out = process.env["KITSTART_VISUAL_OUT"];
  it.runIf(Boolean(out))("writes the pages and their manifest", () => {
    if (!out) return;
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    for (const s of SCENARIOS) writeFileSync(join(out, `${s.name}.html`), page(s.name, renderToStaticMarkup(s.node)));
    writeFileSync(join(out, "manifest.json"), JSON.stringify(SCENARIOS.map(s => ({ name: s.name, widths: s.widths }))));
  });
});

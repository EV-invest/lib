import { renderToReadableStream } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_MESSENGER_TEXT, LEAD_CAPTURE_TEXT, type MessengerKind, type MessengerVariant } from "../src/index";
import { LeadCapture } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";

const M = LEAD_CAPTURE_MESSENGER_TEXT.fr;
const WHATSAPP = "+33 6 12 34 56 78";

/**
 * Each variant, a word only it prints on the server's page, and how many
 * messenger links it draws before anything is picked — WhatsApp's and the
 * bot's (`thanks` draws its own in the success, `saga` and `sheet` behind a pick).
 */
const VARIANTS: Record<MessengerKind, { variant: MessengerVariant; says: string; links: number }> = {
  select: { variant: { kind: "select", side: "suffix" }, says: `aria-label="${M.messengerChannelLabel}"`, links: 1 },
  segment: { variant: { kind: "segment" }, says: M.messengerPreviewTitle, links: 2 },
  tiles: { variant: { kind: "tiles" }, says: M.messengerTilesLabel, links: 1 },
  // The control's form: its messengers are in the success.
  thanks: { variant: { kind: "thanks" }, says: LEAD_CAPTURE_TEXT.fr.submit, links: 0 },
  swap: { variant: { kind: "swap" }, says: M.messengerCallback, links: 2 },
  saga: { variant: { kind: "saga" }, says: M.messengerSagaTitle, links: 0 },
  urgency: { variant: { kind: "urgency", field: "urgency" }, says: M.messengerUrgencyYes, links: 1 },
  sheet: { variant: { kind: "sheet" }, says: M.messengerSheetCta, links: 0 },
  chip: { variant: { kind: "chip" }, says: M.messengerChipWhatsapp, links: 1 },
  split: { variant: { kind: "split" }, says: M.messengerSplitCta, links: 2 },
};

async function html(variant: MessengerVariant): Promise<string> {
  const stream = await renderToReadableStream(
    <LeadCapture
      place={serviceAreaPlace(["fr", "en"])}
      contact={{ phone: WHATSAPP, whatsapp: WHATSAPP }}
      locale="fr"
      renderedAt={1_800_000_000_000}
      wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
      needs={[{ value: "leak", label: "Fuite d’eau" }]}
      text={LEAD_CAPTURE_TEXT.fr}
      messenger={variant}
      messengers={{ whatsapp: WHATSAPP, telegram: "aquafix_devis_bot" }}
      refPrefix="AQ"
      brand="Aquafix"
    />,
    { onError: error => void errors.push(error) },
  );
  await stream.allReady;
  return new Response(stream).text();
}

let errors: unknown[] = [];
afterEach(() => {
  errors = [];
  vi.restoreAllMocks();
});

describe.each(Object.keys(VARIANTS) as MessengerKind[])("the %s variant on the server", kind => {
  it("renders whole with no document, and mints no reference before the script", async () => {
    expect(typeof document).toBe("undefined");
    const console = vi.spyOn(globalThis.console, "error");
    const page = await html(VARIANTS[kind].variant);
    expect(errors).toEqual([]);
    expect(console).not.toHaveBeenCalled();
    expect(page).toContain('data-channels-available="wa,tg"');
    expect(page).toContain(VARIANTS[kind].says);
    // The reference is the browser's to mint: a server's would not survive hydration.
    expect(page).not.toContain('name="message_ref"');
    expect(page).not.toMatch(/AQ-[0-9A-HJKMNP-TV-Z]{4}/);
  });

  // A tap before the script would open the chat with no lead posted and no
  // reference to find it by: until then a messenger link leads nowhere.
  it("draws its messenger links inert: no href to wa.me or t.me, aria-disabled", async () => {
    const page = await html(VARIANTS[kind].variant);
    expect(page).not.toMatch(/href="https:\/\/(wa\.me|t\.me)\//);
    expect(page.match(/<a [^>]*aria-disabled="true"/g) ?? []).toHaveLength(VARIANTS[kind].links);
  });
});

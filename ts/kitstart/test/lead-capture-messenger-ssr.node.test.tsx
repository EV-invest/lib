import { renderToReadableStream } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_MESSENGER_TEXT, LEAD_CAPTURE_TEXT, type MessengerKind, type MessengerVariant } from "../src/index";
import { LeadCapture } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";

const M = LEAD_CAPTURE_MESSENGER_TEXT.fr;
const WHATSAPP = "+33 6 12 34 56 78";

/** Each variant, and a word only it prints on the server's page. */
const VARIANTS: Record<MessengerKind, { variant: MessengerVariant; says: string }> = {
  select: { variant: { kind: "select", side: "suffix" }, says: `aria-label="${M.messengerChannelLabel}"` },
  segment: { variant: { kind: "segment" }, says: M.messengerPreviewTitle },
  tiles: { variant: { kind: "tiles" }, says: M.messengerTilesLabel },
  // The control's form: its messengers are in the success.
  thanks: { variant: { kind: "thanks" }, says: LEAD_CAPTURE_TEXT.fr.submit },
  swap: { variant: { kind: "swap" }, says: M.messengerCallback },
  saga: { variant: { kind: "saga" }, says: M.messengerSagaTitle },
  urgency: { variant: { kind: "urgency", field: "urgency" }, says: M.messengerUrgencyYes },
  sheet: { variant: { kind: "sheet" }, says: M.messengerSheetCta },
  chip: { variant: { kind: "chip" }, says: M.messengerChipWhatsapp },
  split: { variant: { kind: "split" }, says: M.messengerSplitCta },
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
});

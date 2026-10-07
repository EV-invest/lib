// No directive: a plain module, client only because a client file imports it.
import type { Translate } from "@evinvest/i18n";

export const helper = (t: Translate) => t("helper.k", "Helper");

import { TelegramLink, toCall, useMessage, useMessengerAction } from "./action";
import type { MessengerKit } from "./types";

/**
 * Any variant on a place without WhatsApp but with a bot: the control, and
 * «ou via Telegram» under its submit.
 */
export default function Fallback({ kit }: { kit: MessengerKit }) {
  const message = useMessage(kit);
  const action = useMessengerAction(kit, message, () => toCall(kit));
  return (
    <>
      <TelegramLink kit={kit} action={action} />
      {action.overlay}
    </>
  );
}

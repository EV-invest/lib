import { Button, cn, FieldError } from "@evinvest/uikit";
import type { LeadCaptureText } from "../core/lead-capture-text";
import type { SendFailure } from "./use-lead-submit";

/** The submit, busy while the script posts: disabled, `aria-busy`, and saying so. */
export function SubmitButton(props: { busy: boolean; label: string; sending: string; className: string | undefined }) {
  return (
    <Button type="submit" size="touch" disabled={props.busy} aria-busy={props.busy || undefined} className={cn("w-full", props.className)}>
      {props.busy ? props.sending : props.label}
    </Button>
  );
}

/** Why the post got no answer, and the way to send the same lead again. */
export function FailureMessage(props: { failure: SendFailure | null; text: Pick<LeadCaptureText, "networkError" | "timeoutError" | "retry">; onRetry: () => void; className: string | undefined }) {
  const { failure, text } = props;
  if (!failure) return null;
  return (
    <FieldError className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-accent-error", props.className)}>
      <span>{failure === "timeout" ? text.timeoutError : text.networkError}</span>
      <Button type="button" variant="link" size="touch" className="px-1" onClick={props.onRetry}>
        {text.retry}
      </Button>
    </FieldError>
  );
}

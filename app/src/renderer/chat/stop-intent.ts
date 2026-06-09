/**
 * Plain-text "stop the current response" intent detection (issue #225).
 *
 * With a slow model, users try to halt a long "thinking" turn by typing
 * "stop"/"abort thinking"/"stop what you are doing" into chat. While a turn is
 * streaming those just queue as the next prompt and nothing stops. We detect a
 * bare stop command shell-side and treat it as an abort instead.
 *
 * The hard part is precision: this runs in a bioinformatics tool where "stop"
 * (a stop codon), "cancel" (cancel a Galaxy workflow invocation), and "abort"
 * (abort a running job) are real instructions the agent should act on, not
 * meta-commands to halt the turn. So we only fire on a *bare* stop imperative:
 * the whole message is a stop word, optionally wrapped in politeness and one of
 * a small fixed set of objects ("it", "now", "thinking", "the response", ...).
 * Anything with a real object ("stop the FastQC tool") falls through. False
 * negatives are cheap -- the labeled Stop button is still right there -- so we
 * err quiet.
 */

// Polite/filler lead-ins that don't change the intent.
const LEAD_IN =
  /(please\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|just\s+|ok,?\s+|okay,?\s+|hey,?\s+)*/
    .source;
// The stop verbs themselves.
const STOP_VERB = /(stop|abort|halt|cancel)/.source;
// The only objects allowed after the verb. Each clearly refers to the turn
// itself, never to a Galaxy/genomic noun -- "stop the response" is in, but
// "stop the workflow" is deliberately out (it has no "the workflow" object).
const TURN_OBJECT =
  /(\s+(it|this|that|now|please|thinking|responding|generating|the\s+response|what\s+you'?re\s+doing|what\s+you\s+are\s+doing))*/
    .source;

const STOP_INTENT = new RegExp(`^${LEAD_IN}${STOP_VERB}${TURN_OBJECT}[\\s.!?]*$`);

export function detectStopIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // Slash commands are dispatched, never read as a chat intent.
  if (t.startsWith("/")) return false;
  return STOP_INTENT.test(t);
}

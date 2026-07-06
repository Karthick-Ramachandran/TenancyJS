// Minimal, dependency-free ANSI styling. Every helper is a no-op when the output
// is not a TTY, when NO_COLOR is set, or when TERM=dumb — so piped, CI, and
// --json output stays plain text (and the human formatters stay testable).
const ENABLED =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb" &&
  (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY === true);

function sgr(open: number, close: number): (value: string) => string {
  return (value) => (ENABLED ? `[${open}m${value}[${close}m` : value);
}

export const bold = sgr(1, 22);
export const dim = sgr(2, 22);
export const red = sgr(31, 39);
export const green = sgr(32, 39);
export const yellow = sgr(33, 39);
export const cyan = sgr(36, 39);
export const magenta = sgr(35, 39);
export const gray = sgr(90, 39);

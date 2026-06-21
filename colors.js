// Minimal ANSI color/formatting helpers — no external dependency.
//
// Each exported function wraps its argument in the relevant escape codes and
// resets afterwards. When color is disabled (see setEnabled) every helper
// returns its input unchanged, so the same code path produces plain output.

let enabled = true;

// Toggle colored output. Pass false for `--no-color`, NO_COLOR, or non-TTY.
function setEnabled(value) {
  enabled = Boolean(value);
}

const CODE = {
  reset: 0,
  bold: 1,
  dim: 2,
  strikethrough: 9,
  red: 31,
  green: 32,
  yellow: 33,
  cyan: 36,
};

// Build a styler from one or more SGR codes. Codes are combined into a single
// opening sequence and always closed with a full reset.
function style(...codes) {
  const open = codes.map((c) => `\x1b[${c}m`).join('');
  return (text) => (enabled ? `${open}${text}\x1b[${CODE.reset}m` : String(text));
}

module.exports = {
  setEnabled,
  bold: style(CODE.bold),
  dim: style(CODE.dim),
  red: style(CODE.red),
  green: style(CODE.green),
  yellow: style(CODE.yellow),
  cyan: style(CODE.cyan),
  boldCyan: style(CODE.bold, CODE.cyan),
  dimStrike: style(CODE.dim, CODE.strikethrough),
};

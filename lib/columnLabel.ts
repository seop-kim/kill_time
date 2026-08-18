/** 0-based column index -> spreadsheet-style label (0 -> "A", 25 -> "Z", 26 -> "AA", 49 -> "AX"). */
export function columnLabel(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[], header: boolean): string {
  const lines: string[] = [];

  if (header) {
    lines.push(columns.map((column) => escapeCell(column)).join(","));
  }

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(row[column])).join(","));
  }

  return `${lines.join("\n")}\n`;
}

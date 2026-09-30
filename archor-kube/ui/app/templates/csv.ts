/**
 * CSV de las plantillas. Lo que se sube a Grail va siempre en una forma fija
 * (coma, sin comillas, columnas en el orden de la plantilla), porque el patrón
 * DPL que lo lee no entiende comillas. Lo que llega de una planilla se
 * normaliza antes: Excel en español guarda con punto y coma, agrega BOM y
 * termina las líneas con \r\n.
 */

/** Un valor listo para el CSV fijo: sin comas ni saltos de línea. */
const clean = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/[,\r\n]+/g, " ").trim();
};

export const toCsv = (columns: string[], rows: unknown[][]): string =>
  [columns.join(","), ...rows.map((row) => row.map(clean).join(","))].join("\n") + "\n";

/** Lee un CSV con comillas y separador `,` o `;` (el que tenga el encabezado). */
export const parseCsv = (text: string): string[][] => {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const sep = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') field += body[++i];
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
};

/** Baja un archivo de texto en el navegador. */
export const downloadText = (fileName: string, text: string): void => {
  // BOM para que Excel abra los acentos bien.
  const blob = new Blob([String.fromCharCode(0xfeff), text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

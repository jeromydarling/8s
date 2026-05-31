import type { ImportResult } from "../shared/types";

// Cloudflare AI-powered "import years of data in any format". We hand the model
// whatever the family pastes — a CSV export, a copied results table, a wall of
// text from an old email — and ask it to synthesize structured rodeo records.
// If AI isn't bound, we fall back to a deterministic heuristic parser so the
// feature still demonstrates end to end.

const SYSTEM = `You are the import engine for "8 Seconds", a youth rodeo family app.
Families paste messy historical data (CSV, spreadsheet dumps, copied results pages, hand-typed notes).
Extract and normalize it into clean records. Recognize rodeo concepts:
- contestants (riders / kids) with name, age, division (Pee Wee/Junior/Senior)
- horses with name, breed, role
- events / rodeos with name, date, location, association
- runs / results with discipline, time-or-score, placing
Return ONLY valid JSON, no prose, matching:
{"summary": string, "records": [{"type": "contestant|horse|event|run", ...fields}], "warnings": [string]}
Keep field names lowercase snake_case. Infer division from age when possible. Be generous in parsing dates and times.`;

interface AiRecord {
  type?: string;
  [k: string]: string | number | null | undefined;
}

export async function runImport(
  text: string,
  filename: string,
  ai?: Ai,
): Promise<ImportResult> {
  if (ai) {
    try {
      const res = (await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Source: ${filename}\n\nData:\n${text}` },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      })) as { response?: string };

      const parsed = extractJson(res.response ?? "");
      if (parsed) return shape(parsed, filename, true);
    } catch (err) {
      console.error("AI import failed, using heuristic", err);
    }
  }
  return heuristic(text, filename);
}

function extractJson(raw: string): { summary?: string; records?: AiRecord[]; warnings?: string[] } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function shape(
  parsed: { summary?: string; records?: AiRecord[]; warnings?: string[] },
  filename: string,
  fromAi: boolean,
): ImportResult {
  const records = (parsed.records ?? []).filter(Boolean).slice(0, 200);
  const counts = { contestants: 0, horses: 0, runs: 0, events: 0 };
  for (const r of records) {
    if (r.type === "contestant") counts.contestants++;
    else if (r.type === "horse") counts.horses++;
    else if (r.type === "event") counts.events++;
    else if (r.type === "run") counts.runs++;
  }
  return {
    summary:
      parsed.summary ??
      `Synthesized ${records.length} records from ${filename}.`,
    detected: counts,
    records: records.map((r) => r as Record<string, string | number | null>),
    warnings: parsed.warnings ?? [],
    mappedFrom: fromAi ? "Cloudflare AI (Llama 3.3)" : "heuristic parser",
  };
}

// Deterministic fallback: treat the paste as delimited rows, sniff a header,
// and classify each row by the columns present.
function heuristic(text: string, filename: string): ImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return {
      summary: "Nothing recognizable to import.",
      detected: { contestants: 0, horses: 0, runs: 0, events: 0 },
      records: [],
      warnings: ["No rows detected."],
      mappedFrom: "heuristic parser",
    };
  }

  const delim = guessDelim(lines[0]);
  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase());
  const hasHeader = header.some((h) =>
    /name|horse|time|date|event|placing|rider|discipline|age/.test(h),
  );
  const rows = (hasHeader ? lines.slice(1) : lines).slice(0, 200);
  const cols = hasHeader ? header : guessColumns(rows[0]?.split(delim).length ?? 1);

  const records: Record<string, string | number | null>[] = [];
  const counts = { contestants: 0, horses: 0, runs: 0, events: 0 };

  for (const line of rows) {
    const cells = line.split(delim).map((c) => c.trim());
    const rec: Record<string, string | number | null> = {};
    cols.forEach((col, i) => (rec[col] = cells[i] ?? null));

    const hasTime = cols.some((c) => /time|score|result|placing/.test(c));
    const hasHorse = cols.some((c) => /horse/.test(c));
    if (hasTime) {
      rec.type = "run";
      counts.runs++;
    } else if (hasHorse) {
      rec.type = "horse";
      counts.horses++;
    } else if (cols.some((c) => /event|rodeo|venue/.test(c))) {
      rec.type = "event";
      counts.events++;
    } else {
      rec.type = "contestant";
      counts.contestants++;
    }
    records.push(rec);
  }

  return {
    summary: `Parsed ${records.length} rows from ${filename}. Connect Cloudflare AI for smarter mapping of free-form data.`,
    detected: counts,
    records,
    warnings: hasHeader ? [] : ["No header row detected — columns were inferred."],
    mappedFrom: "heuristic parser",
  };
}

function guessDelim(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.split(",").length >= line.split(";").length) return ",";
  return ";";
}

function guessColumns(n: number): string[] {
  const base = ["name", "horse", "event", "discipline", "result", "placing", "date"];
  return Array.from({ length: n }, (_, i) => base[i] ?? `field_${i + 1}`);
}

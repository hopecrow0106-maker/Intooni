import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const REPORT_PATH = path.join(ROOT_DIR, "docs", "ENCODING_AUDIT_REPORT.md");
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml"
]);
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".vercel",
  "backups",
  "coverage",
  "dist",
  "node_modules",
  "out"
]);
const MOJIBAKE_MARKERS = [
  String.fromCodePoint(0xfffd),
  String.fromCodePoint(0x00ec),
  String.fromCodePoint(0x00eb),
  String.fromCodePoint(0x00ea)
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function hasBadControlCharacter(text) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text);
}

function codePointLabel(value) {
  return `U+${value.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
}

async function listTextFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...await listTextFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && isTextFile(fullPath)) {
      if (path.resolve(fullPath) !== path.resolve(REPORT_PATH)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function findIssues(text) {
  const issues = [];

  for (const marker of MOJIBAKE_MARKERS) {
    if (text.includes(marker)) {
      issues.push(`mojibake marker ${codePointLabel(marker)}`);
    }
  }

  if (hasBadControlCharacter(text)) {
    issues.push("unexpected control character");
  }

  if (text !== text.normalize("NFC")) {
    issues.push("not NFC-normalized");
  }

  return issues;
}

function formatReport(results) {
  const generatedAt = new Date().toISOString();
  const failed = results.filter((result) => result.issues.length > 0);
  const lines = [
    "# Encoding Audit Report",
    "",
    `Generated at: ${generatedAt}`,
    "",
    `Files scanned: ${results.length}`,
    `Files with issues: ${failed.length}`,
    "",
    "## Rules",
    "",
    "- UTF-8 text files only",
    "- NFC-normalized Korean text",
    "- No replacement characters",
    "- No likely mojibake markers",
    "- No unexpected control characters",
    ""
  ];

  if (failed.length === 0) {
    lines.push("## Findings", "", "No encoding issues detected.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Findings", "");
  for (const result of failed) {
    lines.push(`- \`${result.path}\`: ${result.issues.join(", ")}`);
  }
  lines.push(
    "",
    "## Remediation",
    "",
    "Do not guess-repair replacement characters. Restore damaged Korean text from the source database, Instagram, Google Sheets history, or a known-good backup."
  );

  return `${lines.join("\n")}\n`;
}

const files = await listTextFiles(ROOT_DIR);
const results = [];

for (const filePath of files) {
  const text = await fs.readFile(filePath, "utf8");
  const relativePath = toPosix(path.relative(ROOT_DIR, filePath));
  results.push({
    path: relativePath,
    issues: findIssues(text)
  });
}

await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
await fs.writeFile(REPORT_PATH, formatReport(results), "utf8");

const failedCount = results.filter((result) => result.issues.length > 0).length;
if (failedCount > 0) {
  console.error(`Encoding audit found ${failedCount} file(s) with issues. See ${REPORT_PATH}`);
  process.exitCode = 1;
} else {
  console.log(`Encoding audit passed. See ${REPORT_PATH}`);
}

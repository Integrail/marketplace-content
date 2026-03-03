import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Converts a markdown string to a PDF buffer using pandoc.
 * Requires pandoc to be installed on the system.
 *
 * @throws if pandoc is not found or exits with a non-zero status.
 */
export function markdownToPdf(markdown: string): Buffer {
    const tmpDir = mkdtempSync(join(tmpdir(), "catalog-pdf-"));
    try {
        const inFile = join(tmpDir, "input.md");
        const outFile = join(tmpDir, "output.pdf");
        writeFileSync(inFile, markdown, "utf-8");
        const result = spawnSync("pandoc", [inFile, "--from=markdown", `--output=${outFile}`], {
            encoding: "utf-8",
        });
        if (result.status !== 0) {
            throw new Error(`pandoc failed (exit ${result.status}): ${result.stderr}`);
        }
        return readFileSync(outFile);
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

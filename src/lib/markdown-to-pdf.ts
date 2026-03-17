import { mdToPdf } from "md-to-pdf";

/**
 * Converts a markdown string to a PDF buffer using md-to-pdf.
 * No external tools required — installed via npm.
 */
export async function markdownToPdf(markdown: string): Promise<Buffer> {
    const pdf = await mdToPdf({ content: markdown });
    return pdf.content;
}

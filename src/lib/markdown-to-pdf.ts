import { marked } from "marked";
import puppeteer from "puppeteer";

const MARKDOWN_CSS = `
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #24292e;
    max-width: 860px;
    margin: 0 auto;
    padding: 20px;
}
h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.25;
}
h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }
p { margin: 0.5em 0 1em; }
ul, ol { padding-left: 2em; margin: 0.5em 0 1em; }
li { margin: 0.25em 0; }
code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 85%;
    background: #f6f8fa;
    border-radius: 3px;
    padding: 0.2em 0.4em;
}
pre {
    background: #f6f8fa;
    border-radius: 6px;
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
}
pre code { background: none; padding: 0; }
blockquote {
    border-left: 4px solid #dfe2e5;
    color: #6a737d;
    margin: 0;
    padding: 0 1em;
}
table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
}
th, td {
    border: 1px solid #dfe2e5;
    padding: 6px 13px;
}
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
img { max-width: 100%; height: auto; display: block; margin: 1em 0; }
hr { border: none; border-top: 1px solid #eaecef; margin: 1.5em 0; }
a { color: #0366d6; text-decoration: none; }
`;

/**
 * Converts a markdown string to a PDF buffer using puppeteer.
 *
 * @param markdown  Markdown content to convert
 * @param basedir   Directory used to resolve relative image paths (e.g. task attachments dir)
 */
export async function markdownToPdf(markdown: string, basedir?: string): Promise<Buffer> {
    marked.use({
        breaks: true,
    });
    const body = await marked(markdown);
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${basedir ? `<base href="file://${basedir}/">` : ""}
<style>${MARKDOWN_CSS}</style>
</head>
<body>${body}</body>
</html>`;

    const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdf = await page.pdf({
            format: "A4",
            margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
            printBackground: true,
        });
        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}

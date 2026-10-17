import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markdownToSafeHtml } from "./markdown.js";

describe("markdownToSafeHtml", () => {
  it("renders headings, emphasis, and links", () => {
    const html = markdownToSafeHtml("## Hello\n\nA **bold** and *italic* [link](https://example.com).");
    assert.match(html, /<h2>Hello<\/h2>/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<em>italic<\/em>/);
    assert.match(html, /<a href="https:\/\/example\.com" rel="noopener noreferrer">link<\/a>/);
  });

  it("escapes raw HTML from authors", () => {
    const html = markdownToSafeHtml("<script>alert(1)</script>");
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  it("renders https images and upload paths", () => {
    const upload = "/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png";
    const html = markdownToSafeHtml(`![cat](https://cdn.example.com/c.png)\n\n![local](${upload})`);
    assert.match(html, /<img src="https:\/\/cdn\.example\.com\/c\.png" alt="cat" loading="lazy" \/>/);
    assert.match(html, new RegExp(`<img src="${upload}" alt="local" loading="lazy" />`));
  });

  it("rejects dangerous or relative image urls", () => {
    const html = markdownToSafeHtml("![x](javascript:alert(1))\n\n![y](/etc/passwd)");
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /!\[x\]/);
  });

  it("renders blockquotes", () => {
    const html = markdownToSafeHtml("> quoted\n> line");
    assert.match(html, /<blockquote><p>quoted<br \/>line<\/p><\/blockquote>/);
  });

  it("renders fenced code without interpreting markdown inside", () => {
    const html = markdownToSafeHtml("```\n**not bold**\n```");
    assert.match(html, /<pre><code>\*\*not bold\*\*<\/code><\/pre>/);
  });
});

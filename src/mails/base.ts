// Ported from pocketbase/mails/base.go

export function resolveTemplateContent(data: { HTMLContent?: string }, ...content: string[]): string {
  if (content.length === 0) {
    return "";
  }

  const layout = content[0] ?? "";
  const html = data.HTMLContent ?? "";
  return layout.replace(/\{\{template "content" \.\}\}/g, html);
}

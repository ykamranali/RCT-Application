/**
 * Template rendering for the email system.
 *
 * Templates use {{variable}} placeholders. Values are HTML-escaped before
 * substitution, so a customer whose company name contains an ampersand or a
 * ticket description containing markup can never break the layout or inject
 * script into a mail client.
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}

/**
 * Replace every {{key}} with its value.
 *
 * A placeholder with no matching variable is replaced with an empty string
 * rather than being left in the output: a customer should never receive an
 * email containing a literal "{{engineer_name}}".
 */
export function renderTemplate(template: string, vars: TemplateVars, escape = true): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === null || value === undefined) return '';
    const text = String(value);
    return escape ? escapeHtml(text) : text;
  });
}

/** Which placeholders a template actually uses - powers the admin editor. */
export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  const pattern = /\{\{\s*([\w.]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    if (match[1]) found.add(match[1]);
  }
  return [...found].sort();
}

/** Placeholders in the template for which no value was supplied. */
export function missingVariables(template: string, vars: TemplateVars): string[] {
  return extractVariables(template).filter(
    (key) => vars[key] === undefined || vars[key] === null || vars[key] === '',
  );
}

/** Crude but dependable HTML -> text fallback for clients that need it. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

import 'server-only';

import PDFDocument from 'pdfkit';

import { formatCurrency, formatDateTime, formatDuration, humaniseEnum } from '@/lib/format';

/**
 * Service report PDF renderer.
 *
 * Produces the document that is attached to the closure email and stored in
 * the private `service-reports` bucket. Everything printed comes from the
 * snapshot captured at closure time, so a report never changes retroactively
 * because a customer was renamed or a category was edited.
 */

export interface ServiceReportPart {
  name: string;
  serialNumber?: string | null;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  currency?: string;
  remarks?: string | null;
}

export interface ServiceReportData {
  company: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    trn?: string | null;
    footer?: string | null;
    /** PNG or JPEG bytes for the letterhead logo. */
    logo?: Buffer | null;
  };
  report: {
    number: string;
    generatedAt: string;
    finalStatus: string;
  };
  ticket: {
    number: string;
    subject: string;
    description: string;
    category?: string | null;
    subcategory?: string | null;
    priority?: string | null;
    createdAt: string;
    slaPlan?: string | null;
    resolutionState?: string | null;
    resolutionDueAt?: string | null;
  };
  customer: {
    name: string;
    code?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  branch?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    emirate?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
  } | null;
  asset?: { tag?: string | null; name?: string | null; serialNumber?: string | null } | null;
  engineer: { name: string; code?: string | null; jobTitle?: string | null; phone?: string | null };
  work: {
    complaint?: string | null;
    diagnosis?: string | null;
    workPerformed?: string | null;
    engineerRemarks?: string | null;
    customerRemarks?: string | null;
    startedAt?: string | null;
    arrivedAt?: string | null;
    completedAt?: string | null;
    totalMinutes?: number | null;
  };
  parts: ServiceReportPart[];
  signatures: {
    customerName?: string | null;
    customerTitle?: string | null;
    customerImage?: Buffer | null;
    customerSignedAt?: string | null;
    engineerName?: string | null;
    engineerImage?: Buffer | null;
  };
}

// --- layout constants -------------------------------------------------
const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, points
const M = { left: 46, right: 46, top: 44, bottom: 58 };
const CONTENT_WIDTH = PAGE.width - M.left - M.right;

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const BRAND = '#0E4FA1';
const SOFT = '#F8FAFC';

type Doc = PDFKit.PDFDocument;

export async function buildServiceReportPdf(data: ServiceReportData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
    bufferPages: true,
    info: {
      Title: `Service Report ${data.report.number}`,
      Author: data.company.name,
      Subject: `Service report for ticket ${data.ticket.number}`,
      Keywords: `service report,${data.ticket.number},${data.customer.name}`,
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  drawLetterhead(doc, data);
  drawTitleBlock(doc, data);
  drawPartyBlocks(doc, data);
  drawTicketSummary(doc, data);
  drawNarrativeSections(doc, data);
  drawPartsTable(doc, data);
  drawTimeBlock(doc, data);
  drawSignatureBlock(doc, data);
  paginate(doc, data);

  doc.end();
  return finished;
}

// ---------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------

/** Reserve vertical space, adding a page when the block would not fit. */
function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > PAGE.height - M.bottom) {
    doc.addPage();
    doc.y = M.top;
  }
}

function drawLetterhead(doc: Doc, data: ServiceReportData): void {
  const top = M.top;

  if (data.company.logo) {
    try {
      // Left is the default; pdfkit's image align only accepts centre or right.
      doc.image(data.company.logo, M.left, top - 4, { fit: [132, 42] });
    } catch {
      // A corrupt or unsupported logo must never prevent a report from being
      // produced - fall back to the wordmark below.
      drawWordmark(doc, top);
    }
  } else {
    drawWordmark(doc, top);
  }

  // Company particulars, right aligned.
  const lines = [
    data.company.address,
    [data.company.phone, data.company.email].filter(Boolean).join('  ·  ') || null,
    data.company.website,
    data.company.trn ? `TRN ${data.company.trn}` : null,
  ].filter((l): l is string => !!l && l.length > 0);

  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  let y = top;
  for (const line of lines) {
    doc.text(line, PAGE.width / 2, y, { width: CONTENT_WIDTH / 2, align: 'right' });
    y += 10.5;
  }

  const ruleY = Math.max(top + 48, y + 4);
  doc.moveTo(M.left, ruleY).lineTo(PAGE.width - M.right, ruleY).lineWidth(1.4).strokeColor(BRAND).stroke();
  doc.y = ruleY + 16;
}

function drawWordmark(doc: Doc, top: number): void {
  doc.font('Helvetica-Bold').fontSize(19).fillColor(INK).text('RCT', M.left, top, { continued: true });
  doc.font('Helvetica').fontSize(19).fillColor(BRAND).text(' Application');
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('SERVICE MANAGEMENT', M.left, top + 23, { characterSpacing: 1.6 });
}

function drawTitleBlock(doc: Doc, data: ServiceReportData): void {
  const y = doc.y;
  const boxWidth = 196;
  const boxX = PAGE.width - M.right - boxWidth;

  doc.font('Helvetica-Bold').fontSize(17).fillColor(INK).text('SERVICE REPORT', M.left, y);
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(MUTED)
    .text('Record of service attendance and work completed', M.left, y + 21);

  // Reference box
  doc.roundedRect(boxX, y - 6, boxWidth, 52, 6).fillColor(SOFT).fill();
  doc.roundedRect(boxX, y - 6, boxWidth, 52, 6).lineWidth(0.7).strokeColor(LINE).stroke();

  label(doc, 'REPORT NUMBER', boxX + 12, y + 2);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text(data.report.number, boxX + 12, y + 12);

  label(doc, 'TICKET', boxX + 12, y + 28);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(data.ticket.number, boxX + 54, y + 27);

  doc.y = y + 62;
}

function drawPartyBlocks(doc: Doc, data: ServiceReportData): void {
  const y = doc.y;
  const colWidth = (CONTENT_WIDTH - 16) / 2;

  const customerRows: [string, string][] = [
    ['Company', data.customer.name],
    ['Account', data.customer.code ?? '—'],
    ['Contact', data.branch?.contactPerson ?? data.customer.contactPerson ?? '—'],
    ['Telephone', data.branch?.phone ?? data.customer.phone ?? '—'],
    ['Email', data.customer.email ?? '—'],
  ];

  const siteRows: [string, string][] = [
    ['Site', data.branch?.name ?? 'Head office'],
    [
      'Location',
      [data.branch?.address, data.branch?.city, data.branch?.emirate].filter(Boolean).join(', ') || '—',
    ],
    ['Engineer', data.engineer.name],
    ['Employee no.', data.engineer.code ?? '—'],
    [
      'Asset',
      data.asset?.tag
        ? `${data.asset.tag}${data.asset.name ? ` · ${data.asset.name}` : ''}`
        : 'Not linked',
    ],
  ];

  const height = Math.max(
    definitionBlock(doc, 'CUSTOMER', customerRows, M.left, y, colWidth),
    definitionBlock(doc, 'SITE & ENGINEER', siteRows, M.left + colWidth + 16, y, colWidth),
  );

  doc.y = y + height + 14;
}

function drawTicketSummary(doc: Doc, data: ServiceReportData): void {
  ensureSpace(doc, 70);
  const y = doc.y;

  sectionHeading(doc, 'CALL DETAILS', y);
  const top = y + 16;

  doc.roundedRect(M.left, top, CONTENT_WIDTH, 44, 5).fillColor(SOFT).fill();
  doc.roundedRect(M.left, top, CONTENT_WIDTH, 44, 5).lineWidth(0.7).strokeColor(LINE).stroke();

  const cells: [string, string][] = [
    ['LOGGED', formatDateTime(data.ticket.createdAt)],
    ['CATEGORY', data.ticket.category ?? '—'],
    ['PRIORITY', data.ticket.priority ?? '—'],
    ['SLA', slaLabel(data)],
    ['STATUS', humaniseEnum(data.report.finalStatus)],
  ];

  const cellWidth = CONTENT_WIDTH / cells.length;
  cells.forEach(([key, value], index) => {
    const x = M.left + index * cellWidth + 12;
    label(doc, key, x, top + 9);
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(INK)
      .text(value, x, top + 21, { width: cellWidth - 16, ellipsis: true, lineBreak: false });
  });

  doc.y = top + 56;
}

function slaLabel(data: ServiceReportData): string {
  const state = data.ticket.resolutionState;
  if (!state || state === 'not_applicable') return data.ticket.slaPlan ?? '—';
  if (state === 'met') return 'Met';
  if (state === 'breached') return 'Breached';
  if (state === 'at_risk') return 'At risk';
  return humaniseEnum(state);
}

function drawNarrativeSections(doc: Doc, data: ServiceReportData): void {
  const sections: [string, string | null | undefined][] = [
    ['CUSTOMER COMPLAINT', data.work.complaint ?? data.ticket.description],
    ['ENGINEER DIAGNOSIS', data.work.diagnosis],
    ['WORK PERFORMED', data.work.workPerformed],
    ['ENGINEER REMARKS', data.work.engineerRemarks],
    ['CUSTOMER REMARKS', data.work.customerRemarks],
  ];

  for (const [title, body] of sections) {
    if (!body || !body.trim()) continue;
    const text = body.trim();

    doc.font('Helvetica').fontSize(9);
    const bodyHeight = doc.heightOfString(text, { width: CONTENT_WIDTH - 24, lineGap: 1.6 });

    ensureSpace(doc, bodyHeight + 40);
    const y = doc.y;

    sectionHeading(doc, title, y);
    const top = y + 16;
    const boxHeight = bodyHeight + 18;

    doc.roundedRect(M.left, top, CONTENT_WIDTH, boxHeight, 5).lineWidth(0.7).strokeColor(LINE).stroke();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(INK)
      .text(text, M.left + 12, top + 9, { width: CONTENT_WIDTH - 24, lineGap: 1.6, align: 'left' });

    doc.y = top + boxHeight + 12;
  }
}

function drawPartsTable(doc: Doc, data: ServiceReportData): void {
  if (!data.parts.length) return;

  const rowHeight = 20;
  ensureSpace(doc, 40 + rowHeight * (data.parts.length + 1));

  const y = doc.y;
  sectionHeading(doc, 'PARTS & MATERIALS USED', y);
  const top = y + 16;

  const cols = [
    { key: 'name', title: 'Description', width: CONTENT_WIDTH * 0.34 },
    { key: 'serial', title: 'Serial number', width: CONTENT_WIDTH * 0.22 },
    { key: 'qty', title: 'Qty', width: CONTENT_WIDTH * 0.1, align: 'right' as const },
    { key: 'unit', title: 'Unit', width: CONTENT_WIDTH * 0.1 },
    { key: 'cost', title: 'Amount', width: CONTENT_WIDTH * 0.24, align: 'right' as const },
  ];

  // Header
  doc.rect(M.left, top, CONTENT_WIDTH, rowHeight).fillColor('#EEF2F7').fill();
  let x = M.left;
  for (const col of cols) {
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(col.title.toUpperCase(), x + 8, top + 6.5, {
        width: col.width - 16,
        align: col.align ?? 'left',
        characterSpacing: 0.4,
      });
    x += col.width;
  }

  // Rows
  let rowY = top + rowHeight;
  let total = 0;
  let currency = data.parts[0]?.currency ?? 'AED';

  data.parts.forEach((part, index) => {
    if (index % 2 === 1) {
      doc.rect(M.left, rowY, CONTENT_WIDTH, rowHeight).fillColor(SOFT).fill();
    }
    const amount = (part.unitCost ?? 0) * part.quantity;
    total += amount;
    currency = part.currency ?? currency;

    const values = [
      part.name,
      part.serialNumber || '—',
      String(part.quantity),
      part.unit,
      part.unitCost === null || part.unitCost === undefined
        ? '—'
        : formatCurrency(amount, part.currency ?? currency),
    ];

    let cx = M.left;
    cols.forEach((col, i) => {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(INK)
        .text(values[i] ?? '', cx + 8, rowY + 6, {
          width: col.width - 16,
          align: col.align ?? 'left',
          ellipsis: true,
          lineBreak: false,
        });
      cx += col.width;
    });

    rowY += rowHeight;
  });

  // Total
  doc.moveTo(M.left, rowY).lineTo(PAGE.width - M.right, rowY).lineWidth(0.7).strokeColor(LINE).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(INK)
    .text('Total', M.left + 8, rowY + 7, { width: CONTENT_WIDTH * 0.72, align: 'right' });
  doc.text(formatCurrency(total, currency), M.left + CONTENT_WIDTH * 0.76, rowY + 7, {
    width: CONTENT_WIDTH * 0.24 - 8,
    align: 'right',
  });

  doc.rect(M.left, top, CONTENT_WIDTH, rowY + 24 - top).lineWidth(0.7).strokeColor(LINE).stroke();
  doc.y = rowY + 34;
}

function drawTimeBlock(doc: Doc, data: ServiceReportData): void {
  ensureSpace(doc, 62);
  const y = doc.y;

  sectionHeading(doc, 'ATTENDANCE', y);
  const top = y + 16;

  doc.roundedRect(M.left, top, CONTENT_WIDTH, 38, 5).lineWidth(0.7).strokeColor(LINE).stroke();

  const cells: [string, string][] = [
    ['WORK STARTED', formatDateTime(data.work.startedAt)],
    ['ARRIVED ON SITE', formatDateTime(data.work.arrivedAt)],
    ['COMPLETED', formatDateTime(data.work.completedAt)],
    ['TOTAL TIME', formatDuration(data.work.totalMinutes)],
  ];

  const cellWidth = CONTENT_WIDTH / cells.length;
  cells.forEach(([key, value], index) => {
    const x = M.left + index * cellWidth + 12;
    label(doc, key, x, top + 8);
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(INK)
      .text(value, x, top + 20, { width: cellWidth - 16, lineBreak: false, ellipsis: true });
  });

  doc.y = top + 50;
}

function drawSignatureBlock(doc: Doc, data: ServiceReportData): void {
  const blockHeight = 116;
  ensureSpace(doc, blockHeight + 24);

  const y = doc.y;
  sectionHeading(doc, 'ACCEPTANCE', y);
  const top = y + 16;
  const colWidth = (CONTENT_WIDTH - 16) / 2;

  signaturePanel(
    doc,
    M.left,
    top,
    colWidth,
    'CUSTOMER ACCEPTANCE',
    data.signatures.customerName ?? data.customer.contactPerson ?? '',
    data.signatures.customerTitle ?? null,
    data.signatures.customerImage ?? null,
    data.signatures.customerSignedAt ?? null,
  );

  signaturePanel(
    doc,
    M.left + colWidth + 16,
    top,
    colWidth,
    'SERVICE ENGINEER',
    data.signatures.engineerName ?? data.engineer.name,
    data.engineer.jobTitle ?? null,
    data.signatures.engineerImage ?? null,
    data.work.completedAt ?? null,
  );

  doc.y = top + blockHeight + 10;

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(
      'By signing above the customer confirms that the work described in this report has been carried out and that the equipment was left in working order at the time of departure.',
      M.left,
      doc.y,
      { width: CONTENT_WIDTH, lineGap: 1.2 },
    );
}

function signaturePanel(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  title: string,
  name: string,
  subtitle: string | null,
  image: Buffer | null,
  signedAt: string | null,
): void {
  const height = 116;
  doc.roundedRect(x, y, width, height, 5).lineWidth(0.7).strokeColor(LINE).stroke();
  label(doc, title, x + 12, y + 9);

  // Signature image area
  const imgTop = y + 24;
  const imgHeight = 44;
  if (image) {
    try {
      doc.image(image, x + 12, imgTop, {
        fit: [width - 24, imgHeight],
        align: 'center',
        valign: 'bottom',
      });
    } catch {
      // Unreadable signature bytes must not break the document.
    }
  }

  const ruleY = imgTop + imgHeight + 4;
  doc.moveTo(x + 12, ruleY).lineTo(x + width - 12, ruleY).lineWidth(0.7).strokeColor(LINE).stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(name || '—', x + 12, ruleY + 7, {
    width: width - 24,
    ellipsis: true,
    lineBreak: false,
  });

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(
      [subtitle, signedAt ? formatDateTime(signedAt) : null].filter(Boolean).join('  ·  ') || ' ',
      x + 12,
      ruleY + 19,
      { width: width - 24, ellipsis: true, lineBreak: false },
    );
}

/** Footer and "Page n of m" on every page, added once the body is complete. */
function paginate(doc: Doc, data: ServiceReportData): void {
  const range = doc.bufferedPageRange();
  const footerText = data.company.footer || data.company.name;

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    // Writing below the bottom margin makes pdfkit start a fresh page, and
    // that new page then needs a footer too - which is how a two-page report
    // silently becomes eight. Dropping the margin for the footer stops the
    // cascade; it is restored immediately afterwards.
    const restoreBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = PAGE.height - M.bottom + 16;
    doc.moveTo(M.left, y - 8).lineTo(PAGE.width - M.right, y - 8).lineWidth(0.6).strokeColor(LINE).stroke();

    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);

    // Each segment is measured and truncated to its own column, so a long
    // company name or a wide date format can never wrap the footer.
    const leftW = CONTENT_WIDTH * 0.34;
    const midW = CONTENT_WIDTH * 0.44;
    const rightW = CONTENT_WIDTH * 0.22;

    doc.text(fit(doc, footerText, leftW), M.left, y, { width: leftW, align: 'left', lineBreak: false });

    doc.text(
      fit(doc, `${data.report.number}  ·  ${formatDateTime(data.report.generatedAt)}`, midW),
      M.left + leftW,
      y,
      { width: midW, align: 'center', lineBreak: false },
    );

    doc.text(`Page ${i - range.start + 1} of ${range.count}`, M.left + leftW + midW, y, {
      width: rightW,
      align: 'right',
      lineBreak: false,
    });

    doc.page.margins.bottom = restoreBottom;
  }
}

// --- small primitives -------------------------------------------------

/** Shorten text with an ellipsis so it fits the given width exactly once. */
function fit(doc: Doc, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let out = text;
  while (out.length > 1 && doc.widthOfString(`${out}…`) > width) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}…`;
}

function label(doc: Doc, text: string, x: number, y: number): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(MUTED)
    .text(text.toUpperCase(), x, y, { characterSpacing: 0.6, lineBreak: false });
}

function sectionHeading(doc: Doc, text: string, y: number): void {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND).text(text.toUpperCase(), M.left, y, {
    characterSpacing: 0.8,
    lineBreak: false,
  });
}

/** Two-column key/value block. Returns the height consumed. */
function definitionBlock(
  doc: Doc,
  title: string,
  rows: [string, string][],
  x: number,
  y: number,
  width: number,
): number {
  const rowHeight = 14;
  const height = 26 + rows.length * rowHeight;

  doc.roundedRect(x, y, width, height, 5).lineWidth(0.7).strokeColor(LINE).stroke();
  label(doc, title, x + 12, y + 9);

  rows.forEach(([key, value], index) => {
    const rowY = y + 24 + index * rowHeight;
    const valueWidth = width * 0.66 - 24;

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(key, x + 12, rowY, { width: width * 0.32, lineBreak: false });

    // Truncate against the measured width rather than trusting pdfkit's
    // ellipsis option, which still wraps and overlaps the row beneath.
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
    doc.text(fit(doc, value || '—', valueWidth), x + 12 + width * 0.34, rowY, {
      width: valueWidth,
      lineBreak: false,
    });
  });

  return height;
}

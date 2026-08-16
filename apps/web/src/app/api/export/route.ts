import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const supabase = await createServerSupabase();
    const type = req.nextUrl.searchParams.get('type') || 'tickets';

    // We stream the PDF output into a buffer so we can return it as a NextResponse
    const pdfBuffer = await new Promise<Buffer>(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const chunks: Buffer[] = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Title
        doc.fontSize(20).text(`RCT System Export: ${type.toUpperCase()}`, { align: 'center' });
        doc.moveDown(2);

        if (type === 'tickets') {
          const { data } = await supabase.from('v_tickets_overview').select('*');
          
          doc.fontSize(10);
          
          if (data && data.length > 0) {
            // Write a simple list/table approximation
            data.forEach((row: any, i: number) => {
              if (doc.y > 500) doc.addPage();
              doc.font('Helvetica-Bold').text(`Ticket: ${row.ticket_number} - ${row.subject}`);
              doc.font('Helvetica').text(`Status: ${row.status} | Priority: ${row.priority_code} | SLA: ${row.resolution_state}`);
              doc.text(`Customer: ${row.customer_name} | Assigned: ${row.assigned_engineer_name}`);
              doc.text(`Created: ${new Date(row.created_at).toLocaleString()}`);
              doc.moveDown(1);
            });
          } else {
            doc.text('No tickets found.');
          }
        } else if (type === 'amc') {
          const { data } = await supabase.from('v_amc_expiring').select('*');
          
          doc.fontSize(10);
          
          if (data && data.length > 0) {
            data.forEach((row: any, i: number) => {
              if (doc.y > 500) doc.addPage();
              doc.font('Helvetica-Bold').text(`AMC: ${row.amc_number} - ${row.company_name}`);
              doc.font('Helvetica').text(`Type: ${row.contract_type} | Status: ${row.status}`);
              doc.text(`Start: ${row.start_date} | Expiry: ${row.expiry_date} | Remaining: ${row.days_remaining} days`);
              doc.moveDown(1);
            });
          } else {
            doc.text('No AMC contracts found.');
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

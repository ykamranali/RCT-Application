import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const supabase = await createServerSupabase();
    const type = req.nextUrl.searchParams.get('type') || 'tickets';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RCT System';
    workbook.lastModifiedBy = 'RCT System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Export Data');

    if (type === 'tickets') {
      const { data } = await supabase.from('v_tickets_overview').select('*');
      
      sheet.columns = [
        { header: 'Ticket Number', key: 'ticket_number', width: 20 },
        { header: 'Subject', key: 'subject', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Priority', key: 'priority_code', width: 15 },
        { header: 'Customer', key: 'customer_name', width: 30 },
        { header: 'Engineer', key: 'assigned_engineer_name', width: 30 },
        { header: 'Created At', key: 'created_at', width: 25 },
        { header: 'Resolution State', key: 'resolution_state', width: 20 },
      ];

      if (data) {
        data.forEach((row: any) => {
          sheet.addRow({
            ticket_number: row.ticket_number,
            subject: row.subject,
            status: row.status,
            priority: row.priority_code,
            customer: row.customer_name,
            engineer: row.assigned_engineer_name,
            created_at: new Date(row.created_at).toLocaleString(),
            resolution_state: row.resolution_state,
          });
        });
      }
    } else if (type === 'amc') {
      const { data } = await supabase.from('v_amc_expiring').select('*');
      
      sheet.columns = [
        { header: 'AMC Number', key: 'amc_number', width: 20 },
        { header: 'Customer', key: 'company_name', width: 30 },
        { header: 'Contract Type', key: 'contract_type', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Start Date', key: 'start_date', width: 20 },
        { header: 'Expiry Date', key: 'expiry_date', width: 20 },
        { header: 'Days Remaining', key: 'days_remaining', width: 15 },
      ];

      if (data) {
        data.forEach((row: any) => {
          sheet.addRow({
            amc_number: row.amc_number,
            company_name: row.company_name,
            contract_type: row.contract_type,
            status: row.status,
            start_date: row.start_date,
            expiry_date: row.expiry_date,
            days_remaining: row.days_remaining,
          });
        });
      }
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

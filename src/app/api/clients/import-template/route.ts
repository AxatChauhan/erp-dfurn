import { NextResponse } from 'next/server';

export async function GET() {
  const csvContent =
    'Client Name,Type,Contact Person,Phone,Email,Address Line 1,City,State,Pincode,Country,GSTIN,Source,Referred By\n' +
    'Acme Enterprises,Business,John Doe,+919876543210,john@acme.com,"123 Industrial Area",Mumbai,Maharashtra,400001,India,27AAPFU0955P1ZV,Direct,Sarah Jenkins\n' +
    'Michael Scott,Individual,,+16146239091,michael@dunder.com,"1725 Slough Ave",Scranton,Pennsylvania,18504,United States,,Referral,Dwight Schrute\n';

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="clients-import-template.csv"'
    }
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { findCountry, DEFAULT_COUNTRY_ISO2 } from '@/lib/countries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const iso2 = searchParams.get('iso2') || DEFAULT_COUNTRY_ISO2;
    const number = searchParams.get('number') || '';

    if (!number.trim()) {
      return NextResponse.json({ ok: true });
    }

    const country = findCountry(iso2) || findCountry(DEFAULT_COUNTRY_ISO2)!;
    const result = normalizePhone({ iso2: country.iso2, number });

    if (result.ok) {
      return NextResponse.json({ ok: true, e164: result.e164 });
    }

    return NextResponse.json({
      ok: false,
      error: `This is not a valid ${country.name} number. Check the digits.`
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}

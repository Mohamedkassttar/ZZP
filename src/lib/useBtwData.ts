import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Database } from './database.types';

type SalesInvoice = Database['public']['Tables']['sales_invoices']['Row'];
type PurchaseInvoice = Database['public']['Tables']['purchase_invoices']['Row'];

interface BtwCalculation {
  omzetHoog: {
    grondslag: number;
    btw: number;
  };
  omzetLaag: {
    grondslag: number;
    btw: number;
  };
  omzetNul: {
    grondslag: number;
  };
  voorbelasting: number;
  verschuldigd: number;
  teruggave: number;
  totaal: number;
}

interface QuarterPeriod {
  startDate: string;
  endDate: string;
}

export function useBtwData(year: number, quarter: number) {
  const [data, setData] = useState<BtwCalculation>({
    omzetHoog: { grondslag: 0, btw: 0 },
    omzetLaag: { grondslag: 0, btw: 0 },
    omzetNul: { grondslag: 0 },
    voorbelasting: 0,
    verschuldigd: 0,
    teruggave: 0,
    totaal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBtwData();
  }, [year, quarter]);

  function getQuarterPeriod(year: number, quarter: number): QuarterPeriod {
    const quarters = [
      { start: `${year}-01-01`, end: `${year}-03-31` },
      { start: `${year}-04-01`, end: `${year}-06-30` },
      { start: `${year}-07-01`, end: `${year}-09-30` },
      { start: `${year}-10-01`, end: `${year}-12-31` },
    ];

    const period = quarters[quarter - 1];
    return {
      startDate: period.start,
      endDate: period.end,
    };
  }

  async function loadBtwData() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');

      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!companyUsers?.company_id) throw new Error('Geen bedrijf gevonden');

      const period = getQuarterPeriod(year, quarter);

      const { data: salesInvoices, error: salesError } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('company_id', companyUsers.company_id)
        .gte('date', period.startDate)
        .lte('date', period.endDate)
        .in('status', ['sent', 'paid', 'overdue']);

      if (salesError) throw salesError;

      const { data: purchaseInvoices, error: purchaseError } = await supabase
        .from('purchase_invoices')
        .select('*')
        .eq('company_id', companyUsers.company_id)
        .gte('invoice_date', period.startDate)
        .lte('invoice_date', period.endDate);

      if (purchaseError) throw purchaseError;

      const calculation = calculateBtw(salesInvoices || [], purchaseInvoices || []);
      setData(calculation);
    } catch (err: any) {
      console.error('Error loading BTW data:', err);
      setError(err.message || 'Fout bij laden van BTW gegevens');
    } finally {
      setLoading(false);
    }
  }

  function calculateBtw(
    salesInvoices: SalesInvoice[],
    purchaseInvoices: PurchaseInvoice[]
  ): BtwCalculation {
    let omzetHoog = { grondslag: 0, btw: 0 };
    let omzetLaag = { grondslag: 0, btw: 0 };
    let omzetNul = { grondslag: 0 };
    let voorbelasting = 0;

    salesInvoices.forEach((invoice) => {
      const items = Array.isArray(invoice.items) ? invoice.items : [];

      items.forEach((item: any) => {
        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const vatRate = Number(item.vat_percentage || 21);

        const subtotal = quantity * price;
        const vatAmount = subtotal * (vatRate / 100);

        if (vatRate === 21) {
          omzetHoog.grondslag += subtotal;
          omzetHoog.btw += vatAmount;
        } else if (vatRate === 9) {
          omzetLaag.grondslag += subtotal;
          omzetLaag.btw += vatAmount;
        } else if (vatRate === 0) {
          omzetNul.grondslag += subtotal;
        } else {
          omzetHoog.grondslag += subtotal;
          omzetHoog.btw += vatAmount;
        }
      });
    });

    purchaseInvoices.forEach((invoice) => {
      const vatAmount = Number(invoice.vat_amount || 0);
      voorbelasting += vatAmount;
    });

    const verschuldigd = omzetHoog.btw + omzetLaag.btw;
    const totaal = verschuldigd - voorbelasting;

    return {
      omzetHoog: {
        grondslag: Math.round(omzetHoog.grondslag * 100) / 100,
        btw: Math.round(omzetHoog.btw * 100) / 100,
      },
      omzetLaag: {
        grondslag: Math.round(omzetLaag.grondslag * 100) / 100,
        btw: Math.round(omzetLaag.btw * 100) / 100,
      },
      omzetNul: {
        grondslag: Math.round(omzetNul.grondslag * 100) / 100,
      },
      voorbelasting: Math.round(voorbelasting * 100) / 100,
      verschuldigd: Math.round(verschuldigd * 100) / 100,
      teruggave: totaal < 0 ? Math.abs(Math.round(totaal * 100) / 100) : 0,
      totaal: Math.round(totaal * 100) / 100,
    };
  }

  return { data, loading, error, refetch: loadBtwData };
}

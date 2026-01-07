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

      let companyId: string | undefined;

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: companyUsers, error: companyError } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (companyError) {
          console.error('Company lookup error:', companyError);
        }

        companyId = companyUsers?.company_id;
      }

      const period = getQuarterPeriod(year, quarter);

      // Haal sales_invoices op (nieuwe tabel)
      const salesQuery = supabase
        .from('sales_invoices')
        .select('*')
        .gte('date', period.startDate)
        .lte('date', period.endDate)
        .in('status', ['sent', 'paid', 'overdue']);

      if (companyId) {
        salesQuery.eq('company_id', companyId);
      }

      const { data: salesInvoices, error: salesError } = await salesQuery;

      if (salesError) {
        console.error('Sales invoices error:', salesError);
        throw new Error('Fout bij ophalen verkoop facturen: ' + salesError.message);
      }

      // Haal ook oude invoices tabel op voor backward compatibility
      const legacyInvoicesQuery = supabase
        .from('invoices')
        .select('*')
        .gte('invoice_date', period.startDate)
        .lte('invoice_date', period.endDate)
        .in('status', ['Sent', 'Paid', 'Overdue']);

      if (companyId) {
        legacyInvoicesQuery.eq('company_id', companyId);
      }

      const { data: legacyInvoices, error: legacyError } = await legacyInvoicesQuery;

      if (legacyError) {
        console.error('Legacy invoices error:', legacyError);
      }

      // Combineer beide invoice bronnen
      const allSalesInvoices = [
        ...(salesInvoices || []),
        ...(legacyInvoices || []).map(inv => ({
          id: inv.id,
          date: inv.invoice_date,
          total_amount: inv.total_amount,
          vat_amount: inv.vat_amount,
          subtotal: inv.subtotal,
          status: inv.status?.toLowerCase() || 'open',
          items: null,
        }))
      ];

      const purchaseQuery = supabase
        .from('purchase_invoices')
        .select('*')
        .gte('invoice_date', period.startDate)
        .lte('invoice_date', period.endDate);

      if (companyId) {
        purchaseQuery.eq('company_id', companyId);
      }

      const { data: purchaseInvoices, error: purchaseError } = await purchaseQuery;

      if (purchaseError) {
        console.error('Purchase invoices error:', purchaseError);
        throw new Error('Fout bij ophalen inkoop facturen: ' + purchaseError.message);
      }

      const calculation = calculateBtw(allSalesInvoices || [], purchaseInvoices || []);
      setData(calculation);
    } catch (err: any) {
      console.error('Error loading BTW data:', err);
      setError(err.message || 'Fout bij laden van BTW gegevens');
    } finally {
      setLoading(false);
    }
  }

  function calculateBtw(
    salesInvoices: any[],
    purchaseInvoices: PurchaseInvoice[]
  ): BtwCalculation {
    let omzetHoog = { grondslag: 0, btw: 0 };
    let omzetLaag = { grondslag: 0, btw: 0 };
    let omzetNul = { grondslag: 0 };
    let voorbelasting = 0;

    salesInvoices.forEach((invoice) => {
      const items = Array.isArray(invoice.items) ? invoice.items : [];

      if (items.length > 0) {
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
      } else {
        const vatAmount = Number(invoice.vat_amount || 0);
        const totalAmount = Number(invoice.total_amount || 0);
        const subtotal = invoice.subtotal ? Number(invoice.subtotal) : totalAmount - vatAmount;

        if (vatAmount > 0 && subtotal > 0) {
          const vatRate = (vatAmount / subtotal) * 100;

          if (vatRate >= 20 && vatRate <= 22) {
            omzetHoog.grondslag += subtotal;
            omzetHoog.btw += vatAmount;
          } else if (vatRate >= 8 && vatRate <= 10) {
            omzetLaag.grondslag += subtotal;
            omzetLaag.btw += vatAmount;
          } else if (vatRate < 1) {
            omzetNul.grondslag += subtotal;
          } else {
            omzetHoog.grondslag += subtotal;
            omzetHoog.btw += vatAmount;
          }
        } else if (totalAmount > 0) {
          omzetNul.grondslag += totalAmount;
        }
      }
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

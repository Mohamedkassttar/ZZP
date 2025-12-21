import { useState, useEffect } from 'react';
import { Copy, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

interface BalanceData {
  begin: number;
  einde: number;
}

interface TaxCategoryBalance {
  category: string;
  label: string;
  begin: number;
  einde: number;
}

interface PLData {
  category: string;
  label: string;
  amount: number;
}

export function IBAangifte() {
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(true);
  const [balanceData, setBalanceData] = useState<TaxCategoryBalance[]>([]);
  const [plData, setPlData] = useState<PLData[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [fiscalYear]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true);

      if (!accounts) {
        setLoading(false);
        return;
      }

      const startDate = `${fiscalYear}-01-01`;
      const endDate = `${fiscalYear}-12-31`;

      const { data: beginLines } = await supabase
        .from('journal_lines')
        .select('*, journal_entries!inner(*), accounts!inner(*)')
        .lt('journal_entries.entry_date', startDate);

      const { data: periodLines } = await supabase
        .from('journal_lines')
        .select('*, journal_entries!inner(*), accounts!inner(*)')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate);

      const balanceCategories: { [key: string]: string } = {
        'Materiële vaste activa': 'Materiële vaste activa',
        'Financiële vaste activa': 'Financiële vaste activa',
        'Voorraden': 'Voorraden',
        'Vorderingen': 'Vorderingen',
        'Liquide middelen': 'Liquide middelen',
        'Ondernemingsvermogen': 'Eigen vermogen',
        'Voorzieningen': 'Voorzieningen',
        'Langlopende schulden': 'Langlopende schulden',
        'Kortlopende schulden': 'Kortlopende schulden',
      };

      const balanceResults: TaxCategoryBalance[] = [];

      for (const [category, label] of Object.entries(balanceCategories)) {
        const categoryAccounts = accounts.filter((acc) => acc.tax_category === category);
        const accountIds = categoryAccounts.map((acc) => acc.id);

        let beginBalance = 0;
        let periodBalance = 0;

        if (beginLines) {
          const categoryBeginLines = beginLines.filter((line: any) =>
            accountIds.includes(line.account_id)
          );
          beginBalance = categoryBeginLines.reduce(
            (sum: number, line: any) => sum + Number(line.debit) - Number(line.credit),
            0
          );
        }

        if (periodLines) {
          const categoryPeriodLines = periodLines.filter((line: any) =>
            accountIds.includes(line.account_id)
          );
          periodBalance = categoryPeriodLines.reduce(
            (sum: number, line: any) => sum + Number(line.debit) - Number(line.credit),
            0
          );
        }

        const eindeBalance = beginBalance + periodBalance;

        balanceResults.push({
          category,
          label,
          begin: beginBalance,
          einde: eindeBalance,
        });
      }

      setBalanceData(balanceResults);

      const plCategories: { [key: string]: string } = {
        'Netto Omzet': 'Netto omzet',
        'Overige Opbrengsten': 'Overige opbrengsten',
        'Inkoopwaarde omzet': 'Inkoopwaarde van de omzet',
        'Afschrijvingen': 'Afschrijvingen',
        'Vervoerskosten': 'Kosten van vervoer',
        'Huisvestingskosten': 'Huisvestingskosten',
        'Kantoorkosten': 'Kantoorkosten',
        'Verkoopkosten': 'Verkoopkosten',
        'Algemene kosten': 'Algemene kosten',
        'Bankkosten': 'Bankkosten',
      };

      const plResults: PLData[] = [];

      for (const [category, label] of Object.entries(plCategories)) {
        const categoryAccounts = accounts.filter((acc) => acc.tax_category === category);
        const accountIds = categoryAccounts.map((acc) => acc.id);

        let amount = 0;

        if (periodLines) {
          const categoryLines = periodLines.filter((line: any) =>
            accountIds.includes(line.account_id)
          );

          const account = categoryAccounts[0];
          if (account?.type === 'Revenue') {
            amount = categoryLines.reduce(
              (sum: number, line: any) => sum + Number(line.credit) - Number(line.debit),
              0
            );
          } else {
            amount = categoryLines.reduce(
              (sum: number, line: any) => sum + Number(line.debit) - Number(line.credit),
              0
            );
          }
        }

        plResults.push({
          category,
          label,
          amount,
        });
      }

      setPlData(plResults);
    } catch (err) {
      console.error('Failed to load IB Aangifte data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(value: number, fieldName: string) {
    try {
      await navigator.clipboard.writeText(value.toFixed(2));
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  const revenueTotal = plData
    .filter((item) => item.category === 'Netto Omzet' || item.category === 'Overige Opbrengsten')
    .reduce((sum, item) => sum + item.amount, 0);

  const costsTotal = plData
    .filter(
      (item) =>
        item.category !== 'Netto Omzet' && item.category !== 'Overige Opbrengsten'
    )
    .reduce((sum, item) => sum + item.amount, 0);

  const winst = revenueTotal - costsTotal;

  const totalActiva = balanceData
    .filter((item) =>
      [
        'Materiële vaste activa',
        'Financiële vaste activa',
        'Voorraden',
        'Vorderingen',
        'Liquide middelen',
      ].includes(item.category)
    )
    .reduce((sum, item) => sum + item.einde, 0);

  const totalPassiva = balanceData
    .filter((item) =>
      ['Voorzieningen', 'Langlopende schulden', 'Kortlopende schulden'].includes(item.category)
    )
    .reduce((sum, item) => sum + item.einde, 0);

  const eigenVermogen = totalActiva - totalPassiva;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IB Aangifte</h1>
          <p className="text-sm text-gray-500">Kopieerhulp voor belastingaangifte</p>
        </div>
        <div>
          <label className="text-sm text-gray-600 mr-2">Boekjaar:</label>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="h-9 px-3 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4">
          A. De Balans (Bezittingen en Schulden)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-3 text-sm font-semibold text-gray-900">
                  Omschrijving
                </th>
                <th className="text-right py-2 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                  Begin Boekjaar
                </th>
                <th className="text-right py-2 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                  Einde Boekjaar
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50">
                <td colSpan={4} className="py-2 px-3 text-sm font-semibold text-gray-900">
                  Activa
                </td>
              </tr>
              {balanceData
                .filter((item) =>
                  [
                    'Materiële vaste activa',
                    'Financiële vaste activa',
                    'Voorraden',
                    'Vorderingen',
                    'Liquide middelen',
                  ].includes(item.category)
                )
                .map((item) => (
                  <tr key={item.category} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm text-gray-900">{item.label}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                      €{item.begin.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                      €{item.einde.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => copyToClipboard(item.einde, `balance-${item.category}`)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Kopieer naar klembord"
                      >
                        {copiedField === `balance-${item.category}` ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}

              <tr className="bg-gray-50">
                <td colSpan={4} className="py-2 px-3 text-sm font-semibold text-gray-900">
                  Passiva
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3 text-sm text-gray-900">Ondernemingsvermogen</td>
                <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                  €{(totalActiva - totalPassiva).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                  €{eigenVermogen.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => copyToClipboard(eigenVermogen, 'eigen-vermogen')}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Kopieer naar klembord"
                  >
                    {copiedField === 'eigen-vermogen' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
              {balanceData
                .filter((item) =>
                  ['Voorzieningen', 'Langlopende schulden', 'Kortlopende schulden'].includes(
                    item.category
                  )
                )
                .map((item) => (
                  <tr key={item.category} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm text-gray-900">{item.label}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                      €{item.begin.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                      €{item.einde.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => copyToClipboard(item.einde, `balance-${item.category}`)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Kopieer naar klembord"
                      >
                        {copiedField === `balance-${item.category}` ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4">
          B. Winst- en Verliesrekening
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-3 text-sm font-semibold text-gray-900">
                  Omschrijving
                </th>
                <th className="text-right py-2 px-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                  Bedrag dit jaar
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {plData
                .filter(
                  (item) =>
                    item.category === 'Netto Omzet' || item.category === 'Overige Opbrengsten'
                )
                .map((item) => (
                  <tr key={item.category} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm text-gray-900">{item.label}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                      €{item.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => copyToClipboard(item.amount, `pl-${item.category}`)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Kopieer naar klembord"
                      >
                        {copiedField === `pl-${item.category}` ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}

              {plData.find((item) => item.category === 'Inkoopwaarde omzet') && (
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 text-sm text-gray-900">
                    Min: Inkoopwaarde van de omzet
                  </td>
                  <td className="py-2 px-3 text-sm text-right text-red-600 whitespace-nowrap">
                    €
                    {plData
                      .find((item) => item.category === 'Inkoopwaarde omzet')!
                      .amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          plData.find((item) => item.category === 'Inkoopwaarde omzet')!.amount,
                          'pl-inkoopwaarde'
                        )
                      }
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Kopieer naar klembord"
                    >
                      {copiedField === 'pl-inkoopwaarde' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              )}

              <tr className="bg-blue-50 border-b-2 border-blue-200">
                <td className="py-2 px-3 text-sm font-semibold text-gray-900">Bruto Winst</td>
                <td className="py-2 px-3 text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                  €{revenueTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => copyToClipboard(revenueTotal, 'bruto-winst')}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Kopieer naar klembord"
                  >
                    {copiedField === 'bruto-winst' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>

              <tr className="bg-gray-50">
                <td colSpan={3} className="py-2 px-3 text-sm font-semibold text-gray-900">
                  Kosten
                </td>
              </tr>

              {plData
                .filter(
                  (item) =>
                    item.category !== 'Netto Omzet' &&
                    item.category !== 'Overige Opbrengsten' &&
                    item.category !== 'Inkoopwaarde omzet'
                )
                .map((item) => (
                  <tr key={item.category} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm text-gray-900">{item.label}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                      €{item.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => copyToClipboard(item.amount, `pl-${item.category}`)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Kopieer naar klembord"
                      >
                        {copiedField === `pl-${item.category}` ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}

              <tr className="bg-green-50 border-t-2 border-green-300">
                <td className="py-3 px-3 text-base font-bold text-gray-900">
                  Winst uit onderneming
                </td>
                <td className="py-3 px-3 text-base text-right font-bold text-gray-900 whitespace-nowrap">
                  €{winst.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => copyToClipboard(winst, 'winst-onderneming')}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Kopieer naar klembord"
                  >
                    {copiedField === 'winst-onderneming' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> Klik op de kopieer-iconen om bedragen direct naar je klembord te
          kopiëren. Je kunt ze dan eenvoudig plakken in het belastingformulier.
        </p>
      </div>
    </div>
  );
}

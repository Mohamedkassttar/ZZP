import { useState, useEffect } from 'react';
import { Copy, CheckCircle, Loader, Calendar, X, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { downloadXAFFile } from '../lib/xafExportService';
import type { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
type JournalLine = Database['public']['Tables']['journal_lines']['Row'];

interface AccountDetail {
  accountId: string;
  accountNumber: string;
  accountName: string;
  begin: number;
  einde: number;
}

interface TaxCategoryBalance {
  category: string;
  label: string;
  begin: number;
  einde: number;
  accounts: AccountDetail[];
}

interface AccountPLDetail {
  accountId: string;
  accountNumber: string;
  accountName: string;
  amount: number;
}

interface PLData {
  category: string;
  label: string;
  amount: number;
  accounts: AccountPLDetail[];
}

interface JournalLineWithDetails extends JournalLine {
  journal_entries?: JournalEntry;
  accounts?: Account;
}

interface ReportsProps {
  onNavigate: (view: string, data?: any) => void;
  fiscalYear: number;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function Reports({ onNavigate, fiscalYear }: ReportsProps) {
  const today = formatDateForInput(new Date());
  const defaultStart = `${fiscalYear}-01-01`;
  const defaultEnd = `${fiscalYear}-12-31`;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loading, setLoading] = useState(true);
  const [balanceData, setBalanceData] = useState<TaxCategoryBalance[]>([]);
  const [plData, setPlData] = useState<PLData[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<{
    id: string;
    number: string;
    name: string;
  } | null>(null);
  const [accountEntries, setAccountEntries] = useState<JournalLineWithDetails[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [exportingXAF, setExportingXAF] = useState(false);

  useEffect(() => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
  }, [fiscalYear]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (!accounts) {
        setLoading(false);
        return;
      }

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
        const accountDetails: AccountDetail[] = [];

        let categoryBeginBalance = 0;
        let categoryEindeBalance = 0;

        for (const account of categoryAccounts) {
          let beginBalance = 0;
          let periodBalance = 0;

          if (beginLines) {
            const accountBeginLines = beginLines.filter((line: any) => line.account_id === account.id);
            beginBalance = accountBeginLines.reduce(
              (sum: number, line: any) => sum + Number(line.debit) - Number(line.credit),
              0
            );
          }

          if (periodLines) {
            const accountPeriodLines = periodLines.filter((line: any) => line.account_id === account.id);
            periodBalance = accountPeriodLines.reduce(
              (sum: number, line: any) => sum + Number(line.debit) - Number(line.credit),
              0
            );
          }

          const eindeBalance = beginBalance + periodBalance;

          if (beginBalance !== 0 || eindeBalance !== 0) {
            accountDetails.push({
              accountId: account.id,
              accountNumber: account.code,
              accountName: account.name,
              begin: beginBalance,
              einde: eindeBalance,
            });
            categoryBeginBalance += beginBalance;
            categoryEindeBalance += eindeBalance;
          }
        }

        balanceResults.push({
          category,
          label,
          begin: categoryBeginBalance,
          einde: categoryEindeBalance,
          accounts: accountDetails,
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
        const accountDetails: AccountPLDetail[] = [];

        let categoryAmount = 0;

        for (const account of categoryAccounts) {
          let amount = 0;

          if (periodLines) {
            const accountLines = periodLines.filter((line: any) => line.account_id === account.id);

            if (account.type === 'Revenue') {
              amount = accountLines.reduce(
                (sum: number, line: any) => sum + Number(line.credit) - Number(line.debit),
                0
              );
            } else {
              amount = accountLines.reduce(
                (sum: number, line: any) => sum + Number(line.debit) - Number(line.credit),
                0
              );
            }
          }

          if (amount !== 0) {
            accountDetails.push({
              accountId: account.id,
              accountNumber: account.code,
              accountName: account.name,
              amount,
            });
            categoryAmount += amount;
          }
        }

        plResults.push({
          category,
          label,
          amount: categoryAmount,
          accounts: accountDetails,
        });
      }

      setPlData(plResults);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountEntries(accountId: string, accountNumber: string, accountName: string) {
    setSelectedAccount({ id: accountId, number: accountNumber, name: accountName });
    setLoadingEntries(true);

    try {
      const { data, error } = await supabase
        .from('journal_lines')
        .select('*, journal_entries!inner(*)')
        .eq('account_id', accountId)
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate)
        .order('id', { ascending: true });

      if (error) {
        console.error('Error loading account entries:', error);
        setAccountEntries([]);
      } else {
        const sortedData = (data || []).sort((a: any, b: any) => {
          const dateA = new Date(a.journal_entries?.entry_date || 0).getTime();
          const dateB = new Date(b.journal_entries?.entry_date || 0).getTime();
          return dateA - dateB;
        });
        setAccountEntries(sortedData);
      }
    } catch (err) {
      console.error('Failed to load account entries:', err);
      setAccountEntries([]);
    } finally {
      setLoadingEntries(false);
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

  async function handleExportXAF() {
    setExportingXAF(true);
    try {
      await downloadXAFFile({
        fiscalYear,
        startDate,
        endDate,
        companyName: 'Mijn Onderneming',
        companyVAT: '',
      });
    } catch (err) {
      console.error('Failed to export XAF:', err);
      alert('Fout bij het exporteren van XAF bestand. Probeer het opnieuw.');
    } finally {
      setExportingXAF(false);
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapportages</h1>
          <p className="text-sm text-gray-500">Balans en Winst & Verlies</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Van:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Tot:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleExportXAF}
            disabled={exportingXAF}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {exportingXAF ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export RGS Brugstaat (.xaf)
          </button>
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
                  <>
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
                    {item.accounts.map((account) => (
                      <tr
                        key={`${item.category}-${account.accountNumber}`}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => loadAccountEntries(account.accountId, account.accountNumber, account.accountName)}
                      >
                        <td className="py-1 px-3 pl-8 text-xs text-gray-600">
                          {account.accountNumber} {account.accountName}
                        </td>
                        <td className="py-1 px-3 text-xs text-right text-gray-600 whitespace-nowrap">
                          €{account.begin.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-3 text-xs text-right text-gray-600 whitespace-nowrap">
                          €{account.einde.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </>
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
                  <>
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
                    {item.accounts.map((account) => (
                      <tr
                        key={`${item.category}-${account.accountNumber}`}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => loadAccountEntries(account.accountId, account.accountNumber, account.accountName)}
                      >
                        <td className="py-1 px-3 pl-8 text-xs text-gray-600">
                          {account.accountNumber} {account.accountName}
                        </td>
                        <td className="py-1 px-3 text-xs text-right text-gray-600 whitespace-nowrap">
                          €{account.begin.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-3 text-xs text-right text-gray-600 whitespace-nowrap">
                          €{account.einde.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </>
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
                  <>
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
                    {item.accounts.map((account) => (
                      <tr
                        key={`${item.category}-${account.accountNumber}`}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => loadAccountEntries(account.accountId, account.accountNumber, account.accountName)}
                      >
                        <td className="py-1 px-3 pl-8 text-xs text-gray-600">
                          {account.accountNumber} {account.accountName}
                        </td>
                        <td className="py-1 px-3 text-xs text-right text-gray-600 whitespace-nowrap">
                          €{account.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </>
                ))}

              {plData.find((item) => item.category === 'Inkoopwaarde omzet') && (
                <>
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
                  {plData
                    .find((item) => item.category === 'Inkoopwaarde omzet')!
                    .accounts.map((account) => (
                      <tr
                        key={`inkoopwaarde-${account.accountNumber}`}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => loadAccountEntries(account.accountId, account.accountNumber, account.accountName)}
                      >
                        <td className="py-1 px-3 pl-8 text-xs text-gray-600">
                          {account.accountNumber} {account.accountName}
                        </td>
                        <td className="py-1 px-3 text-xs text-right text-gray-600 whitespace-nowrap">
                          €{account.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                </>
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
                  <>
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
                    {item.accounts.map((account) => (
                      <tr
                        key={`${item.category}-${account.accountNumber}`}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => loadAccountEntries(account.accountId, account.accountNumber, account.accountName)}
                      >
                        <td className="py-1 px-3 pl-8 text-xs text-gray-600">
                          {account.accountNumber} {account.accountName}
                        </td>
                        <td className="py-1 px-3 text-xs text-right text-gray-600 whitespace-nowrap">
                          €{account.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </>
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
          kopiëren. Klik op een grootboekrekening om alle boekingen te zien.
        </p>
      </div>

      {selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedAccount(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedAccount.number} - {selectedAccount.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Periode: {startDate} tot {endDate}
                </p>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingEntries ? (
                <div className="flex items-center justify-center h-32">
                  <Loader className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : accountEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Geen boekingen gevonden voor deze periode
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-900">Datum</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-900">Omschrijving</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-gray-900">Debet</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-gray-900">Credit</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-gray-900">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountEntries.map((line, index) => {
                        const runningBalance = accountEntries
                          .slice(0, index + 1)
                          .reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0);

                        return (
                          <tr key={line.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 text-sm text-gray-900 whitespace-nowrap">
                              {new Date((line.journal_entries as any)?.entry_date).toLocaleDateString('nl-NL')}
                            </td>
                            <td className="py-2 px-3 text-sm text-gray-900">
                              {(line.journal_entries as any)?.description || line.description}
                            </td>
                            <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                              {Number(line.debit) > 0 ? `€${Number(line.debit).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : ''}
                            </td>
                            <td className="py-2 px-3 text-sm text-right text-gray-900 whitespace-nowrap">
                              {Number(line.credit) > 0 ? `€${Number(line.credit).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : ''}
                            </td>
                            <td className="py-2 px-3 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                              €{runningBalance.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Plus, TrendingDown, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UniversalImporter } from '../UniversalImporter';
import { fixedAssetsConfig } from '../../lib/importConfigs';
import type { Database } from '../../lib/database.types';
import { getCurrentCompanyId } from '../../lib/companyHelper';

type FixedAsset = Database['public']['Tables']['fixed_assets']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

export function FixedAssetsManager() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    purchaseDate: '',
    purchasePrice: 0,
    residualValue: 0,
    lifespanMonths: 36,
    depreciationAccountId: '',
    balanceSheetAccountId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [ass, acc] = await Promise.all([
      supabase.from('fixed_assets').select('*').order('purchase_date', { ascending: false }),
      supabase.from('accounts').select('*').eq('is_active', true),
    ]);

    setAssets(ass.data || []);
    setAccounts(acc.data || []);
  }

  async function createAsset() {
    try {
      const { error } = await supabase.from('fixed_assets').insert({
        name: formData.name,
        purchase_date: formData.purchaseDate,
        purchase_price: formData.purchasePrice,
        residual_value: formData.residualValue,
        lifespan_months: formData.lifespanMonths,
        depreciation_account_id: formData.depreciationAccountId,
        balance_sheet_account_id: formData.balanceSheetAccountId,
      });

      if (error) throw error;

      alert('Asset added successfully!');
      setShowAdd(false);
      loadData();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }

  async function runDepreciation(asset: FixedAsset) {
    if (!confirm(`Run monthly depreciation for ${asset.name}?`)) return;

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Geen bedrijf geselecteerd');
      }

      const monthlyDepreciation =
        (asset.purchase_price - asset.residual_value) / asset.lifespan_months;

      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: companyId,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Depreciation: ${asset.name}`,
          status: 'Draft',
        })
        .select()
        .single();

      if (jeError) throw jeError;

      const journalLines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: asset.depreciation_account_id,
          debit: monthlyDepreciation,
          credit: 0,
          description: 'Afschrijving',
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: asset.balance_sheet_account_id,
          debit: 0,
          credit: monthlyDepreciation,
          description: 'Afschrijving activa',
        },
      ];

      const { error: jlError } = await supabase.from('journal_lines').insert(journalLines);

      if (jlError) throw jlError;

      const { error: updateError } = await supabase
        .from('fixed_assets')
        .update({ last_depreciation_date: new Date().toISOString().split('T')[0] })
        .eq('id', asset.id);

      if (updateError) throw updateError;

      alert(`Depreciation of €${monthlyDepreciation.toFixed(2)} booked successfully!`);
      loadData();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Fixed Assets</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Assets
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
            <th className="px-4 py-2 text-left text-sm font-semibold">Purchase Date</th>
            <th className="px-4 py-2 text-right text-sm font-semibold">Price</th>
            <th className="px-4 py-2 text-right text-sm font-semibold">Monthly Deprec.</th>
            <th className="px-4 py-2 text-left text-sm font-semibold">Last Deprec.</th>
            <th className="px-4 py-2 text-right text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {assets.map((asset) => {
            const monthlyDep = (asset.purchase_price - asset.residual_value) / asset.lifespan_months;
            return (
              <tr key={asset.id}>
                <td className="px-4 py-2 text-sm font-medium">{asset.name}</td>
                <td className="px-4 py-2 text-sm">{asset.purchase_date}</td>
                <td className="px-4 py-2 text-sm text-right">€{asset.purchase_price.toFixed(2)}</td>
                <td className="px-4 py-2 text-sm text-right">€{monthlyDep.toFixed(2)}</td>
                <td className="px-4 py-2 text-sm">{asset.last_depreciation_date || 'Never'}</td>
                <td className="px-4 py-2 text-right">
                  {asset.is_active && (
                    <button
                      onClick={() => runDepreciation(asset)}
                      className="text-sm text-blue-600 flex items-center gap-1 justify-end"
                    >
                      <TrendingDown className="w-3 h-3" />
                      Depreciate
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Add Fixed Asset</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Price</label>
                  <input
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) =>
                      setFormData({ ...formData, purchasePrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Residual Value</label>
                  <input
                    type="number"
                    value={formData.residualValue}
                    onChange={(e) =>
                      setFormData({ ...formData, residualValue: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lifespan (months)</label>
                <input
                  type="number"
                  value={formData.lifespanMonths}
                  onChange={(e) =>
                    setFormData({ ...formData, lifespanMonths: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Depreciation Expense Account</label>
                <select
                  value={formData.depreciationAccountId}
                  onChange={(e) =>
                    setFormData({ ...formData, depreciationAccountId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select...</option>
                  {accounts
                    .filter((a) => a.type === 'Expense')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Balance Sheet Asset Account</label>
                <select
                  value={formData.balanceSheetAccountId}
                  onChange={(e) =>
                    setFormData({ ...formData, balanceSheetAccountId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select...</option>
                  {accounts
                    .filter((a) => a.type === 'Asset')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button
                onClick={createAsset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Add Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {showImporter && (
        <UniversalImporter
          config={fixedAssetsConfig}
          onClose={() => setShowImporter(false)}
          onComplete={() => {
            loadData();
            setShowImporter(false);
            alert('Assets imported successfully');
          }}
        />
      )}
    </div>
  );
}

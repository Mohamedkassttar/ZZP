import { useState, useEffect } from 'react';
import { Plus, DollarSign, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UniversalImporter } from '../UniversalImporter';
import { mileageConfig } from '../../lib/importConfigs';
import type { Database } from '../../lib/database.types';
import { getCurrentCompanyId } from '../../lib/companyHelper';

type MileageLog = Database['public']['Tables']['mileage_logs']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

export function MileageTracker() {
  const [logs, setLogs] = useState<MileageLog[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mileageRate, setMileageRate] = useState(0.23);
  const [showAdd, setShowAdd] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    from: '',
    to: '',
    distance: 0,
    purpose: '',
    vehicle: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [mileage, acc, settings] = await Promise.all([
      supabase.from('mileage_logs').select('*').order('log_date', { ascending: false }),
      supabase.from('accounts').select('*').eq('is_active', true),
      supabase.from('settings').select('*').eq('key', 'mileage_rate').maybeSingle(),
    ]);

    setLogs(mileage.data || []);
    setAccounts(acc.data || []);
    if (settings.data) setMileageRate(parseFloat(settings.data.value));
  }

  async function addLog() {
    try {
      const { error } = await supabase.from('mileage_logs').insert({
        log_date: formData.date,
        from_location: formData.from,
        to_location: formData.to,
        distance_km: formData.distance,
        purpose: formData.purpose,
        vehicle_license: formData.vehicle,
      });

      if (error) throw error;

      alert('Mileage log added!');
      setShowAdd(false);
      loadData();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }

  async function bookUnbookedMileage() {
    if (!confirm('Book all unbooked mileage trips?')) return;

    try {
      const companyId = await getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Geen bedrijf geselecteerd');
      }

      const unbookedLogs = logs.filter((l) => !l.is_booked);
      const totalKm = unbookedLogs.reduce((sum, l) => sum + l.distance_km, 0);
      const totalAmount = totalKm * mileageRate;

      const travelCostAccount = accounts.find((a) => a.code === '4000');
      const priveAccount = accounts.find((a) => a.code === '1700');

      if (!travelCostAccount || !priveAccount) {
        throw new Error('Required accounts not found (4000 Autokosten, 1700 Privé)');
      }

      const entryId = crypto.randomUUID();
      const { error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          id: entryId,
          company_id: companyId,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Mileage reimbursement: ${totalKm.toFixed(2)} km`,
          status: 'Draft',
        });

      if (jeError) throw jeError;
      const journalEntry = { id: entryId };

      const journalLines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: travelCostAccount.id,
          debit: totalAmount,
          credit: 0,
          description: 'Kilometervergoeding',
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: priveAccount.id,
          debit: 0,
          credit: totalAmount,
          description: 'Privé storting',
        },
      ];

      const { error: jlError } = await supabase.from('journal_lines').insert(journalLines);

      if (jlError) throw jlError;

      const { error: updateError } = await supabase
        .from('mileage_logs')
        .update({ is_booked: true, journal_entry_id: journalEntry.id })
        .in(
          'id',
          unbookedLogs.map((l) => l.id)
        );

      if (updateError) throw updateError;

      alert(`Booked ${totalKm.toFixed(2)} km for €${totalAmount.toFixed(2)}!`);
      loadData();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }

  const unbookedLogs = logs.filter((l) => !l.is_booked);
  const totalUnbookedKm = unbookedLogs.reduce((sum, l) => sum + l.distance_km, 0);
  const totalUnbookedAmount = totalUnbookedKm * mileageRate;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Mileage Tracker</h2>
          <p className="text-sm text-gray-600">Rate: €{mileageRate}/km</p>
        </div>
        <div className="flex gap-3">
          {unbookedLogs.length > 0 && (
            <button
              onClick={bookUnbookedMileage}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg"
            >
              <DollarSign className="w-4 h-4" />
              Book {totalUnbookedKm.toFixed(0)} km (€{totalUnbookedAmount.toFixed(2)})
            </button>
          )}
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Trips
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Trip
          </button>
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
            <th className="px-4 py-2 text-left text-sm font-semibold">Route</th>
            <th className="px-4 py-2 text-left text-sm font-semibold">Purpose</th>
            <th className="px-4 py-2 text-right text-sm font-semibold">Distance</th>
            <th className="px-4 py-2 text-right text-sm font-semibold">Amount</th>
            <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log) => (
            <tr key={log.id} className={log.is_booked ? 'bg-gray-50' : ''}>
              <td className="px-4 py-2 text-sm">{log.log_date}</td>
              <td className="px-4 py-2 text-sm">
                {log.from_location} → {log.to_location}
              </td>
              <td className="px-4 py-2 text-sm">{log.purpose}</td>
              <td className="px-4 py-2 text-sm text-right">{log.distance_km} km</td>
              <td className="px-4 py-2 text-sm text-right">
                €{(log.distance_km * mileageRate).toFixed(2)}
              </td>
              <td className="px-4 py-2 text-sm">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    log.is_booked ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {log.is_booked ? 'Booked' : 'Unbooked'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Add Mileage Log</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">From</label>
                <input
                  value={formData.from}
                  onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Amsterdam"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To</label>
                <input
                  value={formData.to}
                  onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Utrecht"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Distance (km)</label>
                <input
                  type="number"
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Business Purpose</label>
                <input
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Client meeting"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle License (optional)</label>
                <input
                  value={formData.vehicle}
                  onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="AB-123-CD"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button onClick={addLog} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                Add Log
              </button>
            </div>
          </div>
        </div>
      )}

      {showImporter && (
        <UniversalImporter
          config={mileageConfig}
          onClose={() => setShowImporter(false)}
          onComplete={() => {
            loadData();
            setShowImporter(false);
            alert('Mileage logs imported successfully');
          }}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Calendar, User, DollarSign, Send } from 'lucide-react';
import {
  getTimeEntries,
  createTimeEntry,
  deleteTimeEntry,
  getContactsWithUnbilledHours,
  convertHoursToInvoice,
  type TimeEntry,
} from '../lib/timeEntryService';
import { getAllContacts } from '../lib/invoiceService';

interface Contact {
  id: string;
  company_name: string;
  hourly_rate?: number;
}

export function TimeTracking() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [unbilledContacts, setUnbilledContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  const [formData, setFormData] = useState({
    contactId: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [entriesData, contactsData, unbilledData] = await Promise.all([
        getTimeEntries(),
        getAllContacts(),
        getContactsWithUnbilledHours(),
      ]);

      setEntries(entriesData);
      setContacts(contactsData.filter((c: any) => c.relation_type === 'Customer' || c.relation_type === 'Both'));
      setUnbilledContacts(unbilledData);
    } catch (error) {
      console.error('Error loading time tracking data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEntry() {
    if (!formData.contactId || !formData.hours || !formData.description) {
      alert('Vul alle velden in');
      return;
    }

    const result = await createTimeEntry({
      contactId: formData.contactId,
      date: formData.date,
      hours: parseFloat(formData.hours),
      description: formData.description,
    });

    if (result.success) {
      setShowAddModal(false);
      setFormData({
        contactId: '',
        date: new Date().toISOString().split('T')[0],
        hours: '',
        description: '',
      });
      await loadData();
    } else {
      alert(result.error || 'Fout bij toevoegen uren');
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm('Weet je zeker dat je deze tijdregel wilt verwijderen?')) {
      return;
    }

    const result = await deleteTimeEntry(entryId);
    if (result.success) {
      await loadData();
    } else {
      alert(result.error || 'Fout bij verwijderen');
    }
  }

  async function handleBillHours(contactId: string) {
    const unbilledEntries = entries.filter(
      (e) => e.contact_id === contactId && e.status === 'open'
    );

    if (unbilledEntries.length === 0) {
      alert('Geen openstaande uren voor deze relatie');
      return;
    }

    const entryIds = unbilledEntries.map((e) => e.id);
    const shouldSend = confirm('Factuur direct per email versturen?');

    const result = await convertHoursToInvoice(contactId, entryIds, shouldSend);

    if (result.success) {
      alert(
        `Factuur ${result.invoiceNumber} aangemaakt!\n${result.emailMessage || ''}`
      );
      setShowBillModal(false);
      await loadData();
    } else {
      alert(result.error || 'Fout bij factureren');
    }
  }

  const totalUnbilledHours = entries
    .filter((e) => e.status === 'open')
    .reduce((sum, e) => sum + e.hours, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Urenregistratie</h1>
          <p className="text-slate-600 mt-1">Beheer je gewerkte uren en factureer klanten</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBillModal(true)}
            disabled={unbilledContacts.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
          >
            <DollarSign className="w-5 h-5" />
            Factureer Uren
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Uren Schrijven
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-slate-600">Openstaande Uren</span>
          </div>
          <p className="text-3xl font-black text-slate-800">{totalUnbilledHours.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <User className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-sm font-semibold text-slate-600">Klanten met Openstaande Uren</span>
          </div>
          <p className="text-3xl font-black text-slate-800">{unbilledContacts.length}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-violet-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-violet-600" />
            </div>
            <span className="text-sm font-semibold text-slate-600">Te Factureren</span>
          </div>
          <p className="text-3xl font-black text-slate-800">
            €
            {unbilledContacts
              .reduce((sum, c) => sum + c.estimated_amount, 0)
              .toFixed(2)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Klant
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Omschrijving
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Uren
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Uurtarief
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Bedrag
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    Nog geen uren geregistreerd
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const contact = entry.contact as any;
                  const hourlyRate = contact?.hourly_rate || 0;
                  const amount = entry.hours * hourlyRate;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {new Date(entry.date).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {contact?.company_name || 'Onbekend'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                        {entry.hours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700">
                        €{hourlyRate.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                        €{amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`px-3 py-1 text-xs font-bold rounded-full ${
                            entry.status === 'open'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {entry.status === 'open' ? 'Openstaand' : 'Gefactureerd'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {entry.status === 'open' && (
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-red-600 hover:text-red-700 transition-colors p-2"
                            title="Verwijderen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-black text-slate-800 mb-6">Uren Schrijven</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Klant *
                </label>
                <select
                  value={formData.contactId}
                  onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecteer klant...</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.company_name}
                      {contact.hourly_rate ? ` (€${contact.hourly_rate}/uur)` : ' (geen tarief)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Datum *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Aantal Uren *
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Bijv. 2.5"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Omschrijving *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Beschrijf de werkzaamheden..."
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
              >
                Annuleren
              </button>
              <button
                onClick={handleAddEntry}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {showBillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-800 mb-6">Uren Factureren</h2>

            <div className="space-y-3">
              {unbilledContacts.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Geen openstaande uren om te factureren</p>
              ) : (
                unbilledContacts.map((contact) => (
                  <div
                    key={contact.contact_id}
                    className="border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900">{contact.company_name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {contact.total_hours.toFixed(2)} uur
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            €{contact.hourly_rate?.toFixed(2) || '0.00'}/uur
                          </span>
                          <span className="font-semibold text-emerald-600">
                            Totaal: €{contact.estimated_amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleBillHours(contact.contact_id)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 font-semibold"
                      >
                        <Send className="w-4 h-4" />
                        Factureren
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowBillModal(false)}
                className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

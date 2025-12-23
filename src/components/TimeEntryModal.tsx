import { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import { updateTimeEntry, type TimeEntry } from '../lib/timeEntryService';
import type { Database } from '../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];

interface TimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  entry: TimeEntry | null;
  contacts: Contact[];
}

export function TimeEntryModal({
  isOpen,
  onClose,
  onSave,
  entry,
  contacts,
}: TimeEntryModalProps) {
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setHours(String(entry.hours));
      setDescription(entry.description);
    }
  }, [entry]);

  async function handleSave() {
    if (!entry) return;

    setError(null);

    if (!hours || parseFloat(hours) <= 0) {
      setError('Vul een geldig aantal uren in');
      return;
    }

    if (!description.trim()) {
      setError('Vul een omschrijving in');
      return;
    }

    setSaving(true);

    try {
      const result = await updateTimeEntry(entry.id, {
        date,
        hours: parseFloat(hours),
        description,
      });

      if (result.success) {
        onSave();
        handleClose();
      } else {
        setError(result.error || 'Fout bij opslaan');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  if (!isOpen || !entry) return null;

  const contact = contacts.find((c) => c.id === entry.contact_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-black text-slate-800">Tijdregel Bewerken</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Klant</label>
            <div className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl bg-slate-100 text-slate-700">
              {contact?.company_name || 'Onbekend'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Datum
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Aantal Uren <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Omschrijving <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Wat heb je gedaan?"
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-white transition-colors font-semibold"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Opslaan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Opslaan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

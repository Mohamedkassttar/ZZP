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
  const [entryType, setEntryType] = useState<'hours' | 'mileage'>('hours');
  const [hours, setHours] = useState('');
  const [distance, setDistance] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setEntryType(entry.entry_type);
      setHours(entry.entry_type === 'hours' && entry.hours ? String(entry.hours) : '');
      setDistance(entry.entry_type === 'mileage' && entry.distance ? String(entry.distance) : '');
      setDescription(entry.description);
    }
  }, [entry]);

  async function handleSave() {
    if (!entry) return;

    setError(null);

    if (!description.trim()) {
      setError('Vul een omschrijving in');
      return;
    }

    let validatedHours: number | undefined;
    let validatedDistance: number | undefined;

    if (entryType === 'hours') {
      const hoursValue = parseFloat(hours);
      if (isNaN(hoursValue) || hoursValue <= 0 || !hours.trim()) {
        setError('Vul een geldig aantal uren in (groter dan 0)');
        return;
      }
      validatedHours = hoursValue;
      validatedDistance = undefined;
    } else {
      const distanceValue = parseFloat(distance);
      if (isNaN(distanceValue) || distanceValue <= 0 || !distance.trim()) {
        setError('Vul een geldige afstand in kilometers in (groter dan 0)');
        return;
      }
      validatedDistance = distanceValue;
      validatedHours = undefined;
    }

    setSaving(true);

    try {
      const result = await updateTimeEntry(entry.id, {
        date,
        entryType,
        hours: validatedHours,
        distance: validatedDistance,
        description: description.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex-none flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-2xl font-black text-slate-800">Tijdregel Bewerken</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
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

          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-semibold text-slate-700 mb-2">Type</label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as 'hours' | 'mileage')}
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
              >
                <option value="hours">Uren</option>
                <option value="mileage">Kilometers</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {entryType === 'hours' ? 'Aantal Uren' : 'Aantal Kilometers'} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step={entryType === 'hours' ? '0.25' : '1'}
              min="0"
              value={entryType === 'hours' ? hours : distance}
              onChange={(e) => {
                if (entryType === 'hours') {
                  setHours(e.target.value);
                } else {
                  setDistance(e.target.value);
                }
              }}
              placeholder={entryType === 'hours' ? '0.00' : '0'}
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

        <div className="flex-none sticky bottom-0 z-10 border-t bg-gray-50 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
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
    </div>
  );
}

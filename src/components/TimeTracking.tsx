import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, ChevronLeft, ChevronRight, DollarSign, Save, Loader } from 'lucide-react';
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

interface WeekEntry {
  id: string;
  date: string;
  contactId: string;
  hours: string;
  description: string;
  isExisting?: boolean;
  existingId?: string;
}

interface DayData {
  date: string;
  dayName: string;
  entries: WeekEntry[];
}

export function TimeTracking() {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [unbilledContacts, setUnbilledContacts] = useState<any[]>([]);
  const [existingEntries, setExistingEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function getWeekDates(mondayDate: Date): DayData[] {
    const days: DayData[] = [];
    const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayDate);
      date.setDate(date.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: dayNames[i],
        entries: [],
      });
    }

    return days;
  }

  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  function formatWeekRange(mondayDate: Date): string {
    const monday = new Date(mondayDate);
    const sunday = new Date(mondayDate);
    sunday.setDate(sunday.getDate() + 6);

    const weekNum = getWeekNumber(monday);
    const mondayStr = monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    const sundayStr = sunday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

    return `Week ${weekNum} (${mondayStr} - ${sundayStr})`;
  }

  async function loadData() {
    setLoading(true);
    try {
      const [entriesData, contactsData, unbilledData] = await Promise.all([
        getTimeEntries(),
        getAllContacts(),
        getContactsWithUnbilledHours(),
      ]);

      setExistingEntries(entriesData);
      setContacts(contactsData.filter((c: any) => c.relation_type === 'Customer' || c.relation_type === 'Both'));
      setUnbilledContacts(unbilledData);

      const weekDates = getWeekDates(currentWeekStart);
      const weekStartStr = weekDates[0].date;
      const weekEndStr = weekDates[6].date;

      const weekEntries = entriesData.filter(
        (e) => e.date >= weekStartStr && e.date <= weekEndStr
      );

      weekDates.forEach((day) => {
        const dayEntries = weekEntries.filter((e) => e.date === day.date);
        day.entries = dayEntries.map((e) => ({
          id: crypto.randomUUID(),
          date: e.date,
          contactId: e.contact_id,
          hours: e.hours.toString(),
          description: e.description || '',
          isExisting: true,
          existingId: e.id,
        }));

        if (day.entries.length === 0) {
          day.entries.push({
            id: crypto.randomUUID(),
            date: day.date,
            contactId: '',
            hours: '',
            description: '',
          });
        }
      });

      setWeekData(weekDates);
    } catch (error) {
      console.error('Error loading time tracking data:', error);
    } finally {
      setLoading(false);
    }
  }

  function addEntryToDay(dayDate: string) {
    setWeekData((prev) =>
      prev.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              entries: [
                ...day.entries,
                {
                  id: crypto.randomUUID(),
                  date: dayDate,
                  contactId: '',
                  hours: '',
                  description: '',
                },
              ],
            }
          : day
      )
    );
  }

  function removeEntryFromDay(dayDate: string, entryId: string) {
    setWeekData((prev) =>
      prev.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              entries: day.entries.filter((e) => e.id !== entryId),
            }
          : day
      )
    );
  }

  function updateEntry(dayDate: string, entryId: string, field: keyof WeekEntry, value: string) {
    setWeekData((prev) =>
      prev.map((day) =>
        day.date === dayDate
          ? {
              ...day,
              entries: day.entries.map((e) =>
                e.id === entryId ? { ...e, [field]: value } : e
              ),
            }
          : day
      )
    );
  }

  async function handleSaveWeek() {
    setSaving(true);
    try {
      const allNewEntries: WeekEntry[] = [];
      weekData.forEach((day) => {
        day.entries.forEach((entry) => {
          if (!entry.isExisting && entry.contactId && entry.hours && entry.description) {
            allNewEntries.push(entry);
          }
        });
      });

      for (const entry of allNewEntries) {
        await createTimeEntry({
          contactId: entry.contactId,
          date: entry.date,
          hours: parseFloat(entry.hours),
          description: entry.description,
        });
      }

      alert(`${allNewEntries.length} uren succesvol opgeslagen!`);
      await loadData();
    } catch (error) {
      console.error('Error saving week:', error);
      alert('Fout bij opslaan van uren');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExistingEntry(entryId: string) {
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
    const unbilledEntries = existingEntries.filter(
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

  function goToPreviousWeek() {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  }

  function goToNextWeek() {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  }

  function goToCurrentWeek() {
    setCurrentWeekStart(getMonday(new Date()));
  }

  const totalUnbilledHours = existingEntries
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
          <h1 className="text-3xl font-black text-slate-800">Weekstaat Urenregistratie</h1>
          <p className="text-slate-600 mt-1">Vul je uren per week in</p>
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
              <Clock className="w-6 h-6 text-emerald-600" />
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

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Vorige week"
            >
              <ChevronLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h2 className="text-xl font-bold text-slate-800">{formatWeekRange(currentWeekStart)}</h2>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Volgende week"
            >
              <ChevronRight className="w-6 h-6 text-slate-600" />
            </button>
            <button
              onClick={goToCurrentWeek}
              className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              Huidige Week
            </button>
          </div>
          <button
            onClick={handleSaveWeek}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg font-semibold"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Opslaan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Opslaan Week
              </>
            )}
          </button>
        </div>

        <div className="space-y-6">
          {weekData.map((day) => (
            <div key={day.date} className="border-2 border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{day.dayName}</h3>
                  <p className="text-sm text-slate-500">
                    {new Date(day.date).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => addEntryToDay(day.date)}
                  className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center gap-2 font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Regel
                </button>
              </div>

              <div className="space-y-3">
                {day.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-lg ${
                      entry.isExisting ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'
                    }`}
                  >
                    <div className="md:col-span-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Klant</label>
                      <select
                        value={entry.contactId}
                        onChange={(e) => updateEntry(day.date, entry.id, 'contactId', e.target.value)}
                        disabled={entry.isExisting}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Selecteer klant...</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Omschrijving</label>
                      <input
                        type="text"
                        value={entry.description}
                        onChange={(e) => updateEntry(day.date, entry.id, 'description', e.target.value)}
                        disabled={entry.isExisting}
                        placeholder="Wat heb je gedaan?"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Uren</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={entry.hours}
                        onChange={(e) => updateEntry(day.date, entry.id, 'hours', e.target.value)}
                        disabled={entry.isExisting}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="md:col-span-1 flex items-end">
                      {entry.isExisting ? (
                        <button
                          onClick={() => handleDeleteExistingEntry(entry.existingId!)}
                          className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Verwijderen"
                        >
                          <Trash2 className="w-5 h-5 mx-auto" />
                        </button>
                      ) : (
                        day.entries.length > 1 && (
                          <button
                            onClick={() => removeEntryFromDay(day.date, entry.id)}
                            className="w-full p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Regel verwijderen"
                          >
                            <Trash2 className="w-5 h-5 mx-auto" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showBillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-800">Factureer Uren</h2>
              <button
                onClick={() => setShowBillModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {unbilledContacts.map((contact) => (
                <div
                  key={contact.contact_id}
                  className="border-2 border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-slate-800">{contact.company_name}</h3>
                      <p className="text-sm text-slate-600">
                        {contact.unbilled_hours} uur • €{contact.estimated_amount.toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleBillHours(contact.contact_id)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-semibold"
                    >
                      <DollarSign className="w-4 h-4" />
                      Factureer
                    </button>
                  </div>
                </div>
              ))}

              {unbilledContacts.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  Geen openstaande uren om te factureren
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

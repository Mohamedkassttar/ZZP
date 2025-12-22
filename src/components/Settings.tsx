import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Book, FileText, Package, Car, Zap, AlertTriangle, Trash2, RotateCcw, Download, DollarSign } from 'lucide-react';
import { AccountsManager } from './settings/AccountsManager';
import { InvoicesManager } from './settings/InvoicesManager';
import { FixedAssetsManager } from './settings/FixedAssetsManager';
import { MileageTracker } from './settings/MileageTracker';
import { BankRulesManager } from './settings/BankRulesManager';
import { FinancialSettings } from './settings/FinancialSettings';
import { clearAllData } from '../lib/taxCalculationService';
import { resetAdministration } from '../lib/adminResetService';
import { downloadConfigurationBackup, getConfigurationStats } from '../lib/configExportService';

type SettingsTab = 'accounts' | 'invoices' | 'assets' | 'mileage' | 'bankrules' | 'financial' | 'system';

interface SettingsProps {
  initialTab?: SettingsTab;
}

export function Settings({ initialTab }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'accounts');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [configStats, setConfigStats] = useState({ accountsCount: 0, bankRulesCount: 0 });

  const tabs = [
    { id: 'accounts' as SettingsTab, label: 'Grootboekrekeningen', icon: Book },
    { id: 'invoices' as SettingsTab, label: 'Facturen', icon: FileText },
    { id: 'assets' as SettingsTab, label: 'Vaste Activa', icon: Package },
    { id: 'mileage' as SettingsTab, label: 'Kilometers', icon: Car },
    { id: 'bankrules' as SettingsTab, label: 'Bankregels', icon: Zap },
    { id: 'financial' as SettingsTab, label: 'Financiële Instellingen', icon: DollarSign },
    { id: 'system' as SettingsTab, label: 'Systeem', icon: AlertTriangle },
  ];

  useEffect(() => {
    if (activeTab === 'system') {
      getConfigurationStats().then(setConfigStats);
    }
  }, [activeTab]);

  async function handleClearAllData() {
    setClearing(true);
    try {
      const result = await clearAllData();
      if (result.success) {
        alert('Alle data succesvol verwijderd!');
        window.location.reload();
      } else {
        alert('Fout bij verwijderen: ' + result.error);
      }
    } catch (error) {
      alert('Fout bij verwijderen van data');
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  }

  async function handleResetAdministration() {
    setResetting(true);
    try {
      const result = await resetAdministration();
      if (result.success) {
        const stats = result.stats!;
        alert(
          `Administratie succesvol gereset!\n\n` +
          `Verwijderd:\n` +
          `- ${stats.journalEntriesDeleted} journaalposten (${stats.journalLinesDeleted} regels)\n` +
          `- ${stats.invoicesDeleted} facturen (${stats.invoiceLinesDeleted} regels)\n` +
          `- ${stats.bankTransactionsDeleted} banktransacties\n` +
          `- ${stats.contactsDeleted} relaties/contacten\n\n` +
          `Behouden:\n` +
          `- Grootboekrekeningen (inclusief belastingcategorieën)\n` +
          `- Bankregels (AI automatisering)`
        );
        window.location.href = '/';
      } else {
        alert('Fout bij resetten: ' + result.error);
      }
    } catch (error) {
      alert('Fout bij resetten van administratie');
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  }

  async function handleExportConfiguration() {
    setExporting(true);
    try {
      await downloadConfigurationBackup();
      alert('Configuratie backup succesvol gedownload!');
    } catch (error) {
      alert('Fout bij exporteren: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Instellingen</h1>
        </div>
        <p className="text-sm text-gray-500">Manage your accounting configuration and business data</p>
      </div>

      <div className="rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'accounts' && <AccountsManager />}
          {activeTab === 'invoices' && <InvoicesManager />}
          {activeTab === 'assets' && <FixedAssetsManager />}
          {activeTab === 'mileage' && <MileageTracker />}
          {activeTab === 'bankrules' && <BankRulesManager />}
          {activeTab === 'financial' && <FinancialSettings />}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-2">Systeeminstellingen</h2>
                <p className="text-sm text-gray-500">Beheer systeemdata en instellingen</p>
              </div>

              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <Download className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-900 mb-2">Configuratie Backup</h3>
                    <p className="text-sm text-blue-800 mb-4">
                      Download een backup van je configuratie-instellingen. Dit bestand bevat je grootboekrekeningen en bankregels,
                      zodat je deze later kunt herstellen of in een nieuwe administratie kunt importeren.
                    </p>
                    <div className="bg-white rounded-lg border border-blue-200 p-4 mb-4">
                      <h4 className="font-semibold text-slate-900 mb-2">Geëxporteerde data:</h4>
                      <ul className="text-sm text-slate-600 space-y-1">
                        <li>✓ Grootboekrekeningen ({configStats.accountsCount} rekeningen) - inclusief alle kolommen en tax_category</li>
                        <li>✓ Bankregels ({configStats.bankRulesCount} regels) - inclusief alle automatiseringsregels</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleExportConfiguration}
                    disabled={exporting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-blue-400"
                  >
                    <Download className="w-4 h-4" />
                    {exporting ? 'Bezig met exporteren...' : 'Download Configuratie Backup'}
                  </button>
                </div>
              </div>

              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-bold text-red-900 mb-2">Gevaarzone</h3>
                    <p className="text-sm text-red-800 mb-4">
                      Wees voorzichtig met deze acties. Ze kunnen niet ongedaan worden gemaakt.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-lg border border-orange-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-1">
                          Administratie Resetten (Behoud Instellingen)
                        </h4>
                        <p className="text-sm text-slate-600 mb-3">
                          Verwijder alle boekingen, facturen, banktransacties en relaties, maar behoud je configuratie.
                        </p>
                        <ul className="text-xs text-slate-500 space-y-1 mb-4">
                          <li className="text-red-600">✗ Journaalposten (alle boekingen worden verwijderd)</li>
                          <li className="text-red-600">✗ Facturen (alle facturen worden verwijderd)</li>
                          <li className="text-red-600">✗ Banktransacties (volledig verwijderd)</li>
                          <li className="text-red-600">✗ Relaties/Contacten (volledig verwijderd)</li>
                          <li className="text-green-600">✓ Grootboekrekeningen (blijven behouden)</li>
                          <li className="text-green-600">✓ Bankregels (blijven behouden)</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        disabled={resetting}
                        className="h-9 flex items-center gap-2 px-4 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold disabled:bg-orange-400"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Start Opnieuw
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-red-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-1">
                          Alle Data Verwijderen
                        </h4>
                        <p className="text-sm text-slate-600 mb-3">
                          Verwijdert ALLE data uit het systeem: boekingen, bankgegevens, facturen,
                          relaties, activa, kilometers en fiscale jaren. De grootboekrekeningen blijven
                          behouden.
                        </p>
                        <ul className="text-xs text-slate-500 space-y-1 mb-4">
                          <li>✗ Journaalposten (alle boekingen)</li>
                          <li>✗ Banktransacties</li>
                          <li>✗ Facturen</li>
                          <li>✗ Relaties</li>
                          <li>✗ Vaste activa</li>
                          <li>✗ Kilometeradministratie</li>
                          <li>✗ Fiscale jaren</li>
                          <li>✗ Bankregels</li>
                          <li>✓ Grootboekrekeningen (blijven behouden)</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        disabled={clearing}
                        className="h-9 flex items-center gap-2 px-4 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:bg-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                        Verwijder Alles
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Weet je zeker dat je opnieuw wilt beginnen?
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  Alle boekingen, facturen, banktransacties en relaties worden volledig verwijderd.
                  Alleen je configuratie blijft behouden.
                </p>
                <div className="text-xs text-slate-500 bg-slate-50 rounded p-3 space-y-1">
                  <p className="font-semibold text-red-700 mb-1">Wordt verwijderd:</p>
                  <p className="text-red-600">• Alle journaalposten</p>
                  <p className="text-red-600">• Alle facturen</p>
                  <p className="text-red-600">• Alle banktransacties</p>
                  <p className="text-red-600">• Alle relaties/contacten</p>
                  <p className="font-semibold text-green-700 mt-2 mb-1">Blijft behouden:</p>
                  <p className="text-green-600">• Grootboekrekeningen (met belastingcategorieën)</p>
                  <p className="text-green-600">• Bankregels (AI automatisering)</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleResetAdministration}
                disabled={resetting}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold disabled:bg-orange-400"
              >
                {resetting ? 'Bezig...' : 'Ja, Reset Administratie'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Weet je het zeker?
                </h3>
                <p className="text-sm text-slate-600">
                  Dit verwijdert ALLE data permanent. Deze actie kan NIET ongedaan worden gemaakt.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleClearAllData}
                disabled={clearing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:bg-red-400"
              >
                {clearing ? 'Bezig...' : 'Ja, Verwijder Alles'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

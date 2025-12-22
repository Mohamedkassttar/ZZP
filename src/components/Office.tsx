import { useState, useEffect } from 'react';
import { Building2, Plus, Users, Edit2, Trash2, UserPlus, X, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/CompanyContext';
import { createCompany, updateCompany, deleteCompany, addUserToCompany, getCompanyUsers } from '../lib/companyService';
import type { Database } from '../lib/database.types';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyUser = Database['public']['Tables']['company_users']['Row'];

export function Office() {
  const { companies, refreshCompanies, isExpert, switchCompany } = useCompany();
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    zip_code: '',
    city: '',
    vat_number: '',
    coc_number: '',
    legal_form: 'eenmanszaak' as 'eenmanszaak' | 'bv' | 'vof' | 'stichting' | 'maatschap' | 'cv' | 'andere',
    fiscal_year_start: new Date().getFullYear() + '-01-01',
  });

  useEffect(() => {
    if (!isExpert) {
      setError('Je hebt geen toegang tot deze pagina. Alleen experts kunnen bedrijven beheren.');
    }
  }, [isExpert]);

  function resetForm() {
    setFormData({
      name: '',
      address: '',
      zip_code: '',
      city: '',
      vat_number: '',
      coc_number: '',
      legal_form: 'eenmanszaak',
      fiscal_year_start: new Date().getFullYear() + '-01-01',
    });
  }

  async function handleCreateCompany() {
    if (!formData.name.trim()) {
      setError('Bedrijfsnaam is verplicht');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createCompany(formData);

    if (result.success) {
      setSuccess(`Bedrijf "${formData.name}" succesvol aangemaakt!`);
      setShowNewCompanyModal(false);
      resetForm();
      await refreshCompanies();
    } else {
      setError(result.error || 'Fout bij aanmaken bedrijf');
    }

    setLoading(false);
  }

  async function handleUpdateCompany() {
    if (!selectedCompany) return;

    setLoading(true);
    setError(null);

    const result = await updateCompany(selectedCompany.id, formData);

    if (result.success) {
      setSuccess(`Bedrijf "${formData.name}" succesvol bijgewerkt!`);
      setShowEditModal(false);
      setSelectedCompany(null);
      resetForm();
      await refreshCompanies();
    } else {
      setError(result.error || 'Fout bij bijwerken bedrijf');
    }

    setLoading(false);
  }

  async function handleDeleteCompany(company: Company) {
    if (!confirm(`Weet je zeker dat je "${company.name}" wilt verwijderen? Alle data wordt permanent verwijderd.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await deleteCompany(company.id);

    if (result.success) {
      setSuccess(`Bedrijf "${company.name}" succesvol verwijderd`);
      await refreshCompanies();
    } else {
      setError(result.error || 'Fout bij verwijderen bedrijf');
    }

    setLoading(false);
  }

  async function handleShowUsers(company: Company) {
    setSelectedCompany(company);
    setShowUsersModal(true);

    const result = await getCompanyUsers(company.id);
    if (result.success && result.users) {
      setCompanyUsers(result.users);
    }
  }

  function openEditModal(company: Company) {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      address: company.address || '',
      zip_code: company.zip_code || '',
      city: company.city || '',
      vat_number: company.vat_number || '',
      coc_number: company.coc_number || '',
      legal_form: (company.legal_form as any) || 'eenmanszaak',
      fiscal_year_start: company.fiscal_year_start || new Date().getFullYear() + '-01-01',
    });
    setShowEditModal(true);
  }

  if (!isExpert) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Users className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Geen Toegang</h2>
          <p className="text-gray-600">Je hebt geen toegang tot Mijn Kantoor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mijn Kantoor</h1>
          <p className="text-sm text-gray-500">Beheer al je bedrijven op één plek</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowNewCompanyModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Nieuw Bedrijf
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div
            key={company.id}
            className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(company)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Bewerken"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCompany(company)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Verwijderen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">{company.name}</h3>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                {company.address && (
                  <p>
                    {company.address}
                    {company.zip_code && `, ${company.zip_code}`}
                    {company.city && ` ${company.city}`}
                  </p>
                )}
                {company.legal_form && (
                  <p className="text-xs">
                    <span className="inline-block px-2 py-1 bg-gray-100 rounded">
                      {company.legal_form.toUpperCase()}
                    </span>
                  </p>
                )}
                {company.vat_number && <p>BTW: {company.vat_number}</p>}
                {company.coc_number && <p>KVK: {company.coc_number}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => switchCompany(company.id)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Open
                </button>
                <button
                  onClick={() => handleShowUsers(company)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  <Users className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(showNewCompanyModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {showEditModal ? 'Bedrijf Bewerken' : 'Nieuw Bedrijf'}
              </h3>
              <button
                onClick={() => {
                  setShowNewCompanyModal(false);
                  setShowEditModal(false);
                  setSelectedCompany(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bedrijfsnaam <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Bijv. Bakkerij Jansen BV"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rechtsvorm
                  </label>
                  <select
                    value={formData.legal_form}
                    onChange={(e) => setFormData({ ...formData, legal_form: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="eenmanszaak">Eenmanszaak</option>
                    <option value="bv">BV</option>
                    <option value="vof">VOF</option>
                    <option value="stichting">Stichting</option>
                    <option value="maatschap">Maatschap</option>
                    <option value="cv">CV</option>
                    <option value="andere">Andere</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Boekjaar
                  </label>
                  <input
                    type="date"
                    value={formData.fiscal_year_start}
                    onChange={(e) => setFormData({ ...formData, fiscal_year_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adres
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Straat + huisnummer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postcode
                  </label>
                  <input
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1234 AB"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plaats
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Amsterdam"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BTW-nummer
                  </label>
                  <input
                    type="text"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="NL123456789B01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    KVK-nummer
                  </label>
                  <input
                    type="text"
                    value={formData.coc_number}
                    onChange={(e) => setFormData({ ...formData, coc_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="12345678"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowNewCompanyModal(false);
                  setShowEditModal(false);
                  setSelectedCompany(null);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={showEditModal ? handleUpdateCompany : handleCreateCompany}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                {showEditModal ? 'Bijwerken' : 'Aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUsersModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Gebruikers: {selectedCompany.name}
              </h3>
              <button
                onClick={() => {
                  setShowUsersModal(false);
                  setSelectedCompany(null);
                  setCompanyUsers([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {companyUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Geen gebruikers gevonden</p>
                ) : (
                  companyUsers.map((cu) => (
                    <div key={cu.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{cu.user_id}</p>
                        <p className="text-sm text-gray-500">{cu.role}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                Gebruiker Toevoegen (Binnenkort)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

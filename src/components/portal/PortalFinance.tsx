import { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle, ArrowRight, Mail, Phone, MapPin, Package, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ContactDetail } from '../ContactDetail';
import type { Database } from '../../lib/database.types';

interface Product {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  sku: string | null;
  is_active: boolean;
}

type Contact = Database['public']['Tables']['contacts']['Row'];

interface ContactWithBalance extends Contact {
  outstanding_amount?: number;
  invoice_count?: number;
}

export function PortalFinance() {
  const [activeTab, setActiveTab] = useState<'debtors' | 'creditors' | 'products'>('debtors');
  const [debtors, setDebtors] = useState<ContactWithBalance[]>([]);
  const [creditors, setCreditors] = useState<ContactWithBalance[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    unit: 'stuk',
    sku: '',
  });

  useEffect(() => {
    loadFinancialData();
  }, []);

  async function loadFinancialData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (companyUser?.company_id) {
        setCompanyId(companyUser.company_id);
      }

      await Promise.all([loadDebtors(), loadCreditors(), loadProducts(companyUser?.company_id)]);
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDebtors() {
    // Get all customer contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .or('relation_type.eq.Customer,relation_type.eq.Both')
      .order('company_name');

    if (contactsError) throw contactsError;

    // Get outstanding invoices per contact
    const contactsWithBalance = await Promise.all(
      (contacts || []).map(async (contact) => {
        const { data: invoices, error } = await supabase
          .from('sales_invoices')
          .select('total_amount, status')
          .eq('contact_id', contact.id)
          .neq('status', 'paid');

        if (error) {
          console.error('Error loading invoices for contact:', error);
          return { ...contact, outstanding_amount: 0, invoice_count: 0 };
        }

        const outstanding_amount = (invoices || []).reduce(
          (sum, inv) => sum + (inv.total_amount || 0),
          0
        );
        const invoice_count = invoices?.length || 0;

        return { ...contact, outstanding_amount, invoice_count };
      })
    );

    // Sort by outstanding amount (highest first)
    contactsWithBalance.sort((a, b) => (b.outstanding_amount || 0) - (a.outstanding_amount || 0));
    setDebtors(contactsWithBalance);
  }

  async function loadCreditors() {
    // Get all supplier contacts
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .or('relation_type.eq.Supplier,relation_type.eq.Both')
      .order('company_name');

    if (error) throw error;
    setCreditors(contacts || []);
  }

  async function loadProducts(cid?: string) {
    if (!cid) return;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', cid)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading products:', error);
      return;
    }

    setProducts(data || []);
  }

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: Number(product.price),
        unit: product.unit,
        sku: product.sku || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        unit: 'stuk',
        sku: '',
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      unit: 'stuk',
      sku: '',
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Naam is verplicht');
      return;
    }

    if (!companyId) {
      alert('Geen bedrijf geselecteerd');
      return;
    }

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            name: formData.name,
            description: formData.description || null,
            price: formData.price,
            unit: formData.unit,
            sku: formData.sku || null,
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert({
            company_id: companyId,
            name: formData.name,
            description: formData.description || null,
            price: formData.price,
            unit: formData.unit,
            sku: formData.sku || null,
          });

        if (error) throw error;
      }

      await loadProducts(companyId);
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert('Fout bij opslaan: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit product wilt verwijderen?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      if (companyId) {
        await loadProducts(companyId);
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert('Fout bij verwijderen: ' + error.message);
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (selectedContact) {
    return (
      <ContactDetail
        contact={selectedContact}
        onBack={() => setSelectedContact(null)}
      />
    );
  }

  const totalOutstanding = debtors.reduce((sum, debtor) => sum + (debtor.outstanding_amount || 0), 0);
  const totalDebtors = debtors.filter((d) => (d.outstanding_amount || 0) > 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financieel Overzicht</h1>
            <p className="text-sm text-gray-600">Debiteuren en Crediteuren</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-1">Openstaand Bedrag</p>
            <p className="text-2xl font-bold text-blue-900">
              {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(
                totalOutstanding
              )}
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border-2 border-amber-200">
            <p className="text-sm font-medium text-amber-900 mb-1">Klanten met Openstaand</p>
            <p className="text-2xl font-bold text-amber-900">{totalDebtors}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border-2 border-emerald-200">
            <p className="text-sm font-medium text-emerald-900 mb-1">Totaal Relaties</p>
            <p className="text-2xl font-bold text-emerald-900">
              {debtors.length + creditors.length}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('debtors')}
            className={`px-6 py-3 font-semibold text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'debtors'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Debiteuren ({debtors.length})
            {activeTab === 'debtors' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('creditors')}
            className={`px-6 py-3 font-semibold text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'creditors'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Crediteuren ({creditors.length})
            {activeTab === 'creditors' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-3 font-semibold text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'products'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Producten ({products.length})
            {activeTab === 'products' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-600">Laden...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'debtors' && (
              <>
                {debtors.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Geen debiteuren gevonden</p>
                  </div>
                ) : (
                  <>
                    {debtors.map((debtor) => (
                      <button
                        key={debtor.id}
                        onClick={() => setSelectedContact(debtor)}
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-gray-900 text-lg">
                                {debtor.company_name}
                              </h3>
                              {(debtor.outstanding_amount || 0) > 0 && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                                  {debtor.invoice_count} openstaand
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              {debtor.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  <span>{debtor.email}</span>
                                </div>
                              )}
                              {debtor.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-4 h-4" />
                                  <span>{debtor.phone}</span>
                                </div>
                              )}
                              {debtor.city && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{debtor.city}</span>
                                </div>
                              )}
                            </div>

                            {(debtor.outstanding_amount || 0) > 0 && (
                              <div className="mt-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-semibold text-amber-900">
                                  Openstaand:{' '}
                                  {new Intl.NumberFormat('nl-NL', {
                                    style: 'currency',
                                    currency: 'EUR',
                                  }).format(debtor.outstanding_amount)}
                                </span>
                              </div>
                            )}
                          </div>

                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}

            {activeTab === 'creditors' && (
              <>
                {creditors.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">Geen crediteuren gevonden</p>
                  </div>
                ) : (
                  <>
                    {creditors.map((creditor) => (
                      <button
                        key={creditor.id}
                        onClick={() => setSelectedContact(creditor)}
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 text-lg mb-2">
                              {creditor.company_name}
                            </h3>

                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              {creditor.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  <span>{creditor.email}</span>
                                </div>
                              )}
                              {creditor.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-4 h-4" />
                                  <span>{creditor.phone}</span>
                                </div>
                              )}
                              {creditor.city && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{creditor.city}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}

            {activeTab === 'products' && (
              <>
                <div className="mb-4 flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Zoek op naam, omschrijving of SKU..."
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-lg whitespace-nowrap"
                  >
                    <Plus className="w-5 h-5" />
                    Nieuw
                  </button>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">
                      {searchTerm
                        ? 'Geen producten gevonden'
                        : 'Nog geen producten toegevoegd'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={() => handleOpenModal()}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Voeg je eerste product toe
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-emerald-400 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900">{product.name}</h3>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                                {product.unit}
                              </span>
                              {product.sku && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-mono">
                                  {product.sku}
                                </span>
                              )}
                            </div>
                            {product.description && (
                              <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                            )}
                            <p className="text-lg font-bold text-emerald-600">
                              €{Number(product.price).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-black text-gray-800">
                {editingProduct ? 'Product Bewerken' : 'Nieuw Product'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Vul de gegevens in voor je product of dienst
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Naam *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    placeholder="bijv. Consultancy Uur"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Omschrijving
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all resize-none"
                    placeholder="Optionele beschrijving..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Prijs
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        €
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            price: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-8 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Eenheid
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    >
                      <option value="stuk">Stuk</option>
                      <option value="uur">Uur</option>
                      <option value="dag">Dag</option>
                      <option value="week">Week</option>
                      <option value="maand">Maand</option>
                      <option value="project">Project</option>
                      <option value="kilometer">Kilometer</option>
                      <option value="pakket">Pakket</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    SKU / Productcode
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    placeholder="Optioneel"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Annuleren
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
              >
                {editingProduct ? 'Opslaan' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

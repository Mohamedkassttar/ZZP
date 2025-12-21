import { supabase } from './supabase';

export interface ImportConfig {
  moduleName: string;
  targetTable: string;
  columnMapping: { [excelHeader: string]: string };
  requiredFields: string[];
  customLogic?: (row: any) => Promise<any>;
}

export const chartOfAccountsConfig: ImportConfig = {
  moduleName: 'Chart of Accounts',
  targetTable: 'accounts',
  columnMapping: {
    'Code': 'code',
    'Name': 'name',
    'Type': 'type',
    'VAT Code': 'vat_code',
  },
  requiredFields: ['Code', 'Name', 'Type'],
  customLogic: async (row: any) => {
    const vatCodeMapping: { [key: string]: string | null } = {
      'High': 'High',
      'Low': 'Low',
      'None': 'None',
      'Hoog': 'High',
      'Laag': 'Low',
      'Geen': 'None',
    };

    if (row.vat_code) {
      row.vat_code = vatCodeMapping[row.vat_code] || null;
    }

    const validTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
    if (!validTypes.includes(row.type)) {
      throw new Error(`Invalid type: ${row.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    row.is_active = true;

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', row.code)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('accounts')
        .update(row)
        .eq('code', row.code);
      throw new Error('Account code already exists - updated existing record');
    }

    return row;
  },
};

export const fixedAssetsConfig: ImportConfig = {
  moduleName: 'Fixed Assets',
  targetTable: 'fixed_assets',
  columnMapping: {
    'Asset Name': 'asset_name',
    'Purchase Date': 'purchase_date',
    'Price': 'purchase_price',
    'Residual Value': 'residual_value',
    'Lifespan (Months)': 'useful_life_months',
  },
  requiredFields: ['Asset Name', 'Purchase Date', 'Price', 'Lifespan (Months)'],
  customLogic: async (row: any) => {
    row.purchase_price = parseFloat(row.purchase_price);
    row.residual_value = row.residual_value ? parseFloat(row.residual_value) : 0;
    row.useful_life_months = parseInt(row.useful_life_months);

    if (typeof row.purchase_date === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + row.purchase_date * 86400000);
      row.purchase_date = date.toISOString().split('T')[0];
    }

    row.status = 'Active';

    return row;
  },
};

export const mileageConfig: ImportConfig = {
  moduleName: 'Mileage Log',
  targetTable: 'mileage_logs',
  columnMapping: {
    'Date': 'trip_date',
    'From': 'from_location',
    'To': 'to_location',
    'Distance': 'distance_km',
    'Purpose': 'purpose',
    'Car License': 'vehicle_license',
  },
  requiredFields: ['Date', 'From', 'To', 'Distance'],
  customLogic: async (row: any) => {
    row.distance_km = parseFloat(row.distance_km);

    if (typeof row.trip_date === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + row.trip_date * 86400000);
      row.trip_date = date.toISOString().split('T')[0];
    }

    return row;
  },
};

async function findOrCreateContact(relationName: string, relationType: 'Supplier' | 'Customer'): Promise<string> {
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .ilike('company_name', relationName.trim())
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      company_name: relationName.trim(),
      relation_type: relationType,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !newContact) {
    throw new Error(`Failed to create contact: ${relationName}`);
  }

  return newContact.id;
}

export const purchaseInvoicesConfig: ImportConfig = {
  moduleName: 'Purchase Invoices',
  targetTable: 'invoices',
  columnMapping: {
    'Relation Name': 'relation_name',
    'Invoice Date': 'invoice_date',
    'Due Date': 'due_date',
    'Reference/Invoice #': 'invoice_number',
    'Total Amount (Incl VAT)': 'total_amount',
    'VAT Amount': 'vat_amount',
    'Description': 'description',
  },
  requiredFields: ['Relation Name', 'Invoice Date', 'Total Amount (Incl VAT)'],
  customLogic: async (row: any) => {
    const relationName = row.relation_name;
    delete row.relation_name;

    const contactId = await findOrCreateContact(relationName, 'Supplier');

    row.contact_id = contactId;
    row.total_amount = parseFloat(row.total_amount);
    row.vat_amount = row.vat_amount ? parseFloat(row.vat_amount) : 0;
    row.status = 'Draft';

    if (typeof row.invoice_date === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + row.invoice_date * 86400000);
      row.invoice_date = date.toISOString().split('T')[0];
    }

    if (row.due_date) {
      if (typeof row.due_date === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + row.due_date * 86400000);
        row.due_date = date.toISOString().split('T')[0];
      }
    }

    return row;
  },
};

export const salesInvoicesConfig: ImportConfig = {
  moduleName: 'Sales Invoices',
  targetTable: 'invoices',
  columnMapping: {
    'Relation Name': 'relation_name',
    'Invoice Date': 'invoice_date',
    'Due Date': 'due_date',
    'Reference/Invoice #': 'invoice_number',
    'Total Amount (Incl VAT)': 'total_amount',
    'VAT Amount': 'vat_amount',
    'Description': 'description',
  },
  requiredFields: ['Relation Name', 'Invoice Date', 'Total Amount (Incl VAT)'],
  customLogic: async (row: any) => {
    const relationName = row.relation_name;
    delete row.relation_name;

    const contactId = await findOrCreateContact(relationName, 'Customer');

    row.contact_id = contactId;
    row.total_amount = parseFloat(row.total_amount);
    row.vat_amount = row.vat_amount ? parseFloat(row.vat_amount) : 0;
    row.status = 'Draft';

    if (typeof row.invoice_date === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + row.invoice_date * 86400000);
      row.invoice_date = date.toISOString().split('T')[0];
    }

    if (row.due_date) {
      if (typeof row.due_date === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + row.due_date * 86400000);
        row.due_date = date.toISOString().split('T')[0];
      }
    }

    return row;
  },
};

export const contactsConfig: ImportConfig = {
  moduleName: 'Contacts',
  targetTable: 'contacts',
  columnMapping: {
    'Company Name': 'company_name',
    'Contact Person': 'contact_person',
    'Email': 'email',
    'Phone': 'phone',
    'Address': 'address',
    'Postal Code': 'postal_code',
    'City': 'city',
    'Country': 'country',
    'VAT Number': 'vat_number',
    'CoC Number': 'coc_number',
    'Payment Terms (Days)': 'payment_term_days',
    'IBAN': 'iban',
    'Type': 'relation_type',
  },
  requiredFields: ['Company Name', 'Type'],
  customLogic: async (row: any) => {
    const validTypes = ['Customer', 'Supplier', 'Both'];
    if (!validTypes.includes(row.relation_type)) {
      throw new Error(`Invalid type: ${row.relation_type}. Must be one of: ${validTypes.join(', ')}`);
    }

    if (row.payment_term_days) {
      row.payment_term_days = parseInt(row.payment_term_days);
    } else {
      row.payment_term_days = 14;
    }

    if (!row.country) {
      row.country = 'Netherlands';
    }

    row.is_active = true;

    const genericNames = ['unknown', 'onbekend', 'test', 'n/a', 'na'];
    if (genericNames.includes(row.company_name.toLowerCase().trim())) {
      throw new Error('Please use a specific company name instead of generic names');
    }

    return row;
  },
};

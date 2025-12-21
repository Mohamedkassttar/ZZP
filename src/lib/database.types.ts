export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type RelationType = 'Customer' | 'Supplier' | 'Both';
export type JournalStatus = 'Draft' | 'Final';
export type DocumentStatus = 'Uploading' | 'Processing' | 'Review_Needed' | 'Booked' | 'Error';
export type BankTransactionStatus = 'Unmatched' | 'Matched' | 'Booked';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';
export type PurchaseInvoiceStatus = 'Draft' | 'Pending' | 'Paid' | 'Overdue';
export type MatchType = 'Contains' | 'Exact';
export type DutchTaxCategory =
  | 'Netto Omzet'
  | 'Overige Opbrengsten'
  | 'Inkoopwaarde van de omzet'
  | 'Afschrijvingen'
  | 'Huisvestingskosten'
  | 'Kosten van vervoer'
  | 'Kantoorkosten'
  | 'Verkoopkosten'
  | 'Algemene kosten'
  | 'Materiële vaste activa'
  | 'Financiële vaste activa'
  | 'Vorderingen'
  | 'Liquide middelen'
  | 'Voorraden'
  | 'Ondernemingsvermogen'
  | 'Voorzieningen'
  | 'Langlopende schulden'
  | 'Kortlopende schulden';

export interface ExtractedInvoiceData {
  supplier_name?: string;
  invoice_date?: string;
  invoice_number?: string;
  total_amount?: number;
  vat_amount?: number;
  net_amount?: number;
  vat_percentage?: number;
  suggested_account_id?: string;
  suggested_account_code?: string;
  suggested_account_name?: string;
  description?: string;
  confidence?: number;
}

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          code: string;
          name: string;
          type: AccountType;
          vat_code: number;
          description: string | null;
          is_active: boolean;
          tax_category: DutchTaxCategory | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          type: AccountType;
          vat_code?: number;
          description?: string | null;
          is_active?: boolean;
          tax_category?: DutchTaxCategory | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          type?: AccountType;
          vat_code?: number;
          description?: string | null;
          is_active?: boolean;
          tax_category?: DutchTaxCategory | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          company_name: string;
          vat_number: string | null;
          relation_type: RelationType;
          email: string | null;
          phone: string | null;
          address: string | null;
          default_ledger_account_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_name: string;
          vat_number?: string | null;
          relation_type: RelationType;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          default_ledger_account_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_name?: string;
          vat_number?: string | null;
          relation_type?: RelationType;
          default_ledger_account_id?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          entry_date: string;
          description: string;
          reference: string | null;
          status: JournalStatus;
          contact_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entry_date?: string;
          description: string;
          reference?: string | null;
          status?: JournalStatus;
          contact_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entry_date?: string;
          description?: string;
          reference?: string | null;
          status?: JournalStatus;
          contact_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      journal_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          account_id: string;
          debit: number;
          credit: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          journal_entry_id: string;
          account_id: string;
          debit?: number;
          credit?: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          journal_entry_id?: string;
          account_id?: string;
          debit?: number;
          credit?: number;
          description?: string | null;
          created_at?: string;
        };
      };
      documents_inbox: {
        Row: {
          id: string;
          file_url: string;
          file_name: string;
          file_type: string;
          status: DocumentStatus;
          extracted_data: ExtractedInvoiceData | null;
          journal_entry_id: string | null;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
          booked_at: string | null;
        };
        Insert: {
          id?: string;
          file_url: string;
          file_name: string;
          file_type: string;
          status?: DocumentStatus;
          extracted_data?: ExtractedInvoiceData | null;
          journal_entry_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
          booked_at?: string | null;
        };
        Update: {
          id?: string;
          file_url?: string;
          file_name?: string;
          file_type?: string;
          status?: DocumentStatus;
          extracted_data?: ExtractedInvoiceData | null;
          journal_entry_id?: string | null;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
          booked_at?: string | null;
        };
      };
      bank_transactions: {
        Row: {
          id: string;
          transaction_date: string;
          description: string;
          amount: number;
          contra_account: string | null;
          contra_name: string | null;
          reference: string | null;
          balance_after: number | null;
          status: BankTransactionStatus;
          journal_entry_id: string | null;
          matched_invoice_id: string | null;
          imported_at: string;
          reconciled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_date: string;
          description: string;
          amount: number;
          contra_account?: string | null;
          contra_name?: string | null;
          reference?: string | null;
          balance_after?: number | null;
          status?: BankTransactionStatus;
          journal_entry_id?: string | null;
          matched_invoice_id?: string | null;
          imported_at?: string;
          reconciled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_date?: string;
          description?: string;
          amount?: number;
          contra_account?: string | null;
          contra_name?: string | null;
          reference?: string | null;
          balance_after?: number | null;
          status?: BankTransactionStatus;
          journal_entry_id?: string | null;
          matched_invoice_id?: string | null;
          imported_at?: string;
          reconciled_at?: string | null;
          created_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          contact_id: string;
          invoice_number: string;
          invoice_date: string;
          due_date: string;
          total_amount: number;
          subtotal: number;
          vat_amount: number;
          net_amount: number | null;
          status: InvoiceStatus;
          journal_entry_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          finalized_at: string | null;
        };
        Insert: {
          id?: string;
          contact_id: string;
          invoice_number: string;
          invoice_date?: string;
          due_date: string;
          total_amount?: number;
          subtotal?: number;
          vat_amount?: number;
          net_amount?: number | null;
          status?: InvoiceStatus;
          journal_entry_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          finalized_at?: string | null;
        };
        Update: {
          id?: string;
          contact_id?: string;
          invoice_number?: string;
          invoice_date?: string;
          due_date?: string;
          total_amount?: number;
          subtotal?: number;
          vat_amount?: number;
          net_amount?: number | null;
          status?: InvoiceStatus;
          journal_entry_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          finalized_at?: string | null;
        };
      };
      invoice_lines: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          vat_rate: number;
          vat_amount: number;
          ledger_account_id: string;
          line_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          vat_rate?: number;
          vat_amount?: number;
          ledger_account_id: string;
          line_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          vat_rate?: number;
          vat_amount?: number;
          ledger_account_id?: string;
          line_order?: number;
          created_at?: string;
        };
      };
      fixed_assets: {
        Row: {
          id: string;
          name: string;
          purchase_date: string;
          purchase_price: number;
          residual_value: number;
          lifespan_months: number;
          depreciation_account_id: string;
          balance_sheet_account_id: string;
          last_depreciation_date: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          purchase_date: string;
          purchase_price: number;
          residual_value?: number;
          lifespan_months: number;
          depreciation_account_id: string;
          balance_sheet_account_id: string;
          last_depreciation_date?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          purchase_date?: string;
          purchase_price?: number;
          residual_value?: number;
          lifespan_months?: number;
          depreciation_account_id?: string;
          balance_sheet_account_id?: string;
          last_depreciation_date?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      mileage_logs: {
        Row: {
          id: string;
          log_date: string;
          from_location: string;
          to_location: string;
          distance_km: number;
          purpose: string;
          vehicle_license: string | null;
          is_booked: boolean;
          journal_entry_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          log_date: string;
          from_location: string;
          to_location: string;
          distance_km: number;
          purpose: string;
          vehicle_license?: string | null;
          is_booked?: boolean;
          journal_entry_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          log_date?: string;
          from_location?: string;
          to_location?: string;
          distance_km?: number;
          purpose?: string;
          vehicle_license?: string | null;
          is_booked?: boolean;
          journal_entry_id?: string | null;
          created_at?: string;
        };
      };
      bank_rules: {
        Row: {
          id: string;
          keyword: string;
          match_type: MatchType;
          target_ledger_account_id: string | null;
          contact_id: string | null;
          description_template: string | null;
          priority: number;
          is_active: boolean;
          is_system_rule: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          keyword: string;
          match_type?: MatchType;
          target_ledger_account_id?: string | null;
          contact_id?: string | null;
          description_template?: string | null;
          priority?: number;
          is_active?: boolean;
          is_system_rule?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          keyword?: string;
          match_type?: MatchType;
          target_ledger_account_id?: string | null;
          contact_id?: string | null;
          description_template?: string | null;
          priority?: number;
          is_active?: boolean;
          is_system_rule?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      account_type: AccountType;
      relation_type: RelationType;
      journal_status: JournalStatus;
      document_status: DocumentStatus;
      bank_transaction_status: BankTransactionStatus;
      invoice_status: InvoiceStatus;
      match_type: MatchType;
      dutch_tax_category: DutchTaxCategory;
    };
  };
}

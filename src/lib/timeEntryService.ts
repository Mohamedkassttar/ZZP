/**
 * Time Entry Service
 *
 * Manages time tracking entries and conversion to invoices
 * Supports both Expert Mode and Client Portal
 */

import { supabase } from './supabase';
import { createAndBookInvoice } from './salesService';

export interface TimeEntry {
  id: string;
  user_id: string;
  contact_id: string;
  date: string;
  hours: number;
  description: string;
  status: 'open' | 'billed';
  invoice_id?: string;
  created_at: string;
  updated_at: string;
  contact?: {
    company_name: string;
    hourly_rate?: number;
  };
}

export interface CreateTimeEntryInput {
  contactId: string;
  date: string;
  hours: number;
  description: string;
}

export interface UpdateTimeEntryInput {
  date?: string;
  hours?: number;
  description?: string;
}

/**
 * Get all time entries for current user
 */
export async function getTimeEntries(contactId?: string): Promise<TimeEntry[]> {
  try {
    let query = supabase
      .from('time_entries')
      .select(`
        *,
        contact:contacts(company_name, hourly_rate)
      `)
      .order('date', { ascending: false });

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching time entries:', error);
      return [];
    }

    return (data || []) as TimeEntry[];
  } catch (error) {
    console.error('Error in getTimeEntries:', error);
    return [];
  }
}

/**
 * Get unbilled hours for a specific contact
 */
export async function getUnbilledHours(contactId: string): Promise<TimeEntry[]> {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        contact:contacts(company_name, hourly_rate)
      `)
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching unbilled hours:', error);
      return [];
    }

    return (data || []) as TimeEntry[];
  } catch (error) {
    console.error('Error in getUnbilledHours:', error);
    return [];
  }
}

/**
 * Get contacts with unbilled hours
 */
export async function getContactsWithUnbilledHours(): Promise<Array<{
  contact_id: string;
  company_name: string;
  total_hours: number;
  hourly_rate?: number;
  estimated_amount: number;
}>> {
  try {
    const { data: entries, error } = await supabase
      .from('time_entries')
      .select(`
        contact_id,
        hours,
        contact:contacts(company_name, hourly_rate)
      `)
      .eq('status', 'open');

    if (error) {
      console.error('Error fetching unbilled contacts:', error);
      return [];
    }

    // Group by contact
    const grouped = (entries || []).reduce((acc: any, entry: any) => {
      const contactId = entry.contact_id;
      if (!acc[contactId]) {
        acc[contactId] = {
          contact_id: contactId,
          company_name: entry.contact?.company_name || 'Unknown',
          total_hours: 0,
          hourly_rate: entry.contact?.hourly_rate || 0,
          estimated_amount: 0,
        };
      }
      acc[contactId].total_hours += entry.hours;
      acc[contactId].estimated_amount = acc[contactId].total_hours * (acc[contactId].hourly_rate || 0);
      return acc;
    }, {});

    return Object.values(grouped);
  } catch (error) {
    console.error('Error in getContactsWithUnbilledHours:', error);
    return [];
  }
}

/**
 * Create a new time entry
 */
export async function createTimeEntry(input: CreateTimeEntryInput): Promise<{
  success: boolean;
  entry?: TimeEntry;
  error?: string;
}> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: 'Gebruiker niet ingelogd',
      };
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: user.id,
        contact_id: input.contactId,
        date: input.date,
        hours: input.hours,
        description: input.description,
        status: 'open',
      })
      .select(`
        *,
        contact:contacts(company_name, hourly_rate)
      `)
      .single();

    if (error) {
      console.error('Error creating time entry:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      entry: data as TimeEntry,
    };
  } catch (error) {
    console.error('Error in createTimeEntry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    };
  }
}

/**
 * Update an existing time entry
 */
export async function updateTimeEntry(
  entryId: string,
  input: UpdateTimeEntryInput
): Promise<{
  success: boolean;
  entry?: TimeEntry;
  error?: string;
}> {
  try {
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.date) updates.date = input.date;
    if (input.hours !== undefined) updates.hours = input.hours;
    if (input.description) updates.description = input.description;

    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', entryId)
      .select(`
        *,
        contact:contacts(company_name, hourly_rate)
      `)
      .single();

    if (error) {
      console.error('Error updating time entry:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      entry: data as TimeEntry,
    };
  } catch (error) {
    console.error('Error in updateTimeEntry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    };
  }
}

/**
 * Delete a time entry
 */
export async function deleteTimeEntry(entryId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId)
      .eq('status', 'open'); // Only allow deleting unbilled entries

    if (error) {
      console.error('Error deleting time entry:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteTimeEntry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    };
  }
}

/**
 * Mark time entries as billed
 *
 * This is a strict, explicit function for marking entries as billed after invoice creation.
 * Used by TimeTracking.tsx → InvoiceFormModal.tsx flow.
 */
export async function markEntriesAsBilled(
  entryIds: string[],
  invoiceId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!entryIds || entryIds.length === 0) {
      return {
        success: false,
        error: 'Geen entries geselecteerd',
      };
    }

    if (!invoiceId) {
      return {
        success: false,
        error: 'Geen invoice ID opgegeven',
      };
    }

    const { error } = await supabase
      .from('time_entries')
      .update({
        status: 'billed',
        invoice_id: invoiceId,
        updated_at: new Date().toISOString(),
      })
      .in('id', entryIds)
      .eq('status', 'open'); // Only update entries that are still open

    if (error) {
      console.error('Error marking entries as billed:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in markEntriesAsBilled:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    };
  }
}

/**
 * Convert time entries to an invoice
 */
export async function convertHoursToInvoice(
  contactId: string,
  entryIds: string[],
  shouldSendEmail = false
): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
  emailSent?: boolean;
  emailMessage?: string;
}> {
  try {
    if (entryIds.length === 0) {
      return {
        success: false,
        error: 'Geen tijdsregels geselecteerd',
      };
    }

    // Get the time entries
    const { data: entries, error: entriesError } = await supabase
      .from('time_entries')
      .select(`
        *,
        contact:contacts(company_name, hourly_rate)
      `)
      .in('id', entryIds)
      .eq('contact_id', contactId)
      .eq('status', 'open');

    if (entriesError || !entries || entries.length === 0) {
      return {
        success: false,
        error: 'Tijdsregels niet gevonden of al gefactureerd',
      };
    }

    // Get hourly rate from contact
    const contact = (entries[0] as any).contact;
    const hourlyRate = contact?.hourly_rate || 0;

    if (hourlyRate <= 0) {
      return {
        success: false,
        error: 'Geen uurtarief ingesteld voor deze relatie',
      };
    }

    // Create invoice lines from time entries
    const lines = entries.map((entry: any) => {
      const amount = entry.hours * hourlyRate;
      return {
        description: `${entry.description} (${entry.hours} uur @ €${hourlyRate}/uur)`,
        amount: amount,
        vatRate: 21, // Default VAT rate
      };
    });

    // Create invoice
    const result = await createAndBookInvoice({
      contactId,
      lines,
      shouldSendEmail,
    });

    if (!result.success || !result.invoiceId) {
      return {
        success: false,
        error: result.error || 'Fout bij aanmaken factuur',
      };
    }

    // Update time entries to mark as billed
    const { error: updateError } = await supabase
      .from('time_entries')
      .update({
        status: 'billed',
        invoice_id: result.invoiceId,
        updated_at: new Date().toISOString(),
      })
      .in('id', entryIds);

    if (updateError) {
      console.error('Error updating time entries:', updateError);
      // Don't fail the whole operation, invoice is already created
    }

    return {
      success: true,
      invoiceId: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
      emailSent: result.emailSent,
      emailMessage: result.emailMessage,
    };
  } catch (error) {
    console.error('Error in convertHoursToInvoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Onbekende fout',
    };
  }
}

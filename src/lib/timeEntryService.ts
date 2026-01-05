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
  entry_type: 'hours' | 'mileage';
  hours: number | null;
  distance: number | null;
  description: string;
  status: 'open' | 'billed';
  invoice_id?: string;
  created_at: string;
  updated_at: string;
  contact?: {
    company_name: string;
    hourly_rate?: number;
    mileage_rate?: number;
  };
}

export interface CreateTimeEntryInput {
  contactId: string;
  date: string;
  entryType: 'hours' | 'mileage';
  hours?: number;
  distance?: number;
  description: string;
}

export interface UpdateTimeEntryInput {
  date?: string;
  entryType?: 'hours' | 'mileage';
  hours?: number;
  distance?: number;
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
        contact:contacts(company_name, hourly_rate, mileage_rate)
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
        contact:contacts(company_name, hourly_rate, mileage_rate)
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
        entry_type,
        hours,
        distance,
        contact:contacts(company_name, hourly_rate, mileage_rate)
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
          mileage_rate: entry.contact?.mileage_rate || 0,
          estimated_amount: 0,
        };
      }

      // Add hours or mileage to totals
      if (entry.entry_type === 'hours' && entry.hours) {
        acc[contactId].total_hours += entry.hours;
        acc[contactId].estimated_amount += entry.hours * (acc[contactId].hourly_rate || 0);
      } else if (entry.entry_type === 'mileage' && entry.distance) {
        acc[contactId].estimated_amount += entry.distance * (acc[contactId].mileage_rate || 0);
      }

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
    console.log('[createTimeEntry] Input received:', JSON.stringify(input, null, 2));

    const insertData: any = {
      user_id: null,
      contact_id: input.contactId,
      date: input.date,
      entry_type: input.entryType,
      description: input.description,
      status: 'open',
    };

    // Add hours or distance based on entry type
    if (input.entryType === 'hours') {
      if (input.hours === undefined || input.hours === null || isNaN(input.hours) || input.hours <= 0) {
        console.error('[createTimeEntry] Invalid hours value:', input.hours);
        return {
          success: false,
          error: 'Aantal uren moet groter dan 0 zijn',
        };
      }
      insertData.hours = input.hours;
      insertData.distance = null;
    } else {
      if (input.distance === undefined || input.distance === null || isNaN(input.distance) || input.distance <= 0) {
        console.error('[createTimeEntry] Invalid distance value:', input.distance);
        return {
          success: false,
          error: 'Afstand moet groter dan 0 zijn',
        };
      }
      insertData.distance = input.distance;
      insertData.hours = null;
    }

    console.log('[createTimeEntry] Data to insert:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('time_entries')
      .insert(insertData)
      .select(`
        *,
        contact:contacts(company_name, hourly_rate, mileage_rate)
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
    if (input.description) updates.description = input.description;

    // Handle entry type changes
    if (input.entryType) {
      updates.entry_type = input.entryType;
      if (input.entryType === 'hours') {
        updates.hours = input.hours !== undefined ? input.hours : 0;
        updates.distance = null;
      } else {
        updates.distance = input.distance !== undefined ? input.distance : 0;
        updates.hours = null;
      }
    } else {
      // Update hours or distance based on current type (not changing type)
      if (input.hours !== undefined) updates.hours = input.hours;
      if (input.distance !== undefined) updates.distance = input.distance;
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', entryId)
      .select(`
        *,
        contact:contacts(company_name, hourly_rate, mileage_rate)
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
        contact:contacts(company_name, hourly_rate, mileage_rate)
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

    // Get rates from contact
    const contact = (entries[0] as any).contact;
    const hourlyRate = contact?.hourly_rate || 0;
    const mileageRate = contact?.mileage_rate || 0;

    // Create invoice lines from time entries
    const lines = entries.map((entry: any) => {
      let amount = 0;
      let description = '';

      if (entry.entry_type === 'hours') {
        if (hourlyRate <= 0) {
          throw new Error('Geen uurtarief ingesteld voor deze relatie');
        }
        amount = (entry.hours || 0) * hourlyRate;
        description = `${entry.description} (${entry.hours} uur @ €${hourlyRate}/uur)`;
      } else if (entry.entry_type === 'mileage') {
        if (mileageRate <= 0) {
          throw new Error('Geen kilometertarief ingesteld voor deze relatie');
        }
        amount = (entry.distance || 0) * mileageRate;
        description = `${entry.description} (${entry.distance} km @ €${mileageRate}/km)`;
      }

      return {
        description,
        amount,
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

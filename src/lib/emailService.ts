import { supabase } from './supabase';

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  senderName: string;
  senderEmail: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface CompanySettings {
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
  sender_name?: string;
  sender_email?: string;
  company_name?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  phone?: string;
  email?: string;
  vat_number?: string;
  kvk_number?: string;
  bank_account?: string;
}

export async function getCompanySettings(): Promise<CompanySettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!companyUser?.company_id) return null;

    const { data: settings, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', companyUser.company_id)
      .maybeSingle();

    if (error) throw error;

    return settings;
  } catch (error) {
    console.error('Error loading company settings:', error);
    return null;
  }
}

export async function updateCompanySettings(settings: Partial<CompanySettings>): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!companyUser?.company_id) {
      throw new Error('No company found');
    }

    const { data: existingSettings } = await supabase
      .from('company_settings')
      .select('id')
      .eq('id', companyUser.company_id)
      .maybeSingle();

    if (existingSettings) {
      const { error } = await supabase
        .from('company_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyUser.company_id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('company_settings')
        .insert({
          id: companyUser.company_id,
          ...settings,
        });

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error updating company settings:', error);
    return false;
  }
}

export function isSMTPConfigured(settings: CompanySettings | null): boolean {
  if (!settings) return false;

  return !!(
    settings.smtp_host &&
    settings.smtp_user &&
    settings.smtp_password &&
    settings.sender_email
  );
}

export async function sendEmail(options: EmailOptions, smtpConfig?: SMTPConfig): Promise<{ success: boolean; error?: string }> {
  try {
    if (!smtpConfig) {
      const settings = await getCompanySettings();

      if (!isSMTPConfigured(settings)) {
        return {
          success: false,
          error: 'SMTP niet geconfigureerd. Stel eerst je email instellingen in.',
        };
      }

      smtpConfig = {
        host: settings!.smtp_host!,
        port: settings!.smtp_port || 587,
        secure: settings!.smtp_secure !== false,
        user: settings!.smtp_user!,
        password: settings!.smtp_password!,
        senderName: settings!.sender_name || settings!.company_name || 'Administratie',
        senderEmail: settings!.sender_email!,
      };
    }

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        smtpConfig,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send email',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het versturen van de email.',
    };
  }
}

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Test Email</h1>
          </div>
          <div class="content">
            <div class="success-badge">Email configuratie succesvol!</div>
            <p>Gefeliciteerd! Je SMTP-instellingen zijn correct geconfigureerd.</p>
            <p>Je kunt nu facturen en offertes versturen vanuit de applicatie.</p>
            <p>Deze test-email werd succesvol verzonden op: <strong>${new Date().toLocaleString('nl-NL')}</strong></p>
          </div>
          <div class="footer">
            <p>Dit is een automatisch gegenereerd testbericht.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: toEmail,
    subject: 'Test Email - SMTP Configuratie',
    html,
  });
}

export function generateInvoiceHTML(invoice: any, companySettings: CompanySettings): string {
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  const itemsHTML = items.map((item: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${Number(item.price).toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.vat_percentage}%</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${(item.quantity * item.price * (1 + item.vat_percentage / 100)).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0 0 10px 0; font-size: 32px; }
          .header p { margin: 0; opacity: 0.9; }
          .info-section { display: flex; justify-content: space-between; padding: 30px; background: #f9fafb; }
          .info-block { flex: 1; }
          .info-block h3 { margin: 0 0 10px 0; color: #1f2937; font-size: 14px; text-transform: uppercase; }
          .info-block p { margin: 4px 0; color: #6b7280; }
          .table-container { padding: 30px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
          .totals { margin-top: 30px; text-align: right; }
          .totals table { width: auto; margin-left: auto; min-width: 300px; }
          .totals tr { border: none; }
          .totals td { padding: 8px 12px; }
          .total-row { font-size: 18px; font-weight: bold; background: #f3f4f6; }
          .footer { text-align: center; padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; color: #6b7280; }
          .payment-info { background: #dbeafe; padding: 20px; margin: 20px 30px; border-radius: 8px; border-left: 4px solid #2563eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>FACTUUR</h1>
            <p>Factuurnummer: ${invoice.invoice_number}</p>
            <p>Datum: ${new Date(invoice.date).toLocaleDateString('nl-NL')}</p>
          </div>

          <div class="info-section">
            <div class="info-block">
              <h3>Van</h3>
              <p><strong>${companySettings.company_name || 'Uw Bedrijf'}</strong></p>
              ${companySettings.address ? `<p>${companySettings.address}</p>` : ''}
              ${companySettings.postal_code && companySettings.city ? `<p>${companySettings.postal_code} ${companySettings.city}</p>` : ''}
              ${companySettings.kvk_number ? `<p>KvK: ${companySettings.kvk_number}</p>` : ''}
              ${companySettings.vat_number ? `<p>BTW: ${companySettings.vat_number}</p>` : ''}
            </div>
            <div class="info-block">
              <h3>Aan</h3>
              <p><strong>${invoice.contact?.company_name || 'Klant'}</strong></p>
              ${invoice.contact?.address ? `<p>${invoice.contact.address}</p>` : ''}
              ${invoice.contact?.postal_code && invoice.contact?.city ? `<p>${invoice.contact.postal_code} ${invoice.contact.city}</p>` : ''}
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Omschrijving</th>
                  <th style="text-align: center;">Aantal</th>
                  <th style="text-align: right;">Prijs</th>
                  <th style="text-align: right;">BTW</th>
                  <th style="text-align: right;">Totaal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="totals">
              <table>
                <tr>
                  <td>Subtotaal:</td>
                  <td style="text-align: right;">€${(invoice.total_amount - invoice.vat_amount).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>BTW:</td>
                  <td style="text-align: right;">€${invoice.vat_amount.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                  <td>Totaal:</td>
                  <td style="text-align: right;">€${invoice.total_amount.toFixed(2)}</td>
                </tr>
              </table>
            </div>
          </div>

          ${companySettings.bank_account ? `
            <div class="payment-info">
              <h3 style="margin: 0 0 10px 0; color: #1e40af;">Betaalinformatie</h3>
              <p style="margin: 4px 0;"><strong>IBAN:</strong> ${companySettings.bank_account}</p>
              <p style="margin: 4px 0;"><strong>Betalingstermijn:</strong> ${invoice.contact?.payment_term_days || 14} dagen</p>
              <p style="margin: 4px 0;"><strong>Onder vermelding van:</strong> ${invoice.invoice_number}</p>
            </div>
          ` : ''}

          ${invoice.notes ? `
            <div style="padding: 20px 30px;">
              <h3 style="color: #374151; margin: 0 0 10px 0;">Opmerkingen</h3>
              <p style="color: #6b7280;">${invoice.notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Bedankt voor uw vertrouwen!</p>
            ${companySettings.email ? `<p>Vragen? Email ons op ${companySettings.email}</p>` : ''}
            ${companySettings.phone ? `<p>Of bel: ${companySettings.phone}</p>` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendInvoiceEmail(invoice: any, toEmail?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getCompanySettings();

    if (!settings || !isSMTPConfigured(settings)) {
      return {
        success: false,
        error: 'SMTP niet geconfigureerd. Stel eerst je email instellingen in.',
      };
    }

    const recipientEmail = toEmail || invoice.contact?.email;

    if (!recipientEmail) {
      return {
        success: false,
        error: 'Geen email adres gevonden voor deze klant.',
      };
    }

    const html = generateInvoiceHTML(invoice, settings);

    const result = await sendEmail({
      to: recipientEmail,
      subject: `Factuur ${invoice.invoice_number} - ${settings.company_name || 'Uw Bedrijf'}`,
      html,
    });

    if (result.success) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: companyUser } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (companyUser?.company_id) {
          await supabase
            .from('sales_invoices')
            .update({
              sent_to_email: recipientEmail,
              last_sent_at: new Date().toISOString(),
              status: 'sent',
            })
            .eq('id', invoice.id)
            .eq('company_id', companyUser.company_id);
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    return {
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het versturen van de factuur.',
    };
  }
}

export function generateQuotationHTML(quotation: any, companySettings: CompanySettings): string {
  const items = Array.isArray(quotation.items) ? quotation.items : [];

  const itemsHTML = items.map((item: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${Number(item.price).toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.vat_percentage}%</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${(item.quantity * item.price * (1 + item.vat_percentage / 100)).toFixed(2)}</td>
    </tr>
  `).join('');

  const acceptUrl = `${window.location.origin}/quote/${quotation.public_token}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0 0 10px 0; font-size: 32px; }
          .header p { margin: 0; opacity: 0.9; }
          .info-section { display: flex; justify-content: space-between; padding: 30px; background: #f9fafb; }
          .info-block { flex: 1; }
          .info-block h3 { margin: 0 0 10px 0; color: #1f2937; font-size: 14px; text-transform: uppercase; }
          .info-block p { margin: 4px 0; color: #6b7280; }
          .table-container { padding: 30px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
          .totals { margin-top: 30px; text-align: right; }
          .totals table { width: auto; margin-left: auto; min-width: 300px; }
          .totals tr { border: none; }
          .totals td { padding: 8px 12px; }
          .total-row { font-size: 18px; font-weight: bold; background: #f3f4f6; }
          .action-button { display: inline-block; background: #059669; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; color: #6b7280; }
          .validity-info { background: #fef3c7; padding: 20px; margin: 20px 30px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>OFFERTE</h1>
            <p>Offertenummer: ${quotation.quote_number}</p>
            <p>Datum: ${new Date(quotation.date).toLocaleDateString('nl-NL')}</p>
          </div>

          <div class="info-section">
            <div class="info-block">
              <h3>Van</h3>
              <p><strong>${companySettings.company_name || 'Uw Bedrijf'}</strong></p>
              ${companySettings.address ? `<p>${companySettings.address}</p>` : ''}
              ${companySettings.postal_code && companySettings.city ? `<p>${companySettings.postal_code} ${companySettings.city}</p>` : ''}
              ${companySettings.kvk_number ? `<p>KvK: ${companySettings.kvk_number}</p>` : ''}
              ${companySettings.vat_number ? `<p>BTW: ${companySettings.vat_number}</p>` : ''}
            </div>
            <div class="info-block">
              <h3>Aan</h3>
              <p><strong>${quotation.contact?.company_name || 'Klant'}</strong></p>
              ${quotation.contact?.address ? `<p>${quotation.contact.address}</p>` : ''}
              ${quotation.contact?.postal_code && quotation.contact?.city ? `<p>${quotation.contact.postal_code} ${quotation.contact.city}</p>` : ''}
            </div>
          </div>

          <div class="validity-info">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">Geldigheid</h3>
            <p style="margin: 0; color: #78350f;">Deze offerte is geldig tot <strong>${new Date(quotation.valid_until).toLocaleDateString('nl-NL')}</strong></p>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Omschrijving</th>
                  <th style="text-align: center;">Aantal</th>
                  <th style="text-align: right;">Prijs</th>
                  <th style="text-align: right;">BTW</th>
                  <th style="text-align: right;">Totaal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="totals">
              <table>
                <tr>
                  <td>Subtotaal:</td>
                  <td style="text-align: right;">€${quotation.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>BTW:</td>
                  <td style="text-align: right;">€${quotation.vat_amount.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                  <td>Totaal:</td>
                  <td style="text-align: right;">€${quotation.total_amount.toFixed(2)}</td>
                </tr>
              </table>
            </div>
          </div>

          ${quotation.notes ? `
            <div style="padding: 20px 30px;">
              <h3 style="color: #374151; margin: 0 0 10px 0;">Opmerkingen</h3>
              <p style="color: #6b7280;">${quotation.notes}</p>
            </div>
          ` : ''}

          <div style="text-align: center; padding: 30px;">
            <a href="${acceptUrl}" class="action-button">Accepteer Offerte</a>
            <p style="color: #6b7280; margin-top: 10px;">Of kopieer deze link: ${acceptUrl}</p>
          </div>

          <div class="footer">
            <p>Bedankt voor uw interesse!</p>
            ${companySettings.email ? `<p>Vragen? Email ons op ${companySettings.email}</p>` : ''}
            ${companySettings.phone ? `<p>Of bel: ${companySettings.phone}</p>` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendQuotationEmail(quotation: any, toEmail?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getCompanySettings();

    if (!settings || !isSMTPConfigured(settings)) {
      return {
        success: false,
        error: 'SMTP niet geconfigureerd. Stel eerst je email instellingen in.',
      };
    }

    const recipientEmail = toEmail || quotation.contact?.email;

    if (!recipientEmail) {
      return {
        success: false,
        error: 'Geen email adres gevonden voor deze klant.',
      };
    }

    const html = generateQuotationHTML(quotation, settings);

    const result = await sendEmail({
      to: recipientEmail,
      subject: `Offerte ${quotation.quote_number} - ${settings.company_name || 'Uw Bedrijf'}`,
      html,
    });

    if (result.success) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: companyUser } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (companyUser?.company_id) {
          await supabase
            .from('quotations')
            .update({
              sent_at: new Date().toISOString(),
              status: 'sent',
            })
            .eq('id', quotation.id)
            .eq('company_id', companyUser.company_id);
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error('Error sending quotation email:', error);
    return {
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het versturen van de offerte.',
    };
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function sendInvoiceReminder(invoice: any, toEmail?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getCompanySettings();

    if (!settings || !isSMTPConfigured(settings)) {
      return {
        success: false,
        error: 'SMTP niet geconfigureerd. Stel eerst je email instellingen in.',
      };
    }

    const recipientEmail = toEmail || invoice.contact?.email;

    if (!recipientEmail) {
      return {
        success: false,
        error: 'Geen email adres gevonden voor deze klant.',
      };
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .warning-badge { background: #f59e0b; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 20px 0; }
            .amount-box { background: white; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .amount { font-size: 32px; font-weight: bold; color: #92400e; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Betalingsherinnering</h1>
            </div>
            <div class="content">
              <div class="warning-badge">Vriendelijke herinnering</div>
              <p>Beste ${invoice.contact?.company_name || 'klant'},</p>
              <p>Dit is een vriendelijke herinnering voor factuur <strong>${invoice.invoice_number}</strong>.</p>
              <div class="amount-box">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">Openstaand bedrag</p>
                <p class="amount">€${invoice.total_amount.toFixed(2)}</p>
              </div>
              <p><strong>Factuurdatum:</strong> ${new Date(invoice.date).toLocaleDateString('nl-NL')}</p>
              <p><strong>Vervaldatum:</strong> ${new Date(invoice.due_date || invoice.date).toLocaleDateString('nl-NL')}</p>
              ${settings.bank_account ? `
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #92400e;"><strong>Betalingsgegevens:</strong></p>
                  <p style="margin: 5px 0; color: #78350f;">IBAN: ${settings.bank_account}</p>
                  <p style="margin: 5px 0; color: #78350f;">Onder vermelding van: ${invoice.invoice_number}</p>
                </div>
              ` : ''}
              <p>Indien u deze factuur al heeft voldaan, kunt u deze herinnering negeren.</p>
              <p>Bij vragen kunt u contact met ons opnemen.</p>
            </div>
            <div class="footer">
              <p>Met vriendelijke groet,<br>${settings.company_name || 'Uw Bedrijf'}</p>
              ${settings.email ? `<p>${settings.email}</p>` : ''}
              ${settings.phone ? `<p>${settings.phone}</p>` : ''}
            </div>
          </div>
        </body>
      </html>
    `;

    return sendEmail({
      to: recipientEmail,
      subject: `Betalingsherinnering - Factuur ${invoice.invoice_number}`,
      html,
    });
  } catch (error: any) {
    console.error('Error sending invoice reminder:', error);
    return {
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het versturen van de herinnering.',
    };
  }
}

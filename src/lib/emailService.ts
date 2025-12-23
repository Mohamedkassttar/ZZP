/**
 * Email Service (Mock Implementation)
 *
 * Since we don't have an SMTP server configured, this service logs emails
 * to the console instead of actually sending them. In production, replace
 * this with a real email service like SendGrid, AWS SES, or Supabase Edge Functions.
 */

interface InvoiceEmailData {
  to: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  contactName: string;
  dueDate: string;
}

interface EmailResult {
  success: boolean;
  message: string;
  sentAt: string;
}

/**
 * Mock email send function - logs to console instead of sending actual email
 */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<EmailResult> {
  const sentAt = new Date().toISOString();

  // Simulate email sending with a small delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Log to console (mock email)
  console.log('=====================================================');
  console.log('📧 MOCK EMAIL SENT');
  console.log('=====================================================');
  console.log('To:', data.to);
  console.log('Subject:', `Factuur ${data.invoiceNumber} van uw administratie`);
  console.log('-----------------------------------------------------');
  console.log('Beste', data.contactName + ',');
  console.log('');
  console.log('Hierbij ontvangt u factuur', data.invoiceNumber);
  console.log('Factuurdatum:', data.invoiceDate);
  console.log('Vervaldatum:', data.dueDate);
  console.log('Totaalbedrag: €', data.totalAmount.toFixed(2));
  console.log('');
  console.log('U kunt de factuur downloaden via uw portal.');
  console.log('');
  console.log('Met vriendelijke groet,');
  console.log('Uw Administratiekantoor');
  console.log('=====================================================');
  console.log('Sent at:', sentAt);
  console.log('=====================================================');

  return {
    success: true,
    message: `Email zou zijn verzonden naar ${data.to} (mock mode - check console)`,
    sentAt
  };
}

/**
 * Send invoice reminder email (mock)
 */
export async function sendInvoiceReminder(data: InvoiceEmailData): Promise<EmailResult> {
  const sentAt = new Date().toISOString();

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('=====================================================');
  console.log('📧 MOCK REMINDER EMAIL SENT');
  console.log('=====================================================');
  console.log('To:', data.to);
  console.log('Subject:', `Herinnering: Factuur ${data.invoiceNumber}`);
  console.log('-----------------------------------------------------');
  console.log('Beste', data.contactName + ',');
  console.log('');
  console.log('Dit is een vriendelijke herinnering voor factuur', data.invoiceNumber);
  console.log('Factuurdatum:', data.invoiceDate);
  console.log('Vervaldatum:', data.dueDate);
  console.log('Openstaand bedrag: €', data.totalAmount.toFixed(2));
  console.log('');
  console.log('Indien u deze factuur al heeft voldaan, kunt u deze');
  console.log('herinnering negeren.');
  console.log('');
  console.log('Met vriendelijke groet,');
  console.log('Uw Administratiekantoor');
  console.log('=====================================================');
  console.log('Sent at:', sentAt);
  console.log('=====================================================');

  return {
    success: true,
    message: `Herinnering zou zijn verzonden naar ${data.to} (mock mode - check console)`,
    sentAt
  };
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

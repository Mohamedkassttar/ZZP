import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import {
  parseMT940File,
  parseCSVFile,
  parseCAMT053,
  parsePDFFile,
  importBankTransactions,
  type ImportResult,
} from '../lib/bankImportService';
import { analyzeAndBookTransactions, type ImportAnalysisReport } from '../lib/bankAutomationService';
import ImportReportModal from './ImportReportModal';

interface BankImporterProps {
  bankAccountId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function BankImporter({ bankAccountId, onClose, onComplete }: BankImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [processingPDF, setProcessingPDF] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [automationReport, setAutomationReport] = useState<ImportAnalysisReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
  }

  async function extractFileContent(file: File): Promise<string> {
    try {
      const textContent = await file.text();
      return textContent;
    } catch (textError) {
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('iso-8859-1');
      return decoder.decode(arrayBuffer);
    }
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const isPDF = file.name.toLowerCase().endsWith('.pdf');

      let transactions;
      let skippedCount = 0;

      if (isPDF) {
        setProcessingPDF(true);
        transactions = await parsePDFFile(file);
        setProcessingPDF(false);
      } else {
        const fileContent = await extractFileContent(file);
        const isMT940 = file.name.toLowerCase().includes('mt940') ||
                        file.name.toLowerCase().includes('.sta') ||
                        file.name.toLowerCase().includes('.940') ||
                        fileContent.includes(':20:') ||
                        fileContent.includes(':25:');
        const isCSV = file.name.toLowerCase().endsWith('.csv');
        const isXML = file.name.toLowerCase().endsWith('.xml') ||
                      fileContent.trim().startsWith('<?xml') ||
                      fileContent.trim().startsWith('<Document');

        if (isXML) {
          const parseResult = await parseCAMT053(fileContent);
          transactions = parseResult.transactions;
          skippedCount = parseResult.skipped;
        } else if (isMT940) {
          transactions = await parseMT940File(fileContent);
        } else if (isCSV) {
          transactions = await parseCSVFile(fileContent);
        } else {
          setResult({
            newTransactions: 0,
            duplicates: 0,
            errors: ['Unsupported file format. Please upload PDF, CAMT.053 (XML), MT940 (.sta), or CSV file.'],
          });
          setImporting(false);
          return;
        }
      }

      if (transactions.length === 0) {
        setResult({
          newTransactions: 0,
          duplicates: 0,
          errors: ['No valid transactions found in file. Please check the format.'],
          skipped: skippedCount,
        });
        setImporting(false);
        return;
      }

      const importResult = await importBankTransactions(transactions, bankAccountId);
      setResult({
        ...importResult,
        skipped: skippedCount
      });

      if (importResult.newTransactions > 0) {
        onComplete();
      }
    } catch (error) {
      console.error('Import error:', error);
      setResult({
        newTransactions: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      });
    } finally {
      setImporting(false);
    }
  }

  function downloadMT940Template() {
    const template = `:20:STATEMENT
:25:NL91ABNA0417164300
:28C:00001
:60F:C230101EUR1000,00
:61:231201C100,00NTRFNONREF//REFERENCE
:86:NAME:Example Customer IBAN:NL12RABO0123456789 REMI:Payment for invoice 2023-001
:61:231202D50,00NTRFNONREF//REFERENCE
:86:NAME:Example Supplier IBAN:NL34INGB9876543210 REMI:Supplier payment
:62F:C231202EUR1050,00
:64:C231202EUR1050,00`;

    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_mt940.sta';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadCSVTemplate() {
    const template = `Date,Amount,Description,Name,Account
2023-12-01,100.00,Payment received,Example Customer,NL12RABO0123456789
2023-12-02,-50.00,Payment sent,Example Supplier,NL34INGB9876543210`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_bank_transactions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadCAMT053Template() {
    const template = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt>100.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt>
          <Dt>2023-12-01</Dt>
        </BookgDt>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Cdtr>
                <Nm>Example Customer</Nm>
              </Cdtr>
              <CdtrAcct>
                <Id>
                  <IBAN>NL12RABO0123456789</IBAN>
                </Id>
              </CdtrAcct>
            </RltdPties>
            <RmtInf>
              <Ustrd>Payment received for invoice 2023-001</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
        <AddtlNtryInf>Customer payment</AddtlNtryInf>
      </Ntry>
      <Ntry>
        <Amt>50.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt>
          <Dt>2023-12-02</Dt>
        </BookgDt>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Dbtr>
                <Nm>Example Supplier</Nm>
              </Dbtr>
              <DbtrAcct>
                <Id>
                  <IBAN>NL34INGB9876543210</IBAN>
                </Id>
              </DbtrAcct>
            </RltdPties>
            <RmtInf>
              <Ustrd>Supplier payment</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
        <AddtlNtryInf>Payment to supplier</AddtlNtryInf>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

    const blob = new Blob([template], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_camt053.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ImportReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        report={automationReport || { totalProcessed: 0, autoBooked: 0, autoBookedDirect: 0, autoBookedRelation: 0, needsReview: 0, errors: 0, details: [] }}
      />
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bank Import</h2>
              <p className="text-sm text-slate-600">Import MT940 or CSV bank statements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Supported Formats</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>CAMT.053 Files (.xml):</strong> Modern ISO 20022 XML format (recommended)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>MT940 Files (.sta, .940):</strong> Legacy SWIFT format
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>CSV Files (.csv):</strong> Comma-separated values with Date, Amount, Description columns
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={downloadCAMT053Template}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                CAMT.053 Template
              </button>
              <button
                onClick={downloadMT940Template}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                MT940 Template
              </button>
              <button
                onClick={downloadCSVTemplate}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV Template
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-2">Automatic Deduplication</h3>
            <p className="text-sm text-amber-800">
              Duplicate transactions are automatically detected and skipped. You can safely re-import the same file
              without creating duplicates.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Upload Bank Statement</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xml,.sta,.mt940,.csv,.940"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {file ? 'Change File' : 'Select File'}
            </button>
            {file && (
              <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-600">
                  Selected: <span className="font-medium text-slate-900">{file.name}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Format: {
                    file.name.toLowerCase().endsWith('.xml') ? 'CAMT.053 (XML)' :
                    file.name.toLowerCase().includes('mt940') || file.name.toLowerCase().includes('.sta') || file.name.toLowerCase().includes('.940') ? 'MT940' :
                    file.name.toLowerCase().endsWith('.csv') ? 'CSV' :
                    'Auto-detect'
                  }
                </p>
              </div>
            )}
          </div>

          {result && (
            <div className={`border rounded-lg p-4 ${
              result.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-start gap-3">
                {result.errors.length > 0 ? (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${
                    result.errors.length > 0 ? 'text-red-900' : 'text-green-900'
                  }`}>
                    {result.errors.length > 0 ? 'Import Voltooid met Fouten' : 'Import Succesvol!'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    {result.newTransactions > 0 && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-800">
                          <strong>{result.newTransactions}</strong> nieuwe transacties geboekt
                        </span>
                      </div>
                    )}
                    {result.duplicates > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-800">
                          <strong>{result.duplicates}</strong> regels overgeslagen (reeds aanwezig in administratie)
                        </span>
                      </div>
                    )}
                    {result.skipped && result.skipped > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-red-800">
                          <strong>{result.skipped}</strong> regels overgeslagen wegens parsefouten (zie console)
                        </span>
                      </div>
                    )}
                    {result.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-900 mb-1">Fouten:</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {result.errors.map((error, idx) => (
                            <p key={idx} className="text-xs text-red-700">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {result ? 'Sluiten' : 'Annuleren'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
            >
              <Upload className="w-4 h-4" />
              {processingPDF ? '⏳ Bezig met AI analyse van PDF...' : importing ? 'Importeren...' : 'Importeren'}
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

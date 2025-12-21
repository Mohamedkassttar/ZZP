import { useState, useRef } from 'react';
import { X, Download, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface ColumnMapping {
  [excelHeader: string]: string;
}

interface ImportConfig {
  moduleName: string;
  targetTable: string;
  columnMapping: ColumnMapping;
  requiredFields: string[];
  customLogic?: (row: any) => Promise<any>;
}

interface UniversalImporterProps {
  config: ImportConfig;
  onClose: () => void;
  onComplete: () => void;
}

interface PreviewRow {
  [key: string]: any;
}

export function UniversalImporter({ config, onClose, onComplete }: UniversalImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const headers = Object.keys(config.columnMapping);
    const worksheet = XLSX.utils.json_to_sheet([{}], { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    const columnWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    worksheet['!cols'] = columnWidths;

    XLSX.writeFile(workbook, `template_${config.moduleName.replace(/\s+/g, '_')}.xlsx`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const preview = jsonData.slice(0, 5) as PreviewRow[];
        setPreviewData(preview);
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Failed to parse Excel file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  }

  function validateRow(row: PreviewRow): { valid: boolean; error?: string } {
    for (const requiredField of config.requiredFields) {
      if (!row[requiredField] || String(row[requiredField]).trim() === '') {
        return { valid: false, error: `Missing required field: ${requiredField}` };
      }
    }
    return { valid: true };
  }

  function mapRowToDatabase(row: PreviewRow): any {
    const mappedRow: any = {};
    for (const [excelHeader, dbColumn] of Object.entries(config.columnMapping)) {
      const value = row[excelHeader];
      if (value !== undefined && value !== null && value !== '') {
        mappedRow[dbColumn] = value;
      }
    }
    return mappedRow;
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as PreviewRow[];

          let successCount = 0;
          let failedCount = 0;
          const errors: string[] = [];

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const rowNumber = i + 2;

            const validation = validateRow(row);
            if (!validation.valid) {
              failedCount++;
              errors.push(`Row ${rowNumber}: ${validation.error}`);
              continue;
            }

            try {
              let mappedRow = mapRowToDatabase(row);

              if (config.customLogic) {
                mappedRow = await config.customLogic(mappedRow);
              }

              const { error } = await supabase
                .from(config.targetTable)
                .insert(mappedRow);

              if (error) {
                failedCount++;
                errors.push(`Row ${rowNumber}: ${error.message}`);
              } else {
                successCount++;
              }
            } catch (error) {
              failedCount++;
              errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }

          setResult({ success: successCount, failed: failedCount, errors });

          if (successCount > 0) {
            onComplete();
          }
        } catch (error) {
          console.error('Error processing file:', error);
          setResult({ success: 0, failed: 0, errors: ['Failed to process file'] });
        } finally {
          setImporting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error importing:', error);
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bulk Import: {config.moduleName}</h2>
              <p className="text-sm text-slate-600">Import data from Excel spreadsheet</p>
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
            <h3 className="font-semibold text-blue-900 mb-2">Step 1: Download Template</h3>
            <p className="text-sm text-blue-800 mb-3">
              Download the Excel template with the correct headers for {config.moduleName}.
            </p>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">Step 2: Upload Filled Template</h3>
            <p className="text-sm text-slate-600 mb-3">
              Fill in the template and upload it here. Required fields: {config.requiredFields.join(', ')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
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
              <p className="text-sm text-slate-600 mt-2">
                Selected: <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>

          {previewData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Preview (First 5 Rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      {Object.keys(config.columnMapping).map((header) => (
                        <th key={header} className="px-3 py-2 text-left font-semibold text-slate-900">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {Object.keys(config.columnMapping).map((header) => (
                          <td key={header} className="px-3 py-2 text-slate-700">
                            {String(row[header] || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className={`border rounded-lg p-4 ${
              result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-start gap-3 mb-3">
                {result.failed === 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${
                    result.failed === 0 ? 'text-green-900' : 'text-amber-900'
                  }`}>
                    Import Complete
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-green-800">
                      <span className="font-medium">{result.success}</span> rows imported successfully
                    </p>
                    {result.failed > 0 && (
                      <p className="text-red-800">
                        <span className="font-medium">{result.failed}</span> rows failed
                      </p>
                    )}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-slate-900 mb-1">Errors:</p>
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
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing || previewData.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-slate-400"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing...' : 'Import Data'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

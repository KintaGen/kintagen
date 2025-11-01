import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ColumnMappingModal } from './ColumnMappingModal';

interface DataInputProps {
  onDataValidated: (csvString: string) => void;
  onDataCleared: () => void;
}

const REQUIRED_COLUMNS = ['dose', 'response', 'total'];

export const DataInput: React.FC<DataInputProps> = ({ onDataValidated, onDataCleared }) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  // --- REFACTORED STATE ---
  // These are now generic to handle data from either CSV or Excel that needs mapping.
  const [isMappingModalOpen, setMappingModalOpen] = useState(false);
  const [dataToMap, setDataToMap] = useState<any[]>([]);
  const [headersToMap, setHeadersToMap] = useState<string[]>([]);
  const [originalFileName, setOriginalFileName] = useState('');

  const clearData = useCallback(() => {
    setCsvText('');
    setFileName('');
    setError(null);
    setIsValid(false);
    onDataCleared();
    // Clear mapping state as well
    setDataToMap([]);
    setHeadersToMap([]);
    setOriginalFileName('');
    setMappingModalOpen(false);
  }, [onDataCleared]);

  // This function is now the final step for any validated data, regardless of origin.
  const validateAndSetData = useCallback((inputText: string, sourceFileName: string) => {
    if (!inputText.trim()) {
      clearData();
      return;
    }
    
    setCsvText(inputText);
    setError(null);
    setIsValid(false);
    setFileName('');

    Papa.parse(inputText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV Parsing Error: ${results.errors[0].message}`);
          onDataCleared();
          return;
        }
        
        const headers = results.meta.fields;
        if (!headers) {
          setError('Could not detect headers in CSV data.');
          onDataCleared();
          return;
        }

        const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
          setError(`Validation failed. Missing required columns after mapping: ${missingColumns.join(', ')}`);
          onDataCleared();
          return;
        }

        setError(null);
        setIsValid(true);
        setFileName(sourceFileName);
        onDataValidated(inputText);
      },
    });
  }, [onDataValidated, onDataCleared, clearData]);

  // --- NEW CSV HANDLER ---
  // This function decides whether to validate directly or open the mapping modal.
  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields;
                if (!headers) {
                    setError("Could not read headers from the CSV file.");
                    return;
                }

                const hasAllRequiredCols = REQUIRED_COLUMNS.every(col => headers.includes(col));
                
                if (hasAllRequiredCols) {
                    // If CSV is already perfect, validate and set it immediately.
                    validateAndSetData(text, file.name);
                } else {
                    // Otherwise, open the mapping modal for the user.
                    setDataToMap(results.data);
                    setHeadersToMap(headers);
                    setOriginalFileName(file.name);
                    setMappingModalOpen(true);
                }
            }
        });
    };
    reader.readAsText(file);
  };

  const handleExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const headers: string[] = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]).filter(Boolean);
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!headers || headers.length === 0 || !jsonData || jsonData.length === 0) {
          setError("Could not read data from the Excel file. Please ensure the first sheet is not empty and has a header row.");
          return;
        }

        // Use the generic state setters
        setDataToMap(jsonData);
        setHeadersToMap(headers);
        setOriginalFileName(file.name);
        setMappingModalOpen(true);
      } catch (err) {
        console.error("Error reading Excel file:", err);
        setError("Error reading Excel file. Please ensure it's a valid .xls or .xlsx file.");
        onDataCleared();
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv')) {
        // Use the new, smarter CSV handler
        handleCsvFile(file);
      } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        handleExcelFile(file);
      } else {
        setError("Unsupported file type. Please upload a .csv, .xls, or .xlsx file.");
      }
    }
    event.target.value = '';
  };

  // --- GENERIC CONFIRMATION HANDLER ---
  // This now works with `dataToMap`, which can come from either file type.
  const handleConfirmMapping = (mapping: Record<string, string>) => {
    const transformedData = dataToMap.map(row => {
      const newRow: Record<string, any> = {};
      for (const requiredCol of REQUIRED_COLUMNS) {
        const sourceHeader = mapping[requiredCol];
        newRow[requiredCol] = row[sourceHeader];
      }
      return newRow;
    });

    const newCsvString = Papa.unparse(transformedData);
    // Now pass the perfectly formatted CSV string to the final validation step.
    validateAndSetData(newCsvString, originalFileName);
    
    // Cleanup
    setMappingModalOpen(false);
    setDataToMap([]);
    setHeadersToMap([]);
    setOriginalFileName('');
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCsvText(event.target.value);
  };
  
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    setTimeout(() => {
      validateAndSetData(event.currentTarget.value, 'Pasted Data');
    }, 0);
  }

  return (
    <div className="bg-gray-700/50 p-4 rounded-lg relative">
      <ColumnMappingModal
          isOpen={isMappingModalOpen}
          requiredColumns={REQUIRED_COLUMNS}
          uploadedHeaders={headersToMap} // Now uses generic headersToMap
          onConfirm={handleConfirmMapping}
          onCancel={() => setMappingModalOpen(false)}
      />

      {(isValid || csvText) && (
          <button 
              onClick={clearData}
              className="absolute top-3 right-3 text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200"
          >
              Clear
          </button>
      )}

      <h4 className="text-gray-200 font-semibold mb-3">Provide Data</h4>
      
      <div className="mb-3">
        <label htmlFor="csv-file-input" className="text-sm text-gray-300">Upload CSV or Excel File:</label><br/>
        <input 
            id="csv-file-input" 
            type="file" 
            accept=".csv, text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
            onChange={handleFileChange} 
            className="mt-1 text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-gray-200 hover:file:bg-gray-500"
        />
      </div>

      <div className="text-center my-2 text-gray-400 text-sm">OR</div>

      <div>
        <label htmlFor="csv-text-input" className="text-sm text-gray-300">Paste CSV Data:</label>
        <textarea
          id="csv-text-input"
          value={csvText}
          onChange={handleTextChange}
          onPaste={handlePaste}
          onBlur={() => validateAndSetData(csvText, 'Pasted Data')}
          placeholder="dose,response,total&#10;0.1,1,50&#10;0.5,5,50"
          rows={5}
          className="w-full mt-1 p-2 bg-gray-900/70 border border-gray-600 rounded-md font-mono text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mt-3 min-h-[20px] text-sm">
        {error && <div className="text-red-400">{error}</div>}
        {isValid && (
          <div className="text-green-400">
            ✓ Using valid custom data from: {fileName}
          </div>
        )}
        {!isValid && !error && (
          <div className="text-gray-400">
            ℹ️ No custom data provided. Analysis will run using the built-in sample dataset.
          </div>
        )}
      </div>
    </div>
  );
};
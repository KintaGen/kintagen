// src/components/ld50/DataInput.tsx

import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';

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

  const clearData = useCallback(() => {
    setCsvText('');
    setFileName('');
    setError(null);
    setIsValid(false);
    onDataCleared();
  }, [onDataCleared]);

  const validateAndSetData = useCallback((inputText: string, sourceFileName: string) => {
    if (!inputText.trim()) {
      clearData();
      return;
    }
    
    // This makes uploaded or pasted text appear right away, before validation finishes.
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
          setError(`Missing required columns: ${missingColumns.join(', ')}`);
          onDataCleared();
          return;
        }

        // On successful validation, set the file name and notify the parent
        setError(null);
        setIsValid(true);
        setFileName(sourceFileName);
        onDataValidated(inputText);
      },
    });
  }, [onDataValidated, onDataCleared, clearData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // This function will now handle setting the text in the textarea
        validateAndSetData(text, file.name);
      };
      reader.readAsText(file);
    }
    event.target.value = ''; 
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCsvText(event.target.value);
  };
  
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    setTimeout(() => {
      validateAndSetData(event.currentTarget.value, 'Pasted Data');
    }, 0);
  }

  // I've switched to Tailwind CSS classes to match your app's theme
  return (
    <div className="bg-gray-700/50 p-4 rounded-lg relative">
        {(isValid || csvText) && (
            <button 
                onClick={clearData}
                className="absolute top-3 right-3 text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200"
            >
                Clear
            </button>
        )}

      <h4 className="text-gray-200 font-semibold mb-3">Provide Custom Data (Optional)</h4>
      
      <div className="mb-3">
        <label htmlFor="csv-file-input" className="text-sm text-gray-300">Upload CSV File:</label><br/>
        <input 
            id="csv-file-input" 
            type="file" 
            accept=".csv, text/csv" 
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
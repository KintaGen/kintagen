import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';

// ... (interfaces remain the same)

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
    onDataCleared(); // Notify parent that data is cleared
  }, [onDataCleared]);

  const validateAndSetData = useCallback((inputText: string, sourceFileName: string) => {
    // If the input is empty or just whitespace, clear everything.
    if (!inputText.trim()) {
      clearData();
      return;
    }

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
          onDataCleared(); // Ensure parent state is cleared on error
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

        setError(null);
        setIsValid(true);
        setFileName(sourceFileName);
        setCsvText(inputText);
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

  return (
    <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px', position: 'relative' }}>
        {/* NEW: Clear button */}
        {(isValid || csvText) && (
            <button 
                onClick={clearData}
                style={{ position: 'absolute', top: '8px', right: '8px', cursor: 'pointer' }}
            >
                Clear
            </button>
        )}

      <h4>Provide Custom Data (Optional)</h4>
      
      <div style={{ marginBottom: '12px' }}>
        <label htmlFor="csv-file-input">Upload CSV File:</label><br/>
        <input id="csv-file-input" type="file" accept=".csv, text/csv" onChange={handleFileChange} />
      </div>

      <div style={{ textAlign: 'center', margin: '8px 0', color: '#888' }}>OR</div>

      <div>
        <label htmlFor="csv-text-input">Paste CSV Data:</label>
        <textarea
          id="csv-text-input"
          value={csvText}
          onChange={handleTextChange}
          onPaste={handlePaste}
          onBlur={() => validateAndSetData(csvText, 'Pasted Data')}
          placeholder="dose,response,total&#10;0.1,1,50&#10;0.5,5,50"
          rows={5}
          style={{ width: '100%', fontFamily: 'monospace', marginTop: '4px' }}
        />
      </div>

      {/* NEW: Improved Status Messaging */}
      <div style={{ marginTop: '12px', minHeight: '20px' }}>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {isValid && (
          <div style={{ color: 'green' }}>
            ✓ Using valid custom data from: {fileName}
          </div>
        )}
        {!isValid && !error && (
          <div style={{ color: '#555' }}>
            ℹ️ No custom data provided. Analysis will run using the built-in sample dataset.
          </div>
        )}
      </div>
    </div>
  );
};
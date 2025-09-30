// src/components/ld50/ColumnMappingModal.tsx

import React from 'react';

interface ColumnMappingModalProps {
  isOpen: boolean;
  requiredColumns: string[];
  uploadedHeaders: string[];
  onConfirm: (mapping: Record<string, string>) => void;
  onCancel: () => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  requiredColumns,
  uploadedHeaders,
  onConfirm,
  onCancel,
}) => {
  const [mapping, setMapping] = React.useState<Record<string, string>>({});

  const handleSelectChange = (requiredCol: string, selectedHeader: string) => {
    setMapping(prev => ({ ...prev, [requiredCol]: selectedHeader }));
  };

  const handleSubmit = () => {
    // Basic validation: ensure all required columns are mapped
    if (requiredColumns.every(col => mapping[col])) {
      onConfirm(mapping);
    } else {
      alert('Please map all required columns.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4">Map Your Columns</h3>
        <p className="text-gray-400 mb-6">
          Please match your spreadsheet's columns to the required data fields.
        </p>

        <div className="space-y-4">
          {requiredColumns.map(reqCol => (
            <div key={reqCol} className="grid grid-cols-2 items-center gap-4">
              <label htmlFor={`map-${reqCol}`} className="text-gray-300 font-semibold text-right">
                {reqCol}:
              </label>
              <select
                id={`map-${reqCol}`}
                onChange={(e) => handleSelectChange(reqCol, e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded-md p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a column...</option>
                {uploadedHeaders.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-gray-200">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold">
            Confirm and Import
          </button>
        </div>
      </div>
    </div>
  );
};
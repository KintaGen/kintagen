// components/nmr/VarianDataInput.tsx
import React from 'react';

interface VarianDataInputProps {
  // The component will now pass up a single File object, not a FileList
  onFileSelected: (file: File | null) => void;
  // We'll display the name of the selected file
  selectedFileName: string;
}

export const VarianDataInput: React.FC<VarianDataInputProps> = ({ onFileSelected, selectedFileName }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Get the first file from the list, or null if none is selected
    const file = event.target.files ? event.target.files[0] : null;
    onFileSelected(file);
  };

  return (
    <div className="bg-gray-700/50 p-4 rounded-lg">
      <h4 className="text-gray-200 font-semibold mb-3">Provide Varian Data</h4>
      
      <div className="mb-3">
        {/* Changed the label to reflect the new input type */}
        <label htmlFor="varian-zip-input" className="text-sm text-gray-300">Upload Varian ZIP File:</label><br/>
        <input 
          id="varian-zip-input" 
          type="file"
          // Removed folder selection attributes
          // Added accept attribute to filter for ZIP files
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileChange} 
          className="mt-1 text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-gray-200 hover:file:bg-gray-500"
        />
      </div>

      <div className="mt-3 min-h-[20px] text-sm text-green-400">
        {/* Display the file name if one is selected */}
        {selectedFileName && (
          `✓ File selected: ${selectedFileName}`
        )}
      </div>
    </div>
  );
};
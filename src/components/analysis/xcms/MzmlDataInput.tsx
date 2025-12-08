import React, { useState } from 'react';
import { DocumentArrowUpIcon, QuestionMarkCircleIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

interface MzmlDataInputProps {
  onFilesSelected: (files: File[]) => void;
  selectedFileNames: string[];
}

export const MzmlDataInput: React.FC<MzmlDataInputProps> = ({ onFilesSelected, selectedFileNames }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // Convert FileList to Array
      const fileList = Array.from(event.target.files);
      onFilesSelected(fileList);
    }
  };
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  return (
    <div className="bg-gray-700/50 p-4 rounded-lg flex flex-col justify-between">
      <div>
        <div className="relative flex items-center justify-center gap-x-2 mb-3">
          <h4 className="text-gray-200 font-semibold">2. Upload Data</h4>
          <div 
            onMouseEnter={() => setIsTooltipVisible(true)} 
            onMouseLeave={() => setIsTooltipVisible(false)}
            className="cursor-pointer"
          >
            <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400 hover:text-gray-200" />
            {isTooltipVisible && (
                <div className="absolute bottom-full mb-2 w-72 p-3 bg-gray-900 text-sm text-gray-200 rounded-lg shadow-lg border border-gray-600 z-10">
                Most instrument vendors produce proprietary data files.
                <br /><br />
                Use <a href="https://proteowizard.sourceforge.io/download.html" target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold hover:underline">ProteoWizard</a> to convert data to .mzML.
                <br /><br />
                <strong>Note:</strong> You can upload 2 files to perform retention time alignment.
                </div>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-400 mb-4 text-center">
          Select 1 or 2 GC-MS data files (.mzML).
        </p>
      </div>
      
      <div className="flex flex-col items-center">
        <label
          htmlFor="mzml-upload"
          className="w-full max-w-xs cursor-pointer bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-md p-4 text-center transition-colors"
        >
          {selectedFileNames.length > 1 ? (
             <DocumentDuplicateIcon className="h-8 w-8 mx-auto text-blue-400 mb-2" />
          ) : (
             <DocumentArrowUpIcon className="h-8 w-8 mx-auto text-gray-500 mb-2" />
          )}
          
          <span className="text-blue-400 font-semibold">
            {selectedFileNames.length > 0 ? 'Change Selection' : 'Select .mzML Files'}
          </span>
          <input
            id="mzml-upload"
            type="file"
            className="hidden"
            accept=".mzml, .mzML"
            multiple // Allow multiple files
            onChange={handleFileChange}
          />
        </label>
        
        {selectedFileNames.length > 0 && (
          <div className="mt-3 text-center w-full max-w-xs">
            <p className="text-sm text-gray-300 font-medium mb-1">Selected ({selectedFileNames.length}):</p>
            <ul className="text-xs text-gray-400 space-y-1">
                {selectedFileNames.map((name, idx) => (
                    <li key={idx} className="truncate">{name}</li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
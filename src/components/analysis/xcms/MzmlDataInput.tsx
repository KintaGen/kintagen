// components/analysis/gcms/MzmlDataInput.tsx
import React,{useState} from 'react';
import { DocumentArrowUpIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface MzmlDataInputProps {
  onFileSelected: (file: File | null) => void;
  selectedFileName: string;
}

export const MzmlDataInput: React.FC<MzmlDataInputProps> = ({ onFileSelected, selectedFileName }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onFileSelected(file || null);
  };
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  return (
<div className="bg-gray-700/50 p-4 rounded-lg flex flex-col justify-between">
  <div>
    {/* --- CORRECTED & ENHANCED HEADER --- */}
    <div className="relative flex items-center justify-center gap-x-2 mb-3">
      <h4 className="text-gray-200 font-semibold">2. Upload Data</h4>
      <div 
        onMouseEnter={() => setIsTooltipVisible(true)} 
        onMouseLeave={() => setIsTooltipVisible(false)}
        className="cursor-pointer"
      >
        <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400 hover:text-gray-200" />
        {/* --- TOOLTIP --- */}
        {isTooltipVisible && (
            <div className="absolute bottom-full mb-2 w-72 p-3 bg-gray-900 text-sm text-gray-200 rounded-lg shadow-lg border border-gray-600 z-10">
            Most instrument vendors (Agilent, Thermo, etc.) produce proprietary data files.
            <br /><br />
            Use the free{' '}
            <a 
                href="https://proteowizard.sourceforge.io/download.html" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 font-semibold hover:underline"
            >
                ProteoWizard
            </a> 
            {' '}tool to convert your raw data into the open-standard .mzML format.
            </div>
        )}
      </div>


    </div>
    
    <p className="text-sm text-gray-400 mb-4 text-center">
      Select a single GC-MS data file in the mzML format.
    </p>
  </div>
  
  <div className="flex flex-col items-center">
    <label
      htmlFor="mzml-upload"
      className="w-full max-w-xs cursor-pointer bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-md p-4 text-center transition-colors"
    >
      <DocumentArrowUpIcon className="h-8 w-8 mx-auto text-gray-500 mb-2" />
      <span className="text-blue-400 font-semibold">Select .mzML File</span>
      <input
        id="mzml-upload"
        type="file"
        className="hidden"
        accept=".mzml, .mzML"
        onChange={handleFileChange}
      />
    </label>
    {selectedFileName && (
      <p className="text-sm text-gray-300 mt-3 text-center truncate w-full max-w-xs">
        Selected: <span className="font-medium text-white">{selectedFileName}</span>
      </p>
    )}
  </div>
</div>
  );
};
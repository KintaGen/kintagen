// src/pages/DataIngestionPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';

// Define a type for the data we expect from the /cids endpoint
interface CidInfo {
  filename: string;
  cid: string;
  uploaded_at: string;
}

const DataIngestionPage: React.FC = () => {
  // --- STATE FROM LOGIC COMPONENT ---
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [proofSetID, setProofSetID] = useState<string>('282'); // Default or load from config
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [cids, setCids] = useState<CidInfo[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);


  // --- STATE FROM UI COMPONENT ---
  const [isDragging, setIsDragging] = useState(false);
  // Ref to access the hidden file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FUNCTIONS FROM LOGIC COMPONENT ---

  // 1. Function to fetch the list of CIDs from the API
  const fetchCIDs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = filter ? `?filename=${encodeURIComponent(filter)}` : '';
      // IMPORTANT: Replace with your actual API URL
      const resp = await fetch(`https://salty-eyes-visit.loca.lt/api/cids${params}`);
      if (!resp.ok) throw new Error('Failed to fetch CID list');
      const json: CidInfo[] = await resp.json();
      setCids(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Function to handle the actual file upload
  const handleUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append('serviceUrl', 'https://yablu.net');
      form.append('serviceName', 'pdp-ricardo');
      form.append('proofSetID', proofSetID);
      form.append('file', file);
      console.log(form)
      alert("form")
      // IMPORTANT: Replace with your actual API URL
      const resp = await fetch('https://salty-eyes-visit.loca.lt/api/proofset/upload-and-add-root', {
        method: 'POST',
        body: form,
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Upload failed');

      setUploadResult(json);
      setFileToUpload(null); // Clear the file after successful upload
      fetchCIDs(); // Refresh the list after a successful upload
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- EFFECTS TO CONNECT LOGIC TO UI ---

  // Automatically fetch CIDs on component mount and when the filter changes
  useEffect(() => {
    fetchCIDs();
  }, [filter]);

  // Automatically trigger the upload when a file is selected
  useEffect(() => {
    if (fileToUpload) {
      handleUpload(fileToUpload);
    }
  }, [fileToUpload]);


  // --- UI EVENT HANDLERS ---

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFileToUpload(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToUpload(e.target.files[0]);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Ingest Data into Knowledge Base</h1>
      <p className="text-gray-400 mb-8">
        Upload research papers (PDF), chemical analysis data (mzML, jdx), or other documents. The AI will process them and make them searchable.
      </p>

      {/* --- Uploader Component (Now Fully Functional) --- */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors duration-300 relative cursor-pointer ${
          isDragging ? 'border-blue-500 bg-gray-800' : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()} // Trigger file input on click
      >
        <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-white">
          {isLoading ? 'Uploading...' : 'Drag and drop files to upload'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">or click to select files</p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* --- Error and Result Display --- */}
      {error && <div className="mt-4 bg-red-900 border border-red-700 text-red-200 p-3 rounded-lg">{`Error: ${error}`}</div>}
      {uploadResult && <div className="mt-4 bg-green-900 border border-green-700 text-green-200 p-3 rounded-lg">Success! {JSON.stringify(uploadResult)}</div>}

      {/* --- Ingestion History (Now with Filter) --- */}
      <div className="mt-10">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Ingestion History</h2>
            <div className="relative">
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter by filename..."
                    className="bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow">
          <ul className="divide-y divide-gray-700">
            {cids.length > 0 ? (
              cids.map((cid) => (
                <li key={cid.cid} className="flex items-center justify-between p-4">
                  <div className="flex items-center overflow-hidden">
                    <DocumentTextIcon className="h-6 w-6 text-gray-400 mr-4 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <p className="font-medium text-white truncate" title={cid.filename}>{cid.filename}</p>
                      <p className="text-sm text-gray-500 truncate" title={cid.cid}>CID: {cid.cid}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 text-right flex-shrink-0 ml-4">
                    {new Date(cid.uploaded_at).toLocaleString()}
                  </div>
                </li>
              ))
            ) : (
                <li className="p-4 text-center text-gray-500">
                    {isLoading ? 'Loading history...' : 'No files found.'}
                </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataIngestionPage;
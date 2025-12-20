import React, { useState, useEffect } from 'react';
import { 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  TagIcon
} from '@heroicons/react/24/solid';
import JSZip from 'jszip';
import { ProvenanceAndDownload } from '../ProvenanceAndDownload';
import { generateDataHash } from '../../../utils/hash';
import { type DisplayJob } from '../../../types';

type ResultsDisplayJob = Pick<DisplayJob, 'projectId' | 'state' | 'returnvalue' | 'logData' | 'inputDataHash'>;

interface CustomObservationDisplayProps {
  job: ResultsDisplayJob;
  isLoading?: boolean;
}

export const CustomObservationDisplay: React.FC<CustomObservationDisplayProps> = ({ job, isLoading }) => {
  // State for display data
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [observationData, setObservationData] = useState<any | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);
  
  // Internal state
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetchingFromIPFS, setIsFetchingFromIPFS] = useState(false);

  useEffect(() => {
    // Reset state on new job
    setImageUrl(null);
    setObservationData(null);
    setMetadata(null);
    setFetchError(null);
    setIsFetchingFromIPFS(false);

    // --- Data Loading Logic ---
    
    // CASE 1: Fetching from IPFS (Logged Job)
    if (job.state === 'logged' && job.logData?.ipfsHash) {
      const fetchAndParseZip = async () => {
        setIsFetchingFromIPFS(true);
        setFetchError(null);
        try {
          // 1. Fetch Zip
          const response = await fetch(`https://scarlet-additional-rabbit-987.mypinata.cloud/ipfs/${job.logData.ipfsHash}`);
          if (!response.ok) throw new Error(`Failed to fetch from IPFS (status: ${response.status})`);
          
          const zipBlob = await response.blob();
          const zip = await JSZip.loadAsync(zipBlob);
          
          // 2. Extract Metadata
          const metadataFile = zip.file("metadata.json");
          if (metadataFile) {
            setMetadata(JSON.parse(await metadataFile.async("string")));
          } else {
            setMetadata({ input_data_hash_sha256: job.inputDataHash || 'N/A' });
          }
          
          // 3. Extract Observation JSON
          const jsonFile = zip.file("observation.json");
          if (!jsonFile) throw new Error("'observation.json' not found in artifact.");
          const jsonData = JSON.parse(await jsonFile.async("string"));
          setObservationData(jsonData);
          
          // 4. Extract Image
          // We look for the filename specified in the JSON, or fallback to searching the zip
          let imgFile = zip.file(jsonData.image_filename);
          
          // Fallback: If filename in JSON doesn't match zip content, find first image file
          if (!imgFile) {
            const files = Object.keys(zip.files);
            const imageKey = files.find(f => f.match(/\.(jpg|jpeg|png|webp)$/i));
            if (imageKey) imgFile = zip.file(imageKey);
          }

          if (imgFile) {
            const imgBlob = await imgFile.async("blob");
            setImageUrl(URL.createObjectURL(imgBlob));
          } else {
            throw new Error("Image file not found in artifact.");
          }

        } catch (error: any) {
          console.error("Error fetching observation:", error);
          setFetchError(error.message);
        } finally {
          setIsFetchingFromIPFS(false);
        }
      };
      fetchAndParseZip();
    }
  }, [job]);

  // Cleanup object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // --- Download Handler ---
  const handleDownload = async () => {
    if (!observationData || !imageUrl) return;

    try {
      const zip = new JSZip();
      
      // Re-create the artifact locally
      const jsonString = JSON.stringify(observationData, null, 2);
      
      // Fetch image blob from local object URL
      const imgRes = await fetch(imageUrl);
      const imgBlob = await imgRes.blob();
      const imgBuffer = await imgBlob.arrayBuffer();
      
      // Calculate hashes (to prove match)
      const jsonHash = await generateDataHash(jsonString);
      const imgHash = await generateDataHash(imgBuffer);

      // Reconstruct metadata
      const fullMetadata = {
        schema_version: "1.0.0",
        analysis_agent: "KintaGen Field Observer v1.0 (Download)",
        timestamp_utc: new Date().toISOString(),
        input_data_hash_sha256: metadata?.input_data_hash_sha256 || imgHash,
        outputs: [
          { filename: "observation.json", hash_sha256: jsonHash },
          { filename: observationData.image_filename || "photo.jpg", hash_sha256: imgHash }
        ]
      };

      zip.file("metadata.json", JSON.stringify(fullMetadata, null, 2));
      zip.file("observation.json", jsonString);
      zip.file(observationData.image_filename || "photo.jpg", imgBlob);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `KintaGen_Observation_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // --- RENDER STATES ---

  if (isLoading || isFetchingFromIPFS) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center my-8">
        <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-green-400 mb-4" />
        <p className="text-lg text-gray-300">Fetching observation data from IPFS...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
        <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg my-8 flex items-start space-x-3">
            <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
                <h3 className="font-bold">Error loading observation</h3>
                <p className="text-sm">{fetchError}</p>
            </div>
        </div>
    );
  }

  if (!observationData || !imageUrl) return null;

  // --- SUCCESS RENDER ---
  return (
    <div className="space-y-8 my-8 animate-fadeIn">
      
      {/* 1. Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Image */}
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 flex items-center justify-center bg-gray-900/50">
          <img 
            src={imageUrl} 
            alt="Observation" 
            className="max-h-[500px] w-auto rounded-lg shadow-md object-contain" 
          />
        </div>

        {/* Right: Data */}
        <div className="space-y-6">
          
          {/* Header Info */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-2">{observationData.title}</h2>
            <div className="flex items-center text-gray-400 text-sm mb-4">
              <CalendarDaysIcon className="h-4 w-4 mr-1" />
              {new Date(observationData.timestamp).toLocaleDateString()} 
              <span className="mx-2">•</span>
              {new Date(observationData.timestamp).toLocaleTimeString()}
            </div>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {observationData.description}
            </p>
          </div>

          {/* Attributes List */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <TagIcon className="h-5 w-5 mr-2 text-green-500" />
              Recorded Attributes
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {observationData.attributes?.map((attr: any, idx: number) => (
                <div key={idx} className="bg-gray-900/50 p-3 rounded border border-gray-600 flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{attr.trait_type}</span>
                  <span className="text-white font-medium">{attr.value}</span>
                </div>
              ))}
              
              {(!observationData.attributes || observationData.attributes.length === 0) && (
                <p className="text-gray-500 italic text-sm">No specific attributes recorded.</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 2. Provenance & Download Footer */}
      <ProvenanceAndDownload 
        job={job}
        metadata={metadata}
        onDownload={handleDownload}
      />
    </div>
  );
};
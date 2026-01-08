import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { XCircleIcon, PlusIcon, TrashIcon, PhotoIcon, ArrowUpOnSquareIcon } from '@heroicons/react/24/solid';
import JSZip from 'jszip';

// Flow & Web3
import { useFlowCurrentUser, useFlowConfig, TransactionDialog, useFlowMutate } from '@onflow/react-sdk';
import { useOwnedNftProjects } from '../flow/kintagen-nft';
import { useLighthouse } from '../hooks/useLighthouse';
import { getAddToLogTransaction } from '../flow/cadence';
import { generateDataHash } from '../utils/hash';

// Components
import { AnalysisJobsList } from '../components/analysis/AnalysisJobsList';
import { type DisplayJob } from '../types';
import { CustomObservationDisplay } from '../components/analysis/custom/CustomObservationDisplay'; 
import { MapInput } from '../components/MapInput'; // 1. IMPORT THE MAP COMPONENT

export const DEMO_PROJECT_ID = 'demo-project';

const CustomObservationPage: React.FC = () => {
  usePageTitle('Field Observations - KintaGen');

  // --- State ---
  const { projects, isLoading: isLoadingProjects, refetchProjects } = useOwnedNftProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  
  // Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null); // 2. ADD STATE FOR LOCATION
  
  // Dynamic Attributes State
  const [attributes, setAttributes] = useState<{ trait_type: string; value: string }[]>([
    { trait_type: 'Growth Stage', value: 'Seedling' },
    { trait_type: 'Height', value: '' },
    { trait_type: 'Condition', value: 'Healthy' }
  ]);
  const [viewedJob, setViewedJob] = useState<DisplayJob | null>(null);

  // Transaction State
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, isLoading: isUploading, error: uploadError } = useLighthouse();
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();
  
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- Helpers ---
  
  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addAttribute = () => setAttributes([...attributes, { trait_type: '', value: '' }]);
  
  const removeAttribute = (index: number) => {
    const newAttrs = [...attributes];
    newAttrs.splice(index, 1);
    setAttributes(newAttrs);
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', val: string) => {
    const newAttrs = [...attributes];
    newAttrs[index][field] = val;
    setAttributes(newAttrs);
  };

  // --- Submission Logic ---

  const handleLogObservation = async () => {
    if (!user?.addr) { setPageError("Please connect your wallet first."); return; }
    if (!selectedProjectId || selectedProjectId === DEMO_PROJECT_ID) { setPageError("Please select a valid owned project."); return; }
    if (!imageFile) { setPageError("Please upload an image."); return; }
    if (!description) { setPageError("Please enter a description."); return; }

    setPageError(null);
    setViewedJob(null);

    try {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project?.nft_id) throw new Error("Project NFT ID not found.");

      // 1. Prepare Data & Hashes
      const imageBuffer = await imageFile.arrayBuffer();
      const imageHash = await generateDataHash(imageBuffer);
      
      const observationData = {
        title: `Observation: ${attributes.find(a => a.trait_type === 'Growth Stage')?.value || 'General'}`,
        description: description,
        timestamp: new Date().toISOString(),
        image_filename: imageFile.name,
        attributes: attributes.filter(a => a.trait_type && a.value),
      };

      const jsonString = JSON.stringify(observationData, null, 2);
      const jsonHash = await generateDataHash(jsonString);

      // --- 3. CREATE LOCATION ARTIFACT (if location was selected) ---
      let locationJsonString = null;
      if (selectedLocation) {
        const locationData = {
          type: 'Circle',
          center: {
              latitude: selectedLocation.lat,
              longitude: selectedLocation.lng
          },
          radius_meters: selectedLocation.radius
        };
        locationJsonString = JSON.stringify(locationData, null, 2);
      }
      
      // 2. Create Zip Artifact
      const zip = new JSZip();
      
      const outputs = [
        { filename: "observation.json", hash_sha256: jsonHash },
        { filename: imageFile.name, hash_sha256: imageHash }
      ];
      
      // --- 4. ADD LOCATION TO ZIP AND METADATA (if it exists) ---
      if (locationJsonString) {
        const locationHash = await generateDataHash(locationJsonString);
        outputs.push({ filename: "location.json", hash_sha256: locationHash });
        zip.file("location.json", locationJsonString);
      }
      
      const metadata = {
        schema_version: "1.0.0",
        analysis_agent: "KintaGen Field Observer v1.0",
        timestamp_utc: new Date().toISOString(),
        input_data_hash_sha256: imageHash, 
        outputs: outputs
      };
      
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));
      zip.file("observation.json", jsonString);
      zip.file(imageFile.name, imageFile);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], `obs_${imageHash.substring(0,8)}.zip`);

      // 3. Upload to IPFS
      const cid = await uploadFile(zipFile);
      if (!cid) throw new Error(uploadError || "Failed to upload to IPFS.");

      // 4. Execute Flow Transaction
      const addresses = { KintaGenNFT: flowConfig.addresses["KintaGenNFT"], NonFungibleToken: "", ViewResolver: "", MetadataViews: "" };
      const cadence = getAddToLogTransaction(addresses);
      
      const logLabel = `Field Obs: ${new Date().toLocaleDateString()}`;
      const logDesc = `Manual observation. Img Hash: ${imageHash}`;

      await executeTransaction({ 
        cadence, 
        args: (arg, t) => [
          arg(project.nft_id, t.UInt64), 
          arg("KintaGen Field Observer", t.String), 
          arg(logLabel, t.String), 
          arg(logDesc, t.String), 
          arg(cid, t.String)
        ], 
        limit: 9999 
      });

    } catch (e: any) {
      setPageError(e.message);
    }
  };

  // --- Parsing Existing Logs for Display ---
  const displayLogs = useMemo((): DisplayJob[] => {
    if (!selectedProjectId || selectedProjectId === DEMO_PROJECT_ID) return [];
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return [];

    return (project.story || [])
      .filter(step => step.title.startsWith("Field Obs") || step.agent.includes("Observer"))
      .map((step, index) => ({
        id: `log-${project.id}-${index}`,
        label: step.title,
        projectId: project.id,
        state: 'logged',
        logData: step,
        inputDataHash: step.description.includes('Hash: ') ? step.description.split('Hash: ')[1] : 'Manual'
      }))
      .reverse();
  }, [selectedProjectId, projects]);

  // --- Transaction Monitoring ---
  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId as string);
      setIsDialogOpen(true);
      // Reset Form on success
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setSelectedLocation(null); // 5. RESET LOCATION STATE
      setAttributes([{ trait_type: 'Growth Stage', value: 'Seedling' }, { trait_type: 'Height', value: '' }, { trait_type: 'Condition', value: 'Healthy' }]);
    }
    
    if (isTxError && txError) {
        const errorMessage = txError instanceof Error ? txError.message : typeof txError === 'string' ? txError : JSON.stringify(txError);
        const safeMsg = errorMessage || "Unknown error";
        setPageError(`Transaction failed: ${safeMsg.includes("Declined") ? "Cancelled by user" : safeMsg}`);
    }
  }, [isTxSuccess, isTxError, txId, txError]);

  const isProcessing = isUploading || isTxPending;

  return (
    <>
      <Helmet>
        <title>Field Observations - KintaGen</title>
      </Helmet>
      
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-2">Field Observations</h1>
        <p className="text-gray-400 mb-8">Upload photos, custom attributes, and location data to your project's on-chain history.</p>

        {/* --- 1. UPLOAD FORM --- */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8 shadow-xl">
          
          {/* Project Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">Select Project to Update</label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value)
                setViewedJob(null);
              }}
              disabled={isLoadingProjects || isProcessing}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-md p-3 focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select a Project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} (#{p.nft_id})</option>
              ))}
            </select>
          </div>

          {selectedProjectId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
              
              {/* Left Column: Image, Description, and Map */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Observation Photo</label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:bg-gray-750 transition-colors bg-gray-900/50">
                    {imagePreview ? (
                      <div className="relative inline-block">
                        <img src={imagePreview} alt="Preview" className="max-h-64 rounded shadow-md object-contain mx-auto" />
                        <button 
                          onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white shadow-sm hover:bg-red-700"
                        >
                          <XCircleIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="py-8">
                        <PhotoIcon className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                        <button 
                          type="button"
                          onClick={handleUploadButtonClick}
                          className="cursor-pointer rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-600 inline-flex items-center"
                        >
                          <ArrowUpOnSquareIcon className="h-5 w-5 mr-2" />
                          <span>Select Photo</span>
                        </button>
                        <input 
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageChange}
                          className="hidden"
                          accept="image/*"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the plant's progress, environmental conditions, or specific observations..."
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-md p-3 h-32 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                
                {/* --- 6. RENDER THE MAP INPUT COMPONENT --- */}
                <MapInput onRegionSelect={setSelectedLocation} />
              </div>

              {/* Right Column: Attributes & Submit Button */}
              <div className="flex flex-col">
                 <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-400">Custom Attributes</label>
                  <button onClick={addAttribute} className="text-xs flex items-center text-green-400 hover:text-green-300">
                    <PlusIcon className="h-4 w-4 mr-1" /> Add Row
                  </button>
                </div>
                
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 flex-grow space-y-3 overflow-y-auto max-h-[500px]">
                  {attributes.map((attr, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input 
                        type="text" placeholder="Trait (e.g. pH)"
                        value={attr.trait_type}
                        onChange={(e) => updateAttribute(idx, 'trait_type', e.target.value)}
                        className="w-1/3 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                      />
                      <span className="text-gray-500">:</span>
                      <input 
                        type="text" placeholder="Value (e.g. 6.5)"
                        value={attr.value}
                        onChange={(e) => updateAttribute(idx, 'value', e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                      />
                      <button onClick={() => removeAttribute(idx)} className="text-gray-500 hover:text-red-400 p-1">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                  {attributes.length === 0 && <p className="text-gray-500 text-center text-sm italic py-4">No attributes added yet.</p>}
                </div>

                <div className="mt-6">
                  {pageError && (
                    <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg mb-4 text-sm flex gap-2">
                        <XCircleIcon className="h-5 w-5 flex-shrink-0" /> {pageError}
                    </div>
                  )}
                  
                  <button
                    onClick={handleLogObservation}
                    disabled={isProcessing}
                    className={`w-full py-4 rounded-md font-bold text-lg transition-all shadow-lg ${
                      isProcessing 
                        ? 'bg-gray-600 text-gray-400 cursor-wait'
                        : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white transform hover:-translate-y-0.5'
                    }`}
                  >
                    {isUploading ? 'Uploading to IPFS...' : isTxPending ? 'Minting Log on Flow...' : 'Log Observation On-Chain'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
        
        {viewedJob && (
          <div className="mb-8 scroll-mt-24" id="observation-display">
             <CustomObservationDisplay job={viewedJob} />
          </div>
        )}
        
        {selectedProjectId && displayLogs.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Observation History</h2>
            <AnalysisJobsList 
              jobs={displayLogs} 
              onViewAndLogResults={(job) => {
                setViewedJob(job);
                setTimeout(() => {
                    document.getElementById('observation-display')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              isLoggingAnyJob={false}
              onClearJobs={() => {}} 
            />
          </div>
        )}

      </div>

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        txId={dialogTxId || undefined}
        onSuccess={refetchProjects}
        pendingTitle="Minting Observation Log"
        successTitle="Observation Recorded!"
        successDescription="Your data has been secured on IPFS and linked to your NFT history."
      />
    </>
  );
};

export default CustomObservationPage;
import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { useFlowConfig, useFlowCurrentUser, useFlowMutate, TransactionDialog } from '@onflow/react-sdk';
import { useIonicStorage } from '../../hooks/useIonicStorage';
import { useLighthouse } from '../../hooks/useLighthouse';
import { getMintNftTransaction } from '../../flow/cadence';
import { SparklesIcon, PhotoIcon, ArrowUpOnSquareIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface CreateProjectFormProps {
  onMintSuccess: () => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ onMintSuccess }) => {
  // --- STATE AND HOOKS (Unchanged) ---
  const [newName, setNewName] = useIonicStorage<string>('form_project_name', '');
  const [newDescription, setNewDescription] = useIonicStorage<string>('form_project_desc', '');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dialogTxId, setDialogTxId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const flowConfig = useFlowConfig();
  const { user } = useFlowCurrentUser();
  const { uploadFile, isLoading: isUploading, error: uploadError } = useLighthouse();
  const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: txError, data: txId } = useFlowMutate();

  // --- FIX: Create a Ref for the hidden file input ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EVENT HANDLERS (with fix applied) ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  
  // FIX: This function is called by our custom button to trigger the hidden input
  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleCreateAndMint = async () => {
    setFormError(null);
    if (!newName || !newImageFile || !user?.addr) {
      setFormError("Project Name, Image, and a connected wallet are required.");
      return;
    }
    try {
      const imageCid = await uploadFile(newImageFile);
      if (!imageCid) throw new Error(uploadError || "Failed to upload image to IPFS.");

      const addresses = {
        NonFungibleToken: flowConfig.addresses["NonFungibleToken"],
        KintaGenNFT: flowConfig.addresses["KintaGenNFT"],
        ViewResolver: flowConfig.addresses["ViewResolver"],
        MetadataViews: flowConfig.addresses["MetadataViews"],
      };
      const cadence = getMintNftTransaction(addresses as any);
      
      await executeTransaction({
        cadence,
        args: (arg, t) => [
          arg(newName, t.String),
          arg(newDescription, t.String),
          arg(imageCid, t.String),
          arg(user.addr!, t.String),
          arg(`run-hash-${Date.now()}`, t.String)
        ],
        limit: 9999
      });
    } catch (error: any) {
      const errorMessage = error?.message || String(error || 'Unknown error');
      if (!errorMessage.includes("User rejected") && !errorMessage.includes("Declined")) {
        setFormError(`Minting failed: ${errorMessage}`);
      }
    } 
  };
  
  useEffect(() => {
    if (isTxSuccess && txId) {
      setDialogTxId(txId as string);
      setIsDialogOpen(true);
    }
    if (isTxError && txError) {
      const errorMessage = txError instanceof Error ? txError.message : String(txError || 'Unknown error');
      const msg = errorMessage.includes("User rejected") || errorMessage.includes("Declined") 
        ? "Transaction cancelled." 
        : errorMessage;
      setFormError(`Transaction failed: ${msg}`);
    }
  }, [isTxSuccess, isTxError, txId, txError]);

  const isMinting = isUploading || isTxPending;
  const isButtonDisabled = !newName || !newImageFile || isMinting;
  const buttonText = isUploading ? 'Uploading to IPFS...' : isTxPending ? 'Awaiting Transaction...' : 'Create & Mint Project';

  return (
    <>
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-10">
        <h2 className="text-xl font-semibold mb-6">Create & Mint New Project</h2>
        <div className="space-y-6">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
            <input id="projectName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., E. coli Antibiotic Resistance" className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" required />
          </div>
          
          <div>
            <label htmlFor="projectDesc" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea id="projectDesc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={4} placeholder="A short summary of the research goals, methods, and expected outcomes." className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Project Image</label>
            <div className="mt-2 flex items-center gap-x-4">
              {imagePreview ? <img src={imagePreview} alt="Preview" className="h-24 w-24 rounded-lg object-cover" /> : <PhotoIcon className="h-24 w-24 text-gray-500" />}
              <div className="flex flex-col gap-2">
                {/* FIX: The visible button now calls our new click handler */}
                <button 
                  type="button"
                  onClick={handleUploadButtonClick}
                  className="cursor-pointer rounded-md bg-gray-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-600 flex items-center justify-center"
                >
                  <ArrowUpOnSquareIcon className="h-5 w-5 mr-2" />
                  <span>Upload Image</span>
                </button>
                {/* FIX: The actual file input is hidden and linked via the ref */}
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  className="sr-only"
                  accept="image/*"
                />
                {imagePreview && <button type="button" onClick={() => { setNewImageFile(null); setImagePreview(null); }} className="text-xs text-red-400 hover:text-red-300">Remove</button>}
              </div>
            </div>
          </div>

          <div>
            {formError && <p className="text-red-400 text-sm mb-2 flex items-center gap-2"><XCircleIcon className="h-5 w-5" />{formError}</p>}
            <button 
              onClick={handleCreateAndMint} 
              disabled={isButtonDisabled} 
              className="w-full flex items-center justify-center bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-wait transition-colors"
            >
              <SparklesIcon className="h-5 w-5 mr-2" />
              <span>{buttonText}</span>
            </button>
          </div>
        </div>
      </div>

      <TransactionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        txId={dialogTxId || undefined}
        onSuccess={() => {
          setNewName(''); setNewDescription(''); setNewImageFile(null); setImagePreview(null); setFormError(null);
          onMintSuccess();
        }}
        pendingTitle="Minting Your Project NFT"
        successTitle="Project Minted Successfully!"
      />
    </>
  );
};

export default CreateProjectForm;
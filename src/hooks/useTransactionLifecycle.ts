import { useState, useEffect } from 'react';
import { useFlowMutate } from '@onflow/react-sdk';

interface UseTransactionLifecycleReturn {
    executeTransaction: ReturnType<typeof useFlowMutate>['mutate'];
    isTxPending: boolean;
    dialogTxId: string | null;
    isDialogOpen: boolean;
    setIsDialogOpen: (open: boolean) => void;
    txError: string | null;
    setTxError: (err: string | null) => void;
}

export const useTransactionLifecycle = (
    onResetLogging: () => void
): UseTransactionLifecycleReturn => {
    const { mutate: executeTransaction, isPending: isTxPending, isSuccess: isTxSuccess, isError: isTxError, error: rawError, data: txId } = useFlowMutate();
    
    const [dialogTxId, setDialogTxId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);

    useEffect(() => {
        if (isTxSuccess && txId) {
            setDialogTxId(txId as string);
            setIsDialogOpen(true);
        }
        if (isTxError && rawError) {
            const msg = rawError?.message || String(rawError);

            const errorMessage = msg.includes("User rejected") 
                ? "Transaction cancelled by user." 
                : (rawError as Error).message;
            setTxError(`Transaction failed: ${errorMessage}`);
            onResetLogging(); // Helper to set isLogging(false) etc
        }
    }, [isTxSuccess, isTxError, txId, rawError, onResetLogging]);

    return {
        executeTransaction,
        isTxPending,
        dialogTxId,
        isDialogOpen,
        setIsDialogOpen,
        txError,
        setTxError
    };
};
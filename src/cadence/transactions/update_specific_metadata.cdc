import "NonFungibleToken"
import "ExampleNFT"
import "MetadataViews"

// A specialized transaction to update only the agent and outputCID of an NFT.
// This is more robust for command-line use as it avoids passing `nil` arguments,
// which can be difficult for the Flow CLI to parse correctly.
//
// This transaction must be signed by the owner of the NFT.

transaction(
    nftID: UInt64,
    newAgent: String,
    newOutputCID: String
) {
    // A reference to the specific NFT in the owner's collection that will be updated.
    // The type `&ExampleNFT.NFT` grants us access to the `updateMetadata` function.
    let nftToUpdate: &ExampleNFT.NFT

    prepare(signer: auth(BorrowValue) &Account) {
        // Dynamically get the collection's storage path from the contract's metadata views.
        let collectionData = ExampleNFT.resolveContractView(resourceType: nil, viewType: Type<MetadataViews.NFTCollectionData>()) as! MetadataViews.NFTCollectionData?
            ?? panic("Could not resolve NFTCollectionData view from the ExampleNFT contract")

        // Borrow a reference to the owner's collection from their account storage.
        let collection = signer.storage.borrow<&ExampleNFT.Collection>(from: collectionData.storagePath)
            ?? panic("Could not borrow a reference to the owner's Collection")

        // Borrow a mutable reference to the specific NFT that needs to be updated.
        // We use `!` to force unwrap the optional, because if the NFT doesn't exist,
        // we want the transaction to fail here with a panic.
        self.nftToUpdate = collection.borrowNFT(nftID)! as! &ExampleNFT.NFT
    }

    execute {
        // Call the `updateMetadata` function that exists on the NFT resource itself.
        // We pass the new values for the fields we are changing, and hardcode `nil`
        // for the fields this specific transaction is not designed to change.
        self.nftToUpdate.updateMetadata(
            newInputs: nil,
            newAgent: newAgent,
            newOutputCID: newOutputCID,
            newRunHash: nil
        )

        log("Successfully updated metadata for NFT with ID: ".concat(nftID.toString()))
    }
}
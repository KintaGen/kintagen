import "NonFungibleToken"
import "ExampleNFT"
import "MetadataViews"

// Updates the metadata of an existing ExampleNFT.
// This is the "UPDATE" operation for your NFT database.
// Must be signed by the owner of the NFT.

transaction(
    nftID: UInt64,
    newInputs: [UInt64]?,
    newAgent: String?,
    newOutputCID: String?,
    newRunHash: String?
) {
    // Reference to the NFT in the owner's collection that will be updated
    let nftToUpdate: &ExampleNFT.NFT

    prepare(signer: auth(BorrowValue) &Account) {
        let collectionData = ExampleNFT.resolveContractView(resourceType: nil, viewType: Type<MetadataViews.NFTCollectionData>()) as! MetadataViews.NFTCollectionData?
            ?? panic("Could not resolve NFTCollectionData view")

        // Borrow a reference to the owner's collection
        let collection = signer.storage.borrow<&ExampleNFT.Collection>(from: collectionData.storagePath)
            ?? panic("Could not borrow a reference to the owner's Collection")

        // Borrow a mutable reference to the specific NFT that needs to be updated
        // The type `&ExampleNFT.NFT` gives us access to the `updateMetadata` function
        self.nftToUpdate = collection.borrowNFT(nftID)! as! &ExampleNFT.NFT
    }

    execute {
        // Call the update function on the NFT with the new data
        self.nftToUpdate.updateMetadata(
            newInputs: newInputs,
            newAgent: newAgent,
            newOutputCID: newOutputCID,
            newRunHash: newRunHash
        )
        log("Successfully updated metadata for NFT with ID: ".concat(nftID.toString()))
    }
}
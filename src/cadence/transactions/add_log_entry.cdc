import "NonFungibleToken"
import "KintaGenNFT"
import "MetadataViews"

// Adds a new, permanent entry to a KintaGenNFT's audit log.
// This transaction must be signed by the owner of the NFT.
transaction(nftID: UInt64, agent: String, actionDescription: String, outputCID: String) {
    let nftRef: &KintaGenNFT.NFT

    prepare(signer: auth(BorrowValue) &Account) {
        let collectionData = KintaGenNFT.resolveContractView(resourceType: nil, viewType: Type<MetadataViews.NFTCollectionData>())! as! MetadataViews.NFTCollectionData
        
        let collection = signer.storage.borrow<&KintaGenNFT.Collection>(from: collectionData.storagePath)
            ?? panic("Could not borrow a reference to the owner's KintaGenNFT Collection")
            
        self.nftRef = collection.borrowNFT(nftID)! as! &KintaGenNFT.NFT
    }

    execute {
        self.nftRef.addLogEntry(
            agent: agent,
            actionDescription: actionDescription,
            outputCID: outputCID
        )
        log("Successfully added new log entry to KintaGenNFT with ID: ".concat(nftID.toString()))
    }
}
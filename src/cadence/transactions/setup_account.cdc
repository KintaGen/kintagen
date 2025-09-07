import "NonFungibleToken"
import "KintaGenNFT"
import "MetadataViews"

// Prepares an account to receive KintaGenNFTs by creating a Collection resource
// and publishing a public capability to it.
transaction {
    prepare(signer: auth(BorrowValue, SaveValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability) &Account) {
        
        let collectionData = KintaGenNFT.resolveContractView(resourceType: nil, viewType: Type<MetadataViews.NFTCollectionData>())! as! MetadataViews.NFTCollectionData
        
        if signer.storage.borrow<&KintaGenNFT.Collection>(from: collectionData.storagePath) != nil {
            log("Account already has a KintaGenNFT collection.")
            return
        }
        
        log("Creating a new KintaGenNFT collection...")
        let collection <- KintaGenNFT.createEmptyCollection(nftType: Type<@KintaGenNFT.NFT>())
        
        signer.storage.save(<-collection, to: collectionData.storagePath)
        signer.capabilities.unpublish(collectionData.publicPath)
        let collectionCap = signer.capabilities.storage.issue<&KintaGenNFT.Collection>(collectionData.storagePath)
        signer.capabilities.publish(collectionCap, at: collectionData.publicPath)
        
        log("KintaGenNFT collection setup complete.")
    }
}
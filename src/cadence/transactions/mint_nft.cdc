import "NonFungibleToken"
import "KintaGenNFT"
import "MetadataViews"

// Mints a new KintaGenNFT and deposits it into a recipient's Collection.
// This transaction must be signed by an account holding a Minter resource.
transaction(recipient: Address, agent: String, outputCID: String, runHash: String) {
    let minter: &KintaGenNFT.Minter
    let recipientCollectionRef: &{NonFungibleToken.Receiver}

    prepare(signer: auth(BorrowValue) &Account) {
        let collectionData = KintaGenNFT.resolveContractView(resourceType: nil, viewType: Type<MetadataViews.NFTCollectionData>())! as! MetadataViews.NFTCollectionData
        
        self.minter = signer.storage.borrow<&KintaGenNFT.Minter>(from: KintaGenNFT.MinterStoragePath)
            ?? panic("Signer does not store a KintaGenNFT Minter.")
            
        self.recipientCollectionRef = getAccount(recipient).capabilities.borrow<&{NonFungibleToken.Receiver}>(collectionData.publicPath)
            ?? panic("Could not borrow receiver capability from the recipient's account.")
    }

    execute {
        let newNFT <- self.minter.mint(agent: agent, outputCID: outputCID, runHash: runHash)
        let id = newNFT.id
        self.recipientCollectionRef.deposit(token: <-newNFT)
        log("Successfully minted KintaGenNFT with ID: ".concat(id.toString()))
    }
}
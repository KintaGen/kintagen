import "ViewResolver"
import "MetadataViews"
import "KintaGenNFT"

// This script reads the standard Display and Traits views for a given KintaGenNFT.
access(all) struct NFTData {
    access(all) let id: UInt64
    access(all) let name: String
    access(all) let description: String
    access(all) let thumbnailCID: String
    access(all) let traits: {String: AnyStruct}

    init(id: UInt64, display: MetadataViews.Display, traits: MetadataViews.Traits) {
        self.id = id
        self.name = display.name
        self.description = display.description
        let ipfsFile = display.thumbnail as! MetadataViews.IPFSFile
        self.thumbnailCID = ipfsFile.cid
        var traitsDict: {String: AnyStruct} = {}
        for trait in traits.traits {
            traitsDict[trait.name] = trait.value
        }
        self.traits = traitsDict
    }
}

access(all) fun main(ownerAddress: Address, nftID: UInt64): NFTData? {
    let owner = getAccount(ownerAddress)
    let collectionCap = owner.capabilities.get<&KintaGenNFT.Collection>(KintaGenNFT.CollectionPublicPath)
    if collectionCap == nil {
        panic("Account does not have the required public KintaGenNFT collection capability.")
    }
    let collectionRef = collectionCap!.borrow()
        ?? panic("Could not borrow a reference to the KintaGenNFT Collection.")
    let resolver = collectionRef.borrowViewResolver(id: nftID)
        ?? panic("Could not borrow view resolver for KintaGenNFT.")
    let displayView = resolver.resolveView(Type<MetadataViews.Display>())! as! MetadataViews.Display
    let traitsView = resolver.resolveView(Type<MetadataViews.Traits>())! as! MetadataViews.Traits
    return NFTData(id: nftID, display: displayView, traits: traitsView)
}
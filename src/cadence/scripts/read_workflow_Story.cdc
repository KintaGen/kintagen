import "ViewResolver"
import "KintaGenNFT"

// This script queries the custom `WorkflowStepView` to get the
// complete, human-readable story of a KintaGenNFT's lifecycle.
access(all) fun main(ownerAddress: Address, nftID: UInt64): [KintaGenNFT.WorkflowStepView]? {

    let owner = getAccount(ownerAddress)
    let collectionCap = owner.capabilities.get<&{ViewResolver.ResolverCollection}>(KintaGenNFT.CollectionPublicPath)
    if collectionCap == nil {
        panic("Account does not have the required public KintaGenNFT resolver collection capability.")
    }
    let collectionRef = collectionCap!.borrow()
        ?? panic("Could not borrow a reference to the Collection.")
    let resolver = collectionRef.borrowViewResolver(id: nftID)
        ?? panic("Could not borrow view resolver for KintaGenNFT.")
    let storyView = resolver.resolveView(Type<KintaGenNFT.WorkflowStepView>())
    return storyView as? [KintaGenNFT.WorkflowStepView]
}
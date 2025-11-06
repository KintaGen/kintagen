// src/flow/cadence.ts

// This interface defines the shape of all the contract addresses your app needs.
interface ContractAddresses {
    NonFungibleToken: string;
    KintaGenNFT: string; // Aligned with your flow.json/config
    ViewResolver: string;
    MetadataViews: string;
  }
  
  // --- TRANSACTIONS ---
  
  export const getMintNftTransaction = (addresses: ContractAddresses): string => {
    return `
      import NonFungibleToken from ${addresses.NonFungibleToken}
      import PublicKintaGenNFTv6 from ${addresses.KintaGenNFT}
      import MetadataViews from ${addresses.MetadataViews}
      import ViewResolver from ${addresses.ViewResolver}
  
      transaction(
          project: String,
          summary: String,
          cid: String,
          investigator: String,
          runHash: String
      ) {
          let receiver: &{NonFungibleToken.CollectionPublic}
          let signerAddress: Address
  
          prepare(signer: auth(Storage, Capabilities) &Account) {
              self.signerAddress = signer.address
  
              if signer.storage.borrow<&PublicKintaGenNFTv6.Collection>(from: PublicKintaGenNFTv6.CollectionStoragePath) == nil {
                  let collection <- PublicKintaGenNFTv6.createEmptyCollection(nftType: Type<@PublicKintaGenNFTv6.NFT>())
                  signer.storage.save(<-collection, to: PublicKintaGenNFTv6.CollectionStoragePath)
  
                  signer.capabilities.publish(
                      signer.capabilities.storage.issue<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(PublicKintaGenNFTv6.CollectionStoragePath),
                      at: PublicKintaGenNFTv6.CollectionPublicPath
                  )
              }
  
              self.receiver = signer.capabilities
                  .borrow<&{NonFungibleToken.CollectionPublic}>(PublicKintaGenNFTv6.CollectionPublicPath)
                  ?? panic("Cannot borrow NFT Collection receiver capability.")
          }
  
          execute {
              // Call the updated mint function, passing in the signer's address
              let token <- PublicKintaGenNFTv6.mint(
                  recipientAddress: self.signerAddress,
                  projectName: project,
                  projectSummary: summary,
                  projectCID: cid,
                  principalInvestigator: investigator,
                  runHash: runHash
              )
              self.receiver.deposit(token: <-token)
          }
      }
    `;
  };
  
  export const getAddToLogTransaction = (addresses: ContractAddresses): string => {
  return `
    import PublicKintaGenNFTv6 from ${addresses.KintaGenNFT}
  
    transaction(nftID: UInt64, agent: String, title: String, details: String, cid: String) {
        prepare(signer: auth(BorrowValue) &Account) {
            let collection = signer.storage.borrow<&PublicKintaGenNFTv6.Collection>(from: PublicKintaGenNFTv6.CollectionStoragePath)
                ?? panic("Signer does not own a PublicKintaGenNFTv6 collection.")
  
            let nft = collection.borrowNFT(nftID)! as! &PublicKintaGenNFTv6.NFT
            nft.addLogEntry(agent: agent, title: title, description: details, ipfsHash: cid)
        }
    }
  `;
  };
  
  // --- SCRIPTS ---
  
  /**
   * This script fetches everything needed for the Logbook page: the project name and its full story.
   * It borrows a capability to both the NFT (for its name) and the ViewResolver (for its story).
   */
  export const getNftLogbookScript = (addresses: ContractAddresses): string => {
    return `
      import NonFungibleToken from ${addresses.NonFungibleToken}
      import ViewResolver from ${addresses.ViewResolver}
      import PublicKintaGenNFTv6 from ${addresses.KintaGenNFT}
  
      // This struct will hold all the data needed for the logbook page
      access(all) struct LogbookInfo {
          access(all) let projectName: String
          access(all) let story: [PublicKintaGenNFTv6.WorkflowStepView]
  
          init(projectName: String, story: [PublicKintaGenNFTv6.WorkflowStepView]) {
              self.projectName = projectName
              self.story = story
          }
      }
  
      // The main function now returns our new struct
      access(all) fun main(ownerAddress: Address, nftID: UInt64): LogbookInfo? {
          let owner = getAccount(ownerAddress)
          
          // Borrow a capability that allows access to both NFT data and Views
          let collectionCap = owner.capabilities.get<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(PublicKintaGenNFTv6.CollectionPublicPath)
          
          if !collectionCap.check() { 
              return nil 
          }
          
          let collection = collectionCap.borrow() ?? panic("Could not borrow collection capability.")
          
          // Borrow a reference to the specific NFT to get its name
          let nft = collection.borrowNFT(nftID)
          if nft == nil {
              return nil
          }
          let kintaGenNft = nft as! &PublicKintaGenNFTv6.NFT
          
          // Also borrow the view resolver to get the story
          let resolver = collection.borrowViewResolver(id: nftID) ?? panic("Could not borrow view resolver.")
          let storyView = resolver.resolveView(Type<[PublicKintaGenNFTv6.WorkflowStepView]>())!
          
          // Construct and return the LogbookInfo object
          return LogbookInfo(
              projectName: kintaGenNft.projectName,
              story: storyView as! [PublicKintaGenNFTv6.WorkflowStepView]
          )
      }
    `;
  };
  
  export const getOwnedNftsScript = (addresses: ContractAddresses): string => {
    return `
      import NonFungibleToken from ${addresses.NonFungibleToken}
      import PublicKintaGenNFTv6 from ${addresses.KintaGenNFT}
  
      access(all) fun main(address: Address): [UInt64] {
          let account = getAccount(address)
  
          let collectionCap = account.capabilities.get
              <&{NonFungibleToken.CollectionPublic}>
              (PublicKintaGenNFTv6.CollectionPublicPath)
  
          if !collectionCap.check() {
              return []
          }
  
          let collection = collectionCap.borrow()
              ?? panic("Could not borrow a reference to the collection")
  
          return collection.getIDs()
      }
    `;
  };
  
  export const getNftDisplaysScript = (addresses: ContractAddresses): string => {
  return `
    import ViewResolver from ${addresses.ViewResolver}
    import PublicKintaGenNFTv6 from ${addresses.KintaGenNFT}
    import MetadataViews from ${addresses.MetadataViews}
  
    access(all) fun main(ownerAddress: Address, ids: [UInt64]): [MetadataViews.Display?] {
        let account = getAccount(ownerAddress)
        let collectionCap = account.capabilities.get<&{ViewResolver.ResolverCollection}>(PublicKintaGenNFTv6.CollectionPublicPath)
        
        if !collectionCap.check() { 
            return []
        }
        
        let resolverCollection = collectionCap.borrow()
            ?? panic("Could not borrow collection capability.")
  
        var displays: [MetadataViews.Display?] = []
  
        for id in ids {
            let resolver = resolverCollection.borrowViewResolver(id: id)
            if resolver != nil {
                let view = resolver!.resolveView(Type<MetadataViews.Display>())
                displays.append(view as? MetadataViews.Display)
            } else {
                displays.append(nil)
            }
        }
        
        return displays
    }
  `;
  };
  
  /**
  * Generates the script to fetch all necessary project data for the main list view.
  * This is the version with the final Cadence 1.0 syntax fix.
  */
  export const getNftStoriesScript = (addresses: ContractAddresses): string => {
  return `
    import PublicKintaGenNFTv6 from ${addresses.KintaGenNFT}
    import MetadataViews from ${addresses.MetadataViews}
    import ViewResolver from ${addresses.ViewResolver}
    import NonFungibleToken from ${addresses.NonFungibleToken}
  
    access(all) struct ProjectInfo {
        access(all) let id: UInt64
        access(all) let name: String
        access(all) let description: String
        access(all) let story: [PublicKintaGenNFTv6.WorkflowStepView]
  
        init(id: UInt64, name: String, description: String, story: [PublicKintaGenNFTv6.WorkflowStepView]) {
            self.id = id
            self.name = name
            self.description = description
            self.story = story
        }
    }
  
    access(all) fun main(ownerAddress: Address, ids: [UInt64]): [ProjectInfo?] {
        let account = getAccount(ownerAddress)
        
        let collectionCap = account.capabilities.get<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(PublicKintaGenNFTv6.CollectionPublicPath)
        
        if !collectionCap.check() { 
            return []
        }
        
        let collection = collectionCap.borrow()
            ?? panic("Could not borrow collection capability.")
  
        var allProjects: [ProjectInfo?] = []
  
        for id in ids {
            let nft = collection.borrowNFT(id)
            if nft != nil {
                // Now that the 'collection' reference has the correct type, this line is valid
                let resolver = collection.borrowViewResolver(id: id)!
                let storyView = resolver.resolveView(Type<[PublicKintaGenNFTv6.WorkflowStepView]>())!
                
                let kintaGenNft = nft as! &PublicKintaGenNFTv6.NFT
  
                allProjects.append(
                    ProjectInfo(
                        id: id,
                        name: kintaGenNft.projectName,
                        description: kintaGenNft.projectSummary,
                        story: storyView as! [PublicKintaGenNFTv6.WorkflowStepView]
                    )
                )
            } else {
                allProjects.append(nil)
            }
        }
        
        return allProjects
    }
  `;
  };

  export const getLatestNftsScript = (addresses: ContractAddresses): string => {
    return `
      import NonFungibleToken from ${addresses.NonFungibleToken}
      import MetadataViews from ${addresses.MetadataViews}
      import ViewResolver from ${addresses.ViewResolver}
      import PublicKintaGenNFTv6 from ${addresses.KintaGenNFT}
  
      // This struct holds the combined data for our dashboard component.
      access(all) struct LatestNftInfo {
          access(all) let id: UInt64
          access(all) let name: String
          access(all) let description: String
          access(all) let owner: Address
          access(all) let thumbnailCid: String
  
          init(id: UInt64, display: MetadataViews.Display, owner: Address) {
              self.id = id
              self.name = display.name
              self.description = display.description
              self.owner = owner
              if let ipfsFile = display.thumbnail as? MetadataViews.IPFSFile {
                    self.thumbnailCid = ipfsFile.cid
              } else {
                    self.thumbnailCid = "" // Default to empty if it's not an IPFS file
              }
          }
              
      }
  
      // The main function queries the contract's total supply and iterates backwards.
      access(all) fun main(limit: Int): [LatestNftInfo] {
          let totalSupply = PublicKintaGenNFTv6.totalSupply
          var nfts: [LatestNftInfo] = []
          
          var currentId = totalSupply - 1
          
          // Loop backwards from the newest NFT until we have enough tokens
          // or we have checked all possible IDs.
          while currentId >= 0 && nfts.length < limit {
              // This is the critical part that relies on a custom public function in your contract.
              if let ownerAddress = PublicKintaGenNFTv6.getOwner(id: currentId) {
                  let account = getAccount(ownerAddress)
                  
                  // Borrow the public collection capability from the owner's account.
                  let collectionCap = account.capabilities.get<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(PublicKintaGenNFTv6.CollectionPublicPath)
  
                  if let collection = collectionCap.borrow() {
                      // Borrow the view resolver for the specific NFT.
                      if let resolver = collection.borrowViewResolver(id: currentId) {
                          // Resolve the Display view for the NFT.
                          if let view = resolver.resolveView(Type<MetadataViews.Display>()) {
                              let display = view as! MetadataViews.Display
                              nfts.append(LatestNftInfo(id: currentId, display: display, owner: ownerAddress))
                          }
                      }
                  }
              }
              if currentId > 0 {
                currentId = currentId - 1
              } else {
                break
              }
          }
          
          return nfts
      }
    `;
  };
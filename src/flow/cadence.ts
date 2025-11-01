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
    import PublicKintaGenNFTv3 from ${addresses.KintaGenNFT}
  
    transaction(
        recipient: Address,
        project: String,
        summary: String,
        cid: String,
        investigator: String,
        runHash: String
    ) {
        let minter: &PublicKintaGenNFTv3.Minter
        let receiver: &{NonFungibleToken.Receiver}
  
        prepare(signer: auth(BorrowValue) &Account) {
            self.minter = signer.storage.borrow<&PublicKintaGenNFTv3.Minter>(from: PublicKintaGenNFTv3.MinterStoragePath)
                ?? panic("PublicKintaGenNFTv3 minter not found in storage.")
  
            self.receiver = getAccount(recipient)
                .capabilities
                .borrow<&{NonFungibleToken.Receiver}>(PublicKintaGenNFTv3.CollectionPublicPath)
                ?? panic("Recipient does not expose a KintaGen collection receiver.")
        }
  
        execute {
            let token <- self.minter.mint(
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
    import PublicKintaGenNFTv3 from ${addresses.KintaGenNFT}
  
    transaction(nftID: UInt64, agent: String, title: String, details: String, cid: String) {
        prepare(signer: auth(BorrowValue) &Account) {
            let collection = signer.storage.borrow<&PublicKintaGenNFTv3.Collection>(from: PublicKintaGenNFTv3.CollectionStoragePath)
                ?? panic("Signer does not own a PublicKintaGenNFTv3 collection.")
  
            let nft = collection.borrowNFT(nftID)! as! &PublicKintaGenNFTv3.NFT
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
      import PublicKintaGenNFTv3 from ${addresses.KintaGenNFT}
  
      // This struct will hold all the data needed for the logbook page
      access(all) struct LogbookInfo {
          access(all) let projectName: String
          access(all) let story: [PublicKintaGenNFTv3.WorkflowStepView]
  
          init(projectName: String, story: [PublicKintaGenNFTv3.WorkflowStepView]) {
              self.projectName = projectName
              self.story = story
          }
      }
  
      // The main function now returns our new struct
      access(all) fun main(ownerAddress: Address, nftID: UInt64): LogbookInfo? {
          let owner = getAccount(ownerAddress)
          
          // Borrow a capability that allows access to both NFT data and Views
          let collectionCap = owner.capabilities.get<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(PublicKintaGenNFTv3.CollectionPublicPath)
          
          if !collectionCap.check() { 
              return nil 
          }
          
          let collection = collectionCap.borrow() ?? panic("Could not borrow collection capability.")
          
          // Borrow a reference to the specific NFT to get its name
          let nft = collection.borrowNFT(nftID)
          if nft == nil {
              return nil
          }
          let kintaGenNft = nft as! &PublicKintaGenNFTv3.NFT
          
          // Also borrow the view resolver to get the story
          let resolver = collection.borrowViewResolver(id: nftID) ?? panic("Could not borrow view resolver.")
          let storyView = resolver.resolveView(Type<[PublicKintaGenNFTv3.WorkflowStepView]>())!
          
          // Construct and return the LogbookInfo object
          return LogbookInfo(
              projectName: kintaGenNft.projectName,
              story: storyView as! [PublicKintaGenNFTv3.WorkflowStepView]
          )
      }
    `;
  };
  
  export const getOwnedNftsScript = (addresses: ContractAddresses): string => {
  return `
    import NonFungibleToken from ${addresses.NonFungibleToken}
    import PublicKintaGenNFTv3 from ${addresses.KintaGenNFT}
  
    access(all) fun main(address: Address): [UInt64] {
        let account = getAccount(address)
        let collectionCap = account.capabilities.get<&{NonFungibleToken.CollectionPublic}>(PublicKintaGenNFTv3.CollectionPublicPath)
        
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
    import PublicKintaGenNFTv3 from ${addresses.KintaGenNFT}
    import MetadataViews from ${addresses.MetadataViews}
  
    access(all) fun main(ownerAddress: Address, ids: [UInt64]): [MetadataViews.Display?] {
        let account = getAccount(ownerAddress)
        let collectionCap = account.capabilities.get<&{ViewResolver.ResolverCollection}>(PublicKintaGenNFTv3.CollectionPublicPath)
        
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
    import PublicKintaGenNFTv3 from ${addresses.KintaGenNFT}
    import MetadataViews from ${addresses.MetadataViews}
    import ViewResolver from ${addresses.ViewResolver}
    import NonFungibleToken from ${addresses.NonFungibleToken}
  
    access(all) struct ProjectInfo {
        access(all) let id: UInt64
        access(all) let name: String
        access(all) let description: String
        access(all) let story: [PublicKintaGenNFTv3.WorkflowStepView]
  
        init(id: UInt64, name: String, description: String, story: [PublicKintaGenNFTv3.WorkflowStepView]) {
            self.id = id
            self.name = name
            self.description = description
            self.story = story
        }
    }
  
    access(all) fun main(ownerAddress: Address, ids: [UInt64]): [ProjectInfo?] {
        let account = getAccount(ownerAddress)
        
        let collectionCap = account.capabilities.get<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>(PublicKintaGenNFTv3.CollectionPublicPath)
        
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
                let storyView = resolver.resolveView(Type<[PublicKintaGenNFTv3.WorkflowStepView]>())!
                
                let kintaGenNft = nft as! &PublicKintaGenNFTv3.NFT
  
                allProjects.append(
                    ProjectInfo(
                        id: id,
                        name: kintaGenNft.projectName,
                        description: kintaGenNft.projectSummary,
                        story: storyView as! [PublicKintaGenNFTv3.WorkflowStepView]
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
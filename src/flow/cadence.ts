// This interface defines the shape of all the contract addresses your app needs.
interface ContractAddresses {
    NonFungibleToken: string;
    PublicKintaGenNFT: string;
    ViewResolver: string;
  }
  
  // --- TRANSACTIONS ---
  
export const getMintNftTransaction = (addresses: ContractAddresses): string => {
  return `
    // This transaction is now network-agnostic.
    // The addresses are injected from your FCL config.
    import NonFungibleToken from ${addresses.NonFungibleToken}
    import PublicKintaGenNFT      from ${addresses.KintaGenNFT}

    transaction(agent: String, outputCID: String, runHash: String) {

        let collectionRef: &PublicKintaGenNFT.Collection

        prepare(signer: auth(Storage, Capabilities) &Account) {

            if signer.storage.borrow<&PublicKintaGenNFT.Collection>(from: PublicKintaGenNFT.CollectionStoragePath) == nil {
                let collection <- PublicKintaGenNFT.createEmptyCollection(nftType: Type<@PublicKintaGenNFT.NFT>())
                signer.storage.save(<-collection, to: PublicKintaGenNFT.CollectionStoragePath)
                signer.capabilities.publish(
                    signer.capabilities.storage.issue<&PublicKintaGenNFT.Collection>(PublicKintaGenNFT.CollectionStoragePath),
                    at: PublicKintaGenNFT.CollectionPublicPath
                )
            }
            
            self.collectionRef = signer.storage.borrow<&PublicKintaGenNFT.Collection>(from: PublicKintaGenNFT.CollectionStoragePath)
                ?? panic("Could not borrow a reference to the NFT collection")
        }

        execute {
            let newNFT <- PublicKintaGenNFT.mint(agent: agent, outputCID: outputCID, runHash: runHash)
            let newNftId = newNFT.id
            self.collectionRef.deposit(token: <-newNFT)
            log("Successfully minted PublicKintaGenNFT with ID ".concat(newNftId.toString()))
        }
    }
  `;
};
  
  export const getAddToLogTransaction = (addresses: ContractAddresses): string => {
    return `
      // NonFungibleToken import is not strictly needed by the code, but good for clarity
      import NonFungibleToken from ${addresses.NonFungibleToken}
      import PublicKintaGenNFT from ${addresses.KintaGenNFT}
  
      transaction(nftId: UInt64, agent: String, actionDescription: String, outputCID: String) {
        let nftRef: &PublicKintaGenNFT.NFT
  
        prepare(signer: auth(BorrowValue) &Account) {
            let collectionRef = signer.storage.borrow<&PublicKintaGenNFT.Collection>(from: PublicKintaGenNFT.CollectionStoragePath)
                ?? panic("Could not borrow a reference to the owner's collection")
            self.nftRef = collectionRef.borrowNFT(nftId) as! &PublicKintaGenNFT.NFT
        }
  
        execute {
            self.nftRef.addLogEntry(agent: agent, actionDescription: actionDescription, outputCID: outputCID)
            log("Successfully added a new entry to the log for NFT ID: ".concat(nftId.toString()))
        }
      }
    `;
  };
  export const getSetupAndMintTransaction = (addresses: ContractAddresses): string => {
    return `
      import NonFungibleToken from ${addresses.NonFungibleToken}
      import PublicKintaGenNFT from ${addresses.KintaGenNFT}
  
      transaction(agent: String, outputCID: String, runHash: String) {
        
        // Define the reference placeholder at the top level
        let collectionRef: &PublicKintaGenNFT.Collection
  
        // The prepare block does all the setup and borrowing
        prepare(signer: auth(Storage, Capabilities) &Account) {
          
          // 1. SETUP: Create a collection if it doesn't exist.
          if signer.storage.borrow<&PublicKintaGenNFT.Collection>(from: PublicKintaGenNFT.CollectionStoragePath) == nil {
              let collection <- PublicKintaGenNFT.createEmptyCollection(nftType: Type<@PublicKintaGenNFT.NFT>())
              signer.storage.save(<-collection, to: PublicKintaGenNFT.CollectionStoragePath)
          }
  
          // 2. FIX: Create the public link if it doesn't exist.
          if !signer.capabilities.get<&{NonFungibleToken.CollectionPublic}>(PublicKintaGenNFT.CollectionPublicPath).check() {
              signer.capabilities.unpublish(PublicKintaGenNFT.CollectionPublicPath)
              signer.capabilities.publish(
                  signer.capabilities.storage.issue<&{NonFungibleToken.CollectionPublic}>(PublicKintaGenNFT.CollectionStoragePath),
                  at: PublicKintaGenNFT.CollectionPublicPath
              )
          }
          
          self.collectionRef = signer.storage.borrow<&PublicKintaGenNFT.Collection>(from: PublicKintaGenNFT.CollectionStoragePath)
              ?? panic("Could not borrow a reference to the owner's collection")
        }
  
        // The execute block performs the final mint and deposit actions
        execute {
          // This is the correct way to call the contract-level mint function
          let newNFT <- PublicKintaGenNFT.mint(agent: agent, outputCID: outputCID, runHash: runHash)
          
          // Use the borrowed reference to deposit
          self.collectionRef.deposit(token: <-newNFT)
  
          log("Successfully minted PublicKintaGenNFT with ID ".concat(newNFT.id.toString()))
        }
      }
    `;
  };
  
  // --- SCRIPTS ---
  
  export const getNftStoryScript = (addresses: ContractAddresses): string => {
    return `
      import ViewResolver from ${addresses.ViewResolver}
      import PublicKintaGenNFT from ${addresses.KintaGenNFT}
  
      access(all) fun main(ownerAddress: Address, nftID: UInt64): [PublicKintaGenNFT.WorkflowStepView]? {
          let owner = getAccount(ownerAddress)
          let collectionCap = owner.capabilities.get<&{ViewResolver.ResolverCollection}>(PublicKintaGenNFT.CollectionPublicPath)
          
          if !collectionCap.check() { return nil }
          
          let resolverCollection = collectionCap.borrow() ?? panic("Could not borrow collection capability.")
          let resolver = resolverCollection.borrowViewResolver(id: nftID) ?? panic("Could not borrow view resolver for the specified NFT.")
          let storyView = resolver.resolveView(Type<PublicKintaGenNFT.WorkflowStepView>())
          
          return storyView as? [PublicKintaGenNFT.WorkflowStepView]
      }
    `;
  };


  export const getOwnedNftsScript = (addresses: ContractAddresses): string => {
    return `
      import NonFungibleToken from ${addresses.NonFungibleToken}
      import PublicKintaGenNFT from ${addresses.KintaGenNFT}
  
      // This script reads the NFT IDs from a user's collection.
      access(all) fun main(address: Address): [UInt64] {
          // Get the public account object for the specified address.
          let account = getAccount(address)
  
          // Get the public capability for their PublicKintaGenNFT Collection.
          let collectionCap = account.capabilities.get<&{NonFungibleToken.CollectionPublic}>(PublicKintaGenNFT.CollectionPublicPath)
          
          // If the capability doesn't exist or is invalid, return an empty array.
          if !collectionCap.check() {
              return []
          }
  
          // Borrow a reference to the collection.
          let collection = collectionCap.borrow()
              ?? panic("Could not borrow a reference to the collection")
  
          // Call the public getIDs() function and return the result.
          return collection.getIDs()
      }
    `;
  };


  export const getNftDisplaysScript = (addresses: ContractAddresses): string => {
    return `
      import ViewResolver from ${addresses.ViewResolver}
      import PublicKintaGenNFT from ${addresses.KintaGenNFT}
      import MetadataViews from ${addresses.MetadataViews}
  
      // This script takes an array of IDs and returns an array of Display structs.
      access(all) fun main(ownerAddress: Address, ids: [UInt64]): [MetadataViews.Display?] {
          let account = getAccount(ownerAddress)
          let collectionCap = account.capabilities.get<&{ViewResolver.ResolverCollection}>(PublicKintaGenNFT.CollectionPublicPath)
          
          // Return an empty array if the capability is missing.
          if !collectionCap.check() { 
              return []
          }
          
          let resolverCollection = collectionCap.borrow()
              ?? panic("Could not borrow collection capability.")
  
          let displays: [MetadataViews.Display?] = []
  
          // Loop through each ID and get its Display view
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

  export const getNftStoriesScript = (addresses: ContractAddresses): string => {
    return `
      import ViewResolver from ${addresses.ViewResolver}
      import PublicKintaGenNFT from ${addresses.KintaGenNFT}
  
      // This script takes an array of IDs and returns an array of stories.
      // The return type is an array of optional arrays of structs.
      access(all) fun main(ownerAddress: Address, ids: [UInt64]): [[PublicKintaGenNFT.WorkflowStepView]?] {
          let account = getAccount(ownerAddress)
          let collectionCap = account.capabilities.get<&{ViewResolver.ResolverCollection}>(PublicKintaGenNFT.CollectionPublicPath)
          
          if !collectionCap.check() { 
              // If the user has no collection, return an empty array.
              return []
          }
          
          let resolverCollection = collectionCap.borrow()
              ?? panic("Could not borrow collection capability.")
  
          // This will be our final array of stories.
          let allStories: [[PublicKintaGenNFT.WorkflowStepView]?] = []
  
          // Loop through each ID passed into the script.
          for id in ids {
              let resolver = resolverCollection.borrowViewResolver(id: id)
              if resolver != nil {
                  let storyView = resolver!.resolveView(Type<PublicKintaGenNFT.WorkflowStepView>())
                  allStories.append(storyView as? [PublicKintaGenNFT.WorkflowStepView])
              } else {
                  // If an NFT can't be found, append nil for that spot.
                  allStories.append(nil)
              }
          }
          
          return allStories
      }
    `;
  };
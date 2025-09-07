import "NonFungibleToken"
import "ViewResolver"
import "MetadataViews"

access(all) contract KintaGenNFT: NonFungibleToken {

    access(all) var totalSupply: UInt64

    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath : PublicPath
    access(all) let MinterStoragePath    : StoragePath
    access(all) let MinterPublicPath     : PublicPath

    access(all) event ContractInitialized()
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event Deposit(id: UInt64, to: Address?)
    access(all) event Minted(id: UInt64, agent: String, runHash: String)
    access(all) event LogEntryAdded(nftID: UInt64, agent: String, outputCID: String)

    access(all) struct LogEntry {
        access(all) let agent: String; access(all) let actionDescription: String; access(all) let outputCID: String; access(all) let timestamp: UFix64
        init(agent: String, actionDescription: String, outputCID: String) {
            self.agent = agent; self.actionDescription = actionDescription; self.outputCID = outputCID; self.timestamp = getCurrentBlock().timestamp
        }
    }

    access(all) struct WorkflowStepView {
        access(all) let stepNumber: Int; access(all) let agent: String; access(all) let action: String; access(all) let resultCID: String; access(all) let timestamp: UFix64
        init(stepNumber: Int, agent: String, action: String, resultCID: String, timestamp: UFix64) {
            self.stepNumber = stepNumber; self.agent = agent; self.action = action; self.resultCID = resultCID; self.timestamp = timestamp
        }
    }

    access(all) resource NFT: NonFungibleToken.NFT, ViewResolver.Resolver {
        access(all) let id: UInt64
        access(all) let initialAgent: String
        access(all) let initialOutputCID: String
        access(all) let initialRunHash: String
        access(all) let initialTimestamp: UFix64
        access(all) var log: [LogEntry]

        init(agent: String, outputCID: String, runHash: String) {
            // FIX: Use `self.uuid` for a guaranteed unique ID.
            self.id = self.uuid
            self.initialAgent = agent
            self.initialOutputCID = outputCID
            self.initialRunHash = runHash
            self.initialTimestamp = getCurrentBlock().timestamp
            self.log = []
            // The `Minted` event is now emitted from the Minter for clarity.
        }

        access(all) fun addLogEntry(agent: String, actionDescription: String, outputCID: String) {
            let newEntry = LogEntry(agent: agent, actionDescription: actionDescription, outputCID: outputCID)
            self.log.append(newEntry)
            emit LogEntryAdded(nftID: self.id, agent: agent, outputCID: outputCID)
        }

        access(all) view fun getViews(): [Type] {
            return [ Type<MetadataViews.Display>(), Type<MetadataViews.Traits>(), Type<MetadataViews.Serial>(), Type<KintaGenNFT.WorkflowStepView>() ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    var latestDescription = "Initial State: Created by ".concat(self.initialAgent)
                    var thumbnail = MetadataViews.IPFSFile(cid: self.initialOutputCID, path: nil)
                    if self.log.length > 0 { let latest = self.log[self.log.length - 1]!; latestDescription = latest.actionDescription; thumbnail = MetadataViews.IPFSFile(cid: latest.outputCID, path: nil) }
                    return MetadataViews.Display(name: "KintaGen Log #".concat(self.id.toString()), description: latestDescription, thumbnail: thumbnail)
                case Type<MetadataViews.Traits>():
                    let traits: [MetadataViews.Trait] = [
                        MetadataViews.Trait(name: "Initial Agent", value: self.initialAgent, displayType: "String", rarity: nil),
                        MetadataViews.Trait(name: "Initial Run Hash", value: self.initialRunHash, displayType: "String", rarity: nil),
                        MetadataViews.Trait(name: "Log Entries", value: self.log.length, displayType: "Number", rarity: nil)
                    ]
                    if self.log.length > 0 { let latest = self.log[self.log.length-1]!; traits.append(MetadataViews.Trait(name: "Latest Agent", value: latest.agent, displayType: "String", rarity: nil)) }
                    return MetadataViews.Traits(traits)
                case Type<MetadataViews.Serial>():
                    return MetadataViews.Serial(self.id)
                case Type<KintaGenNFT.WorkflowStepView>():
                    let story: [WorkflowStepView] = [WorkflowStepView(stepNumber: 0, agent: self.initialAgent, action: "Created initial data asset", resultCID: self.initialOutputCID, timestamp: self.initialTimestamp)]
                    var i = 0
                    while i < self.log.length { let entry = self.log[i]!; story.append(WorkflowStepView(stepNumber: i + 1, agent: entry.agent, action: entry.actionDescription, resultCID: entry.outputCID, timestamp: entry.timestamp)); i = i + 1 }
                    return story
            }
            return nil
        }
    }

    access(all) resource Collection: NonFungibleToken.Provider, NonFungibleToken.Receiver, NonFungibleToken.Collection, NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection {
        access(all) var ownedNFTs: @{UInt64: NonFungibleToken.NFT}
        
        init() { self.ownedNFTs <- {} }
        
        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let nft <- token as! @NFT
            let id = nft.id
            let old <- self.ownedNFTs.insert(key: id, <-nft)
            destroy old
            emit Deposit(id: id, to: self.owner?.address)
        }
        
        access(all) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let nft <- self.ownedNFTs.remove(key: withdrawID) ?? panic("NFT does not exist in this collection.")
            emit Withdraw(id: withdrawID, from: self.owner?.address)
            return <-nft
        }
        
        access(all) view fun getIDs(): [UInt64] { return self.ownedNFTs.keys }
        
        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id] as &{NonFungibleToken.NFT}?
        }

        access(all) view fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}? {
            if let nft = &self.ownedNFTs[id] as &{NonFungibleToken.NFT}? {
                return nft as &{ViewResolver.Resolver}
            }
            return nil
        }
        
        access(all) fun getSupportedNFTTypes(): {Type: Bool} {
            return {Type<@KintaGenNFT.NFT>(): true}
        }
        
        access(all) fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@KintaGenNFT.NFT>()
        }

    }

    access(all) resource Minter {
        access(all) fun mint(agent: String, outputCID: String, runHash: String): @NFT {
            // FIX: Increment totalSupply here, at the moment of creation.
            KintaGenNFT.totalSupply = KintaGenNFT.totalSupply + 1
            let newNFT <- create NFT(agent: agent, outputCID: outputCID, runHash: runHash)
            emit Minted(id: newNFT.id, agent: newNFT.initialAgent, runHash: newNFT.initialRunHash)
            return <- newNFT
        }
    }

    access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        return <- create Collection()
    }
    
    access(all) fun getContractViews(resourceType: Type?): [Type] {
        return [Type<MetadataViews.NFTCollectionData>(), Type<MetadataViews.NFTCollectionDisplay>()]
    }
    
    access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
        switch viewType {
            case Type<MetadataViews.NFTCollectionData>():
                // FIX: Remove the invalid "restricted type" syntax `{...}`.
                // This is the correct Cadence 1.0 syntax.
                return MetadataViews.NFTCollectionData(
                    storagePath: self.CollectionStoragePath,
                    publicPath: self.CollectionPublicPath,
                    publicCollection: Type<&KintaGenNFT.Collection>(),
                    publicLinkedType: Type<&KintaGenNFT.Collection>(),
                    createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
                        return <- KintaGenNFT.createEmptyCollection(nftType: Type<@KintaGenNFT.NFT>())
                    })
                )
            case Type<MetadataViews.NFTCollectionDisplay>():
                let media = MetadataViews.Media(file: MetadataViews.IPFSFile(cid: "bafkreie6j2nehq5gpcjzymf5qj3txgxgm5xcg2gqzquthy2z2g44zbdvda", path: nil), mediaType: "image/png")
                return MetadataViews.NFTCollectionDisplay(
                    name: "KintaGen Workflow NFTs", description: "NFTs that function as a permanent, on-chain logbook.",
                    externalURL: MetadataViews.ExternalURL("https://kintagen.com"), squareImage: media, bannerImage: media, socials: {}
                )
        }
        return nil
    }

    init() {
        self.totalSupply = 0
        self.CollectionStoragePath = /storage/kintagenNFTCollection
        self.CollectionPublicPath  = /public/kintagenNFTCollection
        self.MinterStoragePath     = /storage/kintagenNFTMinter
        self.MinterPublicPath      = /public/kintagenNFTMinter
        
        self.account.storage.save(<- create Minter(), to: self.MinterStoragePath)
        
        let minterCapability = self.account.capabilities.storage.issue<&KintaGenNFT.Minter>(self.MinterStoragePath)
        self.account.capabilities.publish(minterCapability, at: self.MinterPublicPath)
        
        emit ContractInitialized()
    }
}
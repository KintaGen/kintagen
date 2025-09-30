import "NonFungibleToken"
import "ViewResolver"
import "MetadataViews"
import "FlowToken"
import "FungibleToken"

access(all) contract KintaGenNFT: NonFungibleToken {

    access(all) var totalSupply: UInt64
    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath: PublicPath
    access(all) let MinterStoragePath: StoragePath
    access(all) let MinterPublicPath: PublicPath
    access(all) let FeeReceiverPublicPath: PublicPath
    access(all) let mintingFee: UFix64

    access(all) event ContractInitialized()
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event Deposit(id: UInt64, to: Address?)
    access(all) event Minted(id: UInt64, agent: String, runHash: String, owner: Address)
    access(all) event LogEntryAdded(nftID: UInt64, agent: String, outputCID: String)
    access(all) event LoggerAdded(nftID: UInt64, owner: Address, logger: Address)
    access(all) event LoggerRemoved(nftID: UInt64, owner: Address, logger: Address)

    access(all) struct LogEntry {
        access(all) let agent: String
        access(all) let actionDescription: String
        access(all) let outputCID: String
        access(all) let timestamp: UFix64
        init(agent: String, actionDescription: String, outputCID: String) {
            self.agent = agent
            self.actionDescription = actionDescription
            self.outputCID = outputCID
            self.timestamp = getCurrentBlock().timestamp
        }
    }

    access(all) struct WorkflowStepView {
        access(all) let stepNumber: Int
        access(all) let agent: String
        access(all) let action: String
        access(all) let resultCID: String
        access(all) let timestamp: UFix64
        init(stepNumber: Int, agent: String, action: String, resultCID: String, timestamp: UFix64) {
            self.stepNumber = stepNumber
            self.agent = agent
            self.action = action
            self.resultCID = resultCID
            self.timestamp = timestamp
        }
    }

    access(all) resource NFT: NonFungibleToken.NFT, ViewResolver.Resolver {
        access(all) let id: UInt64
        access(all) let initialAgent: String
        access(all) let initialOutputCID: String
        access(all) let initialRunHash: String
        access(all) let initialTimestamp: UFix64
        access(all) var log: [LogEntry]
        access(self) var authorizedLoggers: {Address: Bool}

        init(agent: String, outputCID: String, runHash: String, owner: Address) {
            KintaGenNFT.totalSupply = KintaGenNFT.totalSupply + 1
            self.id = KintaGenNFT.totalSupply
            self.initialAgent = agent
            self.initialOutputCID = outputCID
            self.initialRunHash = runHash
            self.initialTimestamp = getCurrentBlock().timestamp
            self.log = []
            self.authorizedLoggers = {}
            emit Minted(id: self.id, agent: self.initialAgent, runHash: self.initialRunHash, owner: owner)
        }

        access(all) fun addLogEntry(agent: String, actionDescription: String, outputCID: String) {
            let newEntry = LogEntry(agent: agent, actionDescription: actionDescription, outputCID: outputCID)
            self.log.append(newEntry)
            emit LogEntryAdded(nftID: self.id, agent: agent, outputCID: outputCID)
        }

        access(all) fun addLogger(address: Address) {
            self.authorizedLoggers[address] = true
            emit LoggerAdded(nftID: self.id, owner: self.owner!.address, logger: address)
        }

        access(all) fun removeLogger(address: Address) {
            self.authorizedLoggers.remove(key: address)
            emit LoggerRemoved(nftID: self.id, owner: self.owner!.address, logger: address)
        }

        access(all) view fun isLoggerAuthorized(address: Address): Bool {
            return self.authorizedLoggers[address] != nil
        }

        access(all) view fun getViews(): [Type] {
            return [
                Type<MetadataViews.Display>(),
                Type<MetadataViews.Traits>(),
                Type<MetadataViews.Serial>(),
                Type<KintaGenNFT.WorkflowStepView>()
            ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    var latestDescription = "Initial State: Created by ".concat(self.initialAgent)
                    var latestThumbnail = MetadataViews.IPFSFile(cid: self.initialOutputCID, path: nil)
                    if self.log.length > 0 {
                        let latestEntry = self.log[self.log.length - 1]
                        latestDescription = latestEntry.actionDescription
                        latestThumbnail = MetadataViews.IPFSFile(cid: latestEntry.outputCID, path: nil)
                    }
                    return MetadataViews.Display(name: "KintaGen Log #".concat(self.id.toString()), description: latestDescription, thumbnail: latestThumbnail)

                case Type<MetadataViews.Traits>():
                    var traits = [
                        MetadataViews.Trait(name: "Initial Agent", value: self.initialAgent, displayType: "String", rarity: nil),
                        MetadataViews.Trait(name: "Initial Run Hash", value: self.initialRunHash, displayType: "String", rarity: nil),
                        MetadataViews.Trait(name: "Log Entries", value: self.log.length, displayType: "Number", rarity: nil)
                    ]
                    if self.log.length > 0 {
                        let latestAgent = self.log[self.log.length - 1].agent
                        traits.append(MetadataViews.Trait(name: "Latest Agent", value: latestAgent, displayType: "String", rarity: nil))
                    }
                    return MetadataViews.Traits(traits)

                case Type<MetadataViews.Serial>():
                    return MetadataViews.Serial(self.id)

                case Type<KintaGenNFT.WorkflowStepView>():
                    let story: [WorkflowStepView] = []
                    story.append(
                        WorkflowStepView(
                            stepNumber: 0,
                            agent: self.initialAgent,
                            action: "Created initial data asset",
                            resultCID: self.initialOutputCID,
                            timestamp: self.initialTimestamp
                        )
                    )
                    var i = 0
                    while i < self.log.length {
                        let logEntry = self.log[i]
                        story.append(
                            WorkflowStepView(
                                stepNumber: i + 1,
                                agent: logEntry.agent,
                                action: logEntry.actionDescription,
                                resultCID: logEntry.outputCID,
                                timestamp: logEntry.timestamp
                            )
                        )
                        i = i + 1
                    }
                    return story
            }
            return nil
        }
        
        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- create Collection()
        }
    }

    access(all) resource Collection: NonFungibleToken.Collection, ViewResolver.ResolverCollection {
        access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}}

        init() {
            self.ownedNFTs <- {}
        }

        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let nft <- token as! @KintaGenNFT.NFT
            let id = nft.id
            let oldToken <- self.ownedNFTs[id] <- nft
            emit Deposit(id: id, to: self.owner?.address)
            destroy oldToken
        }

        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let token <- self.ownedNFTs.remove(key: withdrawID) ?? panic("missing NFT")
            emit Withdraw(id: token.id, from: self.owner?.address)
            return <-token
        }

        access(all) view fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id] as &{NonFungibleToken.NFT}?
        }

        access(all) view fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}? {
            let nft = self.borrowNFT(id)
            return nft as &{ViewResolver.Resolver}?
        }

        access(all) fun borrowPublicNFTForLogging(id: UInt64, loggerAddress: Address): &KintaGenNFT.NFT? {
            let nftRef = self.borrowNFT(id)
            if let ref = nftRef as? &KintaGenNFT.NFT {
                if ref.isLoggerAuthorized(address: loggerAddress) || self.owner?.address == loggerAddress {
                    return ref
                }
            }
            return nil
        }

        access(all) view fun getSupportedNFTTypes(): {Type: Bool} {
            return {Type<@KintaGenNFT.NFT>(): true}
        }

        access(all) view fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@KintaGenNFT.NFT>()
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- create Collection()
        }
    }

    access(all) resource Minter {
        access(all) fun mint(agent: String, outputCID: String, runHash: String, owner: Address): @NFT {
            return <- create NFT(agent: agent, outputCID: outputCID, runHash: runHash, owner: owner)
        }
    }

    access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        return <- create Collection()
    }
    
    access(all) view fun getContractViews(resourceType: Type?): [Type] {
        return [Type<MetadataViews.NFTCollectionData>(), Type<MetadataViews.NFTCollectionDisplay>()]
    }
    
    access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
        switch viewType {
            case Type<MetadataViews.NFTCollectionData>():
                let publicCollectionType = Type<&{NonFungibleToken.CollectionPublic, ViewResolver.ResolverCollection}>()
                return MetadataViews.NFTCollectionData(
                    storagePath: self.CollectionStoragePath,
                    publicPath: self.CollectionPublicPath,
                    publicCollection: publicCollectionType,
                    publicLinkedType: publicCollectionType,
                    createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
                        return <- KintaGenNFT.createEmptyCollection(nftType: Type<@KintaGenNFT.NFT>())
                    })
                )
            case Type<MetadataViews.NFTCollectionDisplay>():
                let media = MetadataViews.Media(file: MetadataViews.IPFSFile(cid: "bafkreie6j2nehq5gpcjzymf5qj3txgxgm5xcg2gqzquthy2z2g44zbdvda", path: nil), mediaType: "image/png")
                return MetadataViews.NFTCollectionDisplay(
                    name: "KintaGen Workflow NFTs",
                    description: "NFTs that function as a permanent, on-chain logbook for KintaGen's data-science workflows.",
                    externalURL: MetadataViews.ExternalURL("https://kintagen.com"),
                    squareImage: media,
                    bannerImage: media,
                    socials: {}
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
        self.FeeReceiverPublicPath = /public/kintagenFeeReceiver
        self.mintingFee = 0.00

        self.account.storage.save(<- create Minter(), to: self.MinterStoragePath)

        let minterCap = self.account.capabilities.storage.issue<&KintaGenNFT.Minter>(self.MinterStoragePath)
        self.account.capabilities.publish(minterCap, at: self.MinterPublicPath)

        let feeVault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
        self.account.storage.save(<-feeVault, to: /storage/kintagenFeeVault)

        let receiverCap = self.account.capabilities.storage.issue<&{FungibleToken.Receiver}>(/storage/kintagenFeeVault)
        self.account.capabilities.publish(receiverCap, at: self.FeeReceiverPublicPath)
        
        emit ContractInitialized()
    }
}
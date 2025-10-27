import "NonFungibleToken" 
import "MetadataViews" 
import "ViewResolver" 

access(all) contract PublicKintaGenNFTv2: NonFungibleToken {

    access(all) var totalSupply: UInt64

    access(all) event ContractInitialized()
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event Deposit(id: UInt64, to: Address?)
    access(all) event Minted(id: UInt64, agent: String, runHash: String)
    access(all) event LogEntryAdded(nftID: UInt64, agent: String, logCount: Int)

    access(all) struct LogEntry {
        access(all) let agent: String
        access(all) let name: String
        access(all) let description: String
        access(all) let ipfsHash: String
        access(all) let timestamp: UFix64

        init(agent: String, name: String, description: String, ipfsHash: String) {
            self.agent = agent
            self.name = name
            self.description = description
            self.ipfsHash = ipfsHash
            self.timestamp = getCurrentBlock().timestamp
        }
    }


    access(all) struct WorkflowStepView {
        access(all) let stepNumber: Int
        access(all) let agent: String
        access(all) let action: String
        access(all) let timestamp: UFix64
        init(stepNumber: Int, agent: String, action: String, timestamp: UFix64) {
            self.stepNumber = stepNumber
            self.agent = agent
            self.action = action
            self.timestamp = timestamp
        }
    }

    access(all) resource NFT: NonFungibleToken.NFT, ViewResolver.Resolver {
        access(all) let id: UInt64
        access(all) let initialAgent: String
        access(all) let initialRunHash: String
        access(all) let initialTimestamp: UFix64
        access(all) let image: MetadataViews.File
        access(all) var log: [LogEntry]

        init(id: UInt64, agent: String, runHash: String, image: MetadataViews.File) {
            self.id = id
            self.initialAgent = agent
            self.initialRunHash = runHash
            self.initialTimestamp = getCurrentBlock().timestamp
            self.image = image
            self.log = []
            emit Minted(id: self.id, agent: self.initialAgent, runHash: self.initialRunHash)
        }

        access(all) fun addLogEntry(agent: String, actionDescription: String) {
            let newEntry = LogEntry(agent: agent, actionDescription: actionDescription)
            self.log.append(newEntry)
            emit LogEntryAdded(nftID: self.id, agent: agent, logCount: self.log.length)
        }

        access(all) fun getViews(): [Type] {
            return [
                Type<MetadataViews.Display>(),
                Type<MetadataViews.Traits>(),
                Type<MetadataViews.Serial>(),
                Type<PublicKintaGenNFTv2.WorkflowStepView>()
            ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    var latestDescription = "Initial State: Created by ".concat(self.initialAgent)
                    if self.log.length > 0 {
                        let latestEntry = self.log[self.log.length - 1]
                        latestDescription = latestEntry.actionDescription
                    }
                    return MetadataViews.Display(
                        name: "KintaGen Log #".concat(self.id.toString()),
                        description: latestDescription,
                        thumbnail: self.image
                    )

                case Type<MetadataViews.Traits>():
                    var traitArray: [MetadataViews.Trait] = []
                    traitArray.append(MetadataViews.Trait(name: "Initial Agent", value: self.initialAgent, displayType: "String", rarity: nil))
                    traitArray.append(MetadataViews.Trait(name: "Initial Run Hash", value: self.initialRunHash, displayType: "String", rarity: nil))
                    traitArray.append(MetadataViews.Trait(name: "Log Entries", value: self.log.length, displayType: "Number", rarity: nil))
                    if self.log.length > 0 {
                        let latestAgent = self.log[self.log.length - 1].agent
                        traitArray.append(MetadataViews.Trait(name: "Latest Agent", value: latestAgent, displayType: "String", rarity: nil))
                    }
                    return MetadataViews.Traits(traitArray)

                case Type<MetadataViews.Serial>():
                    return MetadataViews.Serial(self.id)

                case Type<PubicKintaGenNFTv2.WorkflowStepView>():
                    var story: [PubicKintaGenNFTv2.WorkflowStepView] = []
                    story.append(
                        PubicKintaGenNFTv2.WorkflowStepView(stepNumber: 0, agent: self.initialAgent, action: "Workflow Initialized", timestamp: self.initialTimestamp)
                    )
                    var i = 0
                    while i < self.log.length {
                        let logEntry = self.log[i]
                        story.append(
                            PubicKintaGenNFTv2.WorkflowStepView(stepNumber: i + 1, agent: logEntry.agent, action: logEntry.actionDescription, timestamp: logEntry.timestamp)
                        )
                        i = i + 1
                    }
                    return story
            }
            return nil
        }
    }

    access(all) resource Collection: NonFungibleToken.Collection {
        access(all) var ownedNFTs: @{UInt64: NonFungibleToken.NFT}

        init() {
            self.ownedNFTs <- {}
        }

        access(all) fun withdraw(withdrawID: UInt64): @NonFungibleToken.NFT {
            let token <- self.ownedNFTs.remove(key: withdrawID) ?? panic("missing NFT")
            emit Withdraw(id: token.id, from: self.owner?.address)
            return <-token
        }

        access(all) fun deposit(token: @NonFungibleToken.NFT) {
            let nft <- token as! @PubicKintaGenNFTv2.NFT
            let id = nft.id
            let old <- self.ownedNFTs[id] <- nft
            emit Deposit(id: id, to: self.owner?.address)
            destroy old
        }

        access(all) fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) fun borrowNFT(id: UInt64): &NonFungibleToken.NFT? {
            return &self.ownedNFTs[id] as &NonFungibleToken.NFT?
        }

        access(all) fun createEmptyCollection(): @NonFungibleToken.Collection {
            return <- create Collection()
        }
    }

    access(all) fun createEmptyCollection(): @NonFungibleToken.Collection {
        return <- create Collection()
    }

    access(all) resource NFTMinter {
        access(all) fun mint(agent: String, runHash: String, image: MetadataViews.File): @NFT {
            self.account.save(<- create NFT(
                id: PubicKintaGenNFTv2.totalSupply,
                agent: agent,
                runHash: runHash,
                image: image
            ), to: /storage/PubicKintaGenNFTv2_NFT)
            PubicKintaGenNFTv2.totalSupply = PubicKintaGenNFTv2.totalSupply + 1
            return <- self.account.load<@NFT>(from: /storage/PubicKintaGenNFTv2_NFT)!
        }
    }

    init() {
        self.totalSupply = 0
        self.account.save(<- create NFTMinter(), to: /storage/PubicKintaGenNFTv2_Minter)
        emit ContractInitialized()
    }
}

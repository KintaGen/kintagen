import "NonFungibleToken"
import "MetadataViews"
import "ViewResolver"

access(all) contract PublicKintaGenNFTv3: NonFungibleToken {

    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath: PublicPath
    access(all) let MinterStoragePath: StoragePath

    access(all) var totalSupply: UInt64

    access(all) event ContractInitialized()
    access(all) event Minted(id: UInt64, project: String, principalInvestigator: String, runHash: String)
    access(all) event Deposit(id: UInt64, to: Address?)
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event LogEntryAdded(nftID: UInt64, stepTitle: String, ipfsHash: String, totalSteps: Int)

    access(all) struct LogEntry {
        access(all) let agent: String
        access(all) let title: String
        access(all) let description: String
        access(all) let ipfsHash: String
        access(all) let timestamp: UFix64

        init(agent: String, title: String, description: String, ipfsHash: String) {
            self.agent = agent
            self.title = title
            self.description = description
            self.ipfsHash = ipfsHash
            self.timestamp = getCurrentBlock().timestamp
        }
    }

    access(all) struct WorkflowStepView {
        access(all) let stepNumber: Int
        access(all) let agent: String
        access(all) let title: String
        access(all) let description: String
        access(all) let ipfsHash: String
        access(all) let timestamp: UFix64

        init(stepNumber: Int, agent: String, title: String, description: String, ipfsHash: String, timestamp: UFix64) {
            self.stepNumber = stepNumber
            self.agent = agent
            self.title = title
            self.description = description
            self.ipfsHash = ipfsHash
            self.timestamp = timestamp
        }
    }

    access(all) resource NFT: NonFungibleToken.NFT, ViewResolver.Resolver {
        access(all) let id: UInt64
        access(all) let projectName: String
        access(all) let projectSummary: String
        access(all) let projectCID: String
        access(all) let principalInvestigator: String
        access(all) let runHash: String
        access(all) let createdAt: UFix64
        access(all) var log: [LogEntry]

        init(projectName: String, projectSummary: String, projectCID: String, principalInvestigator: String, runHash: String) {
            self.id = PublicKintaGenNFTv3.totalSupply
            self.projectName = projectName
            self.projectSummary = projectSummary
            self.projectCID = projectCID
            self.principalInvestigator = principalInvestigator
            self.runHash = runHash
            self.createdAt = getCurrentBlock().timestamp
            self.log = []

            emit Minted(id: self.id, project: self.projectName, principalInvestigator: self.principalInvestigator, runHash: self.runHash)
        }

        access(all) fun addLogEntry(agent: String, title: String, description: String, ipfsHash: String) {
            let entry = LogEntry(agent: agent, title: title, description: description, ipfsHash: ipfsHash)
            self.log.append(entry)
            emit LogEntryAdded(nftID: self.id, stepTitle: title, ipfsHash: ipfsHash, totalSteps: self.log.length)
        }

        access(all) view fun getViews(): [Type] {
            return [
                Type<MetadataViews.Traits>(),
                Type<MetadataViews.Serial>(),
                Type<[PublicKintaGenNFTv3.WorkflowStepView]>()
            ]
        }

        access(all) fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.Display>():
                    return MetadataViews.Display(
                        name: self.projectName,
                        description: self.projectSummary,
                        thumbnail: MetadataViews.IPFSFile(
                            cid: self.projectCID,
                            path: nil
                        )
                    )
                case Type<MetadataViews.Traits>():
                    var traits: [MetadataViews.Trait] = []
                    traits.append(MetadataViews.Trait(name: "Principal Investigator", value: self.principalInvestigator, displayType: "String", rarity: nil))
                    traits.append(MetadataViews.Trait(name: "Project CID", value: self.projectCID, displayType: "String", rarity: nil))
                    traits.append(MetadataViews.Trait(name: "Run Hash", value: self.runHash, displayType: "String", rarity: nil))
                    traits.append(MetadataViews.Trait(name: "Log Count", value: self.log.length, displayType: "Number", rarity: nil))

                    var i = 0
                    while i < self.log.length {
                        let entry = self.log[i]
                        let label = "Log #".concat((i + 1).toString())
                        traits.append(MetadataViews.Trait(name: label.concat(" Title"), value: entry.title, displayType: "String", rarity: nil))
                        traits.append(MetadataViews.Trait(name: label.concat(" Agent"), value: entry.agent, displayType: "String", rarity: nil))
                        traits.append(MetadataViews.Trait(name: label.concat(" CID"), value: entry.ipfsHash, displayType: "String", rarity: nil))
                        i = i + 1
                    }
                    return MetadataViews.Traits(traits)

                case Type<MetadataViews.Serial>():
                    return MetadataViews.Serial(self.id)

                case Type<[PublicKintaGenNFTv3.WorkflowStepView]>():
                    var steps: [WorkflowStepView] = []
                    steps.append(
                        WorkflowStepView(
                            stepNumber: 0,
                            agent: self.principalInvestigator,
                            title: "Project Registered",
                            description: self.projectSummary,
                            ipfsHash: self.projectCID,
                            timestamp: self.createdAt
                        )
                    )

                    var index = 0
                    while index < self.log.length {
                        let entry = self.log[index]
                        steps.append(
                            WorkflowStepView(
                                stepNumber: index + 1,
                                agent: entry.agent,
                                title: entry.title,
                                description: entry.description,
                                ipfsHash: entry.ipfsHash,
                                timestamp: entry.timestamp
                            )
                        )
                        index = index + 1
                    }
                    return steps
            }
            return nil
        }

        access(all) view fun getLogCount(): Int {
            return self.log.length
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- PublicKintaGenNFTv3.createEmptyCollection(nftType: Type<@PublicKintaGenNFTv3.NFT>())
        }
    }

    access(all) resource Collection: NonFungibleToken.Collection, ViewResolver.ResolverCollection {
        access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}}

        init() {
            self.ownedNFTs <- {}
        }

        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let nft <- token as! @PublicKintaGenNFTv3.NFT
            let id = nft.id

            let old <- self.ownedNFTs[id] <- nft
            destroy old

            emit Deposit(id: id, to: self.owner?.address)
        }

        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let nft <- self.ownedNFTs.remove(key: withdrawID) ?? panic("NFT does not exist in collection.")
            emit Withdraw(id: nft.id, from: self.owner?.address)
            return <- nft
        }

        access(all) view fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) view fun getLength(): Int {
            return self.ownedNFTs.length
        }

        access(all) view fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id] as &{NonFungibleToken.NFT}?
        }

        access(all) view fun borrowViewResolver(id: UInt64): &{ViewResolver.Resolver}? {
            if let nft = &self.ownedNFTs[id] as &{NonFungibleToken.NFT}? {
                return nft as &{ViewResolver.Resolver}
            }
            return nil
        }

        access(all) view fun getSupportedNFTTypes(): {Type: Bool} {
            return { Type<@PublicKintaGenNFTv3.NFT>(): true }
        }

        access(all) view fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@PublicKintaGenNFTv3.NFT>()
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- PublicKintaGenNFTv3.createEmptyCollection(nftType: Type<@PublicKintaGenNFTv3.NFT>())
        }
    }

    access(all) resource Minter {
        access(all) fun mint(projectName: String, projectSummary: String, projectCID: String, principalInvestigator: String, runHash: String): @NFT {
            let token <- create NFT(
                projectName: projectName,
                projectSummary: projectSummary,
                projectCID: projectCID,
                principalInvestigator: principalInvestigator,
                runHash: runHash
            )
            PublicKintaGenNFTv3.totalSupply = PublicKintaGenNFTv3.totalSupply + 1
            return <- token
        }
    }

    access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
        return <- create Collection()
    }

    access(all) fun borrowMinter(): &PublicKintaGenNFTv3.Minter {
        return self.account.storage.borrow<&PublicKintaGenNFTv3.Minter>(from: self.MinterStoragePath)
            ?? panic("PublicKintaGenNFTv3 minter is not stored in contract account.")
    }

    access(all) view fun getContractViews(resourceType: Type?): [Type] {
        return [Type<MetadataViews.NFTCollectionData>(), Type<MetadataViews.NFTCollectionDisplay>()]
    }

    access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
        switch viewType {
            case Type<MetadataViews.NFTCollectionData>():
                return MetadataViews.NFTCollectionData(
                    storagePath: self.CollectionStoragePath,
                    publicPath: self.CollectionPublicPath,
                    publicCollection: Type<&PublicKintaGenNFTv3.Collection>(),
                    publicLinkedType: Type<&PublicKintaGenNFTv3.Collection>(),
                    createEmptyCollectionFunction: (fun(): @{NonFungibleToken.Collection} {
                        return <- PublicKintaGenNFTv3.createEmptyCollection(nftType: Type<@PublicKintaGenNFTv3.NFT>())
                    })
                )
            case Type<MetadataViews.NFTCollectionDisplay>():
                let media = MetadataViews.Media(
                    file: MetadataViews.IPFSFile(cid: "bafkreie6j2nehq5gpcjzymf5qj3txgxgm5xcg2gqzquthy2z2g44zbdvda", path: nil),
                    mediaType: "image/png"
                )
                return MetadataViews.NFTCollectionDisplay(
                    name: "KintaGen Scientific Projects",
                    description: "Workflow NFTs that capture the complete scientific project history, including every log entry.",
                    externalURL: MetadataViews.ExternalURL("https://kintagen.com"),
                    squareImage: media,
                    bannerImage: media,
                    socials: {}
                )
        }
        return nil
    }

    init() {
        self.CollectionStoragePath = /storage/kintagenV2Collection
        self.CollectionPublicPath = /public/kintagenV2Collection
        self.MinterStoragePath = /storage/kintagenV2Minter
        self.totalSupply = 0

        self.account.storage.save(<- create Minter(), to: self.MinterStoragePath)
        self.account.storage.save(<- create Collection(), to: self.CollectionStoragePath)

        let cap = self.account.capabilities.storage.issue<&PublicKintaGenNFTv3.Collection>(self.CollectionStoragePath)
        self.account.capabilities.publish(cap, at: self.CollectionPublicPath)

        emit ContractInitialized()
    }
}
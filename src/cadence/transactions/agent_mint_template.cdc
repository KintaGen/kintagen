// FILE: cadence/transactions/agent_mint_template.cdc

// This is the definitive template. Placeholders do NOT include "0x".

import NonFungibleToken from __NFT_ADDRESS__
import MetadataViews from __METADATA_VIEWS_ADDRESS__
import KintaGenNFT from __KINTAGEN_ADDRESS__

transaction(recipient: Address, agent: String, outputCID: String, runHash: String) {

    prepare(signer: AuthAccount) {
        if signer.borrow<&KintaGenNFT.Collection>(from: KintaGenNFT.CollectionStoragePath) == nil {
            let collection <- KintaGenNFT.createEmptyCollection(nftType: Type<@KintaGenNFT.NFT>())
            signer.save(<-collection, to: KintaGenNFT.CollectionStoragePath)
            signer.capabilities.unpublish(KintaGenNFT.CollectionPublicPath)
            let cap = signer.capabilities.storage.issue<&KintaGenNFT.Collection>(KintaGenNFT.CollectionStoragePath)
            signer.capabilities.publish(cap, at: KintaGenNFT.CollectionPublicPath)
        }
    }

    execute {
        let minter = signer.borrow<&KintaGenNFT.Minter>(from: KintaGenNFT.MinterStoragePath)
            ?? panic("Could not borrow Minter")

        let receiver = getAccount(recipient).getCapability(KintaGenNFT.CollectionPublicPath)
            .borrow<&{NonFungibleToken.Receiver}>()
            ?? panic("Could not borrow Receiver")

        let newNFT <- minter.mint(agent: agent, outputCID: outputCID, runHash: runHash)
        receiver.deposit(token: <-newNFT)
    }
}
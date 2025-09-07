// transactions/publish_minter.cdc
import KintaGenNFT from 0x3c16354a3859c81b

transaction {

    prepare(signer: auth(Capabilities) &Account) {
        
        let minterPublicPath: PublicPath = /public/kintagenNFTMinter

        signer.capabilities.unpublish(minterPublicPath)

        let minterCapability = signer.capabilities.storage.issue<&KintaGenNFT.Minter>(KintaGenNFT.MinterStoragePath)

        signer.capabilities.publish(minterCapability, at: minterPublicPath)

        log("Successfully published public Minter capability.")
    }
}
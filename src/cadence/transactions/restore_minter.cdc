// transactions/restore_minter.cdc
import KintaGenNFT from 0x3c16354a3859c81b

// This transaction must be signed by the contract owner.
// It re-creates the Minter resource that was destroyed by the cleanup script.
transaction {
    prepare(signer: auth(SaveValue) &Account) {

        // Check if a minter already exists to avoid errors.
        // If one is there, we don't need to do anything.
        if signer.storage.borrow<&KintaGenNFT.Minter>(from: KintaGenNFT.MinterStoragePath) != nil {
            log("Minter already exists. No action taken.")
            return
        }

        // If the Minter is missing, create a new one.
        let minter <- create KintaGenNFT.Minter()

        // Save the new Minter to storage. This requires `SaveValue` permission.
        signer.storage.save(<-minter, to: KintaGenNFT.MinterStoragePath)

        log("✅ Successfully created and saved a new Minter resource.")
    }
}
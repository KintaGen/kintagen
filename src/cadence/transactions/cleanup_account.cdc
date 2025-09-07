// This transaction removes old storage objects and capabilities to prepare an account
// for a fresh deployment of a new contract version. It does NOT remove contract code.

transaction {
    // We only need Storage and Capabilities permissions now.
    prepare(signer: auth(Storage, Capabilities) &Account) {
        
        log("Starting account storage cleanup...")

        // --- Remove the old Fee Vault from storage ---
        if let oldVault <- signer.storage.load<@AnyResource>(from: /storage/kintagenFeeVault) {
            destroy oldVault
            log("Destroyed old object at /storage/kintagenFeeVault.")
        }

        // --- Remove the old Minter from storage ---
        if let oldMinter <- signer.storage.load<@AnyResource>(from: /storage/kintagenNFTMinter) {
            destroy oldMinter
            log("Destroyed old object at /storage/kintagenNFTMinter.")
        }

        // --- Remove the old NFT Collection from storage ---
        if let oldCollection <- signer.storage.load<@AnyResource>(from: /storage/kintagenNFTCollection) {
            destroy oldCollection
            log("Destroyed old object at /storage/kintagenNFTCollection.")
        }

        // --- Unlink the old Public Capabilities ---
        signer.capabilities.unpublish(/public/kintagenNFTCollection)
        signer.capabilities.unpublish(/public/kintagenNFTMinter)
        signer.capabilities.unpublish(/public/kintagenFeeReceiver)
        log("Attempted to unlink old public capabilities.")
    }

    execute {
        log("✅ Account storage cleanup executed successfully.")
    }
}
transaction {
    prepare(signer: auth(Contracts) &Account) {
        // The `Contracts` authorization is required to manage contracts.
        signer.contracts.remove(name: "KintaGenNFT")
        log("✅ Successfully removed the KintaGenNFT contract.")
    }
}
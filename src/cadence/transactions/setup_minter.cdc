import WorkflowProvenance from 0x179b6b1cb6755e31

transaction {
    prepare(acct: auth(SaveValue) &Account) {
        // Create a new minter resource
        let minter <- WorkflowProvenance.createMinter()
        // Save the minter resource to the account's storage
        acct.storage.save(<-minter, to: WorkflowProvenance.MinterStoragePath)
    }
}

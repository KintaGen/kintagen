/*
================================================================================
THE DEFINITIVE FIX - PLEASE READ
================================================================================

THE PROBLEM:
All previous attempts failed because of a core Cadence concept: references vs. values.
- `nftRef.log` gives us a REFERENCE to the log array (`&[ExampleNFT.LogEntry]`).
- When we loop through it (`for entry in nftRef.log`), each `entry` is a
  REFERENCE to a struct (`&ExampleNFT.LogEntry`).
- We cannot append a REFERENCE to an array of VALUES.

THE SOLUTION (THE MANUAL, EXPLICIT METHOD):
We will create an empty array, loop through the references, and for each reference,
we will manually construct a brand new `LogEntry` struct (a VALUE) using the
data from the reference. Then we append this new VALUE to our array.

This approach is verbose, but it is the most fundamental and explicit way to
perform this action, and it bypasses all the confusing compiler inference
errors we have been fighting. This is the correct way.

================================================================================
*/

// FILE: cadence/scripts/read_full_log.cdc

import "ExampleNFT"

access(all) fun main(ownerAddress: Address, nftID: UInt64): [ExampleNFT.LogEntry] {

    let owner = getAccount(ownerAddress)

    let collectionCap = owner.capabilities.get<&ExampleNFT.Collection>(ExampleNFT.CollectionPublicPath)
    if collectionCap == nil {
        panic("This account does not have the required public capability.")
    }

    let collectionRef = collectionCap!.borrow()
        ?? panic("Could not borrow a reference to the Collection from the capability.")

    let nftRef = collectionRef.borrowNFT(nftID)! as! &ExampleNFT.NFT

    // --- THIS IS THE FINAL FIX ---
    // 1. Create a new, empty array that will hold the VALUES.
    let logCopy: [ExampleNFT.LogEntry] = []

    // 2. Loop through the REFERENCES in the NFT's log.
    for entry in nftRef.log {
        // 3. For each REFERENCE (`entry`), create a new VALUE (`newEntryStruct`)
        //    by calling the LogEntry initializer with the data from the reference.
        let newEntryStruct = ExampleNFT.LogEntry(
            agent: entry.agent,
            actionDescription: entry.actionDescription,
            outputCID: entry.outputCID
        )
        // 4. Append the new VALUE to our copy array.
        logCopy.append(newEntryStruct)
    }

    // 5. Return the new array of VALUES.
    return logCopy
}
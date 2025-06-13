const litActionCode = `
  const go = async () => {
    // This action's only job is to check for the Flow NFT.
    // It does not perform any decryption.
    console.log("Lit Action: Checking Flow NFT balance.");

    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const nftContract = new ethers.Contract(
        nftAddress,
        ["function balanceOf(address, uint256) view returns (uint256)"],
        provider
      );

      const balance = await nftContract.balanceOf(userAddress, tokenId);
      
      const hasAccess = balance.toNumber() > 0;

      console.log("Balance check complete. User has access:", hasAccess);
      
      // Return a simple boolean value indicating if the user has access.
      Lit.Actions.setResponse({ response: JSON.stringify({ hasAccess }) });

    } catch (e) {
      console.log("CRITICAL ERROR during RPC check:", e.message);
      // If the check fails, return false.
      Lit.Actions.setResponse({ response: JSON.stringify({ hasAccess: false, error: e.message }) });
    }
  };

  go();
`;

export default litActionCode;
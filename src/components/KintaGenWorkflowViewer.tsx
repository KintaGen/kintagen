// src/components/KintaGenWorkflowViewer.js

import React, { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";

// The Cadence script is now part of the component that uses it.
const getWorkflowStoryScript = `
  import ViewResolver from 0xViewResolver
  import KintaGenNFT from 0xKintaGenNFT

  access(all) fun main(ownerAddress: Address, nftID: UInt64): [KintaGenNFT.WorkflowStepView]? {
      let owner = getAccount(ownerAddress)
      let collectionCap = owner.capabilities.get<&{ViewResolver.ResolverCollection}>(KintaGenNFT.CollectionPublicPath)
      if collectionCap == nil {
          panic("Account does not have the required public KintaGenNFT resolver collection capability.")
      }
      let collectionRef = collectionCap!.borrow()
          ?? panic("Could not borrow a reference to the Collection.")
      let resolver = collectionRef.borrowViewResolver(id: nftID)
          ?? panic("Could not borrow view resolver for KintaGenNFT.")
      let storyView = resolver.resolveView(Type<KintaGenNFT.WorkflowStepView>())
      return storyView as? [KintaGenNFT.WorkflowStepView]
  }
`;

/**
 * KintaGenWorkflowViewer Component
 * 
 * A self-contained React component to fetch and display the workflow
 * history of a specific KintaGenNFT.
 * 
 * @param {object} props - The properties for the component.
 * @param {string} props.nftId - The ID of the KintaGenNFT to display.
 * @param {string} props.ownerAddress - The Flow address of the account that owns the NFT.
 */
function KintaGenWorkflowViewer({ nftId, ownerAddress }) {
  const [story, setStory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // useEffect will re-run whenever the nftId prop changes.
  useEffect(() => {
    const fetchStory = async () => {
      if (!nftId || !ownerAddress) return;

      setIsLoading(true);
      setError(null);
      setStory(null);

      try {
        const result = await fcl.query({
          cadence: getWorkflowStoryScript,
          args: (arg, t) => [
            arg(ownerAddress, t.Address),
            arg(nftId, t.UInt64)
          ]
        });
        setStory(result);
      } catch (err) {
        console.error(`Error fetching story for NFT #${nftId}:`, err);
        setError(`Failed to fetch story for NFT #${nftId}.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStory();
  }, [nftId, ownerAddress]); // Dependency array ensures this runs when props change

  if (isLoading) return <div className="viewer-loading">Loading workflow for NFT #{nftId}...</div>;
  if (error) return <div className="viewer-error">{error}</div>;
  if (!story) return null; // Or some placeholder

  return (
    <div className="timeline-container">
      <h2>Workflow for NFT #{nftId}</h2>
      {story.map((step) => (
        <div key={step.stepNumber} className="timeline-item">
          <div className="timeline-step-number">{step.stepNumber}</div>
          <div className="timeline-content">
            <h3>{step.action}</h3>
            <p><strong>Agent:</strong> {step.agent}</p>
            <p>
              <strong>Result CID:</strong> 
              <a href={`https://{step.resultCID}.ipfs.filcdn.io/`} target="_blank" rel="noopener noreferrer" className="cid-link">
                <span className="cid">{step.resultCID}</span>
              </a>
            </p>
            <p><small>Timestamp: {new Date(parseFloat(step.timestamp) * 1000).toLocaleString()}</small></p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default KintaGenWorkflowViewer;
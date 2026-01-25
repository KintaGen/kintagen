import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePageTitle } from '../hooks/usePageTitle';
import { useNostr } from '../contexts/NostrContext';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { Link } from 'react-router-dom';
import NostrLoginModal from '../components/NostrLoginModal';
import NostrEphemeralKeyInfo from '../components/feedback/NostrEphemeralKeyInfo'; // Your specific ephemeral key info component

import { useFlowCurrentUser } from '@onflow/react-sdk';

const FEEDBACK_GROUP_CHAT_ID = '3cf3df85c1ee58b712e7296c0d2ec66a68f9b9ccc846b63d2f830d974aa447cd';

const FeedbackPage: React.FC = () => {
  usePageTitle('Feedback & Suggestions - KintaGen');
  const { user: flowUser } = useFlowCurrentUser();

  const {
    pubkey: currentUserPubkey,
    privKey: currentUserPrivKey, // Access privKey from context
    isLoading: isNostrConnecting,
    feedbackMessages,
    isLoadingFeedbackMessages,
    sendFeedback,
    getNostrTime,
    getProfileForMessage,
    showNostrLoginModal,
    openNostrLoginModal,
    closeNostrLoginModal,
    connectWithFlow,
    connectWithExtension,
    generateAndConnectKeys, // This now sets privKey in context
  } = useNostr();

  const [feedbackText, setFeedbackText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // --- NEW STATE: Track if the current login is from ephemeral key generation ---
  const [isEphemeralLogin, setIsEphemeralLogin] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [feedbackMessages]);

  // Reset ephemeral login flag if the user logs out or connects differently
  useEffect(() => {
    if (!currentUserPubkey) {
      setIsEphemeralLogin(false);
    }
  }, [currentUserPubkey]);


  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    if (!currentUserPubkey) {
      setSendError("Please log in to Nostr to send feedback.");
      openNostrLoginModal();
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      await sendFeedback(feedbackText, FEEDBACK_GROUP_CHAT_ID);
      setFeedbackText('');
    } catch (err: any) {
      console.error("Failed to publish feedback:", err);
      setSendError(err.message || "Failed to send feedback. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleLoginWithFlow = async () => {
    setIsEphemeralLogin(false);
    await connectWithFlow();
  };

  const handleLoginWithExtension = async () => {
    setIsEphemeralLogin(false); // Not an ephemeral login
    await connectWithExtension();
  };

  const handleGenerateNewKeys = async () => {
    await generateAndConnectKeys();

    setIsEphemeralLogin(true);

  };


  return (
    <>
      <Helmet>
        <title>Feedback & Suggestions - KintaGen</title>
        <meta name="description" content="Share your feedback and suggestions for the KintaGen app." />
      </Helmet>

      <div className="max-w-3xl mx-auto p-4 md:p-8 bg-gray-900 min-h-screen text-white">
        <h1 className="text-3xl font-bold mb-6 text-center">Feedback & Suggestions</h1>
        <p className="text-gray-400 text-center mb-8">
          Share your thoughts, report bugs, or suggest new features for KintaGen.
          All feedback is public and sent to our dedicated feedback channel.
        </p>

        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-3">Community Feedback</h2>

          <div className="messages-container h-96 overflow-y-auto pr-2 mb-4 custom-scrollbar">
            {isLoadingFeedbackMessages && (
              <div className="text-center text-gray-400 py-8">Loading feedback messages...</div>
            )}
            {!isLoadingFeedbackMessages && feedbackMessages.length === 0 && (
              <div className="text-center text-gray-500 py-8">No feedback yet. Be the first!</div>
            )}
            {!isLoadingFeedbackMessages && feedbackMessages.map((msg, index) => {
              const senderProfile = getProfileForMessage(msg.pubkey);
              const isCurrentUser = currentUserPubkey === msg.pubkey;

              return (
                <div key={msg.id} className={`flex items-start gap-3 mb-4 ${isCurrentUser ? 'justify-end' : ''}`}>
                  {!isCurrentUser && (
                    <Link to={`/profile/${msg.pubkey}`} className="block flex-shrink-0">
                      <img
                        src={senderProfile?.picture || "https://via.placeholder.com/40/4B5563/D1D5DB?text=No+Pic"}
                        alt={senderProfile?.name || "Anonymous"}
                        className="w-10 h-10 rounded-full object-cover border border-purple-500"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/40/4B5563/D1D5DB?text=No+Pic"; }}
                      />
                    </Link>
                  )}
                  <div className={`flex flex-col max-w-[75%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`font-semibold ${isCurrentUser ? 'text-purple-300' : 'text-cyan-300'}`}>
                        {senderProfile?.name || msg.pubkey.substring(0, 8)}
                      </span>
                      <span className="text-xs text-gray-500">{getNostrTime(msg.created_at)}</span>
                    </div>
                    <div className={`p-3 rounded-lg ${isCurrentUser ? 'bg-purple-700' : 'bg-gray-700'} text-white break-words`}>
                      {msg.content}
                    </div>
                  </div>
                  {isCurrentUser && (
                    <Link to={`/profile/${msg.pubkey}`} className="block flex-shrink-0">
                      <img
                        src={senderProfile?.picture || "https://via.placeholder.com/40/4B5563/D1D5DB?text=No+Pic"}
                        alt={senderProfile?.name || "Anonymous"}
                        className="w-10 h-10 rounded-full object-cover border border-purple-500"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/40/4B5563/D1D5DB?text=No+Pic"; }}
                      />
                    </Link>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>


          <form onSubmit={handleSubmitFeedback} className="flex gap-2">
            <textarea
              className="flex-grow p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50 text-white placeholder-gray-400 resize-none h-24"
              placeholder={currentUserPubkey ? "Type your feedback here..." : "Please log in to send feedback..."}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              disabled={isSending || !currentUserPubkey || isNostrConnecting}
            ></textarea>
            <button
              type="submit"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSending || !feedbackText.trim() || !currentUserPubkey || isNostrConnecting}
            >
              {isSending ? (
                <span className="animate-pulse">Sending...</span>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                  Send
                </>
              )}
            </button>
          </form>
          {sendError && (
            <p className="text-red-400 text-sm mt-3 text-center">{sendError}</p>
          )}
          {!currentUserPubkey && (
             <p className="text-yellow-400 text-sm mt-3 text-center">
                You need to be logged in with a Nostr key to submit feedback.
                <button
                    onClick={openNostrLoginModal}
                    className="ml-2 text-purple-400 hover:underline"
                    disabled={isNostrConnecting}
                >
                    Connect Now
                </button>
             </p>
          )}
        </div>

        {/* --- CONDITIONAL RENDERING OF EPHEMERAL KEY INFO --- */}
        {/* Only show if the user logged in specifically by generating new keys AND we have the private key */}
        {isEphemeralLogin && currentUserPubkey && currentUserPrivKey && (
          <div className="mt-8"> {/* Added div for consistent styling margin-top */}
            <NostrEphemeralKeyInfo 
                pubkey={currentUserPubkey} 
                privKey={currentUserPrivKey} 
            />
          </div>
        )}
      </div>

      <NostrLoginModal
        isOpen={showNostrLoginModal}
        onClose={closeNostrLoginModal}
        onLoginWithFlow={handleLoginWithFlow}
        onLoginWithExtension={handleLoginWithExtension}
        onGenerateNewKeys={handleGenerateNewKeys}
        isConnecting={isNostrConnecting}
        flowUserLoggedIn={flowUser?.loggedIn || false}
      />
    </>
  );
};

export default FeedbackPage;
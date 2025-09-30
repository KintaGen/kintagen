import React from 'react';
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';

// Define the props the component will accept
interface FeedbackButtonProps {
  feedbackFormUrl: string;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({ feedbackFormUrl }) => {
  return (
    // This is the exact JSX you provided, now self-contained
    <div className="p-4 border-t border-gray-700">
      <a
        href={feedbackFormUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
      >
        <ChatBubbleBottomCenterTextIcon className="h-5 w-5" />
        <span>Provide Feedback</span>
      </a>
    </div>
  );
};

export default FeedbackButton;
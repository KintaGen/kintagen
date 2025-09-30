import React from 'react';
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline'; // Using outline for a cleaner, secondary look

const Footer: React.FC = () => {
  // --- IMPORTANT ---
  // Replace this placeholder with the actual link to your Google Form
  const feedbackFormUrl = 'https://forms.gle/your-feedback-form-link';

  return (
    <footer className="bg-gray-900 border-t border-gray-700/50 text-gray-400 mt-16">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-center sm:text-left">
          &copy; {new Date().getFullYear()} KintaGen Platform. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
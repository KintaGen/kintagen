// src/components/InfoPopover.tsx
import React from 'react';
import { Popover, Transition,PopoverButton,PopoverPanel } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface InfoPopoverProps {
  title: string;
  children: React.ReactNode; // The content of the popover
}
// Define the type for the object that Popover provides to its child function
interface PopoverRenderProps {
    open: boolean;
    close: (ref?: React.RefObject<HTMLElement>) => void; // Include 'close' for completeness
  }
const InfoPopover: React.FC<InfoPopoverProps> = ({ title, children }) => {
  return (
    <Popover className="relative">
      {({ open }: PopoverRenderProps) => (
        <>
          <PopoverButton
            className={`
              ml-2 p-1 rounded-full text-gray-500 hover:text-white hover:bg-gray-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75
              transition-colors
              ${open ? 'text-white bg-gray-700' : ''}
            `}
            aria-label={`More information about ${title}`}
          >
            <InformationCircleIcon className="h-5 w-5" />
          </PopoverButton>
          
          <Transition
            as={React.Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel 
              as={motion.div}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-10 w-screen max-w-sm px-4 mt-3 transform -translate-x-full left-1/2 sm:px-0 lg:max-w-md"
            >
              <div className="overflow-hidden rounded-lg shadow-2xl ring-1 ring-black/5">
                <div className="relative bg-gray-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                  <div className="text-sm text-gray-300 space-y-3">
                    {children}
                  </div>
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default InfoPopover;
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as fcl from '@onflow/fcl';

// --- 1. Import your FCL configuration file ---
// This ensures that FCL is configured before any other component tries to use it.
// The path might need to be adjusted based on your folder structure.
import '../fcl-config';

// --- 2. Define the types for our context ---

// Describes the shape of the user object provided by FCL
export interface FclUser {
  loggedIn: boolean | null; // null means not yet determined, true/false means determined
  addr?: string;
  // FCL provides more fields, but we only need these for most UI purposes
}

// Describes the shape of the value our context will provide
export interface AuthContextType {
  user: FclUser;
  logIn: () => void;
  logOut: () => void;
  signUp: () => void; // FCL also supports a sign-up flow
}

// --- 3. Create the React Context ---
// We provide a default value that matches the AuthContextType interface.
const AuthContext = createContext<AuthContextType>({
  user: { loggedIn: null },
  logIn: () => console.error('logIn function called outside of AuthProvider'),
  logOut: () => console.error('logOut function called outside of AuthProvider'),
  signUp: () => console.error('signUp function called outside of AuthProvider'),
});

// --- 4. Create a custom hook for easy consumption ---
// This is a best practice. Instead of components importing `useContext` and `AuthContext`
// every time, they can just import and call `useAuth()`.
export const useAuth = () => useContext(AuthContext);

// --- 5. Create the Provider Component ---
// This component will wrap our application and manage the authentication state.
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State to hold the current user object
  const [user, setUser] = useState<FclUser>({ loggedIn: null });

  // Use useEffect to subscribe to FCL's currentUser state.
  // This is the magic that keeps our app's state in sync with the user's wallet.
  useEffect(() => {
    // fcl.currentUser.subscribe returns an unsubscribe function.
    // By returning it from useEffect, React will automatically call it on component unmount,
    // preventing memory leaks.
    return fcl.currentUser.subscribe(setUser);
  }, []); // The empty dependency array ensures this effect runs only once on mount.

  // --- Helper functions to interact with FCL ---

  /**
   * Triggers the FCL wallet discovery and login/authentication process.
   */
  const logIn = () => {
    fcl.authenticate();
  };

  /**
   * Triggers the FCL sign-up process.
   */
  const signUp = () => {
    fcl.signUp();
  };

  /**
   * Logs the user out and clears the session.
   */
  const logOut = () => {
    fcl.unauthenticate();
  };

  // The value object that will be provided to all children of this provider.
  const value = {
    user,
    logIn,
    logOut,
    signUp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
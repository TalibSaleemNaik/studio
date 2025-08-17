
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

// Helper to set a cookie on the client
const setCookie = (name: string, value: string, days: number) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    // Make sure the path is root so the middleware can access it.
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

// Helper to erase a cookie on the client
const eraseCookie = (name: string) => {   
    // Set cookie to a past date to expire it immediately
    document.cookie = name+'=; Max-Age=-99999999; path=/;';  
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setLoading(true); // Start loading state
      if (firebaseUser) {
        // User is signed in.
        setUser(firebaseUser);
        
        // IMPORTANT: Ensure firebaseUser object, especially email, is fully populated before setting the cookie.
        if (firebaseUser.uid && firebaseUser.email) {
          const userData = JSON.stringify({ 
            uid: firebaseUser.uid, 
            email: firebaseUser.email, 
            displayName: firebaseUser.displayName, 
            photoURL: firebaseUser.photoURL 
          });
          setCookie('user-session', userData, 7);
        }
      } else {
        // User is signed out.
        setUser(null);
        eraseCookie('user-session');
      }
      setLoading(false); // End loading state
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) {
      return; // Do nothing while loading to prevent premature redirects
    }

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
    
    // If user is not logged in and not on an auth page, redirect to login.
    if (!user && !isAuthPage) {
      router.push('/login');
    }
    
    // If user is logged in and on an auth page, redirect to dashboard.
    if (user && isAuthPage) {
      router.push('/dashboard');
    }

  }, [user, loading, pathname, router]);


  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

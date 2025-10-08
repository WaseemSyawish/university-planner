// src/components/Layout.js
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { useRouter } from 'next/router';

const Layout = ({ children }) => {
  // start collapsed by default to give the main content more horizontal space
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  // Handle hydration to prevent layout shift
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Call hooks unconditionally at top-level
  const router = useRouter();

  // Prevent rendering until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="flex items-center justify-center h-screen">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  const publicPaths = ['/', '/landing', '/signin', '/signup', '/signout'];
  const isPublic = publicPaths.includes(router.pathname);

  // Sidebar rendered in-flow so it naturally takes up space and the main content
  // sits beside it; this avoids the large empty left gutter and preserves
  // the expected application layout for users.
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="flex">
        {/* Sidebar - keep it in the flow so it contributes to layout width */}
        {!isPublic && (
          <div className="flex-shrink-0">
            <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          <div className={`flex-1 flex flex-col overflow-hidden`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
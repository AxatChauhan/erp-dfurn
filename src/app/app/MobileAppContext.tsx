'use client';

import React, { createContext, useContext, useMemo } from 'react';

interface MobileAppContextType {
  userRole: string;
  userName: string;
}

const MobileAppContext = createContext<MobileAppContextType | undefined>(undefined);

export function MobileAppProvider({
  children,
  userRole,
  userName,
}: {
  children: React.ReactNode;
  userRole: string;
  userName: string;
}) {
  const value = useMemo(
    () => ({
      userRole,
      userName,
    }),
    [userRole, userName]
  );

  return (
    <MobileAppContext.Provider value={value}>
      {children}
    </MobileAppContext.Provider>
  );
}

export function useMobileApp() {
  const context = useContext(MobileAppContext);
  if (!context) {
    throw new Error('useMobileApp must be used within a MobileAppProvider');
  }
  return context;
}

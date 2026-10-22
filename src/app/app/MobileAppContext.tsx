'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type MobileActionType = 'NEW_ENQUIRY' | 'NEW_QUOTATION' | null;

interface MobileAppContextType {
  isActionSheetOpen: boolean;
  openActionSheet: () => void;
  closeActionSheet: () => void;
  activeModal: MobileActionType;
  openModal: (modal: MobileActionType) => void;
  closeModal: () => void;
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
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<MobileActionType>(null);

  const openActionSheet = useCallback(() => setIsActionSheetOpen(true), []);
  const closeActionSheet = useCallback(() => setIsActionSheetOpen(false), []);

  const openModal = useCallback((modal: MobileActionType) => {
    setIsActionSheetOpen(false);
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => setActiveModal(null), []);

  const value = useMemo(
    () => ({
      isActionSheetOpen,
      openActionSheet,
      closeActionSheet,
      activeModal,
      openModal,
      closeModal,
      userRole,
      userName,
    }),
    [isActionSheetOpen, openActionSheet, closeActionSheet, activeModal, openModal, closeModal, userRole, userName]
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

import React, { createContext, useContext, useState } from 'react';

interface UserInfo {
  name: string;
  age: number;
  sector: string;
  incomeLevel: string;
  state: string;
}

interface UserInfoContextType {
  userInfo: UserInfo | null;
  setUserInfo: React.Dispatch<React.SetStateAction<UserInfo | null>>;
}

const UserInfoContext = createContext<UserInfoContextType | undefined>(undefined);

export function useUserInfo() {
  const context = useContext(UserInfoContext);
  if (context === undefined) {
    throw new Error('useUserInfo must be used within a UserInfoProvider');
  }
  return context;
}

export function UserInfoProvider({ children }: { children: React.ReactNode }) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const value = {
    userInfo,
    setUserInfo,
  };

  return (
    <UserInfoContext.Provider value={value}>
      {children}
    </UserInfoContext.Provider>
  );
}
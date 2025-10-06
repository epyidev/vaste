import React, { createContext, useContext, useState, ReactNode } from 'react';
import { LoadingStep } from '../components/ui';

interface LoadingContextType {
  steps: LoadingStep[];
  updateStep: (name: string, status: LoadingStep['status'], detail?: string) => void;
  addStep: (name: string, detail?: string) => void;
  clearSteps: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<LoadingStep[]>([]);

  const updateStep = (name: string, status: LoadingStep['status'], detail?: string) => {
    setSteps(prevSteps => {
      const existingIndex = prevSteps.findIndex(s => s.name === name);
      if (existingIndex >= 0) {
        const newSteps = [...prevSteps];
        newSteps[existingIndex] = { name, status, detail };
        return newSteps;
      } else {
        return [...prevSteps, { name, status, detail }];
      }
    });
  };

  const addStep = (name: string, detail?: string) => {
    setSteps(prevSteps => [...prevSteps, { name, status: 'pending', detail }]);
  };

  const clearSteps = () => {
    setSteps([]);
  };

  return (
    <LoadingContext.Provider value={{ steps, updateStep, addStep, clearSteps }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

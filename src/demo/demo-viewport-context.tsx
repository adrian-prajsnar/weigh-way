import { createContext, ReactNode, useContext } from 'react';

type DemoViewport = {
  width: number;
  height: number;
};

const DemoViewportContext = createContext<DemoViewport | null>(null);

export function DemoViewportProvider({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <DemoViewportContext.Provider value={{ width, height }}>
      {children}
    </DemoViewportContext.Provider>
  );
}

export function useDemoViewport(): DemoViewport | null {
  return useContext(DemoViewportContext);
}

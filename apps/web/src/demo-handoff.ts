import { createContext, useContext } from 'react';
export interface DemoHandoff { principalId: 'finance-a' | 'accounting-a' | 'auditor-b'; path: string; token?: string; }
// Only carries the next route in memory. Authentication and authorization still run on the server.
export const DemoHandoffContext = createContext<(next: DemoHandoff) => Promise<void>>(async () => {});
export const useDemoHandoff = () => useContext(DemoHandoffContext);

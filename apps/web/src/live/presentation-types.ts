import type { ReactNode } from 'react';
import type { Proof, TrustedDeployment, VerificationResult, VerificationTraceEvent } from './verification';

export type LiveStage = 'ready' | 'pdf' | 'hash' | 'sign' | 'register' | 'included' | 'verify' | 'finalized' | 'result';
export interface PresentationProps {
  stage: LiveStage;
  mode: 'recorded' | 'live';
  busy: boolean;
  customer: string;
  asOf: string;
  proof?: Partial<Proof>;
  trusted?: TrustedDeployment;
  verificationProof?: Proof;
  verificationTrust?: TrustedDeployment;
  originalSize?: number;
  pdfHeaderHex?: string;
  selectedName?: string;
  selectedProofName?: string;
  inputSource?: 'received' | 'sample';
  inputError: string;
  inputLoading: boolean;
  canDownload: boolean;
  selectedVariant: 'original' | 'altered' | 'upload';
  result?: VerificationResult;
  verificationTrace?: VerificationTraceEvent[];
  receiptBlock?: string;
  canVerify: boolean;
  notice: string;
  error: string;
  setup: ReactNode;
  evidence: ReactNode;
  onVerify: () => void;
  onSelectSample: (variant: 'original' | 'altered') => void;
  onSelectFiles: (files: File[]) => void;
  onClearFiles: () => void;
  onDownload: (variant: 'original' | 'altered') => void;
  onDownloadProof: () => void;
}

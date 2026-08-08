import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { submitKycStep } from './api';
import { tokens } from '@/lib/tokens';
import { Button } from '@/components/Button';

const STEP_LABELS = ['DETAILS', 'DOCUMENT', 'REVIEW'] as const;

export function IdentityVerificationPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [documentType, setDocumentType] = useState("Passport");
  const [documentNumber, setDocumentNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: () => submitKycStep({ documentType }),
    onSuccess: () => setSubmitted(true),
  });

  return (
    <div className="mx-auto px-10 pt-8 pb-16" style={{ maxWidth: 640 }}>
      <div className="pb-2">
        <h1 className="font-display font-black text-5xl tracking-[1px] uppercase leading-none">
          Identity verification
        </h1>
        <p className="text-md text-lichen mt-1.5 leading-[1.6]">
          Required once, before your first withdrawal. Takes about five minutes.
        </p>
      </div>

      <div className="flex items-center py-8">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state = submitted || n < currentStep ? 'done' : n === currentStep ? 'current' : 'upcoming';
          const borderColor = state === 'upcoming' ? tokens.lichen : tokens.zone;
          const fill = state === 'done' ? tokens.zone : 'transparent';
          const numColor = state === 'done' ? tokens.ground : state === 'current' ? tokens.zone : tokens.lichen;
          return (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-start">
                <div
                  className="w-7 h-7 flex items-center justify-center font-mono text-sm"
                  style={{ border: `1px solid ${borderColor}`, background: fill, color: numColor }}
                >
                  {n}
                </div>
                <span className="font-mono text-xs tracking-[1px] text-lichen mt-2">{label}</span>
              </div>
              {n < STEP_LABELS.length && <div className="h-px bg-lichen flex-1" style={{ margin: '0 12px 22px' }} />}
            </div>
          );
        })}
      </div>

      <div className="border border-lichen bg-panel p-8">
        {submitted ? (
          <>
            <div className="font-display font-bold text-md tracking-[1px] uppercase mb-3" style={{ color: tokens.zone }}>
              Verification submitted
            </div>
            <div className="text-sm text-lichen leading-[1.6]">
              We have what we need. Your details are being confirmed — this is usually instant in this demo
              environment. You can leave this page; your Profile will show the result.
            </div>
          </>
        ) : currentStep === 1 ? (
          <>
            <div className="font-display font-bold text-md tracking-[1px] uppercase mb-5">Step 1 — Your details</div>

            <label className="font-sans text-sm text-lichen block mb-1.5">Full legal name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-ground border border-lichen text-bone font-sans text-base p-2.5 mb-5 box-border"
            />

            <label className="font-sans text-sm text-lichen block mb-1.5">Date of birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full bg-ground border border-lichen text-bone font-mono text-base p-2.5 mb-6 box-border"
            />

            <div className="text-sm text-lichen leading-[1.6] mb-6">
              This should match the name on the document you'll provide next.
            </div>

            <div className="flex gap-3">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => setCurrentStep(2)}
                disabled={!fullName.trim() || !dateOfBirth}
              >
                Continue
              </Button>
            </div>
          </>
        ) : currentStep === 2 ? (
          <>
            <div className="font-display font-bold text-md tracking-[1px] uppercase mb-5">
              Step 2 — Government-issued document
            </div>

            <label className="font-sans text-sm text-lichen block mb-1.5">Document type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full bg-ground border border-lichen text-bone font-sans text-base p-2.5 mb-5"
            >
              <option>Passport</option>
              <option>Driver's license</option>
              <option>National ID</option>
            </select>

            <label className="font-sans text-sm text-lichen block mb-1.5">Document number</label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full bg-ground border border-lichen text-bone font-mono text-base p-2.5 mb-6 box-border"
            />

            <div className="text-sm text-lichen leading-[1.6] mb-6">
              Used only to confirm you're eligible to hold and withdraw tokens under regional rules. Not shared with
              other players.
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => setCurrentStep(3)} disabled={!documentNumber}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="font-display font-bold text-md tracking-[1px] uppercase mb-5">Step 3 — Review</div>

            <div className="flex justify-between py-2.5 border-b border-row-rule">
              <span className="text-sm text-lichen">Full legal name</span>
              <span className="text-base">{fullName || '—'}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-row-rule">
              <span className="text-sm text-lichen">Date of birth</span>
              <span className="text-base font-mono">{dateOfBirth || '—'}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-row-rule mb-6">
              <span className="text-sm text-lichen">Document</span>
              <span className="text-base">
                {documentType} · {documentNumber || '—'}
              </span>
            </div>

            <div className="text-sm text-lichen leading-[1.6] mb-6">
              Double check these details match your document exactly. Once submitted, you can't edit this
              verification attempt.
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending ? 'Submitting…' : 'Submit verification'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

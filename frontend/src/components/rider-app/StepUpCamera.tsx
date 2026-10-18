import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Btn, Label } from '../ui/kit';
import { api } from '../../services/api';
import type { Session } from '../../types/api';

interface StepUpCameraProps {
  session: Session;
  onVerified: (updatedSession: Session) => void;
  onBlocked: (updatedSession: Session) => void;
  onClose?: () => void;
}

export const StepUpCamera: React.FC<StepUpCameraProps> = ({
  session,
  onVerified,
  onBlocked,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pollStatus, setPollStatus] = useState<string>('PENDING_REVIEW');
  const [terminalVerdict, setTerminalVerdict] = useState<string | null>(null);

  // Stop camera tracks helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not supported on this browser/environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHasPermission(true);
    } catch (err: unknown) {
      stopCamera();
      setHasPermission(false);
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Could not access front camera. Please grant camera permission.'
      );
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera]);

  // Poll session state after submission
  useEffect(() => {
    if (!isSubmitted) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const fresh = await api.getSession(session.session_id);
        if (!isSubscribed) return;

        setPollStatus(fresh.status);
        if (fresh.status === 'VERIFIED') {
          clearInterval(interval);
          setTerminalVerdict(fresh.verdict || 'Identity verified by reviewer');
          setTimeout(() => onVerified(fresh), 1500);
        } else if (fresh.status === 'BLOCKED') {
          clearInterval(interval);
          setTerminalVerdict(fresh.verdict || 'Account access blocked by reviewer');
          setTimeout(() => onBlocked(fresh), 2000);
        }
      } catch {
        // network polling error, retry next tick
      }
    }, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [isSubmitted, session.session_id, onVerified, onBlocked]);

  // Capture still frame to JPEG 0.6
  const handleCaptureAndSubmit = async () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

      // Stop camera now that frame is captured
      stopCamera();

      // Submit to backend stepup endpoint
      await api.submitStepUp(session.session_id, dataUrl);
      setIsSubmitted(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to capture or upload verification selfie');
    } finally {
      setIsCapturing(false);
    }
  };

  const corner = 'absolute h-6 w-6 border-paper';
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <Label>Step up · session {session.session_id.slice(0, 8)}</Label>
          {onClose && !isSubmitted && (
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              aria-label="Close"
              className="text-mute hover:text-paper"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {!isSubmitted ? (
          <>
            <h3 className="mt-4 font-serif text-[38px] leading-[0.98] text-paper">
              Show us <em>it's you.</em>
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
              Something about this login didn't feel like you. One selfie, checked by a person on the operations team.
            </p>

            <div className="relative mt-6 aspect-[3/4] w-full overflow-hidden bg-ink-2">
              {hasPermission === false ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="font-serif text-2xl text-paper">Camera is off</div>
                  <p className="font-mono text-[12px] text-mute">{cameraError || 'Camera permission denied.'}</p>
                  <Btn variant="line" onClick={startCamera}>
                    Try the camera again
                  </Btn>
                </div>
              ) : (
                <>
                  <video ref={videoRef} playsInline muted className="mirror h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-[14%_18%] rounded-[50%] border border-dashed border-paper/50" />
                  <span className={`${corner} left-3 top-3 border-l border-t`} />
                  <span className={`${corner} right-3 top-3 border-r border-t`} />
                  <span className={`${corner} bottom-3 left-3 border-b border-l`} />
                  <span className={`${corner} bottom-3 right-3 border-b border-r`} />
                  <span className="label absolute bottom-4 left-1/2 -translate-x-1/2 !text-paper-2">Face inside the oval</span>
                </>
              )}
            </div>

            <div className="mt-auto flex flex-col items-center pt-6">
              <button
                onClick={handleCaptureAndSubmit}
                disabled={isCapturing || hasPermission !== true}
                aria-label="Capture and send selfie"
                className="group flex h-[74px] w-[74px] items-center justify-center rounded-full border-2 border-paper transition disabled:opacity-35"
              >
                <span className={`h-[58px] w-[58px] rounded-full bg-paper transition group-active:scale-90 ${isCapturing ? 'animate-pulse' : ''}`} />
              </button>
              <span className="label mt-3">{isCapturing ? 'Sending' : 'Capture and send'}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col justify-center">
            {pollStatus === 'VERIFIED' ? (
              <div className="border-l-2 border-allow pl-5">
                <Label className="!text-allow">Verified by a reviewer</Label>
                <h4 className="mt-2 font-serif text-[40px] leading-none text-paper">Welcome back.</h4>
                <p className="mt-3 text-[14px] text-paper-2">{terminalVerdict}</p>
                <p className="mt-1 text-[12px] text-mute">Resuming your shift</p>
              </div>
            ) : pollStatus === 'BLOCKED' ? (
              <div className="border-l-2 border-review pl-5">
                <Label className="!text-review">Access blocked</Label>
                <h4 className="mt-2 font-serif text-[40px] leading-none text-paper">This wasn't confirmed.</h4>
                <p className="mt-3 text-[14px] text-paper-2">{terminalVerdict}</p>
                <p className="mt-1 text-[12px] text-mute">Please contact fleet support.</p>
              </div>
            ) : (
              <div>
                <Label>Selfie sent · in the review queue</Label>
                <h4 className="mt-2 font-serif text-[40px] leading-[0.98] text-paper">
                  A person is <em>looking now.</em>
                </h4>
                <p className="mt-3 text-[14px] text-paper-2">This screen updates by itself the moment they decide.</p>
                <div className="relative mt-8 h-px w-full overflow-hidden bg-line">
                  <span className="absolute inset-y-0 w-1/3 animate-sweep bg-paper" />
                </div>
                <div className="mt-3 font-mono text-[11px] text-mute">status: {pollStatus}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

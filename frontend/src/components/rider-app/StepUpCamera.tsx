import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-[#0c1322] border border-[#1e2c47] rounded-2xl p-5 shadow-2xl flex flex-col text-xs font-mono">
        {onClose && !isSubmitted && (
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e2c47] mb-3">
          <div className="w-8 h-8 rounded-lg bg-orange-950/80 border border-orange-800 flex items-center justify-center text-orange-400">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Step-Up Selfie Verification</h3>
            <span className="text-[10px] text-slate-400">
              Identity verification required for Session {session.session_id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Camera Preview or Submitted State */}
        {!isSubmitted ? (
          <div className="space-y-4">
            <p className="text-slate-300 text-[11px] leading-relaxed">
              TrustPulse detected behavioral differences during your recent interaction.
              Please capture a quick selfie to confirm your identity with the operations team.
            </p>

            <div className="relative w-full aspect-4/3 rounded-xl bg-black border border-slate-700 overflow-hidden flex items-center justify-center">
              {hasPermission === false ? (
                <div className="p-4 text-center text-rose-300 space-y-2">
                  <AlertTriangle className="w-8 h-8 mx-auto text-rose-400" />
                  <p className="text-xs">{cameraError || 'Camera permission denied.'}</p>
                  <button
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                  >
                    Retry Camera
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  {/* Subtle target face oval */}
                  <div className="absolute inset-8 border-2 border-dashed border-cyan-400/40 rounded-full pointer-events-none" />
                </>
              )}
            </div>

            <button
              onClick={handleCaptureAndSubmit}
              disabled={isCapturing || hasPermission !== true}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-orange-950 disabled:opacity-50"
            >
              {isCapturing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Capturing & Submitting...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Capture & Submit Selfie</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Submitted - Polling Reviewer State */
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            {pollStatus === 'VERIFIED' ? (
              <>
                <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-600 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-emerald-400">Verified by Reviewer</h4>
                <p className="text-slate-300 text-xs">{terminalVerdict}</p>
                <span className="text-[11px] text-slate-400">Resuming active session...</span>
              </>
            ) : pollStatus === 'BLOCKED' ? (
              <>
                <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-600 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-rose-400">Account Access Blocked</h4>
                <p className="text-slate-300 text-xs">{terminalVerdict}</p>
                <span className="text-[11px] text-slate-400">
                  Please contact fleet support for assistance.
                </span>
              </>
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
                  <div className="absolute w-14 h-14 rounded-full border border-cyan-500/30 animate-ping" />
                </div>
                <h4 className="text-sm font-bold text-slate-100">
                  Verification Frame Transmitted
                </h4>
                <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                  Your verification selfie is currently in the operations review queue.
                  Polling decision status from TrustPulse engine...
                </p>
                <div className="text-[10px] text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  Session Status: <strong className="text-amber-400">{pollStatus}</strong>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

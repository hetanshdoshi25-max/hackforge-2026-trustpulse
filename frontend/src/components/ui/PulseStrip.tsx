import React, { useEffect, useRef } from 'react';
import { socketService } from '../../services/websocket';
import type { Session, WebSocketMessage } from '../../types/api';
import { getActionHex } from '../../utils/status';

/**
 * The fleet's heartbeat: a live ECG trace. Every scored session arrives as one beat,
 * drawn in the colour of the decision it produced; an escalation beats taller.
 * Plain canvas 2D, so it costs nothing on every page.
 */

interface Beat {
  x: number; // px from the right edge when it was born (scrolls left)
  born: number;
  hex: string;
  amp: number;
}

const SPEED = 46; // px per second

export const PulseStrip: React.FC<{ height?: number; className?: string; idleBeats?: boolean }> = ({
  height = 34,
  className = '',
  idleBeats = true,
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const beats = useRef<Beat[]>([]);

  useEffect(() => {
    const push = (hex: string, amp: number) => beats.current.push({ x: 0, born: performance.now(), hex, amp });
    const off = socketService.onMessage((m: WebSocketMessage) => {
      if (m.type !== 'session') return;
      const s = m.data as Session;
      const escalated = s.action === 'STEP_UP' || s.action === 'REVIEW';
      push(getActionHex(s.action), escalated ? 1 : 0.55);
    });
    socketService.connect();
    // a resting rhythm so the line is alive even when the fleet is quiet
    const idle = idleBeats ? window.setInterval(() => push('#5f5d58', 0.28), 1400) : 0;
    return () => {
      off();
      if (idle) window.clearInterval(idle);
    };
  }, [idleBeats]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const mid = h * 0.62;
      const head = w - 24;

      // keep beats that are still on screen
      beats.current = beats.current.filter((b) => head - ((now - b.born) / 1000) * SPEED > -40);

      // baseline
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3a3936';
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(head, mid);
      ctx.stroke();

      for (const b of beats.current) {
        const x = head - ((now - b.born) / 1000) * SPEED;
        const a = b.amp * (h * 0.55);
        const fade = Math.max(0.25, Math.min(1, x / (w * 0.6)));
        ctx.globalAlpha = fade;
        ctx.strokeStyle = b.hex;
        ctx.beginPath();
        ctx.moveTo(x - 14, mid);
        ctx.lineTo(x - 8, mid);
        ctx.lineTo(x - 5, mid - a * 0.25);
        ctx.lineTo(x - 2, mid + a * 0.35);
        ctx.lineTo(x + 2, mid - a);
        ctx.lineTo(x + 6, mid + a * 0.45);
        ctx.lineTo(x + 9, mid);
        ctx.lineTo(x + 16, mid);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // the write head
      ctx.fillStyle = '#edebe6';
      ctx.beginPath();
      ctx.arc(head, mid, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(now / 300);
      ctx.beginPath();
      ctx.arc(head, mid, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} className={`block w-full ${className}`} style={{ height }} aria-hidden />;
};

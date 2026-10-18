import React, { useRef, useState } from 'react';
import { api } from '../../services/api';
import type { MotionTelemetry, Session, TouchTelemetry } from '../../types/api';

interface DemoOrderScreenProps {
  session: Session;
  onSessionUpdate: (updatedSession: Session) => void;
  onTriggerStepUp: () => void;
  /** motion samples recorded since a performance.now() time, so swipes carry the phone grip too */
  motionSince?: (t0: number) => MotionTelemetry[];
}

interface DemoOrder {
  id: string;
  restaurant: string;
  pickup: string;
  dropoff: string;
  items: string;
  payout: string;
  distance: string;
}

const DEMO_ORDERS: DemoOrder[] = [
  {
    id: 'ORD-8941',
    restaurant: 'Bawarchi Biryani & Kebabs',
    pickup: 'Colaba Causeway, Mumbai',
    dropoff: 'Nariman Point, Marine Drive',
    items: '2x Hyderabadi Chicken Biryani, 1x Mirchi Salan',
    payout: '₹145',
    distance: '3.4 km',
  },
  {
    id: 'ORD-9022',
    restaurant: 'Taj Mahal Tea House & Bakery',
    pickup: 'Bandra West, Mumbai',
    dropoff: 'Khar Danda, Mumbai',
    items: '1x Masala Chai Flask, 2x Mawa Cake',
    payout: '₹95',
    distance: '2.1 km',
  },
  {
    id: 'ORD-9150',
    restaurant: 'Gourmet Pizza Co.',
    pickup: 'Koramangala 5th Block, Bengaluru',
    dropoff: 'Indiranagar 100ft Road',
    items: '1x Truffle Mushroom Pizza, 1x Tiramisu',
    payout: '₹180',
    distance: '4.8 km',
  },
];

export const DemoOrderScreen: React.FC<DemoOrderScreenProps> = ({
  session,
  onSessionUpdate,
  onTriggerStepUp,
  motionSince,
}) => {
  const [selectedOrderIndex, setSelectedOrderIndex] = useState(0);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isSubmittingSwipe, setIsSubmittingSwipe] = useState(false);

  // Swipe gesture capture state
  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragProgress, setDragProgress] = useState(0); // 0 to 1
  const isDraggingRef = useRef(false);
  const swipeStartRef = useRef<{
    time: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    path: number;
    sizes: number[];
  } | null>(null);

  const order = DEMO_ORDERS[selectedOrderIndex % DEMO_ORDERS.length];

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAccepted || isSubmittingSwipe) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;

    const initialSize = e.width && e.height ? (e.width + e.height) / 2 : 1.0;
    swipeStartRef.current = {
      time: performance.now(),
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      path: 0,
      sizes: [initialSize],
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !swipeStartRef.current || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const maxDrag = rect.width - 56; // track width minus knob width
    const currentDx = e.clientX - swipeStartRef.current.x;
    const clampedProgress = Math.max(0, Math.min(1, currentDx / maxDrag));
    setDragProgress(clampedProgress);

    // Sum incremental path length
    const stepDist = Math.hypot(
      e.clientX - swipeStartRef.current.lastX,
      e.clientY - swipeStartRef.current.lastY
    );
    swipeStartRef.current.path += stepDist;
    swipeStartRef.current.lastX = e.clientX;
    swipeStartRef.current.lastY = e.clientY;

    if (e.width && e.height) {
      swipeStartRef.current.sizes.push((e.width + e.height) / 2);
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !swipeStartRef.current) return;
    isDraggingRef.current = false;

    const endTime = performance.now();
    const start = swipeStartRef.current;
    const dur = Math.max(10, endTime - start.time);
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const avgSize =
      start.sizes.length > 0
        ? start.sizes.reduce((a: number, b: number) => a + b, 0) / start.sizes.length
        : 1.0;

    swipeStartRef.current = null;

    if (dragProgress >= 0.85) {
      // Completed swipe gesture!
      setDragProgress(1);
      setIsAccepted(true);
      setIsSubmittingSwipe(true);

      const touchEvent: TouchTelemetry = {
        dur: Number(dur.toFixed(1)),
        dx: Number(dx.toFixed(1)),
        dy: Number(dy.toFixed(1)),
        path: Number(Math.max(dx, start.path).toFixed(1)),
        size: Number(avgSize.toFixed(1)),
      };

      try {
        const motion = motionSince?.(start.time - 300) ?? [];
        const updated = await api.sendSessionEvents(session.session_id, {
          touches: [touchEvent],
          ...(motion.length ? { motion } : {}),
        });
        onSessionUpdate(updated);
        if (updated.action === 'STEP_UP' || updated.action === 'REVIEW') {
          onTriggerStepUp();
        }
      } catch (err) {
        console.error('Failed to submit touch telemetry', err);
      } finally {
        setIsSubmittingSwipe(false);
      }
    } else {
      // Snap back
      setDragProgress(0);
    }
  };

  const handleNextDemoOrder = () => {
    setSelectedOrderIndex((prev: number) => prev + 1);
    setIsAccepted(false);
    setDragProgress(0);
  };

  return (
    <div className="animate-rise">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="label">New order · {order.id}</span>
        <button onClick={handleNextDemoOrder} className="font-mono text-[11px] text-mute underline underline-offset-4 hover:text-paper">
          next order
        </button>
      </div>

      {/* the ticket */}
      <div className="relative border border-line-2 bg-ink-2">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <h3 className="font-serif text-[26px] leading-[1.05] text-paper">{order.restaurant}</h3>
            <div className="mt-1 font-mono text-[11px] text-mute">{order.distance}</div>
          </div>
          <div className="text-right">
            <div className="tnum font-mono text-[26px] leading-none text-paper">{order.payout}</div>
            <div className="label mt-1.5">you earn</div>
          </div>
        </div>

        {/* perforation */}
        <div className="relative h-0 border-t border-dashed border-line-2">
          <span className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border border-line-2 bg-ink [clip-path:inset(0_0_0_50%)]" />
          <span className="absolute -right-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border border-line-2 bg-ink [clip-path:inset(0_50%_0_0)]" />
        </div>

        <div className="grid grid-cols-[14px_1fr] gap-x-3 p-5">
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full border border-paper" />
          <div>
            <div className="label">Pickup</div>
            <div className="mt-0.5 text-[14px] text-paper">{order.pickup}</div>
          </div>
          <span className="mx-auto my-1 h-6 w-px bg-line-2" />
          <span />
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-paper" />
          <div>
            <div className="label">Drop</div>
            <div className="mt-0.5 text-[14px] text-paper">{order.dropoff}</div>
          </div>
        </div>
        <div className="border-t border-line px-5 py-3 font-mono text-[11.5px] leading-relaxed text-paper-2">{order.items}</div>
      </div>

      {/* swipe to accept: the gesture itself is a signal */}
      {!isAccepted ? (
        <div className="mt-4">
          <div
            ref={sliderRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className="relative flex h-16 w-full cursor-grab select-none items-center overflow-hidden border border-line-2 active:cursor-grabbing"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 bg-paper/10" style={{ width: `${dragProgress * 100}%` }} />
            <div className="pointer-events-none w-full pl-10 text-center font-mono text-[11.5px] uppercase tracking-[0.22em] text-paper-2" style={{ opacity: 1 - dragProgress }}>
              Swipe to accept <span className="inline-block animate-pulse">→→</span>
            </div>
            <div
              className="pointer-events-none absolute bottom-1 top-1 flex w-12 items-center justify-center bg-paper text-xl text-ink"
              style={{ left: `calc(4px + ${dragProgress} * (100% - 56px))` }}
            >
              →
            </div>
          </div>
          <p className="mt-2 text-center text-[11.5px] text-mute">How you swipe is part of how we know it's you.</p>
        </div>
      ) : (
        <div className="mt-4 border-l-2 border-allow py-1 pl-4">
          <div className="font-serif text-[24px] leading-tight text-paper">Accepted. Head to pickup.</div>
          <p className="mt-1 text-[12.5px] text-mute">{isSubmittingSwipe ? 'Checking your swipe' : 'Swipe checked. Trust updated.'}</p>
          <button onClick={handleNextDemoOrder} className="mt-3 font-mono text-[11px] text-paper underline underline-offset-4">
            load another order
          </button>
        </div>
      )}
    </div>
  );
};

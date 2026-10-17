import React, { useRef, useState } from 'react';
import { Package, ChevronRight, CheckCircle2, Navigation } from 'lucide-react';
import { api } from '../../services/api';
import type { Session, TouchTelemetry } from '../../types/api';

interface DemoOrderScreenProps {
  session: Session;
  onSessionUpdate: (updatedSession: Session) => void;
  onTriggerStepUp: () => void;
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
        const updated = await api.sendSessionEvents(session.session_id, {
          touches: [touchEvent],
        });
        onSessionUpdate(updated);
        if (updated.action === 'STEP_UP') {
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
    <div className="w-full max-w-sm mx-auto space-y-4 text-xs font-mono">
      {/* Demo notice badge */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <Navigation className="w-3.5 h-3.5" /> Demo Order Simulation
        </span>
        <button
          onClick={handleNextDemoOrder}
          className="text-slate-300 hover:text-white underline"
        >
          Next Demo Order
        </button>
      </div>

      {/* Order Card */}
      <div className="p-4 rounded-2xl bg-[#0f192d] border border-[#223558] shadow-lg space-y-3">
        <div className="flex items-start justify-between pb-3 border-b border-[#223558]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">{order.restaurant}</h3>
              <span className="text-[10px] text-slate-400">{order.id} · {order.distance}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-base font-extrabold text-emerald-400">{order.payout}</span>
            <span className="text-[10px] text-slate-400 block">Est. Earning</span>
          </div>
        </div>

        {/* Pickup and Dropoff */}
        <div className="space-y-2 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">PICKUP</span>
              <span className="text-slate-200">{order.pickup}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">DELIVERY</span>
              <span className="text-slate-200">{order.dropoff}</span>
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
          <span className="text-slate-400 text-[10px] block">ITEMS</span>
          {order.items}
        </div>
      </div>

      {/* Swipe to Accept Interaction */}
      {!isAccepted ? (
        <div className="space-y-2">
          <div
            ref={sliderRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className="relative w-full h-14 rounded-2xl bg-[#091122] border border-[#223558] overflow-hidden flex items-center p-1 cursor-grab active:cursor-grabbing select-none"
          >
            {/* Animated track fill */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-950 to-cyan-700/60 transition-all pointer-events-none"
              style={{ width: `${Math.max(10, dragProgress * 100)}%` }}
            />

            {/* Centered label */}
            <div className="w-full text-center text-xs font-semibold text-cyan-300/80 pointer-events-none flex items-center justify-center gap-1">
              <span>Swipe to Accept Order</span>
              <ChevronRight className="w-4 h-4 animate-pulse" />
            </div>

            {/* Draggable knob */}
            <div
              className="absolute top-1 bottom-1 w-12 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-950 transition-transform pointer-events-none"
              style={{
                left: `calc(4px + ${dragProgress} * (100% - 56px))`,
              }}
            >
              <ChevronRight className="w-6 h-6 stroke-[3]" />
            </div>
          </div>
          <span className="text-[10px] text-slate-400 block text-center">
            Motor habits & swipe velocity are analyzed upon acceptance
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Order Accepted</span>
          </div>
          <p className="text-xs text-slate-300">
            Swipe telemetry analyzed by TrustPulse. Session score updated!
          </p>
          <button
            onClick={handleNextDemoOrder}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 text-xs"
          >
            Load Another Order
          </button>
        </div>
      )}
    </div>
  );
};

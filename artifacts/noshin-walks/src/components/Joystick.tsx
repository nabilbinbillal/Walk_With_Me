import { useEffect, useRef } from "react";

export type JoystickDir = "left" | "right" | null;

type Props = {
  onChange: (dir: JoystickDir) => void;
  onAction?: () => void;
};

export function Joystick({ onChange, onAction }: Props) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const activeId = useRef<number | null>(null);
  const lastDir = useRef<JoystickDir>(null);

  useEffect(() => {
    const base = baseRef.current;
    const stick = stickRef.current;
    if (!base || !stick) return;

    const reset = () => {
      stick.style.transform = `translate(0px, 0px)`;
      activeId.current = null;
      if (lastDir.current !== null) {
        lastDir.current = null;
        onChange(null);
      }
    };

    const radius = 44;
    const updateFromPoint = (x: number, y: number) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = x - cx;
      let dy = y - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      const threshold = 12;
      let dir: JoystickDir = null;
      if (Math.abs(dx) > threshold && Math.abs(dx) >= Math.abs(dy)) {
        dir = dx > 0 ? "right" : "left";
      }
      if (dir !== lastDir.current) {
        lastDir.current = dir;
        onChange(dir);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      activeId.current = e.pointerId;
      base.setPointerCapture(e.pointerId);
      updateFromPoint(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (activeId.current !== e.pointerId) return;
      updateFromPoint(e.clientX, e.clientY);
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (activeId.current !== e.pointerId) return;
      try {
        base.releasePointerCapture(e.pointerId);
      } catch {}
      reset();
    };

    base.addEventListener("pointerdown", onPointerDown);
    base.addEventListener("pointermove", onPointerMove);
    base.addEventListener("pointerup", onPointerEnd);
    base.addEventListener("pointercancel", onPointerEnd);
    base.addEventListener("pointerleave", onPointerEnd);

    return () => {
      base.removeEventListener("pointerdown", onPointerDown);
      base.removeEventListener("pointermove", onPointerMove);
      base.removeEventListener("pointerup", onPointerEnd);
      base.removeEventListener("pointercancel", onPointerEnd);
      base.removeEventListener("pointerleave", onPointerEnd);
    };
  }, [onChange]);

  return (
    <div className="flex items-end justify-between gap-4 w-full no-select">
      <div
        ref={baseRef}
        className="relative shrink-0"
        style={{
          width: 132,
          height: 132,
          borderRadius: "50%",
          background: "#fff",
          border: "4px solid #1a1a1a",
          boxShadow: "5px 5px 0 0 #1a1a1a",
          touchAction: "none",
        }}
      >
        {/* directional pixel marks */}
        <div
          className="font-pixel"
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 10,
            color: "#1a1a1a",
          }}
        >
          ◄
        </div>
        <div
          className="font-pixel"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 10,
            color: "#1a1a1a",
          }}
        >
          ►
        </div>
        <div
          ref={stickRef}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 56,
            height: 56,
            marginLeft: -28,
            marginTop: -28,
            borderRadius: "50%",
            background: "var(--pink)",
            border: "4px solid #1a1a1a",
            boxShadow: "3px 3px 0 0 #1a1a1a",
            transition: "transform 60ms ease",
          }}
        />
      </div>

      {onAction && (
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onAction();
          }}
          className="pixel-btn pixel-btn-primary shrink-0"
          style={{ width: 86, height: 86, borderRadius: "50%", padding: 0 }}
          aria-label="Action"
        >
          A
        </button>
      )}
    </div>
  );
}

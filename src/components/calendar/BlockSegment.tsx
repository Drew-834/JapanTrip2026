import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import { useRef } from "react";
import { formatJstTime } from "@/lib/time";
import { PX_PER_MIN } from "@/lib/calendarBlockFactory";
import type { ItineraryBlock } from "@/types";

const px = PX_PER_MIN;

type Props = {
  block: ItineraryBlock;
  dayStr: string;
  fromMin: number;
  toMin: number;
  canEdit: boolean;
  placedAnim: boolean;
  onBodyClick: () => void;
  onResizeDelta: (blockId: string, deltaY: number) => void;
};

export function BlockSegment({
  block,
  dayStr,
  fromMin,
  toMin,
  canEdit,
  placedAnim,
  onBodyClick,
  onResizeDelta,
}: Props) {
  const id = `${block.id}|${dayStr}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !canEdit,
  });
  const resizeRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);

  const top = fromMin * px;
  const h = Math.max(8, (toMin - fromMin) * px);
  const style: CSSProperties = {
    top,
    height: h,
    background: block.color,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 8 : 1,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={`block-item${canEdit ? "" : " readonly"}${placedAnim ? " block-item--placed" : ""}`}
      style={style}
      {...attributes}
      title={`${block.title} · ${formatJstTime(block.start.toDate())}–${formatJstTime(block.end.toDate())}`}
    >
      <div className="block-item__row">
        {canEdit && (
          <button
            type="button"
            className="block-item__handle"
            aria-label="Drag to move"
            {...listeners}
          />
        )}
        <div
          className="block-item__body"
          role="button"
          tabIndex={0}
          onClick={onBodyClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onBodyClick();
            }
          }}
        >
          <strong>{block.title}</strong>
          {block.city && <div className="muted">{block.city}</div>}
        </div>
      </div>
      {canEdit && (
        <div
          ref={resizeRef}
          className="block-item__resize"
          role="separator"
          aria-label="Drag to change end time"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragStartY.current = e.clientY;
            const onMove = (ev: PointerEvent) => {
              const d = ev.clientY - dragStartY.current;
              if (d === 0) return;
              dragStartY.current = ev.clientY;
              onResizeDelta(block.id, d);
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove, { passive: true });
            window.addEventListener("pointerup", onUp);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
        />
      )}
    </div>
  );
}

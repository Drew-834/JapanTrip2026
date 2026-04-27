import { useDroppable } from "@dnd-kit/core";
import type { CSSProperties, MutableRefObject, ReactNode } from "react";

type Props = {
  dayStr: string;
  canEdit: boolean;
  heightPx: number;
  dayBodyStyle?: CSSProperties;
  dayBodyRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onBackgroundClick?: (dayStr: string, clientY: number) => void;
  onBackgroundDoubleClick?: (dayStr: string, clientY: number) => void;
  children: ReactNode;
};

export function DayDropZone({
  dayStr,
  canEdit,
  heightPx,
  dayBodyStyle,
  dayBodyRefs,
  onBackgroundClick,
  onBackgroundDoubleClick,
  children,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${dayStr}`,
    data: { dayStr },
    disabled: !canEdit,
  });

  const setRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    if (el) dayBodyRefs.current.set(dayStr, el);
    else dayBodyRefs.current.delete(dayStr);
  };

  return (
    <div
      ref={setRefs}
      data-day-dropzone={dayStr}
      className={`day-body${isOver ? " day-body--over" : ""}`}
      style={{ height: heightPx, ...dayBodyStyle }}
      onClick={(e) => {
        if (!canEdit) return;
        if ((e.target as HTMLElement).closest(".block-item")) return;
        if ((e.target as HTMLElement).closest(".day-body__add-hint")) return;
        onBackgroundClick?.(dayStr, e.clientY);
      }}
      onDoubleClick={(e) => {
        if (!canEdit) return;
        if ((e.target as HTMLElement).closest(".block-item")) return;
        onBackgroundDoubleClick?.(dayStr, e.clientY);
      }}
    >
      {canEdit && <div className="day-body__add-hint">Click a time to add selected activity</div>}
      {children}
    </div>
  );
}

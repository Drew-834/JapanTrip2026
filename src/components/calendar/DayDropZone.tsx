import { useDroppable } from "@dnd-kit/core";
import type { CSSProperties, MutableRefObject, ReactNode } from "react";

type Props = {
  dayStr: string;
  canEdit: boolean;
  heightPx: number;
  dayBodyStyle?: CSSProperties;
  dayBodyRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onBackgroundDoubleClick?: (dayStr: string, clientY: number) => void;
  children: ReactNode;
};

export function DayDropZone({
  dayStr,
  canEdit,
  heightPx,
  dayBodyStyle,
  dayBodyRefs,
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
      className={`day-body${isOver ? " day-body--over" : ""}`}
      style={{ height: heightPx, ...dayBodyStyle }}
      onDoubleClick={(e) => {
        if (!canEdit) return;
        if ((e.target as HTMLElement).closest(".block-item")) return;
        onBackgroundDoubleClick?.(dayStr, e.clientY);
      }}
    >
      {children}
    </div>
  );
}

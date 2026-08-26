import { Fragment, type CSSProperties, type ReactNode } from "react";

const ADMIN_SHEET_COLUMN_COUNT = 17;
const ADMIN_SHEET_ROW_COUNT = 30;

function columnName(index: number): string {
  return String.fromCharCode(64 + index);
}

function rangeName(col: number, row: number, colSpan: number, rowSpan: number): string {
  return `${columnName(col)}${row}:${columnName(col + colSpan - 1)}${row + rowSpan - 1}`;
}

function gridPosition(column: number, row: number): CSSProperties {
  return { gridColumn: column, gridRow: row };
}

export function AdminCellSheet({ children }: { children: ReactNode }) {
  return (
    <div data-admin-cell-sheet="true" className="relative flex-1 min-h-0 overflow-auto bg-white">
      <div className="grid min-h-[1106px] min-w-[1260px] text-[12px] text-[#222]" style={{ gridTemplateColumns: "36px repeat(17, 72px)", gridTemplateRows: "26px repeat(30, 36px)" }}>
        <div style={gridPosition(1, 1)} className="border border-[#d9d9d9] bg-[#f3f3f3]" />
        {Array.from({ length: ADMIN_SHEET_COLUMN_COUNT }, (_, index) => {
          const name = columnName(index + 1);
          return <div key={name} data-admin-column={name} style={gridPosition(index + 2, 1)} className="flex items-center justify-center border border-[#d9d9d9] bg-[#f3f3f3] text-[#4c6175]">{name}</div>;
        })}

        {Array.from({ length: ADMIN_SHEET_ROW_COUNT }, (_, rowIndex) => (
          <Fragment key={`admin-row-${rowIndex + 1}`}>
            <div data-admin-row={String(rowIndex + 1)} style={gridPosition(1, rowIndex + 2)} className="flex items-center justify-center border border-[#d9d9d9] bg-[#f3f3f3] text-[#4c6175]">{rowIndex + 1}</div>
            {Array.from({ length: ADMIN_SHEET_COLUMN_COUNT }, (_, columnIndex) => (
              <div key={`admin-cell-${rowIndex + 1}-${columnIndex + 1}`} data-admin-cell="true" style={gridPosition(columnIndex + 2, rowIndex + 2)} className="border border-[#e4e8ed] bg-white" />
            ))}
          </Fragment>
        ))}

        {children}
      </div>
    </div>
  );
}

export function AdminSheetArea({
  col,
  row,
  colSpan = 1,
  rowSpan = 1,
  className = "",
  children,
}: {
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  children?: ReactNode;
}) {
  const style = {
    gridColumn: `${col + 1} / span ${colSpan}`,
    gridRow: `${row + 1} / span ${rowSpan}`,
  } as CSSProperties;

  return (
    <div
      data-admin-sheet-area="true"
      data-admin-range={rangeName(col, row, colSpan, rowSpan)}
      style={style}
      className={`z-10 min-h-0 min-w-0 bg-white ${className}`}
    >
      {children}
    </div>
  );
}

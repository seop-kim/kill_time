import type { ReactNode } from "react";

export function AdminMasterDetailSheet({ master, detail }: { master: ReactNode; detail: ReactNode }) {
  return (
    <div data-admin-master-detail="true" className="grid w-[1320px] grid-cols-[340px_1fr] border border-[#b7c9e2] bg-white text-[12px] shadow-sm">
      <aside data-admin-master="true" className="min-h-[560px] border-r border-[#b7c9e2]">
        {master}
      </aside>
      <section data-admin-detail="true" className="min-h-[560px]">
        {detail}
      </section>
    </div>
  );
}

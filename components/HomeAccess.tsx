"use client";

export function HomeAccessCard({
  name,
  busy,
  onNameChange,
  onCreate,
  onOpenJoin,
}: {
  name: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onCreate: () => void;
  onOpenJoin: () => void;
}) {
  return (
    <div className="w-[384px] bg-white border border-[#d0d0d0] rounded-sm shadow-sm">
      <div className="border-b border-[#e0e0e0] px-5 py-3">
        <h1 className="text-[15px] font-semibold text-[#333]">오목 문서</h1>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-[#555]">표시 이름</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            maxLength={8}
            placeholder="예: 김철수"
            className="border border-[#c8c8c8] rounded-sm px-2 py-1.5 text-[13px] outline-none focus:border-[#217346]"
          />
        </label>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={busy}
            className="bg-[#217346] hover:bg-[#1a5c38] disabled:opacity-60 text-white text-[13px] rounded-sm py-2"
          >
            문서 만들기
          </button>
          <button
            type="button"
            onClick={onOpenJoin}
            disabled={busy}
            className="border border-[#217346] text-[#217346] hover:bg-[#f0f7f3] disabled:opacity-60 text-[13px] rounded-sm py-2"
          >
            문서 입장하기
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentJoinDialog({
  open,
  roomCode,
  busy,
  onChange,
  onClose,
  onJoin,
  roomCodeLength = 6,
}: {
  open: boolean;
  roomCode: string;
  busy: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onJoin: () => void;
  roomCodeLength?: number;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="join-document-title" className="w-[384px] bg-white border border-[#d0d0d0] rounded-sm shadow-lg">
        <div className="flex items-center justify-between border-b border-[#e0e0e0] px-5 py-3">
          <h2 id="join-document-title" className="text-[15px] font-semibold text-[#333]">
            문서 입장하기
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="text-[20px] leading-none text-[#777] hover:text-[#333]"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onJoin();
          }}
          className="px-5 py-4 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-[#555]">방 코드</span>
            <input
              autoFocus
              value={roomCode}
              onChange={(event) => onChange(event.target.value)}
              maxLength={roomCodeLength}
              placeholder="예: AB3XQ2"
              className="border border-[#c8c8c8] rounded-sm px-2 py-1.5 text-[13px] tracking-widest outline-none focus:border-[#217346] uppercase"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-[#c8c8c8] text-[#555] hover:bg-[#f5f5f5] text-[13px] rounded-sm px-4 py-2"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="bg-[#217346] hover:bg-[#1a5c38] disabled:opacity-60 text-white text-[13px] rounded-sm px-4 py-2"
            >
              입장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { ExcelChrome, type ChromeAvatar, type GameTab } from "./ExcelChrome";
import { WorkCoverSheet } from "./WorkCoverSheet";

export type WorkspaceSheetId = "workspace" | "exchange";

export function WorkspaceChrome({
  nickname,
  activeSheetId = "workspace",
  initialSensitiveMode = false,
  onNavigateHome,
  onNavigateExchange,
  children,
}: {
  nickname: string;
  activeSheetId?: WorkspaceSheetId;
  initialSensitiveMode?: boolean;
  onNavigateHome?: () => void;
  onNavigateExchange?: () => void;
  children: ReactNode;
}) {
  const [sensitiveMode, setSensitiveMode] = useState(initialSensitiveMode);
  const avatar: ChromeAvatar = {
    id: "workspace-user",
    name: nickname,
    color: "#217346",
    isTurn: false,
    online: true,
  };
  const workspaceTabs: GameTab[] = [
    { id: "workspace", label: "홈", available: true },
    { id: "exchange", label: "머니교환", available: true },
  ];

  return (
    <ExcelChrome
      fileName="문서 허브"
      avatars={[avatar]}
      profileAvatar={avatar}
      onShare={() => {}}
      games={workspaceTabs}
      activeGameId={activeSheetId}
      onSelectGame={(id) => {
        if (id === "exchange") {
          onNavigateExchange?.();
          return;
        }
        onNavigateHome?.();
      }}
      sensitiveMode={sensitiveMode}
      onToggleSensitivity={() => setSensitiveMode((isSensitive) => !isSensitive)}
    >
      {sensitiveMode ? <WorkCoverSheet /> : children}
    </ExcelChrome>
  );
}

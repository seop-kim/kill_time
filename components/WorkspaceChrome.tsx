"use client";

import { useState, type ReactNode } from "react";
import { ExcelChrome, type ChromeAvatar, type GameTab } from "./ExcelChrome";
import type { GameStats } from "@/lib/stats";
import { WorkCoverSheet } from "./WorkCoverSheet";

export type WorkspaceSheetId = "workspace" | "exchange";

export const WORKSPACE_PROFILE_GAMES: GameTab[] = [
  { id: "omok", label: "Omok", available: true },
  { id: "girin", label: "girin", available: true },
  { id: "seotda", label: "Up", available: true },
  { id: "minesweeper", label: "지뢰찾기", available: true },
];

export function WorkspaceChrome({
  nickname,
  activeSheetId = "workspace",
  initialSensitiveMode = false,
  onNavigateHome,
  onNavigateExchange,
  profileStats = {},
  children,
}: {
  nickname: string;
  activeSheetId?: WorkspaceSheetId;
  initialSensitiveMode?: boolean;
  onNavigateHome?: () => void;
  onNavigateExchange?: () => void;
  profileStats?: Record<string, GameStats>;
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
      profileStats={profileStats}
      profileGames={WORKSPACE_PROFILE_GAMES}
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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getWorkCoverColumnKey, WorkCoverSheet } from "./WorkCoverSheet";

describe("WorkCoverSheet", () => {
  it("renders an Excel-style service request worksheet", () => {
    const markup = renderToStaticMarkup(<WorkCoverSheet />);

    expect(markup).toContain('data-work-cover="true"');
    expect(markup).toContain('data-work-cover-grid="true"');
    expect(markup).toContain("날짜");
    expect(markup).toContain("부서");
    expect(markup).toContain("처리시간(분)");
    expect(markup).toContain("요청 타입");
    expect(markup).toContain("후속 조치");
    expect(markup).toContain("2026-01-02");
    expect(markup).toContain("PC 세팅");
    expect(markup).toContain("김도윤 사원");
    expect(markup).not.toContain("배진영 사원");
    expect(markup).not.toContain("IT 프로젝트 운영 현황");
  });

  it("keeps duplicate width definitions on unique column keys", () => {
    expect(getWorkCoverColumnKey("w-[600px]", 5)).not.toBe(getWorkCoverColumnKey("w-[600px]", 6));
  });
});

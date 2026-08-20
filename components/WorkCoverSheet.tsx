const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

const HEADERS = ["날짜", "부서", "이름", "처리시간(분)", "요청 타입", "내용", "후속 조치"];

const SERVICE_REQUEST_ROWS = [
  ["2026-01-02", "해운수출업무부", "김도윤 사원", "30", "PC 세팅", "복직으로인한, PC 세팅진행", "필요프로그램 설치 및 PC 세팅"],
  ["2026-01-02", "항공수출업무부", "박서연 사원", "15", "PC 장애 조치", "데스크탑 PC 윈도우 부팅로그없이 무한 재부팅", "RAM 교체 및 CMOS 전지 재장착"],
  ["2026-01-02", "물류업무부", "이준혁 사원", "10", "인프라 지원", "PC 부분 초기화 이후, 스캔 설정 문의", "사용자 임의로 설정된 스캔 포트 제거"],
  ["2026-01-02", "수입영업부", "최하윤 사원", "30", "PC 세팅", "신규 PC 지급으로 인한 PC 세팅 진행", "필요프로그램 설치 및 PC 세팅"],
  ["2026-01-05", "수입영업부", "최하윤 사원", "20", "네트워크 지원", "새로 지급 받은 PC 네트워크 연결안됨", "기존 PC 와 신규 PC 동일 IP 사용으로 어려움 안내"],
  ["2026-01-05", "전략고객영업부", "정우진 사원", "30", "PC 장애 조치", "PC 꺼짐 증상", "PC 배터리 교체 진행"],
  ["2026-01-05", "평택 물류업무부", "윤서아 계장", "20", "네트워크 지원", "임의 세팅값 변경으로, 네트워크 접속안됨", "네트워크 설정값 전달 후 조치"],
  ["2026-01-06", "부산사무소", "강민재 계장", "30", "인프라 지원", "IP 변환기 사용방법 및 스캔/복합기 설정 요청", "IP 변환기 사용방법 및 스캔/복합기 설정"],
  ["2026-01-06", "인천물류업무부", "송지후 대리", "30", "센티넬 원", "센티넬 보안프로그램 재활성화 및 유선랜 연결 요청", "센티넬 프로그램 재활성화"],
  ["2026-01-07", "해운수출업무부", "김도윤 사원", "20", "인프라 지원", "신규 pc 복합기 및 스캔 설정 요청", "복합기 및 스캔 설정완료"],
  ["2026-01-08", "항공수출업무부", "오채원 계장", "20", "네트워크 지원", "신규 PC 수령 후 네트워크 사용법 문의", "신규 PC 최초사용시 WiFi/IPv4 입력"],
  ["2026-01-08", "물류업무부", "문지훈 계장", "30", "인프라 지원", "협력직원 오피스(엑셀) 사용법 문의", "정규 계정으로 로그인 시 안내"],
  ["2026-01-08", "물류업무부", "서유나 계장", "30", "인프라 지원", "협력직원 오피스(엑셀) 사용법 문의", "정규 계정으로 로그인 시 안내"],
  ["2026-01-09", "부산사무소", "배현우 과장", "30", "네트워크 지원", "김해공항 네트워크 연결요청", "유선 안내로 네트워크 설정 지원"],
  ["2026-01-09", "부산사무소", "임나연 계장", "30", "네트워크 지원", "신규 PC 수령 후, 네트워크 사용법 문의", "기존 PC 와 신규 PC 동일 IP 사용 안내"],
  ["2026-01-09", "부산사무소", "임나연 과장", "30", "PC 장애 조치", "워드 및 DOCX 파일 반응없음", "확인결과, 최초 작성자 97버전 확인"],
  ["2026-01-09", "내부통제부", "고은채 차장", "20", "인프라 지원", "아웃룩 사용시 원치않는 서명 공백란 문의", "사진파일의 해상도와 폰트 크기 조절"],
  ["2026-01-12", "부산물류업무부", "장시우 부장", "30", "PC 세팅", "하반기 교체 신규 PC 세팅", "신규 PC 세팅"],
  ["2026-01-12", "항공수출업무부", "신다은 계장", "20", "네트워크 지원", "신규 PC 복합기 스캔 설정 문의", "원격을 통한 세팅 지원완료"],
  ["2026-01-12", "해운수출업무부", "황건우 사원", "15", "계정 지원", "사내 시스템 로그인 권한 문의", "부서 승인 후 권한 반영"],
  ["2026-01-13", "수입영업부", "전유진 대리", "25", "PC 장애 조치", "노트북 화면 깜빡임 및 외부 모니터 연결 오류", "케이블 교체 후 드라이버 재설치"],
  ["2026-01-13", "물류업무부", "노태윤 사원", "10", "프린터 지원", "공용 프린터 출력 대기열 삭제 요청", "대기열 초기화 및 테스트 출력"],
];

const COLUMN_WIDTHS = [
  "w-[110px]",
  "w-[182px]",
  "w-[128px]",
  "w-[126px]",
  "w-[200px]",
  "w-[600px]",
  "w-[600px]",
];

export function getWorkCoverColumnKey(width: string, index: number): string {
  return `${width}-${index}`;
}

function FilterGlyph() {
  return (
    <span aria-hidden="true" className="inline-flex h-[20px] w-[20px] items-center justify-center rounded-[2px] border border-[#aeb9bd] bg-white text-[13px] leading-none text-[#555]">
      ⌄
    </span>
  );
}

export function WorkCoverSheet() {
  return (
    <div data-work-cover="true" className="h-full min-h-0 overflow-auto bg-white text-[#222]">
      <table data-work-cover-grid="true" className="w-[1988px] min-w-[1988px] table-fixed border-collapse text-[15px] leading-[1.1]">
        <colgroup>
          <col className="w-[42px]" />
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={getWorkCoverColumnKey(width, index)} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr className="h-[28px]">
            <th className="sticky left-0 top-0 z-40 border border-[#d7d7d7] bg-[#f2f2f2]" aria-label="전체 선택">
              <span className="ml-auto block h-0 w-0 border-b-[13px] border-l-[13px] border-b-[#bdbdbd] border-l-transparent" />
            </th>
            {COLUMN_LETTERS.map((letter, index) => (
              <th
                key={letter}
                className={`sticky top-0 z-30 border border-[#d7d7d7] text-center font-normal ${index === COLUMN_LETTERS.length - 1 ? "bg-[#c6e8d7] text-[#217346]" : "bg-[#f2f2f2] text-[#456]"}`}
              >
                {letter}
              </th>
            ))}
          </tr>
          <tr className="h-[30px]">
            <th className="sticky left-0 top-[28px] z-40 border border-[#555] bg-[#f2f2f2] pr-1 text-right font-normal text-[#555]">1</th>
            {HEADERS.map((header, index) => (
              <th
                key={header}
                className={`sticky top-[28px] z-30 border border-[#555] px-2 font-semibold ${index === HEADERS.length - 1 ? "bg-[#a9c9e7]" : "bg-[#c6e8ef]"}`}
              >
                <span className="flex items-center justify-between gap-2 whitespace-nowrap">
                  <span className="min-w-0 flex-1 overflow-hidden text-center text-ellipsis">{header}</span>
                  <FilterGlyph />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SERVICE_REQUEST_ROWS.map((row, rowIndex) => (
            <tr key={`${row[0]}-${row[1]}-${row[2]}-${rowIndex}`} className="h-[29px]">
              <th className="sticky left-0 z-20 border border-[#555] bg-[#f5f5f5] pr-1 text-right font-normal text-[#555]">
                {rowIndex + 2}
              </th>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className={`border border-[#555] px-2 py-1 whitespace-nowrap ${cellIndex < 5 ? "text-center" : "text-center"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

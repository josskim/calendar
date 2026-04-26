export type HolidaySeed = {
  date: string;
  name: string;
};

export const DEFAULT_HOLIDAYS_2007: HolidaySeed[] = [
  { date: "2007-01-01", name: "신정" },
  { date: "2007-02-17", name: "설날 연휴" },
  { date: "2007-02-18", name: "설날 연휴" },
  { date: "2007-02-19", name: "설날" },
  { date: "2007-03-01", name: "삼일절" },
  { date: "2007-05-05", name: "어린이날" },
  { date: "2007-05-07", name: "어린이날 대체휴일" },
  { date: "2007-05-24", name: "부처님 오신 날" },
  { date: "2007-06-06", name: "현충일" },
  { date: "2007-08-15", name: "광복절" },
  { date: "2007-09-24", name: "추석 연휴" },
  { date: "2007-09-25", name: "추석" },
  { date: "2007-09-26", name: "추석 연휴" },
  { date: "2007-10-03", name: "개천절" },
  { date: "2007-10-09", name: "한글날" },
  { date: "2007-12-25", name: "성탄절" },
];

export const DEFAULT_HOLIDAYS_2026: HolidaySeed[] = [
  { date: "2026-05-04", name: "어린이날 전일" },
  { date: "2026-05-05", name: "어린이날" },
  { date: "2026-05-23", name: "부처님 오신 날 전일" },
  { date: "2026-05-24", name: "부처님 오신 날" },
  { date: "2026-05-25", name: "대체공휴일(부처님오신날)" },
  { date: "2026-06-02", name: "전국동시지방선거 전일" },
  { date: "2026-06-03", name: "전국동시지방선거" },
  { date: "2026-06-05", name: "현충일 전일" },
  { date: "2026-06-06", name: "현충일" },
  { date: "2026-08-14", name: "광복절 전일" },
  { date: "2026-08-15", name: "광복절" },
  { date: "2026-08-16", name: "대체공휴일(광복절) 전일" },
  { date: "2026-08-17", name: "대체공휴일(광복절)" },
  { date: "2026-09-23", name: "추석 연휴 전일" },
  { date: "2026-09-24", name: "추석 연휴" },
  { date: "2026-09-25", name: "추석" },
  { date: "2026-09-26", name: "추석 연휴" },
  { date: "2026-10-02", name: "개천절 전일" },
  { date: "2026-10-03", name: "개천절" },
  { date: "2026-10-04", name: "대체공휴일(개천절) 전일" },
  { date: "2026-10-05", name: "대체공휴일(개천절)" },
  { date: "2026-10-08", name: "한글날 전일" },
  { date: "2026-10-09", name: "한글날" },
  { date: "2026-12-24", name: "성탄절 전일" },
  { date: "2026-12-25", name: "성탄절" },
];

export const DEFAULT_HOLIDAYS: HolidaySeed[] = [
  ...DEFAULT_HOLIDAYS_2007,
  ...DEFAULT_HOLIDAYS_2026,
];

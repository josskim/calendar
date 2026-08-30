# StaySync mobile API

모든 요청에는 서버 환경 변수 `STAYSYNC_API_TOKEN`과 같은 Bearer 토큰이
필요합니다.

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## 충돌 검사

`POST /api/mobile/reservations/check`

## 예약 등록

`POST /api/mobile/reservations`

예시 요청:

```json
{
  "reservationType": "pension",
  "sourceRef": "sms_0123456789abcdef",
  "startDate": "2026-08-21",
  "nights": 1,
  "rooms": ["201호", "202호"],
  "guestName": "황진우",
  "phone": "01012345678",
  "contactName": "게스트 260821 독채",
  "peopleCount": 2,
  "totalAmount": 800000,
  "extraAmount": 0,
  "source": "phone",
  "depositDate": "2026-07-20",
  "rawSummary": "사용자가 확인한 문자 요약"
}
```

캠프닉 예시:

```json
{
  "reservationType": "campnic",
  "sourceRef": "sms_campnic_0123456789",
  "startDate": "2026-08-05",
  "nights": 0,
  "rooms": ["캠프닉1부"],
  "guestName": "황진우",
  "phone": "01012345678",
  "contactName": "게스트 260805 캠프닉",
  "peopleCount": 99,
  "totalAmount": 80000,
  "depositDate": "2026-07-26",
  "userType": "야수교",
  "usageTime": "10시~18시",
  "rawSummary": "사용자가 확인한 캠프닉 문자 요약"
}
```

동일 `sourceRef`가 이미 등록된 경우 기존 예약을 반환하고 새 행을 만들지 않습니다.
선택 객실의 숙박 구간이 기존 확정 펜션 예약과 겹치면 HTTP 409를 반환합니다.
캠프닉은 `캠프닉1부`, `캠프닉2부`를 지원하며 같은 날짜·같은 부가 6팀이면
`CAMPNIC_CAPACITY_FULL`과 HTTP 409를 반환합니다. 야수교 캠프닉은
`캠프닉1부`만 허용하고 `userType`과 메모에 `야수교`를 저장합니다.

펜션에서 여러 객실을 동시에 등록하면 총 금액과 추가금은 `201호`가 포함된
경우 201호에만 저장하며 나머지 객실은 0원으로 저장합니다.

## 미래 예약 검증 자료

`POST /api/mobile/reservations/audit`

```json
{
  "from": "2026-07-26",
  "to": "2028-07-26"
}
```

`source`는 `phone`, `naver`, `nol`, `here`, `airbnb`, `other` 중 하나입니다.

취소되지 않은 예약의 날짜, 숙박 수, 객실, 예약자, 연락처, 인원, 금액·추가금,
접수경로, 입금일, 실제 캘린더 메모와 StaySync `sourceRef`를 반환합니다. StaySync의
수동 검증 페이지에서만 사용하는 읽기 전용 API이며 이 요청으로 예약 데이터는
변경되지 않습니다.

## 외부 예약 사이트 상태 검증

StaySync에서 사용자가 직접 날짜와 사이트를 선택해 시작하는 읽기 전용 검증입니다.
화면 진입, 최근 작업 조회, 진행 상태 조회만으로는 검증이 시작되지 않습니다.
새 검증은 반드시 `POST` 요청이 성공했을 때만 대기열에 등록됩니다.

지원 사이트와 실행 순서는 `naver`, `yanolja`, `goodchoice`, `airbnb`입니다.

### 최근 검증 조회

`GET /api/mobile/inventory-audits`

### 새 검증 시작

`POST /api/mobile/inventory-audits`

```json
{
  "from": "2026-08-30",
  "to": "2026-09-30",
  "sites": ["naver", "yanolja", "goodchoice", "airbnb"]
}
```

사이트는 한 개 이상 선택해야 하며 날짜 범위는 최대 190일입니다. 이미 실행 중인
검증이 있으면 HTTP 409와 해당 작업 `id`를 반환합니다. 오류가 없는 동일 기간·동일
사이트의 완료 보고서가 있으면 실제 검증을 다시 실행하지 않고 `reused: true`로
기존 보고서를 반환합니다.

### 진행 상태와 결과 조회

`GET /api/mobile/inventory-audits/{id}`

작업 진행률, 정상·위험·확인·조회 실패 합계, 사이트별 진행 상태와 상세 확인 항목을
반환합니다. 조회는 읽기 전용이며 외부 사이트 작업을 새로 시작하지 않습니다.

### 실행 중지

`DELETE /api/mobile/inventory-audits/{id}`

대기 또는 실행 중인 검증 항목만 `cancelled`로 변경합니다. 예약 차단·해제 동기화
작업에는 영향을 주지 않습니다.

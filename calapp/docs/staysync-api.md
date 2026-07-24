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
  "sourceRef": "sms_0123456789abcdef",
  "startDate": "2026-08-21",
  "nights": 1,
  "rooms": ["201호", "202호"],
  "guestName": "황진우",
  "phone": "01012345678",
  "contactName": "게스트 260821 독채",
  "peopleCount": 2,
  "totalAmount": 800000,
  "depositDate": "2026-07-20",
  "rawSummary": "사용자가 확인한 문자 요약"
}
```

동일 `sourceRef`가 이미 등록된 경우 기존 예약을 반환하고 새 행을 만들지 않습니다.
선택 객실의 숙박 구간이 기존 확정 펜션 예약과 겹치면 HTTP 409를 반환합니다.

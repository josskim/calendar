# 객실 재고 워커 API

CalApp은 예약 저장과 같은 DB 트랜잭션에서 `inventory_events` Outbox 이벤트를
생성합니다. 관리자 화면과 StaySync 앱 등록이 동일한 이벤트 경로로 합쳐집니다.

모든 워커 요청에는 서버 환경 변수 `INVENTORY_WORKER_TOKEN`과 동일한 Bearer
토큰이 필요합니다.

```http
Authorization: Bearer <token>
```

## 이벤트 가져오기

```http
GET /api/worker/inventory-events?limit=5
```

상태가 `pending` 또는 재시도 시간이 지난 `retrying` 이벤트를 가져오면서
`processing`으로 임대합니다. 10분 이상 처리 중인 이벤트는 워커 장애로 보고 다시
가져올 수 있습니다.

## 현재 활성 예약 조회

```http
GET /api/worker/inventory-state?from=2026-08-21&to=2026-08-22
```

취소 시 방을 열기 전에 이 API로 같은 날짜와 객실을 계속 차단해야 하는 다른 활성
예약이 있는지 반드시 다시 계산합니다.

## 이벤트 완료 또는 재시도

```http
POST /api/worker/inventory-events/123
Content-Type: application/json

{"action":"complete","result":{}}
```

```json
{
  "action": "retry",
  "error": "NAVER_AUTH_REQUIRED",
  "retrySeconds": 300,
  "result": {}
}
```

`fail`은 사람이 개입하지 않으면 자동 복구할 수 없는 최종 실패에만 사용합니다.

## 이벤트 종류

- `reservation.created`
- `reservation.updated`
- `reservation.cancelled`
- `reservation.reactivated`
- `inventory.reconcile`

이벤트 payload에는 변경 전·후 예약 스냅샷이 포함됩니다. 날짜나 객실 변경 및 취소
시 이전 차단 범위를 잃지 않기 위해서입니다.

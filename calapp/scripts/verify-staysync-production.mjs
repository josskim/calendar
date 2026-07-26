import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const baseUrl =
  process.env.STAYSYNC_BASE_URL ??
  "https://cal.xn--q20b145avpd59fmvg.com";
const tokenFile = resolve(process.argv[2] ?? "../../staysync/release.properties");
const tokenProperties = await readFile(tokenFile, "utf8");
const token = tokenProperties.match(/^STAYSYNC_API_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) throw new Error("STAYSYNC_API_TOKEN is missing from the token file");

const envLocal = await readFile(resolve(".env.local"), "utf8");
const databaseUrl =
  process.env.DATABASE_URL ??
  envLocal.match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m)?.[1];
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const runId = Date.now().toString(36);
const sourceRef = `staysync_e2e_${runId}`;
const conflictSourceRef = `${sourceRef}_conflict`;
const marker = `[StaySync:${sourceRef}]`;
const conflictMarker = `[StaySync:${conflictSourceRef}]`;
const markerPrefix = `[StaySync:${sourceRef}`;
const baseReservation = {
  reservationType: "pension",
  sourceRef,
  startDate: "2099-12-20",
  nights: 2,
  rooms: ["201호", "202호"],
  guestName: "StaySync연동테스트",
  phone: "01000000000",
  contactName: "게스트 991220 연동테스트",
  peopleCount: 99,
  totalAmount: 800000,
  depositDate: "2099-12-01",
  rawSummary: "요청사항: 바베큐 서비스 운영 연동 테스트",
  calendarMemo: "바베큐 서비스와 추가 침구 준비",
  userType: "일반",
  usageTime: "",
};

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const database = new Client({ connectionString: databaseUrl });
await database.connect();
let deletedRows = 0;

try {
  await database.query(
    `INSERT INTO reservations
      (type, category, use_date, nights, quantity, guest_name, phone,
       people_count, user_type, total_amount, extra_amount, payment_status,
       deposit_date, cancel_date, source, memo, updated_at)
     VALUES
      ('pension', '101호', '2099-12-26T00:00:00Z', 1, 1,
       'StaySync 날짜경계테스트', '01000000000', 2, '일반', 0, 0,
       'confirmed', '2099-12-01T00:00:00Z', '2099-12-01T00:00:00Z',
       'phone', $1, NOW())`,
    [`${markerPrefix}_date_boundary]`]
  );
  const checkoutBoundary = await request("/api/mobile/reservations/check", {
    ...baseReservation,
    sourceRef: `${sourceRef}_boundary_next_day`,
    startDate: "2099-12-27",
    nights: 1,
    rooms: ["101호"],
  });
  assert(checkoutBoundary.status === 200, `boundary check HTTP ${checkoutBoundary.status}`);
  assert(checkoutBoundary.data.available === true, "checkout day was treated as overlap");

  const twoNightBoundary = await request("/api/mobile/reservations/check", {
    ...baseReservation,
    sourceRef: `${sourceRef}_boundary_two_nights`,
    startDate: "2099-12-26",
    nights: 2,
    rooms: ["101호"],
  });
  assert(twoNightBoundary.status === 200, `two-night boundary HTTP ${twoNightBoundary.status}`);
  assert(twoNightBoundary.data.available === false, "real two-night overlap was not detected");

  const initialCheck = await request(
    "/api/mobile/reservations/check",
    baseReservation
  );
  assert(initialCheck.status === 200, `initial check HTTP ${initialCheck.status}`);
  assert(initialCheck.data.available === true, "test dates are not available");

  const created = await request("/api/mobile/reservations", baseReservation);
  assert(created.status === 201, `registration HTTP ${created.status}`);
  assert(created.data.duplicate === false, "first registration was duplicate");
  assert(created.data.reservations?.length === 2, "two rooms were not created");

  const duplicate = await request("/api/mobile/reservations", baseReservation);
  assert(duplicate.status === 200, `duplicate HTTP ${duplicate.status}`);
  assert(duplicate.data.duplicate === true, "duplicate was not detected");

  const overlapping = {
    ...baseReservation,
    sourceRef: conflictSourceRef,
    startDate: "2099-12-21",
    nights: 1,
    rooms: ["201호"],
  };
  const conflictCheck = await request(
    "/api/mobile/reservations/check",
    overlapping
  );
  assert(conflictCheck.status === 200, `conflict check HTTP ${conflictCheck.status}`);
  assert(conflictCheck.data.available === false, "overlap was not detected");
  assert(conflictCheck.data.conflicts?.length === 1, "unexpected conflict count");

  const rejected = await request("/api/mobile/reservations", overlapping);
  assert(rejected.status === 409, `conflicting registration HTTP ${rejected.status}`);
  assert(rejected.data.error === "OVERBOOKING_CONFLICT", "wrong conflict error");

  const generalCampnic = {
    ...baseReservation,
    sourceRef: `${sourceRef}_campnic_general`,
    reservationType: "campnic",
    startDate: "2099-12-22",
    nights: 0,
    rooms: ["캠프닉2부"],
    guestName: "StaySync캠프닉일반테스트",
    totalAmount: 80000,
    userType: "일반",
    usageTime: "16시~21시",
    rawSummary: "캠프닉 일반 2부 운영 연동 테스트",
  };
  const generalCreated = await request("/api/mobile/reservations", generalCampnic);
  assert(generalCreated.status === 201, `general campnic HTTP ${generalCreated.status}`);

  const yasugyoCampnic = {
    ...generalCampnic,
    sourceRef: `${sourceRef}_campnic_yasugyo`,
    startDate: "2099-12-23",
    rooms: ["캠프닉1부"],
    guestName: "StaySync야수교테스트",
    userType: "야수교",
    usageTime: "10시~18시",
    rawSummary: "캠프닉 야수교 종일 운영 연동 테스트",
  };
  const yasugyoCreated = await request("/api/mobile/reservations", yasugyoCampnic);
  assert(yasugyoCreated.status === 201, `yasugyo campnic HTTP ${yasugyoCreated.status}`);

  const capacityBase = {
    ...generalCampnic,
    startDate: "2099-12-24",
    rooms: ["캠프닉2부"],
    usageTime: "16시~21시",
  };
  for (let index = 1; index <= 6; index += 1) {
    const capacityCreated = await request("/api/mobile/reservations", {
      ...capacityBase,
      sourceRef: `${sourceRef}_capacity_${index}`,
      guestName: `StaySync정원테스트${index}`,
    });
    assert(capacityCreated.status === 201, `capacity row ${index} HTTP ${capacityCreated.status}`);
  }
  const seventhCampnic = {
    ...capacityBase,
    sourceRef: `${sourceRef}_capacity_7`,
    guestName: "StaySync정원초과테스트",
  };
  const capacityCheck = await request(
    "/api/mobile/reservations/check",
    seventhCampnic
  );
  assert(capacityCheck.status === 200, `capacity check HTTP ${capacityCheck.status}`);
  assert(capacityCheck.data.available === false, "campnic capacity was not detected");
  const capacityRejected = await request("/api/mobile/reservations", seventhCampnic);
  assert(capacityRejected.status === 409, `capacity registration HTTP ${capacityRejected.status}`);
  assert(
    capacityRejected.data.error === "CAMPNIC_CAPACITY_FULL",
    "wrong campnic capacity error"
  );

  const stored = await database.query(
    `SELECT category, source, people_count, total_amount, memo,
            to_char(use_date, 'YYYY-MM-DD HH24:MI:SS') AS stored_use_date
       FROM reservations
      WHERE memo LIKE $1
      ORDER BY id`,
    [`%${marker}%`]
  );
  assert(stored.rows.length === 2, "database row count mismatch");
  assert(stored.rows.every((row) => row.source === "phone"), "source is not phone");
  assert(
    stored.rows.every((row) => row.people_count === 99),
    "people count is not 99"
  );
  assert(
    stored.rows.every((row) => row.stored_use_date === "2099-12-20 00:00:00"),
    "calendar date was shifted while storing"
  );
  assert(
    stored.rows.find((row) => row.category === "201호")?.total_amount === 800000 &&
      stored.rows.filter((row) => row.category !== "201호").every((row) => row.total_amount === 0),
    "total amount was not assigned only to room 201"
  );
  assert(
    stored.rows.every((row) => row.memo.includes("바베큐 서비스")),
    "special request is missing from memo"
  );
  assert(
    stored.rows.every((row) => row.memo.includes("추가 침구 준비")),
    "editable calendar memo is missing"
  );

  const campnicStored = await database.query(
    `SELECT category, type, nights, user_type, source, memo
       FROM reservations
      WHERE memo LIKE $1 OR memo LIKE $2
      ORDER BY id`,
    [
      `%[StaySync:${generalCampnic.sourceRef}]%`,
      `%[StaySync:${yasugyoCampnic.sourceRef}]%`,
    ]
  );
  assert(campnicStored.rows.length === 2, "campnic database row count mismatch");
  const generalRow = campnicStored.rows.find((row) => row.user_type === "일반");
  const yasugyoRow = campnicStored.rows.find((row) => row.user_type === "야수교");
  assert(generalRow?.category === "캠프닉2부", "general campnic session mismatch");
  assert(generalRow?.memo.includes("16시~21시"), "general usage time missing");
  assert(yasugyoRow?.category === "캠프닉1부", "yasugyo session mismatch");
  assert(yasugyoRow?.memo.includes("야수교"), "yasugyo memo missing");
  assert(yasugyoRow?.memo.includes("10시~18시"), "yasugyo usage time missing");
  assert(
    campnicStored.rows.every(
      (row) => row.type === "campnic" && row.nights === 0 && row.source === "phone"
    ),
    "campnic core fields mismatch"
  );

  process.stdout.write(
    JSON.stringify(
      {
        initialAvailable: true,
        createdRooms: created.data.reservations.length,
        duplicateDetected: true,
        conflictCount: conflictCheck.data.conflicts.length,
        conflictingRegistrationRejected: true,
        source: "phone",
        peopleCount: 99,
        specialRequestStored: true,
        calendarDateStoredAtMidnight: true,
        amountAssignedOnlyToRoom201: true,
        editableCalendarMemoStored: true,
        checkoutBoundaryAvailable: true,
        twoNightOverlapDetected: true,
        generalCampnicSession: "캠프닉2부",
        generalCampnicUsageTimeStored: true,
        yasugyoSession: "캠프닉1부",
        yasugyoUserTypeAndMemoStored: true,
        campnicCapacityLimit: 6,
        seventhCampnicRejected: true,
      },
      null,
      2
    ) + "\n"
  );
} finally {
  const deleted = await database.query(
    `DELETE FROM reservations
      WHERE memo LIKE $1 OR memo LIKE $2 OR memo LIKE $3`,
    [`%${marker}%`, `%${conflictMarker}%`, `%${markerPrefix}%`]
  );
  deletedRows = deleted.rowCount ?? 0;
  const remaining = await database.query(
    `SELECT COUNT(*)::int AS count
       FROM reservations
      WHERE memo LIKE $1 OR memo LIKE $2 OR memo LIKE $3`,
    [`%${marker}%`, `%${conflictMarker}%`, `%${markerPrefix}%`]
  );
  await database.end();
  process.stdout.write(
    JSON.stringify({
      cleanedTestRows: deletedRows,
      remainingTestRows: remaining.rows[0].count,
    }) + "\n"
  );
}

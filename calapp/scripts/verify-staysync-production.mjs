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
const baseReservation = {
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

  const stored = await database.query(
    `SELECT category, source, people_count, memo
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
    stored.rows.every((row) => row.memo.includes("바베큐 서비스")),
    "special request is missing from memo"
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
      },
      null,
      2
    ) + "\n"
  );
} finally {
  const deleted = await database.query(
    `DELETE FROM reservations
      WHERE memo LIKE $1 OR memo LIKE $2`,
    [`%${marker}%`, `%${conflictMarker}%`]
  );
  deletedRows = deleted.rowCount ?? 0;
  const remaining = await database.query(
    `SELECT COUNT(*)::int AS count
       FROM reservations
      WHERE memo LIKE $1 OR memo LIKE $2`,
    [`%${marker}%`, `%${conflictMarker}%`]
  );
  await database.end();
  process.stdout.write(
    JSON.stringify({
      cleanedTestRows: deletedRows,
      remainingTestRows: remaining.rows[0].count,
    }) + "\n"
  );
}

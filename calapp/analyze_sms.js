const { Client } = require('pg')
const fs = require('fs')

const envContent = fs.readFileSync('.env.local', 'utf-8')
const dbUrl = envContent.match(/DATABASE_URL="([^"]+)"/)[1]

const csvPath = 'C:/Users/youby/.claude/channels/telegram/inbox/1774881903334-AgADdhwAAkYXUVY.csv'
const raw = fs.readFileSync(csvPath, 'utf-8')
const lines = raw.split('\n').filter(l => l.trim())

function parseCSVLine(line) {
  const result = []
  let inQuote = false
  let current = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

const rows = lines.slice(1).map(l => {
  const parts = parseCSVLine(l)
  return {
    date: (parts[0] || '').replace(/^\uFEFF/, ''),
    address: parts[1],
    type: parts[2],
    body: (parts[3] || '').replace(/\r$/, '')
  }
}).filter(r => r.address)

function normalizePhone(phone) {
  if (!phone) return null
  let p = phone.replace(/[^0-9]/g, '')
  if (p.length === 10 && p.startsWith('10')) p = '0' + p
  if (p.length === 11 && p.startsWith('010')) return p
  if (p.length === 10 && p.startsWith('01')) return '0' + p
  return null
}

// 예약 키워드 (내가 보내는 예약 확인 메시지용)
const strongKeywords = ['예약', '체크인', '체크아웃', '숙박', '입금', '확인', '예약완료', '예약 완료', '박', '객실', '룸', '날짜']
// 받은 메시지에서 예약 의도를 나타내는 키워드
const intentKeywords = ['예약', '숙박', '며칠', '박', '방', '체크', '있나요', '가능', '인원', '몇명', '얼마']

const phoneMap = new Map()
for (const row of rows) {
  const phone = normalizePhone(row.address)
  if (!phone) continue
  if (!phoneMap.has(phone)) phoneMap.set(phone, { sent: [], received: [] })
  const entry = phoneMap.get(phone)
  if (row.type === '2') entry.sent.push(row)
  else entry.received.push(row)
}

// 예약 관련 번호 분류
const reservationPhones = []
for (const [phone, data] of phoneMap.entries()) {
  const sentHasKeyword = data.sent.some(m => strongKeywords.some(kw => m.body.includes(kw)))
  const receivedHasKeyword = data.received.some(m => intentKeywords.some(kw => m.body.includes(kw)))
  
  if (sentHasKeyword || receivedHasKeyword) {
    reservationPhones.push({ phone, data, sentHasKeyword, receivedHasKeyword })
  }
}

async function main() {
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  
  // 6개월치 예약
  const { rows: reservations } = await client.query(`
    SELECT id, phone, guest_name, use_date, payment_status, created_at 
    FROM reservations 
    WHERE created_at >= NOW() - INTERVAL '6 months'
    ORDER BY created_at DESC
  `)
  
  console.log(`DB 6개월 예약: ${reservations.length}건`)
  
  // DB 전화번호 정규화
  const dbByPhone = new Map()
  for (const r of reservations) {
    const p = normalizePhone(r.phone)
    if (!p) continue
    if (!dbByPhone.has(p)) dbByPhone.set(p, [])
    dbByPhone.get(p).push(r)
  }
  
  // 분류
  const done = []      // 완료: SMS 예약 + DB 있음
  const missed = []    // 미접수: SMS 예약 + DB 없음 (명확한 예약 의도)
  const duplicate = [] // 중복: DB에 2건 이상
  const ambiguous = [] // 애매: 예약 관련이지만 불명확

  for (const { phone, data, sentHasKeyword, receivedHasKeyword } of reservationPhones) {
    const dbEntries = dbByPhone.get(phone) || []
    
    if (dbEntries.length >= 2) {
      // DB에 2건 이상 → 중복
      duplicate.push({ phone, dbEntries, data })
    } else if (dbEntries.length === 1) {
      // DB에 1건 → 완료
      done.push({ phone, dbEntries, data })
    } else {
      // DB에 없음
      // 내가 보낸 문자에 예약 키워드가 있으면 → 미접수 (접수했어야 하는데 안 됨)
      // 받은 문자만 예약 키워드 → 애매
      if (sentHasKeyword) {
        missed.push({ phone, data })
      } else {
        ambiguous.push({ phone, data })
      }
    }
  }
  
  // 출력
  let output = ''
  output += `결과: 완료(${done.length}건) / 미접수(${missed.length}건) / 중복(${duplicate.length}건) / 애매한 건(${ambiguous.length}건)\n`
  output += `\n`
  
  if (missed.length > 0) {
    output += `미접수\n`
    for (const { phone, data } of missed) {
      const sample = data.sent.find(m => strongKeywords.some(kw => m.body.includes(kw)))
      output += `${phone}\n`
      if (sample) output += `  └ ${sample.date} | ${sample.body.substring(0, 60)}\n`
    }
    output += `\n`
  }
  
  if (duplicate.length > 0) {
    output += `중복\n`
    for (const { phone, dbEntries } of duplicate) {
      output += `${phone}\n`
      for (const e of dbEntries) {
        output += `  └ DB: ${e.guest_name} / ${e.use_date?.toISOString().substring(0,10)} / ${e.payment_status}\n`
      }
    }
    output += `\n`
  }
  
  if (ambiguous.length > 0) {
    output += `애매한 건\n`
    for (const { phone, data } of ambiguous) {
      const sample = data.received.find(m => intentKeywords.some(kw => m.body.includes(kw)))
      output += `${phone}\n`
      if (sample) output += `  └ ${sample.date} | ${sample.body.substring(0, 60)}\n`
    }
  }
  
  console.log('\n' + output)
  fs.writeFileSync('C:/tmp/sms_analysis.txt', output, 'utf-8')
  console.log('\n→ C:/tmp/sms_analysis.txt 저장 완료')
  
  await client.end()
}

main().catch(console.error)

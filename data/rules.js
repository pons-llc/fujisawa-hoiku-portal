// 申込ナビ（令和9年度版）から転記した制度データ。
// 出典ページは各項目の page を参照。転記誤りの可能性があるため、必ず原本で確認してください。
window.RULES = {
  fiscalYear: '令和9年度',
  baseDate: '2027-04-01', // クラス年齢の基準日（年度初日）

  // P1 クラス年齢（4月1日時点の年齢）
  classRanges: [
    { cls: 0, from: '2026-04-02', to: '2099-12-31' },
    { cls: 1, from: '2025-04-02', to: '2026-04-01' },
    { cls: 2, from: '2024-04-02', to: '2025-04-01' },
    { cls: 3, from: '2023-04-02', to: '2024-04-01' },
    { cls: 4, from: '2022-04-02', to: '2023-04-01' },
    { cls: 5, from: '2021-04-02', to: '2022-04-01' },
  ],

  // P11 締切
  deadlines: {
    april1: { label: '4月1次', start: '2026-10-05', end: '2026-10-23', method: '郵送のみ（市内在住で市内施設希望の場合）', resubmit: '2026-11-13', withdraw: '2026-12-28', notice: '2026-11-02' },
    april2: { label: '4月2次', end: '2027-02-08', method: '窓口・郵送・電子申請' },
    // 5月以降は「入所希望月の前々月末（土日祝は翌開庁日）」。年末年始の例外を記載
    special: { '2028-02': '2027-12-28' },
  },

  // P6 利用者負担額（保育料）表（単位：円/月）
  // 各行: [階層, 所得割下限, 所得割上限(未満), ひとり親等?, 認可保育所等(第1子 標準,短時間, 第2子 標準,短時間), 家庭的(第1子 標準,短時間, 第2子 標準,短時間)]
  // ※3歳児クラス以上（2号認定）は無償化対象のため0円
  feeTable: [
    { tier: 'A',  label: '生活保護世帯', kind: 'all',    nursery: [0, 0, 0, 0], family: [0, 0, 0, 0] },
    { tier: 'B1', label: '市町村民税非課税（ひとり親世帯等）', kind: 'single', nursery: [0, 0, 0, 0], family: [0, 0, 0, 0] },
    { tier: 'B2', label: '市町村民税非課税（その他の世帯）', kind: 'other',  nursery: [0, 0, 0, 0], family: [0, 0, 0, 0] },
    { tier: 'C1', label: '所得割非課税', kind: 'single', nursery: [3000, 2900, 0, 0], family: [2100, 2100, 0, 0] },
    { tier: 'C1', label: '所得割非課税', kind: 'other',  nursery: [6000, 5900, 3000, 2900], family: [4300, 4300, 2100, 2100] },
    { tier: 'C2', min: 1, max: 24300, kind: 'single', nursery: [3500, 3400, 0, 0], family: [2500, 2500, 0, 0] },
    { tier: 'C2', min: 1, max: 24300, kind: 'other',  nursery: [7000, 6900, 3500, 3400], family: [5000, 5000, 2500, 2500] },
    { tier: 'C3', min: 24300, max: 48600, kind: 'single', nursery: [4200, 4100, 0, 0], family: [3100, 3000, 0, 0] },
    { tier: 'C3', min: 24300, max: 48600, kind: 'other',  nursery: [8300, 8200, 4200, 4100], family: [6100, 6000, 3100, 3000] },
    { tier: 'C4', min: 48600, max: 57700, kind: 'single', nursery: [5600, 5400, 0, 0], family: [4000, 4000, 0, 0] },
    { tier: 'C4', min: 48600, max: 57700, kind: 'other',  nursery: [11200, 11000, 5600, 5400], family: [8200, 8100, 4000, 4000] },
    { tier: 'C4', min: 57700, max: 60700, kind: 'single', nursery: [5600, 5400, 0, 0], family: [4000, 4000, 0, 0] },
    { tier: 'C4', min: 57700, max: 60700, kind: 'other',  nursery: [11200, 11000, 5600, 5400], family: [8200, 8100, 4000, 4000] },
    { tier: 'C5', min: 60700, max: 77101, kind: 'single', nursery: [8000, 7900, 0, 0], family: [5900, 5800, 0, 0] },
    { tier: 'C5', min: 60700, max: 77101, kind: 'other',  nursery: [16000, 15700, 8000, 7900], family: [11800, 11600, 5900, 5800] },
    { tier: 'C5', min: 77101, max: 78900, kind: 'all',    nursery: [16000, 15700, 8000, 7900], family: [11800, 11600, 5900, 5800] },
    { tier: 'C6', min: 78900, max: 97000, kind: 'all',    nursery: [20100, 19800, 10100, 9900], family: [14800, 14600, 7400, 7300] },
    { tier: 'C7', min: 97000, max: 123000, kind: 'all',   nursery: [25400, 25000, 12700, 12500], family: [18700, 18400, 9400, 9200] },
    { tier: 'C8', min: 123000, max: 148200, kind: 'all',  nursery: [33100, 32500, 16600, 16300], family: [24400, 24000, 12200, 12000] },
    { tier: 'C9', min: 148200, max: 169000, kind: 'all',  nursery: [39500, 38800, 19800, 19400], family: [29100, 28700, 14600, 14400] },
    { tier: 'C10', min: 169000, max: 196000, kind: 'all', nursery: [43800, 43100, 21900, 21600], family: [32300, 31800, 16200, 15900] },
    { tier: 'C11', min: 196000, max: 224000, kind: 'all', nursery: [46400, 45600, 23200, 22800], family: [34200, 33700, 17100, 16900] },
    { tier: 'C12', min: 224000, max: 249000, kind: 'all', nursery: [49100, 48300, 24600, 24200], family: [36300, 35700, 18200, 17900] },
    { tier: 'C13', min: 249000, max: 264000, kind: 'all', nursery: [52600, 51700, 26300, 25900], family: [38800, 38200, 19400, 19100] },
    { tier: 'C14', min: 264000, max: 301000, kind: 'all', nursery: [56300, 55300, 28200, 27700], family: [41600, 40900, 20800, 20500] },
    { tier: 'C15', min: 301000, max: 351000, kind: 'all', nursery: [60200, 59200, 30100, 29600], family: [44400, 43700, 22200, 21900] },
    { tier: 'C16', min: 351000, max: 397000, kind: 'all', nursery: [62600, 61500, 31300, 30800], family: [46200, 45500, 23100, 22800] },
    { tier: 'C17', min: 397000, max: 465000, kind: 'all', nursery: [66000, 64900, 33000, 32500], family: [48800, 48000, 24400, 24000] },
    { tier: 'C18', min: 465000, max: Infinity, kind: 'all', nursery: [69500, 68300, 34800, 34200], family: [51300, 50500, 25700, 25300] },
  ],

  // P2 公立保育園の延長保育料（月額）
  extensionFee: [
    { tiers: /^(A|B1|B2)$/, std: 0, short: 0 },
    { tiers: /^C[1-3]$/, std: 1000, short: 100 },
    { tiers: /^C[4-7]$/, std: 2000, short: 200 },
    { tiers: /^C[89]$/, std: 3000, short: 300 },
    { tiers: /^C1[0-8]$/, std: 4000, short: 400 },
  ],

  // P18 B優先順位（高い順）
  priority: [
    { key: 'disaster', code: 'A', label: '災害' },
    { key: 'other', code: 'B', label: 'その他' },
    { key: 'single', code: 'C', label: 'ひとり親' },
    { key: 'illness', code: 'D', label: '疾病・障がい' },
    { key: 'birth', code: 'E', label: '出産' },
    { key: 'work', code: 'F', label: '就労' },
    { key: 'care', code: 'G', label: '介護・看護' },
    { key: 'study', code: 'I', label: '就学' },
    { key: 'offer', code: 'J', label: '就労内定(開業予定)' },
    { key: 'seeking', code: 'K', label: '求職中' },
  ],

  officialUrl: 'https://www.city.fujisawa.kanagawa.jp/hoiku/kenko/kosodate/hoikuen/hoikuen-sinnsei.html',
  ekanagawaNote: '電子申請は藤沢市ホームページから e-kanagawa 電子申請「藤沢市認可保育施設の利用申請手続き」へ',
  contact: '藤沢市役所 保育課 入園担当 TEL 0466-50-3526（直通）／〒251-8601 藤沢市朝日町1番地の1 本庁舎3階',
};

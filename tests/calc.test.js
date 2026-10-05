// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// 点数計算・保育料・必要量・締切のテスト。期待値は申込ナビ（令和9年度版）P1〜P18の記載から起こしたもの。
// 実行: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

global.window = {};
const mem = {};
global.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
for (const f of ['data/rules.js', 'data/facilities.js', 'js/store.js', 'js/calc.js']) require(path.join(__dirname, '..', f));
const { Store, Calc } = window;

// 既定：藤沢市在住・父母とも就労（月160h）・児童1人（1歳児クラス）・4月1次
function base(mod = {}) {
  Store.reset();
  const s = JSON.parse(JSON.stringify(Store.state));
  s.father.hours = '160'; s.mother.hours = '160';
  s.children[0].birth = '2025-06-01';
  s.application.startMonth = '2027-04'; s.application.aprilRound = '1';
  s.household.taxStatus = 'taxed'; s.household.shotokuwari = '100000';
  return deepAssign(s, mod);
}
function deepAssign(t, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object') deepAssign(t[k], v);
    else t[k] = v;
  }
  return t;
}
const child = (birth, extra = {}) => Object.assign(Store.emptyChild(), { birth, name: 'c' + birth }, extra);

// ============ A-1 基礎点数（父母それぞれ） ============
test('A-1 就労：時間区分と境界値', () => {
  const cases = [[200, 10], [140, 10], [139, 9], [112, 9], [111, 8], [64, 8], [63, 7], [10, 7], [0, 7]];
  for (const [h, exp] of cases) assert.equal(Calc.parentA1({ present: true, reason: 'work', hours: String(h) }).score, exp, `就労 月${h}h`);
});
test('A-1 就労内定：時間区分と境界値', () => {
  const cases = [[160, 6], [140, 6], [139, 5], [64, 5], [63, 4], [0, 4]];
  for (const [h, exp] of cases) assert.equal(Calc.parentA1({ present: true, reason: 'offer', hours: String(h) }).score, exp, `内定 月${h}h`);
});
test('A-1 就学・介護看護は就労に準じる（*1）', () => {
  for (const reason of ['study', 'care']) {
    assert.equal(Calc.parentA1({ present: true, reason, hours: '140' }).score, 10);
    assert.equal(Calc.parentA1({ present: true, reason, hours: '112' }).score, 9);
    assert.equal(Calc.parentA1({ present: true, reason, hours: '64' }).score, 8);
    assert.equal(Calc.parentA1({ present: true, reason, hours: '40' }).score, 7);
  }
});
test('A-1 その他の事由', () => {
  const P = o => Calc.parentA1({ present: true, ...o }).score;
  assert.equal(P({ reason: 'seeking' }), 3);
  assert.equal(P({ reason: 'birth' }), 10);
  assert.equal(P({ reason: 'illness', illnessLevel: 'full' }), 12);
  assert.equal(P({ reason: 'illness', illnessLevel: 'daytime' }), 10);
  assert.equal(P({ reason: 'illness', illnessLevel: 'partial' }), 8);
  assert.equal(P({ reason: 'disability', disabilityLevel: 'severe' }), 10);
  assert.equal(P({ reason: 'disability', disabilityLevel: 'grade3' }), 8);
  assert.equal(P({ reason: 'disability', disabilityLevel: 'grade4' }), 7);
  assert.equal(P({ reason: 'disaster' }), 12);
  assert.equal(P({ reason: 'other' }), 20);
});
test('A-1 父母の低い方を採用', () => {
  assert.equal(Calc.score(base({ father: { hours: '160' }, mother: { hours: '100' } })).a1, 8);
  assert.equal(Calc.score(base({ father: { reason: 'seeking' }, mother: { hours: '160' } })).a1, 3);
  assert.equal(Calc.score(base({ father: { reason: 'illness', illnessLevel: 'full' }, mother: { reason: 'offer', hours: '150' } })).a1, 6);
});
test('A-1 ひとり親世帯は11点', () => {
  assert.equal(Calc.score(base({ household: { singleParent: true }, father: { present: false }, mother: { hours: '60' } })).a1, 11);
  assert.equal(Calc.score(base({ father: { present: false }, mother: { reason: 'seeking' } })).a1, 11, '父不在（present=false）でもひとり親扱い');
});

test('ひとり親なのに父母とも「いる」の場合は警告', () => {
  assert.equal(Calc.score(base({ household: { singleParent: true } })).warnings.length, 1);
  assert.equal(Calc.score(base({ household: { singleParent: true }, father: { present: false } })).warnings.length, 0);
});

// ============ A-2 加算・減算 ============
const a2 = mod => Calc.score(base(mod)).a2;
test('A-2 該当なしは0', () => assert.equal(a2({}), 0));
test('A-2 ①生活保護（自立促進が図られる場合のみ）+1', () => {
  assert.equal(a2({ household: { welfare: true, welfareSelfReliance: true } }), 1);
  assert.equal(a2({ household: { welfare: true, welfareSelfReliance: false } }), 0);
});
test('A-2 ②きょうだい在園施設を希望 +2', () => assert.equal(a2({ household: { siblingSameFacility: true } }), 2));
test('A-2 ③本人含め3人以上同時申込 +2（2人は対象外）', () => {
  assert.equal(a2({ children: [child('2025-06-01'), child('2023-06-01')] }), 0);
  assert.equal(a2({ children: [child('2025-06-01'), child('2023-06-01'), child('2022-06-01')] }), 2);
});
test('A-2 ④保育料滞納 -20', () => assert.equal(a2({ household: { arrears: true } }), -20));
test('A-2 ⑤保育士・幼稚園教諭として復職/内定 +6', () => {
  assert.equal(a2({ mother: { nurseryJob: 'teacher' } }), 6);
  assert.equal(a2({ mother: { nurseryJob: 'teacher' }, father: { nurseryJob: 'assistant' } }), 6, '⑤⑥重複時は⑤のみ');
  assert.equal(a2({ mother: { nurseryJob: 'teacher' }, application: { transfer: true } }), 0, '転園申請は除く');
});
test('A-2 ⑥保育補助者として復職/内定 +2', () => assert.equal(a2({ mother: { nurseryJob: 'assistant' } }), 2));
test('A-2 ⑤⑥市外在住（在勤要件）：就労内定は除く／復職は対象・⑦は除く', () => {
  // 市外在住・在勤：⑦-10（⑤⑥に該当しない）
  assert.equal(a2({ household: { residence: 'outsideWork' } }), -10);
  // 市外在住・在勤で保育士として育休から復職 → ⑤+6、⑦は「⑤⑥に該当する場合は除く」
  assert.equal(a2({ household: { residence: 'outsideWork' }, mother: { nurseryJob: 'teacher', ikukyu: true } }), 6);
  // 市外在住・在勤で保育士として就労内定 → ⑤対象外、⑦-10
  assert.equal(a2({ household: { residence: 'outsideWork' }, mother: { reason: 'offer', hours: '160', nurseryJob: 'teacher' } }), -10);
});
test('A-2 ⑦転入予定で契約書等の提出なし -10', () => {
  assert.equal(a2({ household: { residence: 'moving', contractDocs: false } }), -10);
  assert.equal(a2({ household: { residence: 'moving', contractDocs: true } }), 0);
});
test('A-2 ⑧育休B -30（藤沢市在住・転入予定者のみ）', () => {
  assert.equal(a2({ mother: { ikukyu: true }, application: { ikukyuChoice: 'B' } }), -30);
  assert.equal(a2({ mother: { ikukyu: true }, application: { ikukyuChoice: 'A' } }), 0);
  assert.equal(a2({ household: { residence: 'moving' }, mother: { ikukyu: true }, application: { ikukyuChoice: 'B' } }), -30);
  assert.equal(a2({ household: { residence: 'outsideWork' }, mother: { ikukyu: true }, application: { ikukyuChoice: 'B' } }), -10, '市外在勤はB不可（⑦のみ）');
  assert.equal(a2({ application: { ikukyuChoice: 'B' } }), 0, '育休なしなら無関係');
});
test('A-2 ⑨内定辞退等 -2', () => assert.equal(a2({ household: { pastDecline: true } }), -2));
test('A-2 ⑩地域型保育卒園 +5（4月審査のみ）', () => {
  assert.equal(a2({ household: { graduateSmall: true } }), 5);
  assert.equal(a2({ household: { graduateSmall: true }, application: { startMonth: '2027-06' } }), 0);
});
test('A-2 複合：基礎点数 = A-1 + A-2', () => {
  const r = Calc.score(base({ mother: { hours: '120', ikukyu: true }, household: { pastDecline: true, siblingSameFacility: true }, application: { ikukyuChoice: 'B' } }));
  assert.equal(r.a1, 9); assert.equal(r.a2, 2 - 30 - 2); assert.equal(r.base, -21);
});

// ============ B 優先順位 ============
const prio = mod => Calc.score(base(mod)).priority.code;
test('B 優先順位：父母の高い方', () => {
  assert.equal(prio({}), 'F');
  assert.equal(prio({ father: { reason: 'disaster' } }), 'A');
  assert.equal(prio({ father: { reason: 'other' } }), 'B');
  assert.equal(prio({ father: { reason: 'illness' } }), 'D');
  assert.equal(prio({ father: { reason: 'disability' } }), 'D');
  assert.equal(prio({ mother: { reason: 'birth' } }), 'E');
  assert.equal(prio({ father: { reason: 'care' }, mother: { reason: 'care' } }), 'G');
  assert.equal(prio({ father: { reason: 'study' }, mother: { reason: 'offer' } }), 'I');
  assert.equal(prio({ father: { reason: 'offer' }, mother: { reason: 'seeking' } }), 'J');
  assert.equal(prio({ father: { reason: 'seeking' }, mother: { reason: 'seeking' } }), 'K');
  assert.equal(prio({ father: { reason: 'care' }, mother: { reason: 'work' } }), 'F', '就労(F)は介護(G)より上');
});
test('B ひとり親は C', () => assert.equal(prio({ household: { singleParent: true }, father: { present: false } }), 'C'));

// ============ C 調整項目 ============
const C = mod => Calc.score(base(mod)).c;
test('C 基準は父母のA-1の高い方', () => {
  assert.equal(C({ father: { hours: '160' }, mother: { hours: '70' } }), 10);
  assert.equal(C({ father: { reason: 'seeking' }, mother: { hours: '120' } }), 9);
});
test('C ①2人以上同時申込 +2／②多胎 +2', () => {
  assert.equal(C({ children: [child('2025-06-01'), child('2023-06-01')] }), 12);
  assert.equal(C({ children: [child('2025-06-01'), child('2025-06-01')] }), 14);
});
test('C ③認可外等に週3日以上 +3（育休中・市外在住は除く）', () => {
  assert.equal(C({ children: [child('2025-06-01', { paidCare: '3days' })] }), 13);
  assert.equal(C({ children: [child('2025-06-01', { paidCare: '3days' })], mother: { ikukyu: true } }), 12, '育休中は③なし（⑨+2のみ）');
  assert.equal(C({ children: [child('2025-06-01', { paidCare: '3days' })], household: { residence: 'outsideWork' } }), 10);
});
test('C ④認可施設以外に週1回以上 +2（③該当時・育休中は除く）', () => {
  assert.equal(C({ children: [child('2025-06-01', { paidCare: 'weekly' })] }), 12);
  assert.equal(C({ children: [child('2025-06-01', { paidCare: 'weekly' })], mother: { ikukyu: true } }), 12, '育休中は④なし（⑨+2のみ）');
});
test('C ⑤父母とも住民税非課税 +1', () => {
  assert.equal(C({ household: { taxStatus: 'nontax' } }), 11);
  assert.equal(C({ household: { taxStatus: 'zeroIncomeLevy' } }), 10, '所得割のみ非課税は対象外');
});
test('C ⑥18歳未満のきょうだい3人以上 +1', () => {
  assert.equal(C({ household: { siblingsUnder18: 3 } }), 11);
  assert.equal(C({ household: { siblingsUnder18: 2 } }), 10);
});
test('C ⑦同居家族の障がい・要介護 +2（疾病・障がい・介護世帯は除く）', () => {
  assert.equal(C({ household: { familyCareC7: true } }), 12);
  assert.equal(C({ household: { familyCareC7: true }, father: { reason: 'care', hours: '160' } }), 10);
  assert.equal(C({ household: { familyCareC7: true }, father: { reason: 'illness', illnessLevel: 'full' } }), 12, '疾病世帯：基準12、⑦なし');
});
test('C ⑧長期入院・単身赴任 +2', () => {
  assert.equal(C({ household: { absentParent: 'transfer' } }), 12);
  assert.equal(C({ household: { absentParent: 'hospital' } }), 12);
});
test('C ⑨育休から復職見込み +2（自営等で育休を取得できない場合は除く）', () => {
  assert.equal(C({ mother: { ikukyu: true } }), 12);
  assert.equal(C({ mother: { ikukyu: true }, father: { ikukyu: true } }), 12, '父母とも育休でも+2は1回');
  assert.equal(C({ mother: { ikukyu: true, selfEmployed: true } }), 10, '自営業は育児・介護休業法の育休ではない');
});
test('C ⑩ひとり親で65歳未満の同居親族なし +3', () => {
  assert.equal(C({ household: { singleParent: true, noRelativeUnder65: true }, father: { present: false } }), 13);
  assert.equal(C({ household: { singleParent: false, noRelativeUnder65: true } }), 10, 'ひとり親以外は対象外');
});

// ============ 申込ナビP18【審査の例】 ============
test('審査の例 児童A：基礎9／優先F／調整13', () => {
  const r = Calc.score(base({ father: { hours: '160' }, mother: { hours: '120' }, children: [child('2025-06-01', { paidCare: '3days' })] }));
  assert.deepEqual([r.base, r.priority.code, r.c], [9, 'F', 13]);
});
test('審査の例 児童B：基礎11／優先C／調整12', () => {
  const r = Calc.score(base({ household: { singleParent: true }, father: { present: false }, mother: { hours: '170', ikukyu: true } }));
  assert.deepEqual([r.base, r.priority.code, r.c], [11, 'C', 12]);
});

// ============ 保育の必要量 ============
test('必要量：標準／短時間の境界', () => {
  const N = mod => Calc.needAmount(base(mod)).type;
  assert.equal(N({ father: { hours: '120' }, mother: { hours: '120' } }), 'std');
  assert.equal(N({ father: { hours: '160' }, mother: { hours: '119' } }), 'short');
  assert.equal(N({ father: { hours: '64' }, mother: { hours: '160' } }), 'short');
  assert.equal(N({ father: { hours: '63' }, mother: { hours: '160' } }), 'none');
  assert.equal(N({ father: { reason: 'seeking' } }), 'short');
});

// ============ 保育料 ============
const fee = (mod, order = 1, type = 'nursery', i = 0) => { const s = base(mod); return Calc.fee(s, s.children[i], type, order); };
test('保育料：階層の境界（その他世帯・標準時間・第1子）', () => {
  const cases = [['1', 'C2', 7000], ['24299', 'C2', 7000], ['24300', 'C3', 8300], ['48600', 'C4', 11200], ['57700', 'C4', 11200], ['60700', 'C5', 16000], ['77101', 'C5', 16000], ['78900', 'C6', 20100], ['123000', 'C8', 33100], ['148200', 'C9', 39500], ['169000', 'C10', 43800], ['465000', 'C18', 69500], ['999999', 'C18', 69500]];
  for (const [amt, tier, yen] of cases) { const f = fee({ household: { shotokuwari: amt } }); assert.equal(f.tier, tier, amt); assert.equal(f.amount, yen, amt); }
});
test('保育料：非課税・生活保護・所得割非課税', () => {
  assert.equal(fee({ household: { taxStatus: 'welfare' } }).amount, 0);
  assert.equal(fee({ household: { taxStatus: 'nontax' } }).amount, 0);
  assert.equal(fee({ household: { taxStatus: 'zeroIncomeLevy' } }).amount, 6000);
  assert.equal(fee({ household: { taxStatus: 'taxed', shotokuwari: '0' } }).tier, 'C1');
});
test('保育料：ひとり親世帯等（C1〜C5は軽減、77,101円以上は同額）', () => {
  const sp = { household: { singleParent: true }, father: { present: false } };
  assert.equal(fee(deepAssign(sp, { household: { shotokuwari: '30000' } })).amount, 4200);
  assert.equal(fee(deepAssign(JSON.parse(JSON.stringify(sp)), { household: { shotokuwari: '70000' } })).amount, 8000);
  assert.equal(fee(deepAssign(JSON.parse(JSON.stringify(sp)), { household: { shotokuwari: '70000' } }), 2).amount, 0, 'ひとり親の第2子は0円');
  assert.equal(fee(deepAssign(JSON.parse(JSON.stringify(sp)), { household: { shotokuwari: '80000' } })).amount, 20100);
});
test('保育料：第2子半額・第3子以降0円・短時間・家庭的保育', () => {
  assert.equal(fee({ household: { shotokuwari: '150000' } }, 2).amount, 19800);
  assert.equal(fee({ household: { shotokuwari: '150000' } }, 3).amount, 0);
  assert.equal(fee({ household: { shotokuwari: '150000' }, mother: { hours: '100' } }).amount, 38800);
  assert.equal(fee({ household: { shotokuwari: '150000' } }, 1, 'family').amount, 29100);
  assert.equal(fee({ household: { shotokuwari: '150000' }, mother: { hours: '100' } }, 2, 'family').amount, 14400);
});
test('保育料：3歳児クラス以上は無償', () => {
  assert.equal(fee({ children: [child('2024-04-01')], household: { shotokuwari: '300000' } }).amount, 0);
  assert.equal(fee({ children: [child('2024-04-02')], household: { shotokuwari: '300000' } }).amount, 56300);
});
test('保育料：公立延長保育料', () => {
  assert.equal(fee({ household: { shotokuwari: '30000' } }).ext, 1000);
  assert.equal(fee({ household: { shotokuwari: '100000' } }).ext, 2000);
  assert.equal(fee({ household: { shotokuwari: '150000' } }).ext, 3000);
  assert.equal(fee({ household: { shotokuwari: '200000' } }).ext, 4000);
  assert.equal(fee({ household: { shotokuwari: '200000' }, mother: { hours: '100' } }).ext, 400);
});

// ============ クラス年齢 ============
test('クラス年齢（4月1日時点・4/1生まれは上の学年）', () => {
  const t = [['2026-04-02', 0], ['2026-04-01', 1], ['2025-04-02', 1], ['2025-04-01', 2], ['2023-04-02', 3], ['2022-04-01', 5], ['2021-04-02', 5], ['2021-04-01', 6]];
  for (const [b, c] of t) assert.equal(Calc.classAge(b), c, b);
});

// ============ 締切 ============
test('締切：前々月末・土日は翌開庁日・特例', () => {
  const t = { '2027-05': '2027-03-31', '2027-06': '2027-04-30', '2027-07': '2027-05-31', '2027-08': '2027-06-30', '2027-09': '2027-08-02', '2027-10': '2027-08-31', '2027-11': '2027-09-30', '2027-12': '2027-11-01', '2028-01': '2027-11-30', '2028-02': '2027-12-28', '2028-03': '2028-01-31' };
  for (const [m, d] of Object.entries(t)) assert.equal(Calc.deadlineFor(m, '').date, d, m);
  assert.equal(Calc.deadlineFor('2027-04', '1').date, '2026-10-23');
  assert.equal(Calc.deadlineFor('2027-04', '2').date, '2027-02-08');
});

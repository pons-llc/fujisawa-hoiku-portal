// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// QRデータのエンコード・デコード（往復で一致、分割、改ざん検知、欠落検知）
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
global.window = {};
const mem = {};
global.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
for (const f of ['data/rules.js', 'js/store.js', 'js/qrdata.js']) require(path.join(__dirname, '..', f));
const { Store, QRData } = window;

function family() {
  Store.reset();
  const s = JSON.parse(JSON.stringify(Store.state));
  Object.assign(s.household, { postal: '251-8601', address1: '朝日町1番地の1', address2: '〇〇マンション101号室', familyDisability: true, familyDisabilityNames: '藤沢 じろう', absentParent: 'transfer' });
  Object.assign(s.father, { name: '藤沢 いちろう', kana: 'ふじさわ いちろう', birth: '1990-02-02', hours: '160', employer: '株式会社☆☆', cohabit: false });
  Object.assign(s.mother, { name: '藤沢 はなこ', kana: 'ふじさわ はなこ', birth: '1990-01-01', hours: '120', employer: '◆◆信用金庫', ikukyu: true, ikukyuFrom: '2026-08-02', ikukyuTo: '2027-03-31' });
  s.children = [Object.assign(Store.emptyChild(), { name: '藤沢 たろう', kana: 'ふじさわ たろう', birth: '2024-07-01', sex: 'male', status: 'unlicensed', statusName: 'キュン保育園', paidCare: '3days' }), Object.assign(Store.emptyChild(), { name: '藤沢 はな', kana: 'ふじさわ はな', birth: '2026-08-02', sex: 'female' })];
  s.children[0].survey.allergy = 'yes'; s.children[0].survey.allergyItems = ['egg'];
  s.members = [{ relation: '兄', name: '藤沢 じろう', kana: 'ふじさわ じろう', birth: '2015-03-03', cohabit: true, workplace: '■■小学校' }];
  s.application.wishes[0] = { id: '1', name: '藤沢保育園', visited: true, reason: '自宅に近いため', visitPlan: '' };
  s.application.wishes[1] = { id: '72', name: 'キディ鵠沼・藤沢', visited: false, reason: '延長が長い', visitPlan: '2026-11-03' };
  return s;
}

test('往復：エンコードした内容がそのまま復元できる', async () => {
  const s = family();
  const enc = await QRData.encode(s);
  assert.equal(enc.chunks.length, 1);
  assert.match(enc.chunks[0], /^FH1-[0-9A-F]{6}-1-1-[0-9A-Z $%*+\-./:]+$/);
  assert.ok(enc.chunks[0].length < 1400, `QR1つに収まる長さ（${enc.chunks[0].length}文字）`);
  const { results, errors } = await QRData.decode(enc.chunks);
  assert.deepEqual(errors, []);
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, true);
  assert.deepEqual(results[0].data, enc.data);
  const rows = Object.fromEntries(results[0].rows.map(([s, l, v]) => [`${s}_${l}`, v]));
  assert.equal(rows['母_氏名'], '藤沢 はなこ');
  assert.equal(rows['母_育児休業'], '取得中（2026-08-02〜2027-03-31）');
  assert.equal(rows['父_同居'], 'いいえ');
  assert.equal(rows['児童1_有償の預け先'], '有償・週3日以上');
  assert.equal(rows['児童1_アレルギー'], '有：卵');
  assert.equal(rows['希望園_第2希望 施設名'], 'キディ鵠沼・藤沢');
  assert.equal(rows['世帯_父母の長期不在'], '単身赴任中');
});

test('大きなデータは複数のQRに分割され、順不同でも復元できる', async () => {
  const s = family();
  for (let i = 0; i < 4; i++) s.members.push({ relation: 'その他', name: '長い名前の家族' + i + 'あいうえおかきくけこさしすせそ', kana: 'ながいなまえのかぞく', birth: '1950-01-0' + (i + 1), cohabit: true, workplace: '勤務先' + 'たちつてと'.repeat(10) });
  for (let i = 2; i < 10; i++) s.application.wishes[i] = { id: String(100 + i), name: '保育園' + i, visited: false, reason: '理由がとても長い場合のテキスト'.repeat(3) + i, visitPlan: '2026-11-0' + (i % 9 + 1) };
  const enc = await QRData.encode(s);
  assert.ok(enc.chunks.length >= 2, `分割数 ${enc.chunks.length}`);
  assert.ok(enc.chunks.every(c => c.length < 1400));
  const { results } = await QRData.decode([...enc.chunks].reverse());
  assert.equal(results[0].ok, true);
  assert.deepEqual(results[0].data, enc.data);
});

test('改ざん・破損は照合コードで検知、欠落も検知、無関係な文字列は除外', async () => {
  const enc = await QRData.encode(family());
  const c = enc.chunks[0];
  // 別の正しい申込データの本体に差し替える（＝照合コードと中身が一致しない）
  const other = await QRData.encode(Object.assign(family(), { household: { ...family().household, address1: '別の住所' } }));
  const tampered = c.slice(0, 15) + other.chunks[0].slice(15);
  const r1 = await QRData.decode([tampered]);
  assert.equal(r1.results[0].ok, false);
  assert.match(r1.results[0].error, /照合コード/);
  const parts = c.split('-'); const half = `FH1-${parts[1]}-1-2-${c.slice(15, 100)}`;
  const r2 = await QRData.decode([half]);
  assert.match(r2.results[0].error, /2枚目がありません/);
  const r3 = await QRData.decode(['https://example.com', '']);
  assert.equal(r3.results.length, 0); assert.equal(r3.errors.length, 1);
});

test('複数の申込が混在してもそれぞれ復元でき、CSVは1申込1行', async () => {
  const a = await QRData.encode(family());
  const s2 = family(); s2.mother.name = '鵠沼 ゆき'; s2.father.present = false; s2.household.singleParent = true;
  const b = await QRData.encode(s2);
  const { results } = await QRData.decode([...a.chunks, ...b.chunks]);
  assert.equal(results.length, 2);
  const csv = QRData.toCSV(results);
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^"照合コード","照合結果"/);
  assert.match(csv, /鵠沼 ゆき/); assert.match(csv, /いない（ひとり親）/);
});

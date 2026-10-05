// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// facilities/*.geojson（藤沢市オープンデータ）と申込ナビP27〜35の抽出データを統合して data/facilities.js を生成する
// 使い方: node tools/build-facilities.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const naviTable = require('./navi-facility-table.json');
const extraCoords = require('./extra-coords.json');
const master = fs.readFileSync(path.join(__dirname, 'navi-facility-master.txt'), 'utf8').trim().split('\n').map(l => { const [id, type, name, tel, addr, area] = l.split('|'); return { id: +id, type, name, tel: '0466-' + tel, addr: '藤沢市' + addr, area }; });

const norm = s => String(s || '').normalize('NFKC').replace(/[\s　・･\-－ー]/g, '').replace(/[（）()]/g, '').toLowerCase();
const telNorm = s => String(s || '').normalize('NFKC').replace(/\D/g, '');

const capOverride = { 7: [0, 15, 17, 17, 22, 23], 67: [15, 25, 25, 0, 0, 0], 78: [0, 0, 0, 25, 25, 25], 68: [11, 15, 15, 15, 0, 0], 77: [6, 6, 6, 6, 0, 0], 107: [6, 15, 17, 22, 0, 0], 990: [0, 5, 5, 0, 0, 0] };
const remarks = { 7: '令和14年3月31日をもって閉園予定', 16: '施設老朽化等の状況を踏まえ閉園について検討中', 5: '住所は園舎移転後の住所（2026年9月時点で判明しているもの）', 67: '3歳児クラスからは「78 ときわぎ保育園分園」に転園', 990: 'ときわぎ保育園と同住所。2歳児クラス修了後に転園が必要', 68: '4歳児以降に転園が必要', 107: '4歳児以降に転園が必要', 301: '申込み前に必ず事前見学が必要（見学未済は審査対象外）', 304: '申込み前に必ず事前見学が必要（見学未済は審査対象外）' };
const z2h = s => s.replace(/[０-９]/g, d => '０１２３４５６７８９'.indexOf(d));

function naviInfo(m) {
  const f = naviTable[m.id] || {};
  const small = m.type === '小規模保育事業' || m.type === '家庭的保育事業';
  let cap = capOverride[m.id] || (small || m.type === '認定こども園' ? null : (f.nums || []).slice(0, 6));
  const total = cap ? cap.reduce((a, b) => a + b, 0) : (f.nums || [])[0] || null;
  const classes = small ? [0, 1, 2] : m.type === '認定こども園' ? [3, 4, 5] : cap.map((c, i) => (c > 0 ? i : -1)).filter(i => i >= 0);
  let latest = 0; (f.times || []).forEach(t => { const x = z2h(t).match(/～(\d{1,2})：(\d\d)/); if (x) latest = Math.max(latest, +x[1] + x[2] / 60); });
  let minDays = null, x; const ma = f.minAge || '';
  if ((x = ma.match(/生後(\d+)日/))) minDays = +x[1];
  else if ((x = z2h(ma).match(/満([\d．.]+)[ヶか]月/))) minDays = Math.round(parseFloat(x[1].replace('．', '.')) * 30.4);
  return { cap, total, classes, minAge: ma, minDays, parking: f.parking || '', transfer: !!f.star || small, times: f.times || [], latest: Math.round(latest * 100) / 100, notes: f.notes || [], remark: remarks[m.id] || '' };
}

const LICENSED = { '公立認可保育所': '公立', '法人立認可保育所': '法人立', '法人立認可保育園': '法人立', '小規模保育事業': '小規模保育事業', '家庭的保育事業': '家庭的保育事業', '認定こども園': '認定こども園' };
const dir = path.join(root, 'facilities');
const out = []; const used = new Set(); const seen = new Set(); const unmatched = [];
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.geojson')).sort()) {
  const g = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, ''));
  for (const ft of g.features) {
    const p = ft.properties; const [lng, lat] = ft.geometry.coordinates;
    const gtype = (p['施設種別'] || g.name || '').trim();
    const name = (p['名称'] || '').trim().replace(/\s+/g, ' ');
    const base = { name, category: gtype, lat, lng, addr: ((p['所在地'] || '').trim().replace(/^神奈川県?/, '').replace(/^藤沢市/, '藤沢市') + ' ' + (p['所在地2'] || '').trim()).trim(), tel: (p['電話番号'] || '').trim().normalize('NFKC'), url: (p['ホームページ'] || '').trim() };
    const dupKey = norm(name) + telNorm(base.tel);
    if (seen.has(dupKey)) continue; seen.add(dupKey);
    if (LICENSED[gtype]) {
      const cands = master.filter(m => m.type === LICENSED[gtype] && !used.has(m.id));
      let m = cands.find(m => norm(m.name) === norm(name)) || master.find(m => !used.has(m.id) && norm(m.name) === norm(name)) || cands.find(m => norm(name).includes(norm(m.name)) || norm(m.name).includes(norm(name))) || cands.find(m => telNorm(m.tel) === telNorm(base.tel) && telNorm(base.tel));
      if (m) { used.add(m.id); out.push({ id: m.id, licensed: true, type: m.type, area: m.area, ...base, name: m.name, naviAddr: m.addr, ...naviInfo(m) }); }
      else { unmatched.push(`${gtype}: ${name}`); out.push({ id: null, licensed: true, type: LICENSED[gtype], area: '', ...base, cap: null, classes: [], notes: [], times: [], remark: '令和9年度申込ナビの施設一覧に掲載がありません（閉園・統合・名称変更等の可能性）。保育課へ確認してください', notInNavi: true }); }
    } else {
      out.push({ id: null, licensed: false, type: gtype, area: '', ...base, cap: null, classes: [], notes: [], times: [], remark: '認可外の施設です。利用申込みは施設へ直接（保育課の利用調整の対象外）' });
    }
  }
}
// GeoJSONにない申込ナビ掲載施設（分園・2歳コース等）も追加
for (const m of master) if (!used.has(m.id)) {
  const sib = out.find(o => o.id && (o.tel && telNorm(o.tel) === telNorm(m.tel)));
  const ec = extraCoords[m.id];
  out.push({ id: m.id, licensed: true, type: m.type, area: m.area, name: m.name, category: m.type, lat: ec ? ec[0] : sib ? sib.lat : null, lng: ec ? ec[1] : sib ? sib.lng : null, addr: m.addr, tel: m.tel, url: sib ? sib.url : '', naviOnly: true, ...naviInfo(m) });
}
out.sort((a, b) => (a.licensed === b.licensed ? 0 : a.licensed ? -1 : 1) || (a.id ?? 9999) - (b.id ?? 9999));
fs.writeFileSync(path.join(root, 'data/facilities.js'), '// 自動生成: node tools/build-facilities.js\n// 位置・HP等: facilities/*.geojson（藤沢市オープンデータ） / 施設番号・定員・預かり時間・受入月齢: 申込ナビP27〜35（2026年9月時点）\n// 自動抽出・自動照合のため誤りがあり得ます。\nwindow.FACILITIES = ' + JSON.stringify(out) + ';\n');
console.log('total', out.length, 'licensed', out.filter(o => o.licensed).length, 'with id', out.filter(o => o.id).length, 'navi only', out.filter(o => o.naviOnly).map(o => o.id + o.name).join(','));
console.log('unmatched:', unmatched);

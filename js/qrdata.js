// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// 申込内容 ⇔ QRコード用文字列。
//   申込内容 → 短いキーのJSON → deflate-raw 圧縮 → Base45（QRの英数字モードと同じ文字集合）
//   QR文字列: "FH1-<照合コード6桁>-<何枚目>-<全枚数>-<データ>"
// 照合コード = JSONのSHA-256の先頭6桁（16進・大文字）。シートに印字し、読み取り時に一致を確認する。
(function () {
  const PREFIX = 'FH1';
  const CHUNK = 1300; // QR1つあたりの最大文字数（バージョン25程度）

  // ---------- Base45（RFC 9285） ----------
  const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  function b45enc(u8) {
    let o = '';
    for (let i = 0; i < u8.length; i += 2) {
      if (i + 1 < u8.length) { const x = u8[i] * 256 + u8[i + 1]; o += B45[x % 45] + B45[Math.floor(x / 45) % 45] + B45[Math.floor(x / 2025)]; }
      else { const x = u8[i]; o += B45[x % 45] + B45[Math.floor(x / 45)]; }
    }
    return o;
  }
  function b45dec(s) {
    const v = [...s].map(c => { const i = B45.indexOf(c); if (i < 0) throw new Error('Base45として読めない文字があります'); return i; });
    const out = [];
    for (let i = 0; i < v.length; i += 3) {
      if (i + 2 < v.length) { const x = v[i] + v[i + 1] * 45 + v[i + 2] * 2025; if (x > 65535) throw new Error('データが壊れています'); out.push(x >> 8, x & 255); }
      else { const x = v[i] + v[i + 1] * 45; if (x > 255) throw new Error('データが壊れています'); out.push(x); }
    }
    return new Uint8Array(out);
  }

  // ---------- 圧縮・ハッシュ（ブラウザ標準API） ----------
  async function pipe(u8, stream) { const r = new Blob([u8]).stream().pipeThrough(stream); return new Uint8Array(await new Response(r).arrayBuffer()); }
  const deflate = u8 => pipe(u8, new CompressionStream('deflate-raw'));
  const inflate = u8 => pipe(u8, new DecompressionStream('deflate-raw'));
  async function hash6(u8) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', u8)); return [...d.slice(0, 3)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); }

  // ---------- 申込内容 → 短いキーのJSON ----------
  const clean = o => {
    if (Array.isArray(o)) { const a = o.map(clean); while (a.length && a[a.length - 1] == null) a.pop(); return a.length ? a : undefined; }
    if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) { const c = clean(v); if (c !== undefined) r[k] = c; } return Object.keys(r).length ? r : undefined; }
    return o === '' || o == null ? undefined : o;
  };
  const b = v => (v ? 1 : 0);
  function compact(s) {
    const h = s.household, a = s.application;
    const par = p => (p.present ? { n: p.name, k: p.kana, b: p.birth, t: p.phone, co: b(p.cohabit !== false), wp: p.workplace, r: p.reason, hr: p.hours, em: p.employer, ea: p.employerAddr, es: p.employStart, ei: b(p.reason === 'offer'), eo: b(p.startOnEntry), ik: b(p.ikukyu), ikf: p.ikukyuFrom, ikt: p.ikukyuTo, se: b(p.selfEmployed), nj: p.nurseryJob !== 'none' ? p.nurseryJob : '', il: ['illness', 'disability'].includes(p.reason) ? (p.reason === 'illness' ? p.illnessLevel : p.disabilityLevel) : '', in: p.illnessName, sn: p.schoolName, sa: p.schoolAddr, sf: p.schoolFrom, st: p.schoolTo, ct: p.careTarget, cr: p.careRelation, sk: p.reason === 'seeking' ? p.seekingPlan : '' } : { x: 1 });
    const sv = v => ({ bo: v.birthOrder, dl: v.delivery, gw: v.gestation, bw: v.birthWeight, bh: v.birthHeight, w: v.weight, ht: v.height, md: v.measureDate, ck: v.checkups, vx: v.vaccines, vo: v.vaccineOther, dv: b(v.devConsult), sc: b(v.specialCare), wk: v.walkMonth, al: v.allergy, ai: v.allergy !== 'none' ? v.allergyItems : [], ao: v.allergyOther, ill: b(v.illness), cf: b(v.confirms.every(Boolean)) });
    return clean({
      v: 1, y: 'R9', t: new Date().toISOString().slice(0, 16),
      a: { sm: a.startMonth, ar: a.startMonth === '2027-04' ? a.aprilRound : '', r8: b(a.continueFromR8), r8w: a.r8FirstWish, et: a.endType, ed: a.endDate, cr: b(a.continueReview), me: a.method, rp: a.representative, wd: a.writtenDate, ik: a.ikukyuChoice, sn: b(a.siblingNoPref), s1: a.sib1, s2: a.sib2, s3: a.sib3, pl: a.planIfFail, pd: a.planDetail, tr: b(a.transfer) },
      h: { z: h.postal, a1: h.address1, a2: h.address2, rs: h.residence, cd: b(h.contractDocs !== false), sp: b(h.singleParent), sr: h.singleReason, sd: h.singleDate, nr: b(h.noRelativeUnder65), ab: h.absentParent !== 'none' ? h.absentParent : '', wl: b(h.welfare), wf: h.welfareFrom, ws: b(h.welfareSelfReliance), r6: h.reg2026, r6p: h.reg2026Pref, r6c: h.reg2026City, r7: h.reg2027, r7p: h.reg2027Pref, r7c: h.reg2027City, tf: b(h.taxFiled), ds: b(h.familyDisability), dn: h.familyDisabilityNames, c7: b(h.familyCareC7), pg: b(h.motherPregnant), dd: h.dueDate, mf: h.maternityFrom, mt: h.maternityTo, ab2: h.motherPregnant ? h.afterBirth : '', u18: h.siblingsUnder18, ss: b(h.siblingSameFacility), gs: b(h.graduateSmall), pd: b(h.pastDecline) },
      f: par(s.father), m: par(s.mother),
      c: s.children.map(c => ({ n: c.name, k: c.kana, b: c.birth, s: c.sex, u: b(c.unborn), st: c.status, sn: c.statusName, pc: c.paidCare !== 'none' ? c.paidCare : '', v: sv(c.survey) })),
      o: s.members.map(m => ({ r: m.relation, n: m.name, k: m.kana, b: m.birth, co: b(m.cohabit !== false), wp: m.workplace })),
      g: Object.fromEntries(['pf', 'pm', 'mf', 'mm'].map(k => { const g = s.grandparents[k]; return [k, g.name ? [g.name, g.birth, b(g.cohabit), g.addr] : null]; })),
      w: s.application.wishes.filter(w => w.id || w.name).map(w => [w.id, w.name, b(w.visited), w.reason, w.visitPlan]),
    });
  }

  // ---------- エンコード ----------
  async function encode(s) {
    const data = compact(s);
    const json = new TextEncoder().encode(JSON.stringify(data));
    const code = await hash6(json);
    const body = b45enc(await deflate(json));
    const n = Math.max(1, Math.ceil(body.length / CHUNK));
    const size = Math.ceil(body.length / n);
    const chunks = [];
    for (let i = 0; i < n; i++) chunks.push(`${PREFIX}-${code}-${i + 1}-${n}-${body.slice(i * size, (i + 1) * size)}`);
    return { code, chunks, data, bytes: json.length };
  }

  // ---------- デコード ----------
  // texts: QRから読んだ文字列（複数・順不同・別の申込が混在してもよい）
  async function decode(texts) {
    const groups = new Map(); const errors = [];
    for (const raw of texts) {
      const t = String(raw).trim(); if (!t) continue;
      const m = t.match(/^FH1-([0-9A-F]{6})-(\d+)-(\d+)-([0-9A-Z $%*+\-./:]+)$/);
      if (!m) { errors.push(`このツールのQRではない文字列です：${t.slice(0, 30)}…`); continue; }
      const [, code, i, n, body] = m;
      if (!groups.has(code)) groups.set(code, { code, n: +n, parts: new Map() });
      groups.get(code).parts.set(+i, body);
    }
    const results = [];
    for (const g of groups.values()) {
      if (g.parts.size < g.n) { const missing = []; for (let i = 1; i <= g.n; i++) if (!g.parts.has(i)) missing.push(i); results.push({ code: g.code, ok: false, error: `QRが足りません（${g.n}枚中 ${missing.join('・')}枚目がありません）` }); continue; }
      try {
        let body = ''; for (let i = 1; i <= g.n; i++) body += g.parts.get(i);
        const json = await inflate(b45dec(body));
        const check = await hash6(json);
        const data = JSON.parse(new TextDecoder().decode(json));
        results.push({ code: g.code, ok: check === g.code, error: check === g.code ? '' : `照合コードが一致しません（印字：${g.code}／計算：${check}）。データが壊れている可能性があります。`, data, rows: expand(data) });
      } catch (e) { results.push({ code: g.code, ok: false, error: '読み取ったデータを復元できませんでした：' + e.message }); }
    }
    return { results, errors };
  }

  // ---------- 短いキーのJSON → 項目名つきの行 ----------
  const L = {
    residence: { fujisawa: '藤沢市在住', moving: '藤沢市へ転入予定', outsideWork: '市外在住（藤沢市在勤・在学）', chigasaki: '茅ヶ崎市堤地区（1〜110番地）' },
    reason: { work: '就労', offer: '就労内定', seeking: '求職活動', study: '就学', illness: '疾病・負傷', disability: '障がい', care: '介護・看護', birth: '出産', disaster: '災害復旧', other: 'その他' },
    status: { none: '家庭保育', licensed: '認可保育施設在園', unlicensed: '認可外・幼稚園在園', temporary: '一時預かり利用', ikukyu: '育休中', other: 'その他' },
    paid: { '3days': '有償・週3日以上', weekly: '有償・週1回以上' },
    plan: { extendIkukyu: '父母が自宅で保育（育休延長）', waitHome: '父母が自宅で保育（空きを待つ）', relative: '父母以外の親族が保育', otherFacility: '認可保育施設以外の施設を利用', seeking: '求職活動中', continueCurrent: '現在の認可保育施設を継続利用', withdraw: '申込みを取り下げる', other: 'その他' },
    method: { mail: '郵送', window: '窓口', online: '電子申請' },
    nj: { teacher: '保育士・幼稚園教諭として復職/就労開始', assistant: '保育補助者として復職/就労開始' },
    il: { full: '保育が完全に不可能', daytime: '日中常時の保育が困難', partial: '保育が部分的に困難', severe: '手帳（重度）', grade3: '身体3級', grade4: '身体4級以下' },
    sk: { pause: '一旦休止し入所後に開始', continueHW: '継続（ハローワーク等）', continueHome: '継続（自宅）', stop: '取りやめる' },
    single: { unmarried: '未婚', divorce: '離婚', bereaved: '死別', other: 'その他' },
    absent: { transfer: '単身赴任中', hospital: '入院中' },
    after: { leave: '退園（出産要件）', work: '直ちに復職', ikukyu: '育児休業を取得' },
    sex: { male: '男', female: '女' },
    sib: { A: 'A 必ず同時期', B: 'B 同時期でなくてよい', C: 'C 必ず同じ園', D: 'D 同じ園を優先', E: 'E 希望順位を優先', F: 'F 上の子を先に', G: 'G 下の子を先に' },
    al: { none: '無', unknown: '不明', yes: '有' },
    allergy: { egg: '卵', milk: '牛乳', soy: '大豆', wheat: '小麦', buckwheat: 'そば', other: 'その他' },
    ck: { m4: '4か月', m9: '9・10か月', y1: '1歳6か月', y3: '3歳6か月' },
    vx: { hepb: 'B型肝炎', pneumo: '小児用肺炎球菌', dpt: '4種混合・ヒブ', bcg: 'BCG', rota: 'ロタ', mr: '麻疹・風疹', varicella: '水痘', je: '日本脳炎', other: 'その他' },
  };
  const yn = v => (v ? 'はい' : 'いいえ');
  const map = (dict, v) => (v == null || v === '' ? '' : dict[v] ?? v);
  const list = (dict, arr) => (arr || []).map(x => dict[x] ?? x).join('・');
  function expand(d) {
    const rows = []; const r = (sec, label, v) => rows.push([sec, label, v == null ? '' : String(v)]);
    const a = d.a || {}, h = d.h || {};
    r('基本', 'データ作成日時', d.t); r('基本', '記入日', a.wd);
    r('申込', '保育希望開始時期', a.sm); r('申込', '4月入所の申込区分', a.ar ? `${a.ar}次` : '');
    r('申込', '令和8年度から継続', a.r8 ? 'はい' : ''); r('申込', '令和8年度第1希望園', a.r8w);
    r('申込', '保育希望終了時期', a.et === 'date' ? a.ed : '就学前まで');
    r('申込', '入所できない場合の継続審査', yn(a.cr)); r('申込', '提出方法', map(L.method, a.me));
    r('申込', '代表者', a.rp === 'father' ? '父' : '母'); r('申込', '転園申請', a.tr ? 'はい' : '');
    r('申込', '育休中の申込み（確認事項⑪）', a.ik ? `育休${a.ik}` : '');
    r('申込', 'きょうだい申込み条件', a.sn ? '希望なし' : [a.s1, a.s2, a.s3].filter(Boolean).map(x => L.sib[x]).join('／'));
    r('申込', '入所できなかった場合の予定', [map(L.plan, a.pl), a.pd].filter(Boolean).join('：'));
    (d.w || []).forEach((w, i) => { const p = `第${i + 1}希望`; r('希望園', `${p} 施設番号`, w[0]); r('希望園', `${p} 施設名`, w[1]); r('希望園', `${p} 見学`, w[2] ? '済' : '未'); r('希望園', `${p} 希望理由`, w[3]); r('希望園', `${p} 見学予定日`, w[4]); });
    r('世帯', '郵便番号', h.z); r('世帯', '住所', [h.a1, h.a2].filter(Boolean).join(' ')); r('世帯', 'お住まい', map(L.residence, h.rs));
    if (h.rs === 'moving') r('世帯', '転入先の契約書等', h.cd ? '提出可' : '提出なし');
    r('世帯', 'ひとり親世帯', h.sp ? `はい（${map(L.single, h.sr)}${h.sd ? '・' + h.sd : ''}）` : 'いいえ');
    if (h.sp) r('世帯', '65歳未満の同居親族', h.nr ? 'いない' : 'いる');
    r('世帯', '父母の長期不在', map(L.absent, h.ab));
    r('世帯', '生活保護', h.wl ? `受給中${h.wf ? '（' + h.wf + 'から）' : ''}` : 'いいえ');
    r('世帯', '2026年1月1日の父母の住民登録地', h.r6 === 'outside' ? `市外（${[h.r6p, h.r6c].filter(Boolean).join(' ')}）` : '藤沢市');
    r('世帯', '2027年1月1日の父母の住民登録地', h.r7 === 'outside' ? `市外（${[h.r7p, h.r7c].filter(Boolean).join(' ')}）` : '藤沢市');
    r('世帯', '障がい者手帳・療育手帳', h.ds ? `あり（${h.dn || ''}）` : 'なし');
    r('世帯', '同居家族の障がい・要介護（調整⑦）', h.c7 ? 'あり' : '');
    r('世帯', '母の出産予定', h.pg ? `あり（予定日 ${h.dd || ''}／産休 ${h.mf || ''}〜${h.mt || ''}／産休後 ${map(L.after, h.ab2)}）` : 'なし');
    r('世帯', '18歳未満のきょうだい数', h.u18);
    r('世帯', 'きょうだい在園施設を希望', h.ss ? 'はい' : ''); r('世帯', '地域型保育の卒園', h.gs ? 'はい' : ''); r('世帯', '過去3年度内の内定辞退等', h.pd ? 'あり' : '');
    [['f', '父'], ['m', '母']].forEach(([k, w]) => {
      const p = d[k] || {};
      if (p.x) { r(w, '状況', 'いない（ひとり親）'); return; }
      r(w, '氏名', p.n); r(w, 'ふりがな', p.k); r(w, '生年月日', p.b); r(w, '携帯電話', p.t); r(w, '同居', yn(p.co)); r(w, '勤務先・就学先（世帯欄）', p.wp);
      r(w, '保育の必要性事由', map(L.reason, p.r)); r(w, '月の就労等時間', p.hr ? `${p.hr}時間` : '');
      if (['work', 'offer'].includes(p.r)) { r(w, '就労先名称', p.em); r(w, '就労先住所', p.ea); r(w, '雇用開始日', p.es); r(w, '入所後直ちに就労開始', p.eo ? 'はい' : ''); r(w, '育児休業', p.ik ? `取得中（${p.ikf || ''}〜${p.ikt || ''}）` : ''); r(w, '自営業等', p.se ? 'はい' : ''); r(w, '保育士等（加点⑤⑥）', map(L.nj, p.nj)); }
      if (p.il) r(w, '疾病・障がいの程度', map(L.il, p.il)); if (p.in) r(w, '病名・障がい名', p.in);
      if (p.sn) { r(w, '就学先', [p.sn, p.sa].filter(Boolean).join(' ')); r(w, '就学期間', `${p.sf || ''}〜${p.st || ''}`); }
      if (p.ct) r(w, '被介護者', `${p.ct}${p.cr ? '（' + p.cr + '）' : ''}`);
      if (p.sk) r(w, '入所できない場合の求職活動', map(L.sk, p.sk));
    });
    (d.c || []).forEach((c, i) => {
      const w = `児童${i + 1}`, v = c.v || {};
      r(w, '氏名', c.n); r(w, 'ふりがな', c.k); r(w, '生年月日', c.u ? '出生前' : c.b); r(w, '性別', map(L.sex, c.s));
      r(w, '児童の状況', [map(L.status, c.st), c.sn].filter(Boolean).join('：')); r(w, '有償の預け先', map(L.paid, c.pc));
      r(w, 'アレルギー', [map(L.al, v.al), list(L.allergy, v.ai), v.ao].filter(Boolean).join('：'));
      r(w, '受診した乳幼児健診', list(L.ck, v.ck)); r(w, '接種済みの予防接種', [list(L.vx, v.vx), v.vo].filter(Boolean).join('・'));
      r(w, '出生時（第何子・分娩・在胎週・体重g・身長cm）', [v.bo, v.dl === 'normal' ? '正常' : v.dl === 'abnormal' ? '異常' : '', v.gw, v.bw, v.bh].map(x => x || '').join('／'));
      r(w, '現在（体重kg・身長cm・計測日）', [v.w, v.ht, v.md].map(x => x || '').join('／'));
      r(w, '発達の相談・指導', v.dv ? '有' : '無'); r(w, '集団生活での特別な対応', v.sc ? '必要' : ''); r(w, '歩き始め（か月）', v.wk);
      r(w, '病気・通院歴', v.ill ? '有' : '無'); r(w, '児童調査書の確認事項', v.cf ? '確認済み' : '');
    });
    (d.o || []).forEach((m, i) => { const w = `家族${i + 1}`; r(w, '続柄', m.r); r(w, '氏名', m.n); r(w, 'ふりがな', m.k); r(w, '生年月日', m.b); r(w, '同居', yn(m.co)); r(w, '勤務先・就学先・在園名', m.wp); });
    Object.entries({ pf: '父方祖父', pm: '父方祖母', mf: '母方祖父', mm: '母方祖母' }).forEach(([k, w]) => { const g = (d.g || {})[k]; if (!g) return; r('祖父母', `${w} 氏名`, g[0]); r('祖父母', `${w} 生年月日`, g[1]); r('祖父母', `${w} 同居`, yn(g[2])); r('祖父母', `${w} 住所`, g[3]); });
    return rows.filter(x => x[2] !== '');
  }

  // 複数の申込 → CSV（1申込1行。列は全件の項目の和集合）
  function toCSV(results) {
    const ok = results.filter(r => r.rows);
    const cols = []; const seen = new Set();
    ok.forEach(r => r.rows.forEach(([sec, label]) => { const k = `${sec}_${label}`; if (!seen.has(k)) { seen.add(k); cols.push(k); } }));
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['照合コード', '照合結果', ...cols].map(q).join(',')];
    ok.forEach(r => { const m = new Map(r.rows.map(([sec, label, v]) => [`${sec}_${label}`, v])); lines.push([r.code, r.ok ? '一致' : '不一致', ...cols.map(c => m.get(c) ?? '')].map(q).join(',')); });
    return '﻿' + lines.join('\r\n');
  }

  window.QRData = { encode, decode, expand, toCSV, compact, b45enc, b45dec, PREFIX };
})();

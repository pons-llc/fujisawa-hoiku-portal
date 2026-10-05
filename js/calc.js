// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// 点数計算・保育料試算・必要書類判定（申込ナビ P1〜P18 の記載に基づく簡易ロジック）
// 実際の審査・算定は藤沢市保育課が行います。結果は目安です。
(function () {
  const R = window.RULES;
  const num = v => { const n = parseFloat(String(v ?? '').replace(/[,，円 ]/g, '')); return isNaN(n) ? null : n; };
  const ymd = s => (s ? new Date(s + 'T00:00:00') : null);

  // ---------- クラス年齢 ----------
  function classAge(birth) {
    if (!birth) return null;
    for (const r of R.classRanges) if (birth >= r.from && birth <= r.to) return r.cls;
    return birth < '2021-04-02' ? 6 : null; // 6 = 就学
  }
  function ageAt(birth, at) {
    const b = ymd(birth), d = ymd(at); if (!b || !d) return null;
    let y = d.getFullYear() - b.getFullYear(), m = d.getMonth() - b.getMonth();
    if (d.getDate() < b.getDate()) m--;
    if (m < 0) { y--; m += 12; }
    const days = Math.floor((d - b) / 86400000);
    return { y, m, days };
  }

  // ---------- 締切 ----------
  const pad = n => String(n).padStart(2, '0');
  function deadlineFor(startMonth, aprilRound) {
    if (!startMonth) return null;
    const [y, m] = startMonth.split('-').map(Number);
    if (m === 4 && y === 2027) {
      if (aprilRound === '1') return { date: R.deadlines.april1.end, label: '4月1次（受付 2026/10/5〜10/23 必着・郵送のみ）', note: '不足書類の追加提出は 2026/11/13 必着。取下げ可能期限 2026/12/28。' };
      return { date: R.deadlines.april2.end, label: '4月2次', note: '4月2次を新たに申込めるのは4月1次に申込んでいない方に限ります。' };
    }
    if (R.deadlines.special[startMonth]) return { date: R.deadlines.special[startMonth], label: `${y}年${m}月入所`, note: '年末年始の特例日です。' };
    // 前々月末。土日なら翌開庁日（祝日は考慮していません）
    let d = new Date(y, m - 2, 0); // m-2 月の末日 = (m-1)の0日
    let shifted = false;
    while (d.getDay() === 0 || d.getDay() === 6) { d.setDate(d.getDate() + 1); shifted = true; }
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label: `${y}年${m}月入所`, note: '入所希望月の前々月末（土日祝日の場合は翌開庁日）。祝日は本ツールでは考慮していないため市HPで確認してください。' + (shifted ? '（土日のため翌開庁日に調整）' : '') };
  }

  // ---------- A-1 基礎点数（父母それぞれ） ----------
  function hoursScore(h) { if (h == null) return null; if (h >= 140) return 10; if (h >= 112) return 9; if (h >= 64) return 8; return 7; }
  function parentA1(p) {
    if (!p || !p.present) return { score: null, label: '不在' };
    const h = num(p.hours);
    switch (p.reason) {
      case 'work': return { score: hoursScore(h ?? 0), label: `就労（月${h ?? '?'}時間${p.ikukyu ? '・育休中' : ''}）` };
      case 'offer': return { score: h >= 140 ? 6 : h >= 64 ? 5 : 4, label: `就労内定（月${h ?? '?'}時間）` };
      case 'seeking': return { score: 3, label: '求職中' };
      case 'study': return { score: hoursScore(h ?? 0), label: `就学（月${h ?? '?'}時間・就労に準じる）` };
      case 'care': return { score: hoursScore(h ?? 0), label: `親族の介護・看護（月${h ?? '?'}時間・就労に準じる）` };
      case 'birth': return { score: 10, label: '出産' };
      case 'illness': return { score: { full: 12, daytime: 10, partial: 8 }[p.illnessLevel] ?? 8, label: '疾病・負傷' };
      case 'disability': return { score: { severe: 10, grade3: 8, grade4: 7 }[p.disabilityLevel] ?? 7, label: '心身の障がい' };
      case 'disaster': return { score: 12, label: '災害復旧への従事' };
      case 'other': return { score: 20, label: 'その他（児童相談所からの通知等）' };
    }
    return { score: null, label: '未選択' };
  }
  const priorityKey = { work: 'work', offer: 'offer', seeking: 'seeking', study: 'study', care: 'care', birth: 'birth', illness: 'illness', disability: 'illness', disaster: 'disaster', other: 'other' };

  function parentsOf(s) {
    const ps = [];
    if (s.father.present) ps.push({ who: '父', p: s.father });
    if (s.mother.present) ps.push({ who: '母', p: s.mother });
    return ps;
  }

  // ---------- 点数計算 ----------
  function score(s) {
    const h = s.household, app = s.application;
    const ps = parentsOf(s);
    const single = h.singleParent || ps.length === 1;
    const lines = { a1: [], a2: [], c: [] };
    const warnings = [];
    const anyIkukyu = ps.some(x => x.p.ikukyu);
    const outsideResident = h.residence === 'outsideWork' || h.residence === 'chigasaki';
    const isApril = (app.startMonth || '').endsWith('-04');

    // A-1
    const per = ps.map(x => ({ ...x, a1: parentA1(x.p) }));
    per.forEach(x => lines.a1.push(`${x.who}：${x.a1.label} → ${x.a1.score ?? '—'}点`));
    let a1;
    if (single) { a1 = 11; lines.a1.push('ひとり親世帯のため A-1基礎点数は 11点'); if (ps.length === 2) warnings.push('ひとり親世帯にチェックがありますが、父母の両方が「いる」になっています。不在の保護者は「マイ申請」で「いない」にしてください（調整項目の計算に影響します）。'); }
    else if (per.length === 2 && per.every(x => x.a1.score != null)) { a1 = Math.min(...per.map(x => x.a1.score)); lines.a1.push(`父母のうち低い方を採用 → ${a1}点`); }
    else { a1 = null; warnings.push('父母の保育の必要性事由を入力してください。'); }

    // A-2
    let a2 = 0; const add = (cond, pt, text) => { if (cond) { a2 += pt; lines.a2.push(`${text}：${pt > 0 ? '+' : ''}${pt}`); } };
    add(h.welfare && h.welfareSelfReliance, 1, '①生活保護受給・自立促進');
    add(h.siblingSameFacility, 2, '②きょうだいが在園している施設を希望（その施設の審査のみ）');
    add(s.children.length >= 3, 2, '③本人含めきょうだい3人以上が同時に希望');
    add(h.arrears, -20, '④保育料の滞納あり');
    // ⑤⑥：転園申請は対象外。市外在住者（藤沢市在勤）は「就労内定」のみ対象外（復職は対象）
    const nurseryJobs = app.transfer ? [] : ps.filter(x => !(h.residence === 'outsideWork' && x.p.reason === 'offer')).map(x => x.p.nurseryJob);
    add(nurseryJobs.includes('teacher'), 6, '⑤市内認可保育施設等で保育士・幼稚園教諭として復職/就労内定');
    add(!nurseryJobs.includes('teacher') && nurseryJobs.includes('assistant'), 2, '⑥同施設で保育補助者として復職/就労内定');
    const noNurseryBonus = !(nurseryJobs.includes('teacher') || nurseryJobs.includes('assistant'));
    add((h.residence === 'outsideWork' && noNurseryBonus) || (h.residence === 'moving' && !h.contractDocs), -10, '⑦市外在住者の在勤要件申込／転入先契約書等の未提出');
    add(anyIkukyu && app.ikukyuChoice === 'B' && !outsideResident, -30, '⑧育休B申込み（育休延長許容）');
    add(h.pastDecline, -2, '⑨過去3年度以内の内定辞退・締切後取下げ等');
    add(h.graduateSmall && isApril, 5, '⑩地域型保育事業等の卒園に伴う申込（4月審査のみ）');
    if (anyIkukyu && app.ikukyuChoice === 'B' && outsideResident) warnings.push('市外在住（藤沢市在勤）の方は育休Bを選択できません。');

    // B 優先順位
    let priority;
    if (single) priority = R.priority.find(p => p.key === 'single');
    else {
      const idx = per.map(x => R.priority.findIndex(p => p.key === priorityKey[x.p.reason])).filter(i => i >= 0);
      priority = idx.length ? R.priority[Math.min(...idx)] : null;
    }

    // C 調整項目
    const cBase = per.length ? Math.max(...per.map(x => x.a1.score ?? 0)) : 0;
    lines.c.push(`父母の A-1 点数の高い方：${cBase}点`);
    let c = cBase; const addC = (cond, pt, text) => { if (cond) { c += pt; lines.c.push(`${text}：+${pt}`); } };
    const multiples = s.children.length >= 2 && s.children.some((x, i) => s.children.some((y, j) => i !== j && x.birth && x.birth === y.birth));
    addC(s.children.length >= 2, 2, '①2人以上のきょうだいが同時に申込');
    addC(multiples, 2, '②多胎児が同時に申込');
    const care3 = s.children.some(ch => ch.paidCare === '3days') && !anyIkukyu && !outsideResident;
    const careW = !care3 && s.children.some(ch => ch.paidCare === 'weekly') && !anyIkukyu && !outsideResident;
    addC(care3, 3, '③認可外・企業主導型・ベビーシッターに有償で週3日以上');
    addC(careW, 2, '④認可保育施設以外に有償で週1回以上（一時預かり含む）');
    addC(['welfare', 'nontax'].includes(h.taxStatus), 1, '⑤父母ともに住民税非課税');
    addC(num(h.siblingsUnder18) >= 3, 1, '⑥生計を一にする18歳未満のきょうだいが3人以上');
    const illnessHousehold = per.some(x => ['illness', 'disability', 'care'].includes(x.p.reason));
    addC(h.familyCareC7 && !illnessHousehold, 2, '⑦同居家族に障がい者手帳（3級以上）等・要介護3以上');
    addC(h.absentParent !== 'none' && !single, 2, '⑧長期入院・単身赴任で昼夜不在（育休取得者本人の単身赴任は除く）');
    // ⑨：育児・介護休業法に基づく育休を取得できない（自営・役員等）場合は除く
    addC(ps.some(x => x.p.ikukyu && !x.p.selfEmployed), 2, '⑨入所に伴い育児休業から復職見込み');
    addC(single && h.noRelativeUnder65, 3, '⑩ひとり親世帯で65歳未満の同居親族なし');

    const base = a1 == null ? null : a1 + a2;
    return { single, a1, a2, base, priority, c, lines, warnings, per };
  }

  // ---------- 保育の必要量 ----------
  function needAmount(s) {
    const ps = parentsOf(s).map(x => x.p);
    const hrs = ps.filter(p => ['work', 'offer', 'study', 'care'].includes(p.reason)).map(p => num(p.hours) ?? 0);
    const nonHourly = ps.filter(p => !['work', 'offer', 'study', 'care'].includes(p.reason));
    if (!ps.length) return null;
    if (ps.some(p => p.reason === 'seeking')) return { type: 'short', label: '保育短時間（求職活動）', note: '求職活動中は短時間認定となることが一般的です（要確認）。' };
    if (hrs.length && Math.min(...hrs) < 64) return { type: 'none', label: '認定基準（月64時間）未満の可能性', note: '就労基準は月64時間以上（通勤・休憩時間を除く）。' };
    if (hrs.length && Math.min(...hrs) < 120) return { type: 'short', label: '保育短時間認定（1日最大8時間 8:30〜16:30）', note: '月120時間未満でも、実働が恒常的に13時〜18時の場合等は標準時間になる例外があります（P2）。' };
    if (nonHourly.length && !hrs.length) return { type: 'std', label: '保育標準時間（目安）', note: '就労以外の事由は必要時間に応じて認定されます。' };
    return { type: 'std', label: '保育標準時間認定（1日最大11時間 7:00〜18:00）', note: '' };
  }

  // ---------- 保育料試算 ----------
  function feeTier(h, single) {
    if (h.taxStatus === 'welfare') return R.feeTable[0];
    if (h.taxStatus === 'nontax') return R.feeTable.find(r => r.tier === (single ? 'B1' : 'B2'));
    if (h.taxStatus === 'zeroIncomeLevy') return R.feeTable.find(r => r.tier === 'C1' && r.kind === (single ? 'single' : 'other'));
    const amt = num(h.shotokuwari);
    if (amt == null) return null;
    if (amt <= 0) return R.feeTable.find(r => r.tier === 'C1' && r.kind === (single ? 'single' : 'other'));
    return R.feeTable.find(r => r.min != null && amt >= r.min && amt < r.max && (r.kind === 'all' || r.kind === (single ? 'single' : 'other')));
  }
  function fee(s, child, facilityType, order) {
    const cls = classAge(child.birth);
    const single = s.household.singleParent || parentsOf(s).length === 1;
    const need = needAmount(s);
    const short = need && need.type === 'short';
    if (cls == null) return { ok: false, msg: '生年月日を入力してください。' };
    if (cls >= 3) return { ok: true, cls, amount: 0, msg: '3歳児クラス以上は無償化の対象です（給食食材料費・延長保育料等は別途）。' };
    const tier = feeTier(s.household, single);
    if (!tier) return { ok: false, cls, msg: '市町村民税の所得割額（父母の合算）を入力してください。' };
    if (order >= 3) return { ok: true, cls, tier: tier.tier, amount: 0, msg: '第3子以降は0円（同一生計のきょうだいを施設・年齢に限らず数えます）。' };
    const arr = facilityType === 'family' ? tier.family : tier.nursery;
    const amount = arr[(order === 2 ? 2 : 0) + (short ? 1 : 0)];
    const ext = R.extensionFee.find(e => e.tiers.test(tier.tier));
    return { ok: true, cls, tier: tier.tier, amount, short, ext: ext ? (short ? ext.short : ext.std) : null, msg: '' };
  }

  // ---------- 必要書類 ----------
  function documents(s) {
    const h = s.household, app = s.application;
    const ps = parentsOf(s);
    const docs = [];
    const d = (group, name, why, opts = {}) => docs.push({ group, name, why, ...opts });
    const nChildren = s.children.length;
    d('全員', '① 教育・保育給付認定申請書 兼 保育施設利用申込書', 'きょうだいで申込む場合も1枚にまとめる', { star: true, form: 'mousikomi' });
    d('全員', `② 保育施設利用申込みの児童調査書（${nChildren}枚）`, '申込児童の人数分', { star: true, form: 'chosa' });
    ps.forEach(({ who, p }) => {
      const R3 = '③ 保育の必要性事由を証明する書類';
      switch (p.reason) {
        case 'work': case 'offer':
          if (p.selfEmployed) {
            d(R3, `${who}：就労証明書（事業主の方が発行）`, '自営業・個人事業主・専従者・業務委託など');
            d(R3, `${who}：就労状況説明書`, '会社勤め以外の方');
            d(R3, `${who}：${isAprilApp(app) ? '令和7年' : '令和8年'}確定申告書（第一表）又は源泉徴収票の写し`, '4月1次・2次は令和7年分。業務委託は業務委託契約書で代替、開業直後等は代替書類（P15）');
          } else {
            d(R3, `${who}：就労証明書（市の所定用紙・令和9年度様式）`, p.ikukyu ? '育児休業中の方も必要（取得中・期間の記載を確認）' : '会社勤め（役員・代表含む）');
            if (p.executiveSelfCert) d(R3, `${who}：商業登記簿謄本`, '証明者が保護者自身になる会社役員・代表');
            if (p.spouseCompany) d(R3, `${who}：事業に携わっていることが分かる書類（源泉徴収票・給与明細等）`, '配偶者経営の会社で証明者が配偶者');
          }
          break;
        case 'seeking': d(R3, `${who}：（申込時は不要）`, '求職中は入所後2か月以内に就労証明書を提出', { optional: true }); break;
        case 'birth': d(R3, `${who}：母子健康手帳のコピー（表紙と分娩予定日のページ）`, '出産'); break;
        case 'illness': d(R3, `${who}：医師の診断書（市の所定用紙）`, '疾病・負傷'); break;
        case 'disability': d(R3, `${who}：障がい者手帳又は療育手帳のコピー`, '障がい'); break;
        case 'care': d(R3, `${who}：被介護者の診断書等`, '介護・看護'); d(R3, `${who}：介護(看護)状況申告書（市の所定用紙）`, '介護・看護'); break;
        case 'study': d(R3, `${who}：学生証（在籍証明書）のコピー`, '就学'); d(R3, `${who}：カリキュラム表など（日中保育できない時間・日数が分かるもの）`, '就学'); break;
        default: d(R3, `${who}：事由を証明する書類`, '保育課にご確認ください');
      }
    });
    d('全員', '④ 代表者の本人確認書類（郵送は両面コピー）', '「本人確認書類・マイナンバー確認書類貼付台紙」に貼付', { star: true });
    d('全員', '⑤ 同居の家族全員のマイナンバー確認書類', 'マイナンバーカード両面コピー又はマイナンバー記載の住民票');
    d('全員', '⑥ 誓約書・保育施設利用申込受理通知', '受理通知のコピーが申込控えになります', { star: true, form: 'jyuri' });
    const needEnvelope = !(app.method === 'window' && !isApril1(app));
    if (needEnvelope) d('全員', '⑦ 切手を貼った返信用封筒（長3形）', '50g以内の書類を返送予定。切手不足に注意');

    // B: 該当者のみ
    const B = '該当者のみ';
    if (s.children.some(c => ['unlicensed', 'temporary'].includes(c.status) || c.paidCare !== 'none')) d(B, '⑧ 保育証明書', '児童本人又はきょうだいを認可保育施設以外に預けている／一時預かりを週1回以上定期利用（証明日は保育開始日より後）');
    const [sy, sm] = (app.startMonth || '2027-04').split('-').map(Number);
    const firstHalf = (sy === 2027 && sm >= 4 && sm <= 8);
    if (firstHalf && (h.reg2026 !== 'fujisawa' || !h.taxFiled)) d(B, '⑨-1 令和8年度 住民税課税証明書（父母）', '2026年1月1日時点で市外在住 又は 所得申告未済（2027年4〜8月入所希望）');
    if (!firstHalf && (h.reg2027 !== 'fujisawa' || !h.taxFiled)) d(B, '⑨-2 令和9年度 住民税課税証明書（父母）', '2027年1月1日時点で市外在住 又は 所得申告未済（2027年9月〜2028年3月入所希望）');
    if (h.singleParent) d(B, '⑩ ひとり親世帯の書類（いずれか1点）', '戸籍謄本（発行1か月以内・離婚日等の記載）／受理証明書／児童扶養手当証書／ひとり親福祉医療証');
    if (h.residence === 'moving') { d(B, '⑪ 転入・転居に関する申立書', '転入予定日は入所希望月の前月末より前'); if (h.contractDocs !== false) d(B, '⑫ 転入・転居先の詳細を確認できる書類（売買・賃貸契約書等のコピー）', '藤沢市民との同居による転入の場合は不要。未提出だとA-2⑦で-10点'); }
    if (ps.some(x => x.p.nurseryJob !== 'none') && !app.transfer) {
      d(B, '⑬ 保育園(幼稚園)等の就労に関する誓約書兼証明書', '市内の認可保育施設・藤沢型認定保育施設・幼稚園で保育士等として復職/就労開始');
      if (ps.some(x => x.p.nurseryJob === 'teacher')) d(B, '⑭ 保育士証（幼稚園教諭の普通免許状）の写し', '保育補助者の場合は不要');
    }
    if (h.welfare) d(B, '⑮ 生活保護受給中であることが分かる書類（福祉事務所発行）', '生活保護受給中');
    if (app.preBirth || s.children.some(c => c.unborn)) d(B, '⑯ 母子手帳のコピー（表紙・分娩予定日のページ）', '出生前申込み（4月入所のみ可）。出生後に児童調査書・マイナンバー確認書類を窓口で手続き');
    if (s.children.some(c => c.special)) d(B, '児童状況票', '集団生活の中で特別な対応を希望する場合（児童調査書3(1)）');
    if (h.familyDisability || h.familyCareC7) d(B, '障がい者手帳・療育手帳等のコピー', '家族に手帳の交付を受けている方がいる場合（申込書表面下部に氏名記入）');
    if (h.absentParent === 'hospital') d(B, '入院期間が記載された診断書', 'C調整項目⑧（長期入院）');
    if (h.absentParent === 'transfer') d(B, '単身赴任の記載のある就労証明書', 'C調整項目⑧（単身赴任）');
    if (['welfare', 'nontax'].includes(h.taxStatus) && h.residence !== 'fujisawa') d(B, '非課税証明書', 'C調整項目⑤（直近で藤沢市へ転入した場合）');
    if (h.motherPregnant) d(B, '母子手帳のコピー', '母に出産予定あり（申込書 確認事項⑦）');
    return docs;
  }
  const isApril1 = app => app.startMonth === '2027-04' && app.aprilRound === '1';
  const isAprilApp = app => app.startMonth === '2027-04';

  // ---------- 入力チェック（申込書類チェックリストに準拠した簡易チェック） ----------
  function validate(s) {
    const issues = [];
    const app = s.application;
    s.children.forEach((c, i) => {
      if (!c.name) issues.push(`申込児童${i + 1}の氏名が未入力`);
      if (!c.birth && !c.unborn) issues.push(`申込児童${i + 1}の生年月日が未入力`);
      if (!c.sex && !c.unborn) issues.push(`申込児童${i + 1}の性別が未選択`);
    });
    const wishes = app.wishes.filter(w => w.id || w.name);
    if (!wishes.length) issues.push('希望保育施設が1つも入力されていません');
    wishes.forEach((w, i) => { if (!w.visited && !w.visitPlan) issues.push(`第${app.wishes.indexOf(w) + 1}希望（${w.name || w.id}）は見学未済です。確認事項⑫に見学予定日の記入を推奨`); });
    // 受入月齢チェック
    if (window.FACILITIES) {
      const start = (app.startMonth || '2027-04') + '-01';
      s.children.forEach((c, ci) => {
        if (!c.birth) return;
        const age = ageAt(c.birth, start); const cls = classAge(c.birth);
        wishes.forEach(w => {
          const f = window.FACILITIES.find(f => String(f.id) === String(w.id)); if (!f) return;
          if (cls != null && !f.classes.includes(cls)) issues.push(`${c.name || '児童' + (ci + 1)}（${cls}歳児クラス）は「${f.name}」の受入クラス外の可能性`);
          else if (f.minDays && age && age.days < f.minDays) issues.push(`${c.name || '児童' + (ci + 1)}は入所時点で「${f.name}」の受入月齢（${f.minAge}）に達しない可能性`);
          if (f.type === '家庭的保育事業' && !w.visited) issues.push(`「${f.name}」は家庭的保育事業のため事前見学が必須（未見学は審査対象外）`);
        });
      });
    }
    if (s.children.length >= 2 && !app.siblingNoPref && !app.sib1) issues.push('きょうだい同時申込の「申込み条件（項目1〜3）」が未選択（未記入は同時期同園希望扱い）');
    if (!app.startMonth) issues.push('保育希望開始時期が未入力');
    ['father', 'mother'].forEach(k => {
      const p = s[k]; if (!p.present) return;
      if (['work', 'offer', 'study', 'care'].includes(p.reason) && !num(p.hours)) issues.push(`${k === 'father' ? '父' : '母'}の月の就労（就学・介護）時間が未入力`);
    });
    return issues;
  }

  window.Calc = { classAge, ageAt, deadlineFor, score, parentA1, needAmount, fee, feeTier, documents, validate, num };
})();

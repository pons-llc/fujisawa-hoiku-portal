// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// マイ申請：チャット形式（1問1答）の入力。答えは Store（フォーム入力と同じデータ）に保存する。
// 質問は現在の答えから毎回組み立てるので、答えに応じて必要な質問だけが出る。
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const S = () => Store.state;
  const ans = () => (S().chat = S().chat || { answers: {} }).answers;
  const pad = n => String(n).padStart(2, '0');
  const toHira = s => String(s || '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const jpDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${y}年${+m}月${+dd}日`; };
  const PARENT = { father: 'お父さん', mother: 'お母さん' };
  const YES_NO = [['yes', 'はい'], ['no', 'いいえ']];

  // ---------- 質問の組み立て ----------
  function flow() {
    const s = S(), h = s.household, app = s.application, A = ans();
    const Q = [];
    const q = o => Q.push(o);
    const months = []; for (let i = 0; i < 12; i++) { const d = new Date(2027, 3 + i, 1); months.push([`${d.getFullYear()}-${pad(d.getMonth() + 1)}`, `${d.getFullYear()}年${d.getMonth() + 1}月`]); }

    // --- いつから ---
    q({ id: 'start', type: 'choice', text: 'いつから 保育園に 入りたいですか？', help: '入れるのは 月の 1日（ついたち）だけです。', options: months, get: () => app.startMonth, set: v => { app.startMonth = v; } });
    if (app.startMonth === '2027-04') q({ id: 'aprilRound', type: 'choice', text: '4月に 入る 申込みは 2回 あります。どちらに しますか？', help: '1回目は 10月23日までに 郵便で 届く ように 送ります。', options: [['1', '1回目（2026年10月23日 まで）'], ['2', '2回目（2027年2月8日 まで）']], get: () => app.aprilRound, set: v => { app.aprilRound = v; } });

    // --- 住まい ---
    q({ id: 'residence', type: 'choice', text: 'いま どこに 住んでいますか？', options: [['fujisawa', '藤沢市に 住んでいる'], ['moving', 'これから 藤沢市に 引っこす'], ['outsideWork', 'ほかの 市に 住んでいて、藤沢市で はたらいている'], ['chigasaki', '茅ヶ崎市 堤（つつみ）地区（湘南ライフタウン）']], get: () => h.residence, set: v => { h.residence = v; },
      after: v => (v === 'outsideWork' ? 'ほかの 市に 住んでいる 人は、ふつう 住んでいる 市の 窓口で 申込みます。くわしくは 住んでいる 市に 聞いてください。' : null) });
    if (h.residence === 'moving') q({ id: 'contractDocs', type: 'choice', text: '引っこし先の 家の 契約書（けいやくしょ）の コピーを 出せますか？', help: '出せないと 点数が 10点 下がります。藤沢市に 住んでいる 家族と いっしょに 住む ときは 必要 ありません。', options: [['yes', 'はい、出せる'], ['no', 'いいえ、出せない']], get: () => (h.contractDocs === false ? 'no' : 'yes'), set: v => { h.contractDocs = v === 'yes'; } });
    q({ id: 'postal', type: 'text', text: '郵便番号（ゆうびんばんごう）を 教えてください。', placeholder: '251-0000', inputmode: 'numeric', get: () => h.postal, set: v => { const d = v.replace(/\D/g, ''); h.postal = d.length === 7 ? d.slice(0, 3) + '-' + d.slice(3) : v; }, validate: v => (v.replace(/\D/g, '').length === 7 ? null : '7けたの 数字で 入れてください。') });
    q({ id: 'address1', type: 'text', text: h.residence === 'fujisawa' ? '住所を 教えてください。「藤沢市」より あとを 書いてください。' : '住所を 教えてください（市の 名前から）。', placeholder: h.residence === 'fujisawa' ? '朝日町1番地の1' : '〇〇市〇〇町1-2-3', get: () => h.address1, set: v => { h.address1 = v; } });
    q({ id: 'address2', type: 'text', optional: true, text: 'マンションや アパートの 名前、部屋の 番号が あれば 教えてください。', placeholder: '〇〇マンション 101号室', get: () => h.address2, set: v => { h.address2 = v; } });

    // --- 子ども ---
    q({ id: 'nChildren', type: 'choice', text: '申込む 子どもは 何人 ですか？', help: 'きょうだいで いっしょに 申込む ときは 人数を えらんでください。', options: [['1', '1人'], ['2', '2人'], ['3', '3人']], get: () => String(s.children.length), set: v => { const n = +v; while (s.children.length < n) s.children.push(Store.emptyChild()); s.children.length = n; } });
    s.children.forEach((c, i) => {
      const who = s.children.length > 1 ? `${i + 1}人目の 子ども` : '子ども';
      const P = 'child' + i;
      if (s.application.startMonth === '2027-04') q({ id: P + '.unborn', type: 'choice', text: `${who}は もう 生まれていますか？`, options: [['no', 'はい、生まれている'], ['yes', 'まだ（おなかの 中）']], help: 'まだ 生まれていない 子は 4月に 入る 申込みだけ できます（2027年3月1日までに 生まれる 予定の 子）。', get: () => (c.unborn ? 'yes' : 'no'), set: v => { c.unborn = v === 'yes'; } });
      q({ id: P + '.name', type: 'text', text: c.unborn ? `${who}の 名前が 決まっていたら 教えてください。` : `${who}の 名前を 教えてください。`, optional: c.unborn, placeholder: '藤沢 たろう', get: () => c.name, set: v => { c.name = v; } });
      const nm = c.name || who;
      q({ id: P + '.kana', type: 'text', optional: c.unborn, text: `「${nm}」の 読みかたを ひらがなで 教えてください。`, placeholder: 'ふじさわ たろう', get: () => c.kana, set: v => { c.kana = toHira(v); } });
      if (c.unborn) return;
      q({ id: P + '.birth', type: 'date', text: `${nm}さんが 生まれた 日は いつですか？`, get: () => c.birth, set: v => { c.birth = v; }, show: jpDate,
        after: v => { const cls = Calc.classAge(v); return cls == null ? null : cls >= 6 ? '小学生の 年れいです。保育園には 申込めません。' : `${nm}さんは ${cls}歳児クラス です。（2027年4月1日の 年れいで 決まります）`; } });
      q({ id: P + '.sex', type: 'choice', text: `${nm}さんの 性別（せいべつ）を えらんでください。`, options: [['male', '男の子'], ['female', '女の子']], get: () => c.sex, set: v => { c.sex = v; } });
      q({ id: P + '.status', type: 'choice', text: `${nm}さんは いま 昼間 どこで すごしていますか？`, options: [['none', '家（家族が 見ている）'], ['licensed', '認可保育園に かよっている（転園したい）'], ['unlicensed', '認可外の 保育園・幼稚園に かよっている'], ['temporary', '一時あずかりを つかっている'], ['other', 'そのほか']], get: () => c.status, set: v => { c.status = v; if (v === 'licensed') app.transfer = true; } });
      if (['licensed', 'unlicensed', 'temporary', 'other'].includes(c.status)) q({ id: P + '.statusName', type: 'text', text: 'その 施設の 名前を 教えてください。', optional: true, get: () => c.statusName, set: v => { c.statusName = v; } });
      if (['unlicensed', 'temporary'].includes(c.status)) q({ id: P + '.paidCare', type: 'choice', text: 'お金を はらって あずけていますか？ 1週間に 何日 くらいですか？', help: '認可外・企業主導型・ベビーシッターに 週3日以上 だと 点数が 上がる ことが あります。「保育証明書（ほいくしょうめいしょ）」が 必要です。', options: [['3days', '週3日 以上'], ['weekly', '週1〜2日'], ['none', 'お金は はらっていない／ときどき']], get: () => c.paidCare, set: v => { c.paidCare = v; } });
      // 児童調査書（かんたんな項目）
      q({ id: P + '.allergy', type: 'choice', text: `${nm}さんに 食べもの などの アレルギーは ありますか？`, options: [['none', 'ない'], ['yes', 'ある'], ['unknown', 'わからない']], get: () => c.survey.allergy, set: v => { c.survey.allergy = v; } });
      if (c.survey.allergy !== 'none') q({ id: P + '.allergyItems', type: 'multi', text: 'あてはまる ものを えらんでください（いくつでも）。', options: [['egg', '卵'], ['milk', '牛乳'], ['soy', '大豆'], ['wheat', '小麦'], ['buckwheat', 'そば'], ['other', 'そのほか']], get: () => c.survey.allergyItems, set: v => { c.survey.allergyItems = v; }, after: () => 'アレルギーが ある ときは、申込みの 前に 入りたい 保育園に 相談（そうだん）してください。' });
      q({ id: P + '.checkups', type: 'multi', optional: true, text: '受けた 赤ちゃん健診（けんしん）を えらんでください。', options: [['m4', '4か月'], ['m9', '9・10か月'], ['y1', '1歳6か月'], ['y3', '3歳6か月']], get: () => c.survey.checkups, set: v => { c.survey.checkups = v; } });
      q({ id: P + '.vaccines', type: 'multi', optional: true, text: '受けた 予防接種（よぼうせっしゅ）を えらんでください。', help: '母子手帳（ぼしてちょう）を 見ると わかります。', options: [['hepb', 'B型肝炎'], ['pneumo', '小児用肺炎球菌'], ['dpt', '4種混合・ヒブ（5種混合）'], ['bcg', 'BCG'], ['rota', 'ロタ'], ['mr', '麻しん・風しん（MR）'], ['varicella', '水ぼうそう'], ['je', '日本脳炎']], get: () => c.survey.vaccines, set: v => { c.survey.vaccines = v; } });
      q({ id: P + '.confirms', type: 'info', text: '児童調査書（じどうちょうさしょ）の 約束（やくそく）です。読んでください。', help: '・病気や 発達の ことで 特別な 手だすけが 必要な とき、市が 保育園に 相談する ことが あります。\n・保育園の 事情で、入れない ことが あります。\n・出した あとで 大きな 病気が わかった ときは、市に 連絡（れんらく）します。\n・うそを 書いた ときは、入園が 取り消しに なる ことが あります。', button: '読みました', get: () => c.survey.confirms.every(Boolean) ? 'ok' : '', set: () => { c.survey.confirms = [true, true, true, true]; }, show: () => '読みました' });
    });

    // --- 家族の形 ---
    q({ id: 'single', type: 'choice', text: 'ひとり親（おやが ひとり）の 家庭ですか？', options: YES_NO, get: () => (h.singleParent ? 'yes' : 'no'), set: v => { h.singleParent = v === 'yes'; if (v === 'no') { s.father.present = true; s.mother.present = true; } } });
    if (h.singleParent) {
      q({ id: 'singleWho', type: 'choice', text: 'いっしょに 子どもを 育てている 親は どちらですか？', options: [['mother', 'お母さん'], ['father', 'お父さん']], get: () => (!s.father.present ? 'mother' : !s.mother.present ? 'father' : ''), set: v => { s[v].present = true; s[v === 'mother' ? 'father' : 'mother'].present = false; app.representative = v; } });
      q({ id: 'singleReason', type: 'choice', text: 'ひとり親に なった 理由を えらんでください。', help: '戸籍謄本（こせきとうほん）など、ひとり親だと わかる 書類が 1つ 必要です。', options: [['unmarried', '結婚していない'], ['divorce', '離婚（りこん）'], ['bereaved', '死別（しべつ）'], ['other', 'そのほか']], get: () => h.singleReason, set: v => { h.singleReason = v; } });
      q({ id: 'noRelative', type: 'choice', text: 'いっしょに 住んでいる 65歳より 若い 大人（親せき）は いますか？', help: '子どもと 自分（親）は 数えません。', options: [['no', 'いない'], ['yes', 'いる']], get: () => (h.noRelativeUnder65 ? 'no' : 'yes'), set: v => { h.noRelativeUnder65 = v === 'no'; } });
    }

    // --- 保護者 ---
    ['mother', 'father'].forEach(k => {
      const p = s[k]; if (!p.present) return;
      const W = PARENT[k], P = k;
      q({ id: P + '.name', type: 'text', text: `${W}の 名前を 教えてください。`, placeholder: k === 'mother' ? '藤沢 はなこ' : '藤沢 いちろう', get: () => p.name, set: v => { p.name = v; } });
      q({ id: P + '.kana', type: 'text', text: `${W}の 名前の 読みかたを ひらがなで 教えてください。`, placeholder: 'ふじさわ はなこ', get: () => p.kana, set: v => { p.kana = toHira(v); } });
      q({ id: P + '.birth', type: 'date', text: `${W}の 生まれた 日は いつですか？`, get: () => p.birth, set: v => { p.birth = v; }, show: jpDate });
      q({ id: P + '.phone', type: 'text', text: `${W}の 携帯電話（けいたいでんわ）の 番号を 教えてください。`, placeholder: '090-1234-5678', inputmode: 'tel', optional: true, get: () => p.phone, set: v => { p.phone = v; } });
      if (!h.singleParent) q({ id: P + '.cohabit', type: 'choice', text: `${W}は 子どもと いっしょに 住んでいますか？`, options: [['yes', 'はい'], ['transfer', 'いいえ（単身赴任 たんしんふにん）'], ['hospital', 'いいえ（長く 入院している）'], ['other', 'いいえ（そのほか）']], get: () => (p.cohabit === false ? (h.absentParent !== 'none' ? h.absentParent : 'other') : 'yes'), set: v => { p.cohabit = v === 'yes'; if (v === 'transfer' || v === 'hospital') h.absentParent = v; else if (v === 'yes' && !(s.father.cohabit === false || s.mother.cohabit === false)) h.absentParent = 'none'; } });
      q({ id: P + '.reason', type: 'choice', text: `${W}が 昼間 子どもを 見られない 理由は どれですか？`, help: 'いちばん あてはまる ものを 1つ えらんでください。', options: [['work', 'はたらいている（育休中も ふくむ）'], ['offer', '仕事が 決まっている（まだ はじまっていない）'], ['seeking', '仕事を さがしている'], ['study', '学校に かよっている'], ['illness', '病気・けが'], ['disability', '障がい'], ['care', '家族の 介護（かいご）・看病（かんびょう）'], ['birth', '出産（しゅっさん）の 前後']], get: () => p.reason, set: v => { p.reason = v; } });
      if (['work', 'offer', 'study', 'care'].includes(p.reason)) {
        const word = { work: 'はたらいて', offer: 'はたらく 予定', study: '学校に かよって', care: '介護・看病を して' }[p.reason];
        q({ id: P + '.hours', type: 'number', text: `${W}は 1か月に 何時間 ${word}${p.reason === 'offer' ? 'ですか' : 'いますか'}？`, help: '休けいと 通勤（つうきん）の 時間は 入れません。契約（けいやく）の 時間で 答えてください。', placeholder: '160', quick: [['160', '160時間（週5日 × 1日8時間）'], ['140', '140時間（週5日 × 1日7時間）'], ['120', '120時間（週5日 × 1日6時間）'], ['80', '80時間（週4日 × 1日5時間）'], ['64', '64時間（週4日 × 1日4時間）']], get: () => p.hours, set: v => { p.hours = v; }, validate: v => (+v > 0 && +v < 500 ? null : '数字で 入れてください（例：160）。'), show: v => `${v}時間`,
          after: v => (+v < 64 ? '1か月 64時間より 少ないと、保育園を つかう 条件に あたらない ことが あります。' : null) });
      }
      if (['work', 'offer'].includes(p.reason)) {
        q({ id: P + '.employer', type: 'text', text: 'はたらいている（はたらく 予定の）会社や お店の 名前を 教えてください。', placeholder: '株式会社〇〇 △△支店', get: () => p.employer, set: v => { p.employer = v; p.workplace = p.workplace || v; } });
        q({ id: P + '.employerAddr', type: 'text', optional: true, text: 'その 会社の 住所を 教えてください。', placeholder: '神奈川県藤沢市〇〇', get: () => p.employerAddr, set: v => { p.employerAddr = v; } });
        q({ id: P + '.self', type: 'choice', text: '会社に やとわれて いますか？ 自分で 仕事を していますか？', options: [['no', '会社などに やとわれている'], ['yes', '自分で 仕事を している（自営業・フリーランス など）']], help: '自分で 仕事を している 人は、就労状況説明書（しゅうろうじょうきょうせつめいしょ）と 確定申告書（かくていしんこくしょ）の コピーも 必要です。', get: () => (p.selfEmployed ? 'yes' : 'no'), set: v => { p.selfEmployed = v === 'yes'; } });
      }
      if (p.reason === 'work') {
        q({ id: P + '.ikukyu', type: 'choice', text: `${W}は いま 育児休業（いくじきゅうぎょう・育休）中 ですか？`, help: '育休中の 人は、保育園に 入った 次の 月の 15日までに 仕事に もどる 必要が あります。', options: [['yes', 'はい、育休中（または これから 育休）'], ['no', 'いいえ']], get: () => (p.ikukyu ? 'yes' : 'no'), set: v => { p.ikukyu = v === 'yes'; } });
        if (p.ikukyu) q({ id: P + '.ikukyuTo', type: 'date', optional: true, text: '育休が おわる 予定の 日を 教えてください。', get: () => p.ikukyuTo, set: v => { p.ikukyuTo = v; }, show: jpDate });
      }
      if (['work', 'offer'].includes(p.reason)) q({ id: P + '.nursery', type: 'choice', text: '保育園に 入ると 同時に、藤沢市の 保育園・幼稚園で 先生として はたらきますか？', help: '保育士・幼稚園の 先生だと 点数が 6点、保育の お手つだい（保育補助）だと 2点 上がります。', options: [['none', 'いいえ'], ['teacher', 'はい、保育士・幼稚園の 先生として'], ['assistant', 'はい、保育の お手つだい（保育補助）として']], get: () => p.nurseryJob, set: v => { p.nurseryJob = v; } });
      if (p.reason === 'seeking') q({ id: P + '.seekingPlan', type: 'choice', text: '保育園に 入れなかったら、仕事さがしは どうしますか？', options: [['pause', 'いったん やめて、入れたら はじめる'], ['continueHW', 'つづける（ハローワークなどに かよう）'], ['continueHome', 'つづける（家で さがす）'], ['stop', 'やめる']], help: '仕事を さがしている 人は、入園から 2か月の あいだに 仕事を はじめる 必要が あります。', get: () => p.seekingPlan, set: v => { p.seekingPlan = v; } });
      if (p.reason === 'study') q({ id: P + '.schoolName', type: 'text', text: 'かよっている 学校の 名前を 教えてください。', get: () => p.schoolName, set: v => { p.schoolName = v; p.workplace = p.workplace || v; } });
      if (p.reason === 'illness') q({ id: P + '.illnessLevel', type: 'choice', text: '病気・けがで、子どもを 見るのは どのくらい むずかしいですか？', help: '医師の 診断書（しんだんしょ・市の 用紙）が 必要です。', options: [['full', 'まったく 見られない'], ['daytime', '昼間は ずっと むずかしい'], ['partial', 'ときどき むずかしい']], get: () => p.illnessLevel, set: v => { p.illnessLevel = v; } });
      if (p.reason === 'disability') q({ id: P + '.disabilityLevel', type: 'choice', text: 'もっている 手帳を えらんでください。', options: [['severe', '身体障がい者手帳 1・2級、精神 1〜3級、療育手帳'], ['grade3', '身体障がい者手帳 3級'], ['grade4', '身体障がい者手帳 4級 以下']], get: () => p.disabilityLevel, set: v => { p.disabilityLevel = v; } });
      if (p.reason === 'care') q({ id: P + '.careTarget', type: 'text', text: '介護・看病を している 人の 名前を 教えてください。', optional: true, get: () => p.careTarget, set: v => { p.careTarget = v; } });
    });
    const anyIkukyu = s.father.present && s.father.ikukyu || s.mother.present && s.mother.ikukyu;
    if (anyIkukyu && h.residence !== 'outsideWork' && h.residence !== 'chigasaki') q({ id: 'ikukyuChoice', type: 'choice', text: '保育園に 入れなかった ときは、育休を のばしても いいですか？', help: '「のばしても いい」を えらぶと、点数が 30点 下がります。どうしても 早く 入りたい 人は「いいえ」を えらんでください。', options: [['A', 'いいえ。入れたら すぐ 仕事に もどりたい（育休A）'], ['B', 'はい。のばしても いい（育休B・30点 下がる）']], get: () => app.ikukyuChoice, set: v => { app.ikukyuChoice = v; } });
    if (s.father.present && s.mother.present) q({ id: 'representative', type: 'choice', text: '市からの 手紙は だれ あてに 送りますか？', options: [['mother', 'お母さん'], ['father', 'お父さん']], get: () => app.representative, set: v => { app.representative = v; } });

    // --- いっしょに 住む 家族 ---
    q({ id: 'members', type: 'choice', text: 'お父さん・お母さん・申込む 子ども の ほかに、いっしょに 住んでいる 家族は いますか？', help: 'きょうだい、おじいさん、おばあさん など。いっしょに 住んでいなくても、単身赴任や 留学で はなれている 家族は 入れてください。', options: [['yes', 'いる'], ['no', 'いない']], get: () => (s.members.length ? 'yes' : ''), set: v => { if (v === 'yes' && !s.members.length) s.members.push(Store.emptyMember()); if (v === 'no') s.members = []; } });
    for (let i = 0; i < s.members.length && i < 4; i++) {
      const m = s.members[i], P = 'member' + i;
      q({ id: P + '.relation', type: 'choice', text: `${i + 1}人目の 家族は だれですか？`, options: [['兄', '兄（あに）'], ['姉', '姉（あね）'], ['弟', '弟（おとうと）'], ['妹', '妹（いもうと）'], ['祖父', 'おじいさん'], ['祖母', 'おばあさん'], ['その他', 'そのほか']], get: () => m.relation, set: v => { m.relation = v; } });
      q({ id: P + '.name', type: 'text', text: 'その 人の 名前を 教えてください。', get: () => m.name, set: v => { m.name = v; } });
      q({ id: P + '.kana', type: 'text', optional: true, text: '名前の 読みかたを ひらがなで 教えてください。', get: () => m.kana, set: v => { m.kana = toHira(v); } });
      q({ id: P + '.birth', type: 'date', text: 'その 人の 生まれた 日を 教えてください。', get: () => m.birth, set: v => { m.birth = v; }, show: jpDate });
      q({ id: P + '.workplace', type: 'text', optional: true, text: 'その 人が かよっている 学校・保育園や、はたらいている ところが あれば 教えてください。', get: () => m.workplace, set: v => { m.workplace = v; } });
      if (i < 3) q({ id: P + '.more', type: 'choice', text: 'ほかにも いっしょに 住んでいる 家族は いますか？', options: [['yes', 'いる'], ['no', 'いない']], get: () => (s.members.length > i + 1 ? 'yes' : ''), set: v => { if (v === 'yes' && s.members.length <= i + 1) s.members.push(Store.emptyMember()); if (v === 'no') s.members.length = i + 1; } });
    }
    q({ id: 'siblings18', type: 'choice', text: '18歳より 下の きょうだいは、申込む 子も ふくめて 何人 いますか？', help: '3人 以上だと 点数が 少し 上がります。', options: [['1', '1人'], ['2', '2人'], ['3', '3人'], ['4', '4人 以上']], get: () => String(h.siblingsUnder18 || ''), set: v => { h.siblingsUnder18 = +v; h.childOrder = Math.max(1, +v - s.children.length + 1); } });

    // --- おじいさん・おばあさん（申込書の「祖父母の状況」） ---
    [['pf', 'お父さんの お父さん（父方の おじいさん）'], ['pm', 'お父さんの お母さん（父方の おばあさん）'], ['mf', 'お母さんの お父さん（母方の おじいさん）'], ['mm', 'お母さんの お母さん（母方の おばあさん）']].forEach(([k, label]) => {
      const g = s.grandparents[k];
      q({ id: 'gp.' + k, type: 'text', optional: true, text: `${label}の 名前を 教えてください。`, help: 'わからない ときや 亡くなった ときは「とばす」を おしてください（申込書に 手で 書いてください）。', get: () => g.name, set: v => { g.name = v; } });
      if (g.name) q({ id: 'gp.' + k + '.co', type: 'choice', text: 'その 人と いっしょに 住んでいますか？', options: YES_NO, get: () => (g.name ? (g.cohabit ? 'yes' : 'no') : ''), set: v => { g.cohabit = v === 'yes'; } });
      if (g.name && !g.cohabit) q({ id: 'gp.' + k + '.addr', type: 'text', optional: true, text: 'その 人の 住所を 教えてください。', get: () => g.addr, set: v => { g.addr = v; } });
    });

    // --- そのほかの 確認 ---
    q({ id: 'motherPregnant', type: 'choice', text: 'お母さんの おなかに いま 赤ちゃんが いますか？', options: YES_NO, help: '申込む 子とは べつの 赤ちゃんの ことです。', get: () => (h.motherPregnant ? 'yes' : 'no'), set: v => { h.motherPregnant = v === 'yes'; } });
    if (h.motherPregnant) {
      q({ id: 'dueDate', type: 'date', text: '生まれる 予定の 日は いつですか？', get: () => h.dueDate, set: v => { h.dueDate = v; }, show: jpDate, after: () => '母子手帳（ぼしてちょう）の コピーが 必要です。' });
      q({ id: 'afterBirth', type: 'choice', text: '赤ちゃんが 生まれた あとは どうする 予定ですか？', options: [['ikukyu', '育休を とる'], ['work', 'すぐ 仕事に もどる'], ['leave', '仕事は しない（保育園は 産後2か月ごろ まで）']], get: () => h.afterBirth, set: v => { h.afterBirth = v; } });
    }
    q({ id: 'welfare', type: 'choice', text: '生活保護（せいかつほご）を うけていますか？', options: YES_NO, get: () => (h.welfare ? 'yes' : 'no'), set: v => { h.welfare = v === 'yes'; if (h.welfare) h.taxStatus = 'welfare'; } });
    q({ id: 'familyDisability', type: 'choice', text: '家族の 中に、障がい者手帳や 療育手帳（りょういくてちょう）を もっている 人は いますか？', options: YES_NO, help: '申込む 子ども、お父さん、お母さんも ふくめます。', get: () => (h.familyDisability ? 'yes' : 'no'), set: v => { h.familyDisability = v === 'yes'; } });
    if (h.familyDisability) q({ id: 'familyDisabilityNames', type: 'text', text: '手帳を もっている 人の 名前を ぜんぶ 教えてください。', get: () => h.familyDisabilityNames, set: v => { h.familyDisabilityNames = v; } });
    q({ id: 'reg2026', type: 'choice', text: '2026年1月1日に、お父さんと お母さんは 藤沢市に 住んでいましたか？', help: '住んでいなかった ときは、住民税（じゅうみんぜい）の 課税証明書（かぜいしょうめいしょ）が 必要です。', options: [['fujisawa', 'はい、藤沢市'], ['outside', 'いいえ、ほかの 市']], get: () => h.reg2026, set: v => { h.reg2026 = v; } });
    if (h.reg2026 === 'outside') q({ id: 'reg2026City', type: 'text', text: 'そのとき 住んでいた 市（区・町・村）の 名前を 教えてください。', placeholder: '東京都 世田谷区', get: () => [h.reg2026Pref, h.reg2026City].filter(Boolean).join(' '), set: v => { const m = v.match(/^(.+?[都道府県])\s*(.*)$/); if (m) { h.reg2026Pref = m[1].replace(/[都道府県]$/, ''); h.reg2026City = m[2].replace(/[市区町村]$/, ''); } else { h.reg2026Pref = ''; h.reg2026City = v; } } });

    // --- 入りたい 保育園 ---
    const filled = () => app.wishes.filter(w => w.id || w.name);
    q({ id: 'wishIntro', type: 'info', text: '入りたい 保育園を えらびましょう。いくつでも（10こ まで）えらべます。', help: '・えらんだ じゅんばんは、入れるか どうかには 関係 ありません。\n・入れる 園を ふやすため、行ける 園は できるだけ 多く 書くのが おすすめです。\n・地図で さがしたい ときは、下の「保育園」タブを つかってください。', button: 'わかりました', get: () => '', set: () => {}, show: () => 'わかりました' });
    for (let k = 0; k < 10; k++) {
      const w = app.wishes[k], P = 'wish' + k;
      q({ id: P, type: 'facility', text: k === 0 ? 'いちばん 入りたい 保育園は どこですか？' : `${k + 1}番目に 入りたい 保育園は どこですか？`, help: '番号か 名前の 一部を 入れて、出てきた 中から えらんでください。', get: () => (w.id ? `${w.id} ${w.name}` : w.name), set: v => { app.wishes[k] = { ...Store.emptyWish(), ...app.wishes[k], id: v.id, name: v.name }; }, show: v => v.name || v,
        after: () => fitNote(app.wishes[k]) });
      if (!(w.id || w.name)) break;
      q({ id: P + '.visited', type: 'choice', text: `「${w.name}」を 見学（けんがく）しましたか？`, help: '見学していなくても 申込めます（家庭的保育事業だけは 見学が 必要です）。', options: [['yes', 'はい、見学した（電話で 相談した）'], ['no', 'まだ']], get: () => (w.visited ? 'yes' : (A[P + '.visited'] ? 'no' : '')), set: v => { w.visited = v === 'yes'; } });
      if (!w.visited) q({ id: P + '.visitPlan', type: 'date', optional: true, text: '見学する 予定の 日が あれば 教えてください。', get: () => w.visitPlan, set: v => { w.visitPlan = v; }, show: jpDate });
      q({ id: P + '.reason', type: 'choice', text: 'その 保育園を えらんだ 理由は なんですか？', options: [['自宅に近いため', '家に 近い'], ['職場に近いため', '仕事場に 近い'], ['駅に近いため', '駅に 近い'], ['きょうだいが在園しているため', 'きょうだいが かよっている'], ['保育方針に共感したため', '保育の 考えかたが よい'], ['__other', 'そのほか（自分で 書く）']], get: () => w.reason, set: v => { if (v !== '__other') w.reason = v; }, show: v => (v === '__other' ? 'そのほか' : v) });
      if (A[P + '.reason'] && A[P + '.reason'].v === '__other') q({ id: P + '.reasonText', type: 'text', text: '理由を みじかく 書いてください。', placeholder: '園庭が ひろいため', get: () => w.reason, set: v => { w.reason = v; } });
      if (k === 9) break;
      q({ id: P + '.more', type: 'choice', text: `ほかにも 入りたい 保育園は ありますか？（いま ${filled().length}こ）`, options: [['yes', 'ある'], ['no', 'もう ない']], get: () => '', set: () => {} });
      if (!A[P + '.more'] || A[P + '.more'].v !== 'yes') break;
    }

    // --- きょうだい・入れなかったとき ---
    if (s.children.length >= 2) {
      q({ id: 'sib1', type: 'choice', text: 'きょうだいは、かならず 同じ 時期に 入りたいですか？', help: 'この 答えで 有利や 不利には なりません。', options: [['A', 'はい。かならず いっしょに 入りたい'], ['B', 'いいえ。ひとりだけ 先に 入っても いい'], ['none', 'とくに 希望は ない']], get: () => (app.siblingNoPref ? 'none' : app.sib1), set: v => { app.siblingNoPref = v === 'none'; app.sib1 = v === 'none' ? '' : v; } });
      if (!app.siblingNoPref) {
        q({ id: 'sib2', type: 'choice', text: '同じ 時期に 入れる とき、保育園は 同じ ほうが いいですか？', options: [['C', 'かならず 同じ 保育園'], ['D', 'なるべく 同じ 保育園（希望の じゅんばんが 下がっても）'], ['E', 'ちがっても いい（それぞれ 希望の 高い 園）']], get: () => app.sib2, set: v => { app.sib2 = v; } });
        if (app.sib1 === 'B') q({ id: 'sib3', type: 'choice', text: 'ひとりしか 入れない とき、どちらを 先に 入れたいですか？', options: [['F', '上の子（年上の 子）'], ['G', '下の子（年下の 子）'], ['', 'どちらでも いい']], get: () => app.sib3, set: v => { app.sib3 = v; } });
      }
    }
    q({ id: 'continueReview', type: 'choice', text: '入れなかった ときは、2028年3月まで 毎月 つづけて 申込みますか？', help: '「はい」に すると、毎月 自動で 審査（しんさ）されます。', options: [['yes', 'はい、つづける'], ['no', 'いいえ、この 月だけ']], get: () => (app.continueReview ? 'yes' : 'no'), set: v => { app.continueReview = v === 'yes'; } });
    q({ id: 'planIfFail', type: 'choice', text: '保育園に 入れなかったら、子どもは どう する 予定ですか？', help: 'これは 点数には 関係 ありません。', options: [['extendIkukyu', '親が 家で 見る（育休を のばす）'], ['waitHome', '親が 家で 見て、空きを まつ'], ['relative', '親せきに 見てもらう'], ['otherFacility', 'ほかの 施設（認可外・幼稚園など）に あずける'], ['seeking', '仕事を さがしながら 見る'], ['continueCurrent', 'いまの 保育園に かよいつづける'], ['withdraw', '申込みを やめる']], get: () => app.planIfFail, set: v => { app.planIfFail = v; } });
    q({ id: 'method', type: 'choice', text: '書類は どうやって 出しますか？', help: app.startMonth === '2027-04' && app.aprilRound === '1' ? '4月の 1回目は 郵便だけ です。切手を はった 返信用の ふうとう（長3）も 入れてください。' : '郵便の ときは、切手を はった 返信用の ふうとう（長3）も 入れてください。', options: app.startMonth === '2027-04' && app.aprilRound === '1' ? [['mail', '郵便で 送る']] : [['mail', '郵便で 送る'], ['window', '市役所の 窓口に もっていく'], ['online', 'インターネット（電子申請）']], get: () => app.method, set: v => { app.method = v; } });
    q({ id: 'tax', type: 'choice', optional: true, text: '保育料（ほいくりょう）の めやすを 計算しますか？', help: '住民税の「所得割額（しょとくわりがく）」が 必要です。課税証明書（かぜいしょうめいしょ）や、会社で もらう「住民税の 決定通知書」に 書いてあります。', options: [['yes', 'はい、金額が わかる'], ['nontax', '住民税は かかっていない（非課税）'], ['no', 'わからない・あとで']], get: () => '', set: v => { if (v === 'nontax') h.taxStatus = 'nontax'; if (v === 'yes' && h.taxStatus !== 'welfare') h.taxStatus = 'taxed'; } });
    if (A.tax && A.tax.v === 'yes') q({ id: 'shotokuwari', type: 'number', text: 'お父さんと お母さんの 所得割額を たした 金額を 教えてください（円）。', placeholder: '150000', get: () => h.shotokuwari, set: v => { h.shotokuwari = v.replace(/\D/g, ''); }, validate: v => (/^\d+$/.test(v.replace(/[,，円\s]/g, '')) ? null : '数字で 入れてください。'), show: v => Number(String(v).replace(/\D/g, '')).toLocaleString('ja-JP') + '円' });
    return Q;
  }

  function fitNote(w) {
    if (!w || !w.id) return w && w.name ? 'この 保育園は 番号が わかりませんでした。正しい 名前か 確認してください。' : null;
    const f = (window.FACILITIES || []).find(f => String(f.id) === String(w.id)); if (!f) return null;
    const notes = [];
    const s = S(); const start = (s.application.startMonth || '2027-04') + '-01';
    s.children.forEach((c, i) => {
      if (!c.birth) return;
      const cls = Calc.classAge(c.birth); const a = Calc.ageAt(c.birth, start); const nm = c.name || `${i + 1}人目の 子`;
      if (!f.classes.includes(cls)) notes.push(`⚠ ${f.name}は ${cls}歳児クラスの 受け入れが ないかも しれません（${nm}）。`);
      else if (f.minDays && a && a.days < f.minDays) notes.push(`⚠ ${nm}は 入園の ときに ${f.name}の 受け入れ月齢（${f.minAge}）に まだ 足りないかも しれません。`);
    });
    if (f.type === '家庭的保育事業') notes.push('⚠ ここは「家庭的保育事業」です。申込みの 前に かならず 見学が 必要です。');
    if (f.transfer) notes.push('この 保育園は 2歳（または 3歳）クラスまでです。そのあと 別の 保育園に うつる 必要が あります。');
    return notes.join('\n') || `${f.name}を えらびました。`;
  }

  // ---------- 描画 ----------
  let root = null, error = '';
  function current(Q) { const A = ans(); return Q.find(q => !(q.id in A)); }
  function label(q, v) {
    if (v == null || v === '') return 'とばしました';
    if (q.show) return q.show(v);
    if (q.type === 'choice') { const o = q.options.find(o => o[0] === v); return o ? o[1] : String(v); }
    if (q.type === 'multi') { const arr = Array.isArray(v) ? v : []; return arr.length ? arr.map(x => (q.options.find(o => o[0] === x) || [x, x])[1]).join('、') : 'なし'; }
    return String(v);
  }

  function render(el) {
    root = el || root; if (!root) return;
    const Q = flow(); const A = ans(); const cur = current(Q);
    const idx = cur ? Q.indexOf(cur) : Q.length;
    const answered = Q.slice(0, idx);
    const pct = Math.round(answered.length / Math.max(Q.length, 1) * 100);
    const bot = (html, cls = '') => `<div class="msg bot ${cls}"><div class="bubble">${html}</div></div>`;
    const lines = s => esc(s).replace(/\n/g, '<br>');
    let html = `<div class="chat-progress" aria-label="すすみぐあい"><div style="width:${pct}%"></div></div><div class="chat-log" id="chatLog">`;
    html += bot('こんにちは。保育園の 申込書を いっしょに 作りましょう。<br>しつもんに こたえる だけで だいじょうぶです。<br><small>答えは この スマホの 中だけに 保存されます。マイナンバーは ここでは 聞きません（申込書に 手で 書いてください）。</small>');
    answered.forEach(q => {
      const a = A[q.id];
      html += bot(`${lines(typeof q.text === 'function' ? q.text() : q.text)}`);
      html += `<div class="msg me"><button class="bubble" data-edit="${esc(q.id)}" title="タップして なおす">${esc(a.label)}</button></div>`;
      if (a.note) html += bot(lines(a.note), 'note-msg');
    });
    if (cur) {
      html += bot(`${lines(cur.text)}${cur.help ? `<div class="hint">${lines(cur.help)}</div>` : ''}`, 'current');
    } else {
      html += bot('おつかれさまでした！ 申込書に 書く ことが ぜんぶ そろいました。🎉<br>つぎは 必要な 書類を 見て、申込書の PDFを 作りましょう。<br><small>答えを なおしたい ときは、自分の 答え（右がわの 吹き出し）を タップしてください。</small>', 'done');
    }
    html += '</div>';
    html += `<div class="chat-dock">${error ? `<div class="chat-error">${esc(error)}</div>` : ''}${cur ? inputHTML(cur) : `<div class="row"><button class="btn primary" data-mode="docs">必要な 書類を 見る</button><a class="btn primary" href="#forms">申込書PDFを 作る</a></div><div class="row" style="margin-top:8px"><a class="btn" href="#score">点数を 見る</a></div><div class="row" style="margin-top:8px"><button class="btn small" data-act="restart">はじめから やりなおす</button></div>`}${cur && answered.length ? '<div class="dock-sub"><button class="link-btn" data-act="back">← ひとつ もどる</button></div>' : ''}</div>`;
    root.innerHTML = html;
    const log = root.querySelector('#chatLog');
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; const inp = root.querySelector('.chat-dock input:not([type=checkbox])'); if (inp && !('ontouchstart' in window)) inp.focus({ preventScroll: true }); });
    return log;
  }

  function inputHTML(q) {
    const v = q.get ? q.get() : '';
    const skip = q.optional ? '<button class="btn" data-act="skip">とばす</button>' : '';
    switch (q.type) {
      case 'choice':
        return `<div class="choice-list">${q.options.map(([val, l]) => `<button class="choice-btn${String(v) === String(val) && v !== '' ? ' selected' : ''}" data-choice="${esc(val)}">${esc(l)}</button>`).join('')}</div>${skip ? `<div class="row">${skip}</div>` : ''}`;
      case 'multi': {
        const arr = Array.isArray(v) ? v : [];
        return `<div class="chip-list">${q.options.map(([val, l]) => `<label class="chip-check"><input type="checkbox" value="${esc(val)}"${arr.includes(val) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div><div class="row"><button class="btn primary" data-act="multi">つぎへ</button>${skip}</div>`;
      }
      case 'info':
        return `<div class="row"><button class="btn primary" data-act="info">${esc(q.button || 'つぎへ')}</button></div>`;
      case 'facility': {
        const opts = (window.FACILITIES || []).filter(f => f.licensed && f.id).map(f => `<option value="${f.id} ${esc(f.name)}"></option>`).join('');
        return `<form class="chat-input" data-act="submit"><input type="search" id="chatIn" list="chatFac" value="${esc(v)}" placeholder="番号か 名前を 入れる（例：辻堂、72）" autocomplete="off" aria-label="保育園"><datalist id="chatFac">${opts}</datalist><button class="btn primary">決定</button></form><div class="row"><a class="btn small" href="#facilities">地図で さがす</a></div>`;
      }
      default: {
        const type = q.type === 'date' ? 'date' : 'text';
        const im = q.inputmode ? ` inputmode="${q.inputmode}"` : q.type === 'number' ? ' inputmode="numeric"' : '';
        const quick = q.quick ? `<div class="choice-list">${q.quick.map(([val, l]) => `<button type="button" class="choice-btn${String(v) === val ? ' selected' : ''}" data-quick="${esc(val)}">${esc(l)}</button>`).join('')}</div><div class="hint">または 数字を 入れてください：</div>` : '';
        return `${quick}<form class="chat-input" data-act="submit"><input type="${type}" id="chatIn"${im} value="${esc(v)}" placeholder="${esc(q.placeholder || '')}" autocomplete="off" aria-label="こたえ"><button class="btn primary">つぎへ</button></form>${skip ? `<div class="row">${skip}</div>` : ''}`;
      }
    }
  }

  function answer(q, raw) {
    error = '';
    let v = raw;
    if (['text', 'number', 'date'].includes(q.type)) {
      v = String(raw ?? '').trim();
      if (!v) { if (q.optional) return skip(q); error = q.type === 'date' ? '日にちを えらんでください。' : 'こたえを 入れてください。いらない ときは「とばす」を おしてください。'; return render(); }
      if (q.type === 'number') v = v.normalize('NFKC').replace(/[,，円時間\s]/g, '');
      if (q.validate) { const e = q.validate(v); if (e) { error = e; return render(); } }
    }
    if (q.type === 'facility') {
      const t = String(raw || '').normalize('NFKC').trim();
      if (!t) { error = '保育園を えらんでください。'; return render(); }
      const F = (window.FACILITIES || []).filter(f => f.licensed && f.id);
      const num = (t.match(/^(\d+)/) || [])[1];
      let f = num ? F.find(f => String(f.id) === num) : F.find(f => f.name.normalize('NFKC') === t);
      if (!f) { const cand = F.filter(f => f.name.normalize('NFKC').includes(t)); if (cand.length === 1) f = cand[0]; else { error = cand.length ? `${cand.length}こ 見つかりました。下の 候補から えらんでください。` : '見つかりませんでした。番号か、名前の 一部を 入れて 候補から えらんでください。'; return render(); } }
      if (S().application.wishes.some((w, i) => String(w.id) === String(f.id) && 'wish' + i !== q.id)) { error = 'その 保育園は もう えらんでいます。'; return render(); }
      v = { id: String(f.id), name: f.name };
    }
    q.set(v);
    const note = q.after ? q.after(v) : null;
    ans()[q.id] = { v: q.type === 'facility' ? v.id : v, label: label(q, v), ...(note ? { note } : {}) };
    if (!S().application.writtenDate) S().application.writtenDate = new Date().toISOString().slice(0, 10);
    Store.save();
    render();
  }
  function skip(q) { error = ''; ans()[q.id] = { v: null, label: 'とばしました' }; Store.save(); render(); }

  function bind(el) {
    el.addEventListener('click', e => {
      const Q = flow(); const cur = current(Q);
      const c = e.target.closest('[data-choice]'); if (c && cur) return answer(cur, c.dataset.choice);
      const qk = e.target.closest('[data-quick]'); if (qk && cur) return answer(cur, qk.dataset.quick);
      const act = e.target.closest('[data-act]'); const a = act && act.dataset.act;
      if (a === 'skip' && cur) return skip(cur);
      if (a === 'info' && cur) return answer(cur, 'ok');
      if (a === 'multi' && cur) return answer(cur, [...el.querySelectorAll('.chip-list input:checked')].map(i => i.value));
      if (a === 'back') { const idx = cur ? Q.indexOf(cur) : Q.length; const prev = Q[idx - 1]; if (prev) { delete ans()[prev.id]; error = ''; Store.save(); render(); } return; }
      if (a === 'restart') { if (confirm('チャットを はじめから やりなおしますか？（入力した 内容は のこります）')) { S().chat = { answers: {} }; Store.save(); render(); } return; }
      const ed = e.target.closest('[data-edit]');
      if (ed) { delete ans()[ed.dataset.edit]; error = ''; Store.save(); render(); }
    });
    el.addEventListener('submit', e => { e.preventDefault(); const cur = current(flow()); if (cur) answer(cur, el.querySelector('#chatIn').value); });
  }

  window.Chat = { mount(el) { root = el; error = ''; bind(el); render(el); }, flow };
})();

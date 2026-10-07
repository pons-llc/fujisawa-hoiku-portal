// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// 画面描画・ルーティング
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const yen = n => (n == null ? '—' : n.toLocaleString('ja-JP') + '円');
  const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); const w = '日月火水木金土'[new Date(d + 'T00:00:00').getDay()]; return `${y}年${+m}月${+dd}日（${w}）`; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const NAVI_PDF = 'docs/r9moushikomi_navi.pdf';
  const pageLink = (p, label) => `<a href="${NAVI_PDF}#page=${p + 3}" target="_blank" rel="noopener">${esc(label || '申込ナビP' + p)}</a>`;
  const S = () => Store.state;
  const DISCLAIMER = '<p class="note">※本ツールの結果は申込ナビの記載をもとにした<strong>非公式の目安</strong>です。正確性は保証しません。実際の審査・認定・保育料は藤沢市保育課が決定します。</p>';
  const R = window.RULES;
  const OPERATOR = '合同会社Pons';
  const CONTACT_HTML = '<a href="https://x.com/ponsllc" target="_blank" rel="noopener">X（旧Twitter）@ponsllc</a>';
  const childLabel = (c, i) => c.name || `児童${i + 1}`;

  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  // ============ フォーム部品 ============
  // data-path に Store のパスを持たせ、イベント委譲で保存する
  function field(path, label, type = 'text', opts = {}) {
    const v = Store.get(path);
    const id = 'f_' + path.replace(/\./g, '_');
    const help = opts.help ? `<span class="help">${opts.help}</span>` : '';
    const rr = opts.rerender ? ' data-rerender="1"' : '';
    if (type === 'select') {
      return `<div class="f"><label for="${id}">${label}</label><select id="${id}" data-path="${path}"${rr}>${opts.options.map(([val, l]) => `<option value="${esc(val)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${help}</div>`;
    }
    if (type === 'radio') {
      return `<div class="f"><span class="lbl">${label}</span><div class="choice">${opts.options.map(([val, l]) => `<label><input type="radio" name="${id}" data-path="${path}" value="${esc(val)}"${String(v) === String(val) ? ' checked' : ''}${rr}>${esc(l)}</label>`).join('')}</div>${help}</div>`;
    }
    if (type === 'check') {
      return `<label class="switch-row" for="${id}"><span class="sw-text">${label}${help}</span><input type="checkbox" role="switch" class="switch" id="${id}" data-path="${path}"${v ? ' checked' : ''}${rr}></label>`;
    }
    if (type === 'multi') {
      const arr = Array.isArray(v) ? v : [];
      return `<div class="f"><span class="lbl">${label}</span><div class="choice">${opts.options.map(([val, l]) => `<label><input type="checkbox" data-multi="${path}" value="${esc(val)}"${arr.includes(val) ? ' checked' : ''}${rr}>${esc(l)}</label>`).join('')}</div>${help}</div>`;
    }
    if (type === 'textarea') return `<div class="f"><label for="${id}">${label}</label><textarea id="${id}" data-path="${path}" rows="${opts.rows || 2}">${esc(v)}</textarea>${help}</div>`;
    const ph = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : '';
    const im = type === 'number' ? ' inputmode="decimal"' : '';
    return `<div class="f"><label for="${id}">${label}</label><input id="${id}" type="${type === 'number' ? 'text' : type}"${im} data-path="${path}" value="${esc(v)}"${ph}${rr}>${help}</div>`;
  }

  function bindInputs(root, onRerender) {
    root.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.path && el.type !== 'checkbox' && el.type !== 'radio' && el.tagName !== 'SELECT') { Store.set(el.dataset.path, el.value); if (el.dataset.rerender) onRerender && onRerender(); }
    });
    root.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.multi) {
        const p = el.dataset.multi; const arr = new Set(Store.get(p) || []);
        el.checked ? arr.add(el.value) : arr.delete(el.value); Store.set(p, [...arr]);
      } else if (el.dataset.path) {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'radio' && (v === 'true' || v === 'false')) v = v === 'true';
        Store.set(el.dataset.path, v);
      } else return;
      if (el.dataset.rerender) onRerender && onRerender();
    });
  }

  // ============ ルーター ============
  const views = {};
  let cleanup = null;
  const TITLES = { home: '保育所申込（藤沢市）', facilities: '保育園をさがす', profile: 'マイ申請', score: '点数・保育料', forms: '申込書PDF', guide: '入園案内', terms: '利用規約', privacy: 'プライバシーポリシー', reader: 'QR読み取り（職員向け）' };
  const SUB_PAGES = ['guide', 'terms', 'privacy', 'reader'];
  function route() {
    let name = (location.hash || '#home').slice(1).split('?')[0];
    if (!views[name]) name = 'home';
    const view = views[name];
    $$('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + name));
    $('#appTitle').textContent = TITLES[name] || '保育所申込';
    document.body.dataset.view = name;
    document.body.classList.toggle('chat-mode', name === 'profile' && ((S().ui && S().ui.profileMode) || 'chat') === 'chat');
    $('#backBtn').hidden = !SUB_PAGES.includes(name);
    closeMenu();
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    const app = $('#app');
    const fresh = app.cloneNode(false); app.replaceWith(fresh); // 古いイベントリスナーを破棄
    cleanup = view(fresh) || null;
    window.scrollTo(0, 0);
  }

  // ============ ホーム ============
  views.home = el => {
    const s = S();
    const dl = Calc.deadlineFor(s.application.startMonth, s.application.aprilRound);
    const daysLeft = dl ? Math.ceil((new Date(dl.date + 'T23:59:59') - new Date()) / 86400000) : null;
    const filled = s.children.some(c => c.name || c.birth);
    const nWish = s.application.wishes.filter(w => w.id || w.name).length;
    const tile = (href, title, sub, ic) => `<a class="list-item" href="${href}"><span class="li-ic">${ic}</span><span class="li-body"><span class="li-title">${title}</span><span class="li-sub">${sub}</span></span><span class="li-chev" aria-hidden="true">›</span></a>`;
    el.innerHTML = `
      <div class="card deadline">
        <div class="stat-label">あなたの申込締切・${esc(dl ? dl.label.split('（')[0] : '未設定')}（必着）</div>
        <div class="stat date">${dl ? fmtDate(dl.date) : '—'}</div>
        <div>${daysLeft != null ? (daysLeft >= 0 ? `あと <strong>${daysLeft}</strong> 日（必着）` : '締切を過ぎています') : '<a href="#profile">入所希望月を設定</a>'}</div>
        <small class="muted">${esc(dl ? dl.note : '')}</small>
      </div>
      <h3 class="section-title">申込みの準備</h3>
      <div class="list">
        ${tile('#facilities', '1. 保育園をさがす', `地図から探して希望園に追加（${nWish}/10）`, '📍')}
        ${tile('#profile', '2. マイ申請を入力・必要書類', filled ? '入力あり・' + (s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('ja-JP') + ' 更新' : '') : '未入力', '📝')}
        ${tile('#score', '3. 点数・保育料を確認', '基礎点数・優先順位・保育料の目安', '📊')}
        ${tile('#forms', '4. 申込書PDFを作る', '市の様式に印字した画像PDF（コンビニ印刷向け）', '🖨️')}
        ${tile('#guide', '入園案内', '申込ナビの検索・要点・締切カレンダー・よくある質問', '📖')}
      </div>
      ${DISCLAIMER}
      <div class="grid cols-2">
        <div class="card"><div class="stat-label">4月1次 申込受付</div><div class="stat" style="font-size:1.3rem">2026/10/5〜10/23</div><div class="muted">郵送のみ・締切日必着（消印有効ではありません）</div><small>${pageLink(11)}</small></div>
        <div class="card"><h3>申込から入所までの流れ</h3>
          <ol class="steps">
            <li>希望園の決定・見学（家庭的保育事業は見学必須）</li>
            <li>申込書類の用意（別紙チェックリストで確認）</li>
            <li>期限内に提出（4月1次は郵送のみ）</li>
            <li>認定審査・利用調整（締切日が基準日）</li>
            <li>結果通知 → 内定なら面談・口座登録／保留なら翌月以降も審査</li>
          </ol><small>${pageLink(7, '申込ナビP7〜8')}</small></div>
      </div>`;
  };

  // ============ 入園案内 ============
  views.guide = el => {
    const s = S();
    const sec = (title, body, page) => `<details class="sec"><summary>${title}${page ? ` <small class="muted">P${page}</small>` : ''}</summary><div class="body">${body}${page ? `<p><small>原文：${pageLink(page)}</small></p>` : ''}</div></details>`;
    const classRows = R.classRanges.map(r => `<tr><td>${r.cls}歳児クラス</td><td>${r.cls === 0 ? '2026年4月2日以降生まれ' : `${r.from.replace(/-/g, '/')} 〜 ${r.to.replace(/-/g, '/')} 生まれ`}</td></tr>`).join('');
    const months = []; for (let i = 0; i < 12; i++) { const d = new Date(2027, 3 + i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    el.innerHTML = `
      <form class="searchbar guide-search" id="kform" role="search"><input type="search" id="kq" placeholder="申込ナビを検索（例：育休 点数、4月 締切）" aria-label="申込ナビをキーワード検索" autocomplete="off" value="${esc(window.__kq || '')}"></form>
      <div class="row ex-chips">${['4月1次 締切', '育休B', '保育料 計算', '必要書類', '見学', '転園', '求職中', '内定辞退'].map(x => `<button type="button" class="legend-chip" data-ex="${x}">${x}</button>`).join('')}</div>
      <div id="kresults"></div>
      <p>原本：<a href="${NAVI_PDF}" target="_blank" rel="noopener">ふじさわ認可保育施設 申込ナビ（PDF）</a> ／ <a href="docs/r9bessi_checklist.pdf" target="_blank" rel="noopener">申込書類チェックリスト（PDF）</a> ／ <a href="${R.officialUrl}" target="_blank" rel="noopener">申込書類のダウンロード（藤沢市HP）</a></p>
      <div class="note">以下は原本を要約したものです。要約の過程で誤りや省略がある可能性があります。<strong>必ず原本をご確認ください。</strong></div>
      <div class="card"><h3>締切日カレンダー</h3>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>入所月</th><th>申込締切（必着）</th><th>備考</th></tr></thead><tbody>
        ${[['2027-04', '1'], ['2027-04', '2']].concat(months.slice(1).map(m => [m, ''])).map(([m, r]) => { const d = Calc.deadlineFor(m, r); return `<tr><td>${esc(d.label)}</td><td>${fmtDate(d.date)}</td><td><small>${esc(d.note)}</small></td></tr>`; }).join('')}
        </tbody></table></div><small>5月以降の締切は「前々月末（土日祝は翌開庁日）」から計算しています。祝日は考慮していません。</small></div>
      ${sec('クラス年齢と保育の必要性の認定', `<table class="tbl"><tbody>${classRows}</tbody></table>
        <p>保育施設を利用するには、住民登録地の市区町村から「保育の必要性の認定」を受けます。0〜2歳は3号認定、3〜5歳は2号認定。保護者（原則父・母）が次のいずれかに該当する必要があります：①就労（月64時間以上）②妊娠・出産 ③疾病・障がい ④親族の介護・看護 ⑤災害復旧 ⑥求職活動（入所後2か月以内に就労） ⑦就学 ⑧その他市長が認める場合。</p>`, 1)}
      ${sec('保育の必要量（標準時間・短時間）と延長保育', `<ul><li><strong>保育標準時間</strong>：月120時間以上。1日最大11時間（7:00〜18:00）</li><li><strong>保育短時間</strong>：月64時間以上120時間未満。1日最大8時間（藤沢市内は8:30〜16:30）</li><li>例外：120時間未満でも実働が恒常的に13〜18時、又は通勤等で8時間以上保育できない場合は標準時間</li><li>時間を超える保育は延長保育（別途料金）。公立の延長保育料はC1〜C3：1,000円、C4〜C7：2,000円、C8〜C9：3,000円、C10以上：4,000円（標準時間・月額）</li></ul>`, 2)}
      ${sec('保育料（利用者負担額）', `<ul><li>父母の市区町村民税<strong>所得割額の合算</strong>で決定（父母とも非課税なら同居祖父母が対象）</li><li>2027年4〜8月分：令和8年度（2025年収入）、9月〜2028年3月分：令和9年度（2026年収入）の税額</li><li>きょうだいは同一生計なら施設・年齢を問わず数え、第1子満額・第2子半額・第3子以降0円</li><li>3歳児クラス以上は無償（給食食材料費・延長保育料は別途）</li><li>保育料は内定後に算定。目安は<a href="#score">点数・書類チェック</a>で試算できます</li></ul>`, 3)}
      ${sec('申込みができる方・申込方法', `<ul><li>藤沢市在住の方／藤沢市に転入予定の方／藤沢市で月64時間以上就労・就学している市外在住の方／湘南ライフタウン内の茅ヶ崎市堤地区（1〜110番地）の方</li><li>入所は必ず月の1日付。4月入所のみ1次・2次あり</li><li><strong>4月1次</strong>：2026/10/5〜10/23 郵送のみ（市内在住・市内施設希望）。受理通知は11/2までに発送、不足書類の追加提出は11/13まで、取下げは12/28まで</li><li><strong>4月2次</strong>：2027/2/8締切（4月1次に申込んでいない方のみ新規可）</li><li><strong>5月以降</strong>：前々月末締切。窓口・郵送・電子申請（e-kanagawa）</li><li>郵送先：〒251-8601 藤沢市朝日町1番地の1 藤沢市役所 保育課 入園担当 宛（返信用封筒・長3形に切手を貼って同封）</li></ul>`, 10)}
      ${sec('必要書類', `<p>全員：①申込書 ②児童調査書 ③保育の必要性を証明する書類 ④代表者の本人確認書類 ⑤同居家族全員のマイナンバー確認書類 ⑥誓約書・受理通知 ⑦返信用封筒。該当者のみ：⑧保育証明書 ⑨課税証明書 ⑩ひとり親書類 ⑪⑫転入書類 ⑬⑭保育士関係 ⑮生活保護 ⑯母子手帳コピー（出生前申込）。</p><p>あなたに必要な書類は<a href="#score">点数・書類チェック</a>で自動判定できます。</p><p class="note">消せるペン・鉛筆での記入、申込時点と内容が異なる書類、発行から3か月以上経過した書類（④⑤⑨⑩⑫⑭除く）は無効です。</p>`, 13)}
      ${sec('入所選考基準（点数）', `<p>父母それぞれの<strong>A-1基礎点数</strong>の低い方を採用し、<strong>A-2加算・減算</strong>を加えたものが基礎点数。同点の場合は B優先順位 → C調整項目 → 父母の所得の低い順 → 認可外等に預けている期間 → 待機期間 の順で比較。希望順位や申込順は影響しません。</p><table class="tbl"><tbody><tr><th>就労 月140h以上</th><td>10</td><th>就労内定 月140h以上</th><td>6</td></tr><tr><th>就労 月112h以上</th><td>9</td><th>就労内定 月64h以上</th><td>5</td></tr><tr><th>就労 月64h以上</th><td>8</td><th>就労内定 その他</th><td>4</td></tr><tr><th>就労 その他</th><td>7</td><th>求職中</th><td>3</td></tr><tr><th>出産</th><td>10</td><th>疾病（完全に不可能／常時困難／部分的）</th><td>12／10／8</td></tr><tr><th>ひとり親</th><td>11</td><th>災害復旧</th><td>12</td></tr></tbody></table><p>A-2：きょうだい在園園希望+2、保育士等として復職+6、育休B-30、内定辞退歴-2、市外在勤・契約書未提出-10、小規模卒園+5 など。詳しくは<a href="#score">点数チェック</a>で。</p>`, 17)}
      ${sec('育児休業中の申込み（育休A・育休B）', `<ul><li>入所後<strong>翌月15日まで</strong>に復職が必要</li><li>育休A：入所でき次第復職を希望</li><li>育休B：保留なら育休延長を許容（基礎点数-30点、藤沢市民・転入予定者のみ）</li><li>きょうだい1人だけ入所でも父母ともに翌月15日までの復職が必要</li></ul>`, 20)}
      ${sec('注意事項（見学・転園・出生前・きょうだい）', `<ul><li>家庭的保育事業は見学必須（未見学は審査対象外）。アレルギー・持病等がある場合も事前相談必須</li><li>利用調整の基準日は各申込締切日</li><li>転園：入所6か月以内は新規入所希望者が優先。転園内定後は辞退不可</li><li>出生前申込み：令和9年4月入所のみ、2027年3月1日までに出産予定の方</li><li>きょうだい同時申込みは申込書の「きょうだいの申込み条件」を必ず選択（未記入は同時期同園希望扱い）</li></ul>`, 19)}
      ${sec('内定後・入所後', `<ul><li>内定園と面談（児童同伴）。内定月前月末日までに面談がない場合は内定取消の場合あり</li><li>保育料は口座振替（毎月末日）</li><li>ならし保育：入所日から概ね2〜3週間</li><li>求職中・内定中：入所から2か月以内に月64時間以上の就労開始</li><li>内定辞退：全施設の申込みが取下げ。再申込みは3年度、基礎点数-2点</li></ul>`, 22)}
      ${sec('よくある質問', (window.FAQ || []).map(f => `<p><strong>Q. ${esc(f.q)}</strong><br>A. ${esc(f.a)} <small>${pageLink(f.page, 'P' + f.page)}</small></p>`).join(''), 23)}
      ${sec('その他の事業（一時預かり・休日保育・病児保育など）', `<ul><li>一時預かり：4時間以内1,200円／8時間以内2,400円（原則週3日以内）</li><li>休日保育：認可施設利用児童対象・0円（キディ鵠沼・藤沢、キディ湘南C-X、どれみチャイルドくらぶ にじ）</li><li>病児保育2,000円/日・病後児保育1,500円/日</li><li>こども誰でも通園制度：0歳6か月〜3歳未満、300円/時間</li><li>予約は藤沢市特別保育予約システム https://fujisawa.hoiku.michi-shiru.jp/</li></ul>`, 25)}
      ${sec('相談窓口', `<p>${esc(R.contact)}</p><p>保育コンシェルジュ（予約制・ふじまどでオンライン予約、電話相談可）。</p>`, 24)}
    `;
    // キーワード検索
    const highlight = (text, q) => { let h = esc(text); Search.terms(q).forEach(t => { h = h.split(esc(t)).join(`<mark>${esc(t)}</mark>`); }); return h; };
    const run = q => {
      window.__kq = q; $('#kq', el).value = q;
      const box = $('#kresults', el);
      if (!q.trim()) { box.innerHTML = ''; return; }
      const hits = Search.search(q);
      box.innerHTML = `<div class="card kres"><div class="row" style="justify-content:space-between"><strong>「${esc(q)}」の検索結果 ${hits.length}件</strong><button type="button" class="btn small" id="kclear">閉じる</button></div>`
        + (hits.length ? hits.map(h => `<div class="hit"><div class="src">${h.doc.kind === 'faq' ? 'Q&A（要約）' : '申込ナビ本文'}・P${h.doc.page}「${esc(h.doc.title)}」 ${pageLink(h.doc.page, '原文を開く')}</div><pre>${highlight(h.doc.text.normalize('NFKC'), q)}</pre></div>`).join('') : '<p>該当する記載が見つかりませんでした。言い換えるか、保育課（0466-50-3526）へお問い合わせください。</p>')
        + '<p class="sheet-note">キーワードの一致で探しています。要約Q&Aは原本を要約したもので、正確性は保証しません。必ず原文で確認してください。</p></div>';
    };
    $('#kform', el).onsubmit = e => { e.preventDefault(); $('#kq', el).blur(); run($('#kq', el).value); };
    el.addEventListener('click', e => {
      const ex = e.target.closest('[data-ex]'); if (ex) run(ex.dataset.ex);
      if (e.target.closest('#kclear')) run('');
    });
    if (window.__kq) run(window.__kq);
  };

  // ============ 点数・書類チェック ============
  views.score = el => {
    const s = S();
    const r = Calc.score(s);
    const need = Calc.needAmount(s);
    const issues = Calc.validate(s);
    const firstWish = s.application.wishes.find(w => w.id);
    const famType = id => { const f = (window.FACILITIES || []).find(f => String(f.id) === String(id)); return f && f.type === '家庭的保育事業' ? 'family' : 'nursery'; };
    const order0 = Math.max(1, +s.household.childOrder || 1);
    const feeRows = s.children.map((c, i) => {
      const f = Calc.fee(s, c, famType(firstWish && firstWish.id), order0 + i);
      return `<div class="fee-row"><div><strong>${esc(childLabel(c, i))}</strong><div class="muted" style="font-size:.875rem">${f.cls != null ? (f.cls >= 6 ? '就学' : f.cls + '歳児クラス') : '—'}・第${order0 + i}子${f.tier ? '・' + f.tier + '階層' : ''}</div>${f.msg ? `<div class="muted" style="font-size:.8125rem">${esc(f.msg)}</div>` : ''}</div><div class="fee-amt">${f.ok ? yen(f.amount) : '—'}${f.ok && f.ext != null && f.amount > 0 ? `<small>公立延長 ${yen(f.ext)}</small>` : ''}</div></div>`;
    }).join('');
    el.innerHTML = `
      <p class="muted">「<a href="#profile">マイ申請</a>」の内容から自動で計算します。入力を変えると結果も変わります。</p>
      ${DISCLAIMER}
      ${r.warnings.length ? `<div class="note">${r.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="grid cols-3">
        <div class="card"><div class="stat-label">① 基礎点数（A-1＋A-2）</div><div class="stat">${r.base ?? '—'}<small style="font-size:1rem"> 点</small></div><div class="muted">A-1 ${r.a1 ?? '—'} ／ A-2 ${r.a2 >= 0 ? '+' : ''}${r.a2}</div></div>
        <div class="card"><div class="stat-label">② B 優先順位</div><div class="stat">${r.priority ? r.priority.code : '—'}</div><div class="muted">${r.priority ? esc(r.priority.label) : ''}（A が最優先、K が最下位）</div></div>
        <div class="card"><div class="stat-label">③ C 調整項目点数</div><div class="stat">${r.c}<small style="font-size:1rem"> 点</small></div><div class="muted">同点時の比較に使用</div></div>
      </div>
      <div class="grid cols-2">
        <div class="card"><h3>計算の内訳</h3>
          <h4>A-1 基礎点数（基本）</h4><ul>${r.lines.a1.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
          <h4>A-2 加算・減算</h4><ul>${r.lines.a2.length ? r.lines.a2.map(l => `<li>${esc(l)}</li>`).join('') : '<li>該当なし</li>'}</ul>
          <h4>C 調整項目</h4><ul>${r.lines.c.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
          <small>同点の場合 ④父母の所得の低い順 ⑤認可外等に預けている期間 ⑥待機期間 の順で比較されます。${pageLink(17, '選考基準 P17〜18')}</small>
        </div>
        <div class="card"><h3>保育の必要量</h3><p><strong>${need ? esc(need.label) : '—'}</strong></p><p class="muted">${need ? esc(need.note) : ''}</p>
          <h3>保育料の目安（月額）</h3>
          <div class="fee-list">${feeRows}</div>
          <small>所得割額：${esc(s.household.shotokuwari || '未入力')}円。${firstWish ? `第1希望（${esc(firstWish.name || firstWish.id)}）の施設類型で計算。` : '施設類型は認可保育所として計算。'}2027年9月以降は令和9年度の税額で再算定されます。給食食材料費・延長保育料等は別途。${pageLink(6, '保育料表 P6')}</small>
        </div>
      </div>
      <div class="card"><h3>入力内容のチェック</h3>
        ${issues.length ? `<ul class="issues">${issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>簡易チェックで問題は見つかりませんでした（すべてを確認できるわけではありません）。</p>'}
      </div>
      <div class="card"><h3>必要書類</h3><p>あなたに必要な書類は「<a href="#profile" onclick="Store.set('ui.profileMode','docs')">マイ申請 → 📎 必要書類</a>」で確認できます。</p></div>`;
  };

  // ============ 保育園検索（全画面地図） ============
  const TYPE_STYLE = [
    { type: '公立', color: '#0017c1', licensed: true },
    { type: '法人立', color: '#197a4b', licensed: true },
    { type: '小規模保育事業', label: '小規模', color: '#e25100', licensed: true },
    { type: '家庭的保育事業', label: '家庭的', color: '#c2185b', licensed: true },
    { type: '認定こども園', label: 'こども園', color: '#7b1fa2', licensed: true },
    { type: '藤沢型保育室A型', label: '藤沢型A', color: '#927200', licensed: false },
    { type: '藤沢型保育室C型', label: '藤沢型C', color: '#7a6000', licensed: false },
    { type: 'その他の私設保育施設', label: '私設', color: '#767676', licensed: false },
  ];
  const typeStyle = t => TYPE_STYLE.find(x => x.type === t) || { type: t, color: '#767676', licensed: false };

  views.facilities = el => {
    const s = S();
    const F = (window.FACILITIES || []).filter(f => f.lat && f.lng);
    const st = window.__facFilter = Object.assign({ q: '', hidden: TYPE_STYLE.filter(t => !t.licensed).map(t => t.type) }, window.__facFilter || {});
    const child = s.children.find(c => c.birth);
    const childCls = child ? Calc.classAge(child.birth) : null;
    const startDate = (s.application.startMonth || '2027-04') + '-01';
    const types = TYPE_STYLE.filter(t => F.some(f => f.type === t.type));
    el.classList.add('map-view');
    el.innerHTML = `
      <div id="map" class="map-full" aria-label="保育施設の地図"><p class="muted" style="padding:16px">地図を読み込み中…（インターネット接続が必要です）</p></div>
      <div class="map-overlay">
        <div class="searchbar"><input type="search" id="fq" value="${esc(st.q)}" placeholder="園名・住所・番号でさがす" aria-label="キーワード" autocomplete="off"></div>
        <div class="legend" role="group" aria-label="施設種別の表示切り替え">${types.map(t => `<button type="button" class="legend-chip${st.hidden.includes(t.type) ? ' off' : ''}" data-type="${esc(t.type)}" aria-pressed="${!st.hidden.includes(t.type)}"><span class="dot" style="background:${t.color}"></span>${esc(t.label || t.type)}</button>`).join('')}</div>
        <div class="map-count" id="count"></div>
      </div>
      <div class="sheet" id="sheet" hidden></div>`;

    let map = null, layer = null, selected = null;
    const markers = new Map();
    const isFav = f => (S().favorites || []).includes(f.id ?? f.name);
    const keyOf = f => String(f.id ?? f.name);

    function visible() {
      const q = st.q.normalize('NFKC').toLowerCase();
      return F.filter(f => !st.hidden.includes(f.type) && (!q || `${f.id ?? ''} ${f.name} ${f.addr}`.normalize('NFKC').toLowerCase().includes(q)));
    }
    function draw(fit) {
      if (!layer) return;
      layer.clearLayers(); markers.clear();
      const list = visible();
      list.forEach(f => {
        const ts = typeStyle(f.type);
        const m = L.circleMarker([f.lat, f.lng], { bubblingMouseEvents: false, radius: 9, weight: 2, color: '#fff', fillColor: ts.color, fillOpacity: .95 }).addTo(layer);
        m.on('click', () => openSheet(f));
        m.bindTooltip(f.name, { direction: 'top', offset: [0, -8] });
        markers.set(keyOf(f), m);
      });
      $('#count', el).textContent = `${list.length}件を表示中`;
      if (fit && list.length) map.fitBounds(list.map(f => [f.lat, f.lng]), { padding: [40, 40], maxZoom: 16 });
      if (selected) highlight(selected);
    }
    function highlight(f) {
      markers.forEach(m => m.setStyle({ radius: 9, weight: 2, color: '#fff' }));
      const m = markers.get(keyOf(f)); if (m) { m.setStyle({ radius: 13, weight: 4, color: '#1a1a1a' }); m.bringToFront(); }
    }
    function sheetHTML(f) {
      const ts = typeStyle(f.type);
      const caps = f.cap ? `<div class="caps">${f.cap.map((c, i) => `<span class="${c ? 'on' : ''}${i === childCls ? ' me' : ''}">${i}歳 ${c || '-'}</span>`).join('')}</div>` : (f.total ? `<div class="caps"><span class="on">${f.classes.length ? f.classes[0] + '〜' + f.classes[f.classes.length - 1] + '歳' : ''} 定員${f.total}</span></div>` : '');
      let fit = '';
      if (child && f.licensed && f.id) {
        const a = Calc.ageAt(child.birth, startDate);
        const okCls = f.classes.includes(childCls), okAge = !(f.minDays && a && a.days < f.minDays);
        fit = `<div class="fit ${okCls && okAge ? 'ok' : 'ng'}">${esc(childLabel(child, 0))}（${childCls}歳児クラス）：${!okCls ? 'このクラスの受入なし' : !okAge ? '入所時点で受入月齢に達しない可能性' : '受入クラスあり'}</div>`;
      }
      const inWish = f.id && S().application.wishes.some(w => String(w.id) === String(f.id));
      return `<div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-head"><span class="dot big" style="background:${ts.color}"></span><div class="sheet-title">${f.id ? `<span class="pill accent">${f.id}</span>` : ''}${esc(f.name)}</div>
          <button class="star${isFav(f) ? ' on' : ''}" data-fav="${esc(keyOf(f))}" aria-label="お気に入り">${isFav(f) ? '★' : '☆'}</button>
          <button class="icon-btn" data-close aria-label="閉じる">✕</button></div>
        <div><span class="pill">${esc(f.type)}</span>${f.area ? `<span class="pill">${esc(f.area)}</span>` : ''}${f.transfer && f.licensed ? '<span class="pill warn">卒園後転園が必要</span>' : ''}${f.type === '家庭的保育事業' ? '<span class="pill warn">見学必須</span>' : ''}${f.notInNavi ? '<span class="pill warn">R9申込ナビ未掲載</span>' : ''}</div>
        ${fit}
        <div class="meta">${esc(f.addr)}${f.tel ? `<br><a href="tel:${esc(f.tel.replace(/[^0-9]/g, ''))}">${esc(f.tel)}</a>` : ''}</div>
        ${caps}
        ${f.licensed && f.id ? `<div class="meta">受入：${esc(f.minAge || '—')} ／ 駐車場：${esc(f.parking || '—')}${f.times.length ? '<br>預かり時間（PDF記載）：' + esc(f.times.join('、')) : ''}${f.notes.length ? '<br>' + esc(f.notes.join(' ')) : ''}</div>` : ''}
        ${f.remark ? `<div class="meta warn-text">${esc(f.remark)}</div>` : ''}
        <div class="sheet-actions">
          ${f.licensed && f.id ? `<button class="btn primary" data-wish="${f.id}"${inWish ? ' disabled' : ''}>${inWish ? '希望園に追加済み' : '＋ 希望園に追加'}</button>` : ''}
          ${f.url ? `<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">施設HP</a>` : ''}
          <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.lat + ',' + f.lng)}" target="_blank" rel="noopener">経路・地図アプリ</a>
        </div>
        <p class="sheet-note">施設情報は申込ナビからの自動抽出で、誤りがあり得ます。空き状況は分かりません。必ず${pageLink(30, '原本')}と施設に確認してください。</p>`;
    }
    function openSheet(f) {
      selected = f; highlight(f);
      const sh = $('#sheet', el); sh.innerHTML = sheetHTML(f); sh.hidden = false;
      map.panTo([f.lat, f.lng], { animate: true });
    }
    function closeSheet() { selected = null; $('#sheet', el).hidden = true; markers.forEach(m => m.setStyle({ radius: 9, weight: 2, color: '#fff' })); }

    const ensureLeaflet = () => new Promise((res, rej) => {
      if (window.L) return res();
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
      const js = document.createElement('script'); js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; js.onload = res; js.onerror = rej; document.head.appendChild(js);
    });
    ensureLeaflet().then(() => {
      const box = $('#map', el); if (!box) return; box.innerHTML = '';
      map = L.map(box, { zoomControl: false, tap: true }).setView([35.365, 139.47], 12);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      layer = L.layerGroup().addTo(map);
      map.on('click', closeSheet);
      draw(true);
    }).catch(() => { const box = $('#map', el); if (box) box.innerHTML = '<p class="muted" style="padding:16px">地図を読み込めませんでした（オフライン等）。インターネット接続を確認してください。</p>'; });

    let qTimer;
    el.addEventListener('input', e => { if (e.target.id === 'fq') { clearTimeout(qTimer); qTimer = setTimeout(() => { st.q = e.target.value; draw(true); }, 250); } });
    el.addEventListener('click', e => {
      const chip = e.target.closest('.legend-chip');
      if (chip) {
        const t = chip.dataset.type; const i = st.hidden.indexOf(t);
        i >= 0 ? st.hidden.splice(i, 1) : st.hidden.push(t);
        chip.classList.toggle('off', st.hidden.includes(t)); chip.setAttribute('aria-pressed', String(!st.hidden.includes(t)));
        if (selected && st.hidden.includes(selected.type)) closeSheet();
        draw(false); return;
      }
      if (e.target.closest('[data-close]')) { closeSheet(); return; }
      const fav = e.target.closest('[data-fav]');
      if (fav && selected) {
        const key = selected.id ?? selected.name; const favs = new Set(S().favorites || []);
        favs.has(key) ? favs.delete(key) : favs.add(key); Store.set('favorites', [...favs]); openSheet(selected); return;
      }
      const wish = e.target.closest('[data-wish]');
      if (wish && selected) {
        const ws = S().application.wishes; const i = ws.findIndex(w => !w.id && !w.name);
        if (i < 0) { toast('希望園は10園までです'); return; }
        ws[i] = { ...Store.emptyWish(), id: String(selected.id), name: selected.name }; Store.save();
        toast(`第${i + 1}希望に「${selected.name}」を追加しました`); openSheet(selected);
      }
    });
    return () => { if (map) map.remove(); };
  };

  // ============ 帳票作成 ============
  views.forms = el => {
    const s = S();
    const issues = Calc.validate(s);
    el.innerHTML = `
      <p class="muted">「<a href="#profile">マイ申請</a>」の内容を、藤沢市の公式様式（令和9年度）の画像に印字したPDFを作成します。文字を画像に焼き込んだ「画像PDF」なので、コンビニのマルチコピー機などでそのまま印刷できます（A4・等倍で印刷してください）。</p>
      <div class="note"><strong>必ずお読みください</strong><br>
      ・本機能は非公式です。印字位置のずれ・転記漏れ・様式の改訂などにより、<strong>そのまま提出できる保証はありません</strong>。印刷後に全項目を目視確認し、不足は手書きで補ってください。<br>
      ・様式は2026年10月5日時点で藤沢市HPに掲載されていたものです。最新の様式は<a href="${R.officialUrl}" target="_blank" rel="noopener">藤沢市HP</a>で確認してください。<br>
      ・<strong>マイナンバー、保護者署名、誓約書のチェック欄は印字しません</strong>。内容を読んだうえでご自身で記入してください。<br>
      ・就労証明書・診断書など、勤務先・医療機関が記入する書類は作成できません。<br>
      ・消せるペン（フリクション等）での追記は無効です。</div>
      ${issues.length ? `<div class="card"><h3>入力チェック（${issues.length}件）</h3><ul class="issues">${issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul><a class="btn small" href="#profile">入力を修正する</a></div>` : ''}
      <div class="card no-print">
        <h3>作成する書類</h3>
        <div class="choice">
          <label><input type="checkbox" name="fk" value="mousikomi" checked>教育・保育給付認定申請書 兼 保育施設利用申込書（4ページ）</label>
          <label><input type="checkbox" name="fk" value="chosa" checked>保育施設利用申込みの児童調査書（児童ごと2ページ）</label>
          <label><input type="checkbox" name="fk" value="jyuri" checked>誓約書・保育施設利用申込受理通知（2ページ）</label>
          <label><input type="checkbox" name="fk" value="qrsheet" checked>データ連携用シート（QRコード・1ページ）<span class="help">市の様式ではない追加の1枚です。申込内容をQRコードにして、職員がデータとして読み取れるようにします。</span></label>
        </div>
        <details style="margin-top:8px"><summary>印字位置の微調整（プリンタでずれる場合）</summary>
          <div class="fields" style="margin-top:8px">${field('formOffset.x', '横方向（pt、＋で右へ）', 'number')}${field('formOffset.y', '縦方向（pt、＋で下へ）', 'number')}</div>
          <label class="choice"><input type="checkbox" id="grid"> プレビューに座標グリッドを表示（PDFには出ません）</label>
        </details>
        <div class="row" style="margin-top:10px"><button class="btn" id="prev">プレビュー</button><button class="btn primary" id="pdf">PDFをダウンロード</button></div>
        <div id="fstatus" class="muted"></div>
      </div>
      <div id="preview" class="preview"></div>`;
    bindInputs(el);
    const keys = () => $$('input[name=fk]:checked', el).map(i => i.value);
    const ready = () => { if (!window.FORM_BG) { toast('様式画像を読み込み中です。少し待ってから再度お試しください'); return false; } return true; };
    async function render(grid) {
      const out = [];
      for (const k of keys()) out.push(...await Forms.renderForm(k, S(), { grid }));
      return out;
    }
    $('#prev', el).onclick = async () => {
      if (!ready()) return;
      $('#fstatus', el).textContent = '作成中…';
      const pages = await render($('#grid', el).checked);
      const pv = $('#preview', el); pv.innerHTML = '';
      pages.forEach((p, i) => { const fig = document.createElement('figure'); fig.appendChild(p.canvas); const cap = document.createElement('figcaption'); cap.textContent = `${i + 1}. ${p.label}`; fig.appendChild(cap); pv.appendChild(fig);
        p.canvas.onclick = () => { const z = document.createElement('div'); z.className = 'zoom'; const c = p.canvas.cloneNode(); c.getContext('2d').drawImage(p.canvas, 0, 0); z.appendChild(c); z.onclick = () => z.remove(); document.body.appendChild(z); }; });
      $('#fstatus', el).textContent = `${pages.length}ページ。画像をクリックで拡大。`;
    };
    $('#pdf', el).onclick = async () => {
      if (!ready()) return;
      if (!confirm('作成したPDFは非公式ツールによるもので、正確性は保証されません。印刷後に必ず内容を確認し、マイナンバー・署名・誓約書のチェックはご自身で記入してください。\n\nダウンロードしますか？')) return;
      $('#fstatus', el).textContent = 'PDFを作成中…';
      try {
        const pages = await render(false);
        await Forms.toPDF(pages.map(p => p.canvas), `保育施設申込書類_${today()}.pdf`);
        $('#fstatus', el).textContent = 'ダウンロードしました。A4・等倍（拡大縮小なし）で印刷してください。';
      } catch (err) { $('#fstatus', el).textContent = err.message; }
    };
  };

  // ============ マイ申請 ============

  // ============ 必要書類（マイ申請のタブ） ============
  function docsView(el) {
    const docs = Calc.documents(S());
    const checked = S().checklist || {};
    const docSum = () => { const ck = S().checklist || {}; const need = docs.filter(d => d.needed); const done = need.filter(d => ck[d.name]).length; return `<p><strong>あなたに必要：${need.length}件</strong>（準備済み ${done}件） ／ <span class="muted">不要：${docs.length - need.length}件（二重線）</span></p><div class="chat-progress"><div style="width:${need.length ? Math.round(done / need.length * 100) : 0}%"></div></div>`; };
    const box = document.createElement('div');
    box.innerHTML = `
      <div class="card"><h3>必要書類（目安）</h3>
        <div id="docSum">${docSum()}</div>
        <p class="muted" style="font-size:.875rem">チェックを入れると準備状況を保存できます。🌟は不足・未記入だと受付できない場合がある書類です。二重線の書類は、いまの入力内容では不要と判定したものです（入力が変われば必要になる場合があります）。</p>
        <label class="switch-row"><span class="sw-text">不要な書類をかくす</span><input type="checkbox" role="switch" class="switch" id="hideOff"${S().ui && S().ui.hideUnneeded ? ' checked' : ''}></label>
        ${[...new Set(docs.map(d => d.group))].map(g => `<h4 class="doc-group">${esc(g)}</h4><ul class="doc-list">${docs.filter(d => d.group === g).map(d => d.needed
          ? `<li><input type="checkbox" data-doc="${esc(d.name)}"${checked[d.name] ? ' checked' : ''} aria-label="${esc(d.name)}"><div><div>${d.star ? '🌟 ' : ''}${esc(d.name)}${d.form ? ' <a class="pill accent" href="#forms">PDF作成可</a>' : ''}</div><div class="why">${esc(d.why)}</div></div></li>`
          : `<li class="doc-off"${S().ui && S().ui.hideUnneeded ? ' hidden' : ''}><span class="off-mark" aria-hidden="true">不要</span><div><div class="off-name"><span class="visually-hidden">不要：</span>${esc(d.name)}</div><div class="why">${d.info ? '' : '必要になるのは：'}${esc(d.why)}</div></div></li>`).join('')}</ul>`).join('')}
        <p><small>根拠：${pageLink(13, '必要書類一覧 P13〜16')}。提出前に<a href="docs/r9bessi_checklist.pdf" target="_blank" rel="noopener">申込書類チェックリスト（別紙）</a>も必ず確認してください。様式は<a href="${R.officialUrl}" target="_blank" rel="noopener">藤沢市HP</a>からダウンロードできます。</small></p>
      </div>`;
    el.appendChild(box);
    box.addEventListener('change', e => {
      if (e.target.id === 'hideOff') { Store.set('ui.hideUnneeded', e.target.checked); $$('.doc-off', box).forEach(li => (li.hidden = e.target.checked)); return; }
      const k = e.target.dataset.doc; if (k == null) return; const c = { ...(S().checklist || {}) }; c[k] = e.target.checked; Store.set('checklist', c); $('#docSum', box).innerHTML = docSum();
    });
  }

  const modeTabs = mode => `<div class="mode-tabs" role="tablist" aria-label="マイ申請の表示">${[['chat', '💬 チャット'], ['form', '📋 フォーム'], ['docs', '📎 必要書類']].map(([k, l]) => `<button role="tab" data-mode="${k}" aria-selected="${mode === k}"${mode === k ? ' class="on"' : ''}>${l}</button>`).join('')}</div>`;
  views.profile = el => {
    const mode = (S().ui && S().ui.profileMode) || 'chat';
    el.addEventListener('click', e => {
      const m = e.target.closest('[data-mode]'); if (!m || m.dataset.mode === mode) return;
      Store.set('ui.profileMode', m.dataset.mode); route();
    });
    if (mode === 'docs') {
      el.innerHTML = modeTabs('docs');
      docsView(el);
      return;
    }
    if (mode === 'chat') {
      el.innerHTML = modeTabs('chat') + '<div id="chatRoot" class="chat"></div>';
      Chat.mount($('#chatRoot', el));
      return;
    }
    let openSet = new Set(window.__openSecs || ['app']);
    const render = () => {
      const y = window.scrollY;
      openSet = new Set($$('details.sec[open]', el).map(d => d.dataset.sec).concat(el.childElementCount ? [] : [...openSet]));
      window.__openSecs = [...openSet];
      el.innerHTML = profileHTML(openSet);
      window.scrollTo(0, y);
    };
    el.innerHTML = profileHTML(openSet);
    bindInputs(el, render);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const s = S();
      const act = b.dataset.act, i = +b.dataset.i;
      if (act === 'addChild') { if (s.children.length >= 3) return toast('申込書に記入できる児童は3人までです'); s.children.push(Store.emptyChild()); Store.save(); render(); }
      if (act === 'delChild') { if (!confirm('この児童の情報を削除しますか？')) return; s.children.splice(i, 1); if (!s.children.length) s.children.push(Store.emptyChild()); Store.save(); render(); }
      if (act === 'addMember') { if (s.members.length >= 4) return toast('申込書の世帯欄は代表者・配偶者を含め6人までです'); s.members.push(Store.emptyMember()); Store.save(); render(); }
      if (act === 'delMember') { s.members.splice(i, 1); Store.save(); render(); }
      if (act === 'clearWish') { const w = s.application.wishes; w.splice(i, 1); w.push(Store.emptyWish()); Store.save(); render(); }
      if (act === 'upWish' && i > 0) { const w = s.application.wishes; [w[i - 1], w[i]] = [w[i], w[i - 1]]; Store.save(); render(); }
      if (act === 'downWish') { const w = s.application.wishes; if (w[i + 1] && (w[i + 1].id || w[i + 1].name)) { [w[i + 1], w[i]] = [w[i], w[i + 1]]; Store.save(); render(); } }
      if (act === 'export') { const blob = new Blob([Store.exportJSON()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `保育所申込_マイ情報_${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
      if (act === 'import') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.onchange = async () => { try { Store.importJSON(await inp.files[0].text()); toast('読み込みました'); render(); } catch (err) { alert('読み込めませんでした：' + err.message); } }; inp.click(); }
      if (act === 'reset') { if (confirm('この端末に保存されたマイ情報をすべて削除します。よろしいですか？')) { Store.reset(); toast('削除しました'); render(); } }
      if (act === 'today') { Store.set('application.writtenDate', today()); render(); }
    });
    // 希望園の追加（番号・名前の候補から選択）
    el.addEventListener('change', e => {
      if (!e.target.matches('#wishPick')) return;
      const v = e.target.value.normalize('NFKC').trim(); if (!v) return;
      const num = (v.match(/^(\d+)/) || [])[1];
      const F = (window.FACILITIES || []).filter(f => f.licensed && f.id);
      const f = num ? F.find(f => String(f.id) === num) : F.find(f => f.name.normalize('NFKC') === v);
      const ws = S().application.wishes;
      const i = ws.findIndex(w => !w.id && !w.name);
      if (i < 0) { toast('希望園は10園までです'); return; }
      if (f && ws.some(w => String(w.id) === String(f.id))) { toast('すでに追加されています'); e.target.value = ''; return; }
      ws[i] = { ...Store.emptyWish(), id: f ? String(f.id) : '', name: f ? f.name : v };
      Store.save(); toast(`第${i + 1}希望に追加しました`); render();
    });
  };

  function profileHTML(openSet) {
    const s = S(), h = s.household, app = s.application;
    const sec = (key, title, body) => `<details class="sec" data-sec="${key}"${openSet.has(key) ? ' open' : ''}><summary>${title}</summary><div class="body">${body}</div></details>`;
    const parentHTML = (k, label) => {
      const p = s[k]; const P = k + '.';
      const reasonOpts = [['work', '就労（育休中含む）'], ['offer', '就労内定'], ['seeking', '求職活動'], ['study', '就学'], ['illness', '疾病・負傷'], ['disability', '心身の障がい'], ['care', '親族の介護・看護'], ['birth', '出産'], ['disaster', '災害復旧'], ['other', 'その他（児童相談所の通知等）']];
      let body = field(P + 'present', `${label}がいる（同一生計・申込書に記入する）`, 'check', { rerender: true });
      if (!p.present) return body;
      body += `<div class="fields">${field(P + 'name', '氏名', 'text', { placeholder: '藤沢 太郎' })}${field(P + 'kana', 'ふりがな', 'text', { placeholder: 'ふじさわ たろう' })}${field(P + 'birth', '生年月日', 'date')}${field(P + 'phone', '携帯電話番号', 'tel')}${field(P + 'workplace', '勤務先・就学先（世帯の状況欄）', 'text')}</div>`;
      body += field(P + 'cohabit', '児童と同居している', 'check');
      body += field(P + 'reason', '保育の必要性事由', 'select', { options: reasonOpts, rerender: true });
      if (['work', 'offer', 'study', 'care'].includes(p.reason)) body += field(P + 'hours', '月の就労（就学・介護）時間', 'number', { help: '休憩・通勤時間を除いた雇用契約上の時間。例：週5日×1日8時間≒月160時間', placeholder: '160' });
      if (['work', 'offer'].includes(p.reason)) {
        body += `<div class="fields">${field(P + 'employer', '就労先 名称', 'text')}${field(P + 'employerAddr', '就労先 住所', 'text')}${field(P + 'employStart', '就労証明書上の雇用開始日', 'date')}</div>`;
        body += field(P + 'startOnEntry', '保育施設に入所でき次第直ちに就労開始', 'check');
        body += field(P + 'ikukyu', '育児休業を取得中（又は取得予定）', 'check', { rerender: true });
        if (p.ikukyu) body += `<div class="fields">${field(P + 'ikukyuFrom', '育休 開始日', 'date')}${field(P + 'ikukyuTo', '育休 終了（予定）日', 'date')}</div>`;
        body += field(P + 'selfEmployed', '会社勤めではない（自営業・個人事業主・専従者・業務委託など）', 'check');
        body += field(P + 'executiveSelfCert', '会社役員・代表で、就労証明書の証明者が自分自身', 'check');
        body += field(P + 'spouseCompany', '配偶者が経営する会社で就労し、証明者が配偶者', 'check');
        body += field(P + 'nurseryJob', '入所に伴い市内の認可保育施設・藤沢型認定保育施設・幼稚園で', 'select', { options: [['none', '該当しない'], ['teacher', '保育士・幼稚園教諭として復職／就労開始（+6点）'], ['assistant', '保育補助者として復職／就労開始（+2点）']] });
      }
      if (p.reason === 'seeking') body += field(P + 'seekingPlan', '入所できなかった場合の求職活動の予定', 'select', { options: [['pause', '一旦休止し、入所が決まり次第開始'], ['continueHW', '継続（定期的にハローワーク等に通う）'], ['continueHome', '継続（主に自宅で）'], ['stop', '完全に取りやめる']], rerender: true }) + (p.seekingPlan === 'continueHW' ? field(P + 'seekingPerWeek', '週の回数', 'number') : '');
      if (p.reason === 'study') body += `<div class="fields">${field(P + 'schoolName', '就学先 名称', 'text')}${field(P + 'schoolAddr', '就学先 住所', 'text')}${field(P + 'schoolFrom', '就学期間 開始', 'date')}${field(P + 'schoolTo', '就学期間 終了', 'date')}</div>`;
      if (p.reason === 'illness') body += field(P + 'illnessLevel', '程度', 'select', { options: [['full', '保育が完全に不可能（12点）'], ['daytime', '日中常時の保育が困難（10点）'], ['partial', '保育が部分的に困難（8点）']] }) + field(P + 'illnessName', '病名', 'text');
      if (p.reason === 'disability') body += field(P + 'disabilityLevel', '程度', 'select', { options: [['severe', '身体1〜2級・精神1〜3級・療育手帳で常時保育困難（10点）'], ['grade3', '身体3級（8点）'], ['grade4', '身体4級以下（7点）']] }) + field(P + 'illnessName', '障がい名', 'text');
      if (p.reason === 'care') body += `<div class="fields">${field(P + 'careTarget', '被介護（看護）者 氏名', 'text')}${field(P + 'careRelation', '続柄', 'text')}</div>`;
      return body;
    };
    const childHTML = (c, i) => {
      const P = `children.${i}.`, v = c.survey, V = P + 'survey.';
      return `<div class="subcard"><div class="head"><strong>申込児童 ${i + 1}</strong>${s.children.length > 1 ? `<button class="btn small danger" data-act="delChild" data-i="${i}">削除</button>` : ''}</div>
        <div class="fields">${field(P + 'name', '氏名', 'text')}${field(P + 'kana', 'ふりがな', 'text')}${field(P + 'birth', '生年月日', 'date', { rerender: true, help: c.birth ? `${Calc.classAge(c.birth) ?? '?'}歳児クラス（令和9年度）` : '' })}${field(P + 'sex', '性別', 'radio', { options: [['male', '男'], ['female', '女']] })}</div>
        ${field(P + 'unborn', '出生前の申込み（4月入所のみ可能）', 'check')}
        ${field(P + 'status', '児童の状況', 'select', { options: [['none', '家庭で保育'], ['licensed', '認可保育施設在園（転園申請）'], ['unlicensed', '認可外・幼稚園在園'], ['temporary', '一時預かり利用'], ['ikukyu', '育休中'], ['other', 'その他']], rerender: true })}
        ${['licensed', 'unlicensed', 'temporary', 'other'].includes(c.status) ? field(P + 'statusName', '施設名・内容', 'text') : ''}
        ${field(P + 'paidCare', '認可保育施設以外に有償で定期的に預けている（C調整項目）', 'select', { options: [['none', '預けていない'], ['3days', '認可外・企業主導型・ベビーシッターに週3日以上（+3）'], ['weekly', '認可施設以外に週1回以上（一時預かり含む・+2）']] })}
        <details><summary>児童調査書の項目（健康状態など）</summary>
          <p class="muted" style="font-size:.82rem">主な項目のみ印字します。発達の詳細・アレルギー症状・病名などの記述欄は手書きで記入してください。</p>
          <div class="f"><span class="lbl">確認事項（内容を読んで同意する項目にチェック）</span><div class="choice" style="flex-direction:column">${['特別な配慮が必要な場合、保育課から保育施設へ対応可否を確認する場合がある', '保育施設の状況によっては受け入れできない場合がある', '提出後に児童の状況に変化があれば保育課へ連絡する', '申し出の内容が事実と異なった場合、内定・入所を取り消すことがある'].map((t, j) => `<label><input type="checkbox" data-path="${V}confirms.${j}"${v.confirms[j] ? ' checked' : ''}>${t}</label>`).join('')}</div></div>
          <div class="fields">${field(V + 'birthOrder', '出生歴（第何子）', 'number')}${field(V + 'delivery', '分娩', 'select', { options: [['', '—'], ['normal', '正常'], ['abnormal', '異常']] })}${field(V + 'gestation', '在胎週', 'number')}${field(V + 'birthWeight', '出生時の体重（g）', 'number')}${field(V + 'birthHeight', '出生時の身長（cm）', 'number')}${field(V + 'weight', '現在の体重（kg）', 'number')}${field(V + 'height', '現在の身長（cm）', 'number')}${field(V + 'measureDate', '計測日', 'date')}${field(V + 'walkMonth', '歩き始め（ヶ月頃）', 'number')}</div>
          ${field(V + 'checkups', '受診した乳幼児健診', 'multi', { options: [['m4', '4か月'], ['m9', '9・10か月'], ['y1', '1歳6か月'], ['y3', '3歳6か月']] })}
          ${field(V + 'vaccines', '接種済みの定期予防接種', 'multi', { options: [['hepb', 'B型肝炎'], ['pneumo', '小児用肺炎球菌'], ['dpt', '4種混合・ヒブ（5種混合）'], ['bcg', 'BCG'], ['rota', 'ロタ'], ['mr', '麻疹・風疹'], ['varicella', '水痘'], ['je', '日本脳炎'], ['other', 'その他']] })}
          ${field(V + 'vaccineOther', 'その他の予防接種', 'text')}
          ${field(V + 'devConsult', '発達・発育に関して相談・指導を受けている', 'check')}
          ${field(V + 'specialCare', '集団生活の中で特別な対応が必要（児童状況票の提出が必要）', 'check')}
          ${field(V + 'allergy', '食物アレルギー等', 'select', { options: [['none', '無'], ['unknown', '不明'], ['yes', '有']], rerender: true })}
          ${v.allergy !== 'none' ? field(V + 'allergyItems', '品目', 'multi', { options: [['egg', '卵'], ['milk', '牛乳'], ['soy', '大豆'], ['wheat', '小麦'], ['buckwheat', 'そば'], ['other', 'その他']] }) + field(V + 'allergyOther', 'その他の品目', 'text') : ''}
          ${field(V + 'illness', '大きな病気・慢性疾患での通院・治療・入院歴がある', 'check')}
        </details></div>`;
    };
    const filledWishes = app.wishes.map((w, i) => ({ w, i })).filter(x => x.w.id || x.w.name);
    const wishCards = filledWishes.map(({ w, i }) => {
      const P = `application.wishes.${i}.`;
      const last = i === filledWishes.length - 1;
      return `<div class="wish-card">
        <div class="wish-head"><span class="wish-no">第${i + 1}希望</span><span class="wish-name">${w.id ? `<span class="pill accent">${esc(w.id)}</span>` : ''}${esc(w.name)}</span>
          <span class="wish-actions"><button class="icon-btn" data-act="upWish" data-i="${i}" aria-label="順位を上げる"${i ? '' : ' disabled'}>▲</button><button class="icon-btn" data-act="downWish" data-i="${i}" aria-label="順位を下げる"${last ? ' disabled' : ''}>▼</button><button class="icon-btn" data-act="clearWish" data-i="${i}" aria-label="削除">✕</button></span></div>
        ${field(P + 'visited', '見学済み（問い合わせ済み含む）', 'check', { rerender: true })}
        ${w.visited ? '' : field(P + 'visitPlan', '見学予定日', 'date')}
        ${field(P + 'reason', '希望理由', 'text', { placeholder: '例：自宅に近いため' })}
      </div>`;
    }).join('');
    const facOptions = (window.FACILITIES || []).filter(f => f.licensed && f.id).map(f => `<option value="${f.id} ${esc(f.name)}"></option>`).join('');
    const months = []; for (let i = 0; i < 12; i++) { const d = new Date(2027, 3 + i, 1); months.push([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, `${d.getFullYear()}年${d.getMonth() + 1}月`]); }
    const memberHTML = s.members.map((m, i) => `<div class="subcard"><div class="head"><strong>同居・同一生計の家族 ${i + 1}</strong><button class="btn small danger" data-act="delMember" data-i="${i}">削除</button></div><div class="fields">${field(`members.${i}.relation`, '続柄', 'text', { placeholder: '兄・祖父など' })}${field(`members.${i}.name`, '氏名', 'text')}${field(`members.${i}.kana`, 'ふりがな', 'text')}${field(`members.${i}.birth`, '生年月日', 'date')}${field(`members.${i}.workplace`, '勤務先・就学先・在園名', 'text')}</div>${field(`members.${i}.cohabit`, '同居している', 'check')}</div>`).join('');
    const gpHTML = [['pf', '父方 祖父'], ['pm', '父方 祖母'], ['mf', '母方 祖父'], ['mm', '母方 祖母']].map(([k, l]) => `<div class="subcard"><strong>${l}</strong><div class="fields">${field(`grandparents.${k}.name`, '氏名（離別・死別等はその旨）', 'text')}${field(`grandparents.${k}.birth`, '生年月日', 'date')}${field(`grandparents.${k}.addr`, '住所（別居の場合）', 'text')}</div>${field(`grandparents.${k}.cohabit`, '同居', 'check')}</div>`).join('');
    const anyIkukyu = s.father.ikukyu || s.mother.ikukyu;

    return modeTabs('form') + `
      <p class="note compact">入力は自動でこの端末にだけ保存されます。<strong>マイナンバーは入力しないでください</strong>。説明は要約で、正確性は保証しません（${pageLink(36, '記入例 P36〜42')}）。</p>
      ${sec('app', '1. 申込内容（開始時期・希望園）', `
        <div class="fields">
          ${field('application.startMonth', '保育希望開始時期', 'select', { options: months, rerender: true })}
          ${app.startMonth === '2027-04' ? field('application.aprilRound', '4月入所の申込区分', 'select', { options: [['1', '4月1次から（2026/10/23締切・郵送）'], ['2', '4月2次から（2027/2/8締切）']] }) : ''}
          ${field('application.method', '提出方法', 'select', { options: [['mail', '郵送'], ['window', '窓口'], ['online', '電子申請（e-kanagawa）']] })}
          ${field('application.representative', '代表者（結果通知の送付先）', 'select', { options: [['mother', '母'], ['father', '父']] })}
          <div class="f"><label>記入日</label><div class="row" style="flex-wrap:nowrap"><input type="date" data-path="application.writtenDate" value="${esc(app.writtenDate)}"><button class="btn small" data-act="today" type="button">今日</button></div></div>
        </div>
        ${app.startMonth === '2027-04' ? field('application.continueFromR8', '令和8年度から継続して申込中', 'check', { rerender: true }) + (app.continueFromR8 ? field('application.r8FirstWish', '令和8年度第1希望園', 'text') : '') : ''}
        ${field('application.endType', '保育希望終了時期', 'radio', { options: [['preschool', '就学前まで'], ['date', '日付を指定']], rerender: true })}
        ${app.endType === 'date' ? field('application.endDate', '終了日', 'date') : ''}
        ${field('application.continueReview', '希望月に入所できなかった場合、年度末（2028年3月）まで毎月審査を継続する', 'check')}
        ${field('application.transfer', '転園申請（現在認可保育施設に在園中）', 'check')}
        <h4>希望保育施設（最大10園）</h4>
        <p class="muted" style="font-size:.875rem"><a href="#facilities">保育園をさがす</a>からも追加できます。希望順位は審査の順位に影響しません。見学していない園は見学予定日を入れてください（確認事項⑫）。</p>
        ${wishCards || '<p class="muted">まだ希望園がありません。</p>'}
        ${filledWishes.length < 10 ? `<div class="f"><label for="wishPick">希望園を追加（${filledWishes.length}/10）</label><input type="search" id="wishPick" list="facList" placeholder="番号か園名を入力して候補から選択" autocomplete="off"><datalist id="facList">${facOptions}</datalist></div>` : ''}
        ${field('application.planIfFail', '入所がかなわなかった場合の予定（選考には影響しません）', 'select', { options: [['extendIkukyu', '父母が自宅で保育（育児休業を延長）'], ['waitHome', '父母が自宅で保育（育休以外で空きを待つ）'], ['relative', '父母以外の親族が保育'], ['otherFacility', '認可保育施設以外の施設を利用'], ['seeking', '求職活動中'], ['continueCurrent', '現在の認可保育施設を継続利用（転園・転入予定）'], ['withdraw', '申込みを取り下げる'], ['other', 'その他']], rerender: true })}
        ${['relative', 'otherFacility', 'other'].includes(app.planIfFail) ? field('application.planDetail', '詳細（保育者氏名・施設名など）', 'text') : ''}
        ${anyIkukyu ? field('application.ikukyuChoice', '育児休業中の申込み（確認事項⑪）', 'radio', { options: [['A', 'A：入所でき次第、翌月15日までに復職'], ['B', 'B：入所できない場合は育休延長を許容（基礎点数-30点）']], help: '育休Bは藤沢市民・転入予定の方のみ' }) : ''}
      `)}
      ${sec('house', '2. 住所・世帯', `
        ${field('household.residence', 'お住まい', 'select', { options: [['fujisawa', '藤沢市在住'], ['moving', '藤沢市へ転入予定'], ['outsideWork', '市外在住・父母のいずれかが藤沢市で月64時間以上就労/就学'], ['chigasaki', '茅ヶ崎市堤地区（湘南ライフタウン内1〜110番地）']], rerender: true, help: '市外在住の方は原則、住民登録地の市区町村窓口で申込みます' })}
        <div class="fields">${field('household.postal', '郵便番号', 'text', { placeholder: '251-0000' })}${field('household.address1', '住所（藤沢市以降・1行目）', 'text', { placeholder: '朝日町1番地の1' })}${field('household.address2', '住所（建物名・部屋番号）', 'text')}</div>
        ${h.residence === 'moving' ? field('household.contractDocs', '転入先の売買・賃貸契約書等を提出できる（藤沢市民との同居なら不要）', 'check') : ''}
        ${field('household.singleParent', 'ひとり親世帯', 'check', { rerender: true })}
        ${h.singleParent ? `<div class="fields">${field('household.singleReason', '理由', 'select', { options: [['', '—'], ['unmarried', '未婚'], ['divorce', '離婚'], ['bereaved', '死別'], ['other', 'その他']] })}${field('household.singleDate', '事実発生日', 'date')}</div>${field('household.noRelativeUnder65', '65歳未満の同居親族がいない（+3）', 'check')}` : field('household.absentParent', '父母のどちらかが長期不在', 'select', { options: [['none', '該当なし'], ['transfer', '単身赴任中'], ['hospital', '長期入院中']] })}
        <div class="fields">
          ${field('household.reg2026', '2026年1月1日時点の父母の住民登録地', 'select', { options: [['fujisawa', '藤沢市'], ['outside', '藤沢市外']], rerender: true })}
          ${h.reg2026 === 'outside' ? field('household.reg2026Pref', '都道府県', 'text') + field('household.reg2026City', '市区町村', 'text') : ''}
          ${field('household.reg2027', '2027年1月1日時点の父母の住民登録地（見込み）', 'select', { options: [['fujisawa', '藤沢市'], ['outside', '藤沢市外']], rerender: true })}
          ${h.reg2027 === 'outside' ? field('household.reg2027Pref', '都道府県', 'text') + field('household.reg2027City', '市区町村', 'text') : ''}
        </div>
        ${field('household.taxFiled', '父母とも所得の申告（年末調整・確定申告等）が済んでいる', 'check')}
        ${field('household.welfare', '生活保護を受給中', 'check', { rerender: true })}
        ${h.welfare ? `<div class="fields">${field('household.welfareFrom', '受給開始日', 'date')}</div>${field('household.welfareSelfReliance', '児童の入所・保護者の就労で自立促進が図られる（+1）', 'check')}` : ''}
        ${field('household.familyDisability', '家族（申込児童含む）に障がい者手帳・療育手帳の交付を受けている人がいる', 'check', { rerender: true })}
        ${h.familyDisability ? field('household.familyDisabilityNames', '交付を受けている方の氏名（全員）', 'text') : ''}
        ${field('household.familyCareC7', '申込児童・保護者以外の同居家族に身体障がい者手帳3級以上・療育手帳・精神障がい者保健福祉手帳、又は要介護3〜5（在宅）の方がいる（+2）', 'check')}
        <h4>妊娠・出産（確認事項⑦）</h4>
        ${field('household.motherPregnant', '児童の母に出産予定がある', 'check', { rerender: true })}
        ${h.motherPregnant ? `<div class="fields">${field('household.dueDate', '出産予定日', 'date')}${field('household.maternityFrom', '産前産後休業 開始', 'date')}${field('household.maternityTo', '産前産後休業 終了', 'date')}${field('household.afterBirth', '産休後の予定', 'select', { options: [['leave', '退園する（出産要件）'], ['work', '直ちに復職・就労開始'], ['ikukyu', '育児休業を取得する']] })}</div>` : ''}
      `)}
      ${sec('father', '3. 保護者（父）', parentHTML('father', '父'))}
      ${sec('mother', '4. 保護者（母）', parentHTML('mother', '母'))}
      ${sec('child', '5. 申込児童', s.children.map(childHTML).join('') + `<button class="btn" data-act="addChild">＋児童を追加（きょうだい同時申込）</button>` + (s.children.length >= 2 ? `<h4>きょうだいの申込み条件（申込書5）</h4>${field('application.siblingNoPref', '希望はない', 'check', { rerender: true })}${app.siblingNoPref ? '' : field('application.sib1', '項目1（一番大事な希望）', 'radio', { options: [['A', 'A 必ず同時期に入所したい★'], ['B', 'B 必ずしも同時期でなくてよい']], rerender: true }) + (app.sib1 === 'B' ? field('application.sib3', '項目3（1人しか入所できない場合）', 'radio', { options: [['F', 'F 必ず上の子を先に★'], ['G', 'G 必ず下の子を先に★']] }) : '') + field('application.sib2', '項目2（同時期に入所できる場合）', 'radio', { options: [['C', 'C 必ず同じ園★'], ['D', 'D 希望順位が下がっても同じ園を優先'], ['E', 'E それぞれ希望順位が高い園を優先']] }) + '<p class="muted" style="font-size:.82rem">★は絶対条件。回答で有利・不利にはなりません。</p>'}` : ''))}
      ${sec('family', '6. 同居家族・祖父母', `<p class="muted" style="font-size:.84rem">代表者と配偶者は自動で記入されます。それ以外の同居家族、別居でも同一生計の家族（単身赴任・留学中など）を入力してください。</p>${memberHTML}<button class="btn" data-act="addMember">＋家族を追加</button><h4>祖父母の状況</h4>${gpHTML}`)}
      ${sec('points', '7. 点数・保育料に関わる項目', `
        ${field('household.taxStatus', '住民税の状況（保育料の階層判定）', 'select', { options: [['taxed', '課税（所得割額あり）'], ['zeroIncomeLevy', '所得割非課税（均等割のみ）'], ['nontax', '住民税非課税'], ['welfare', '生活保護世帯']], rerender: true })}
        ${h.taxStatus === 'taxed' ? field('household.shotokuwari', '父母の市町村民税 所得割額の合算（円）', 'number', { help: '課税証明書・税額決定通知書の「所得割額」。住宅ローン控除・寄付金控除等は適用前の額で算定されます', placeholder: '150000' }) : ''}
        <div class="fields">${field('household.childOrder', '申込児童1人目は保育料算定上の第何子？', 'number', { help: '同一生計のきょうだいを年齢・施設に関係なく数える' })}${field('household.siblingsUnder18', '生計を一にする18歳未満のきょうだいの人数（申込児童含む）', 'number')}</div>
        ${field('household.siblingSameFacility', 'きょうだいが在園している施設を希望する（+2、その施設の審査のみ）', 'check')}
        ${field('household.graduateSmall', '小規模保育事業等の卒園に伴う申込み（4月審査のみ+5）', 'check')}
        ${field('household.pastDecline', '過去3年度以内に内定辞退・締切後の取下げ・育休中入所後に復職せず退園した（-2）', 'check')}
        ${field('household.arrears', '過去に在園した児童に保育料の滞納がある（-20）', 'check')}
      `)}
      ${sec('data', '8. データの保存・書き出し・削除', `
        <p>データはこのブラウザにのみ保存されています。別の端末で使う場合や、バックアップしたい場合はファイルに書き出してください（ファイルには個人情報が含まれます。取り扱いにご注意ください）。</p>
        <div class="row"><button class="btn" data-act="export">ファイルに書き出す（JSON）</button><button class="btn" data-act="import">ファイルから読み込む</button><button class="btn danger" data-act="reset">この端末のデータをすべて削除</button></div>
      `)}
      <div class="row" style="margin-top:16px"><a class="btn primary" href="#score">点数・必要書類を確認する →</a><a class="btn" href="#forms">申込書PDFを作る →</a></div>`;
  }

  // ============ 職員向け：QR読み取り ============
  views.reader = el => {
    const texts = window.__readerTexts = window.__readerTexts || new Set();
    el.innerHTML = `
      <p class="note compact">申込者が提出した「データ連携用シート」のQRコードを読み取り、申込内容をデータ（CSV・JSON）にします。読み取りはこのブラウザの中だけで行い、外部には送信しません。<strong>手書きで修正・追記がある場合は紙の申込書が優先です。</strong>必ず照合してください。</p>
      <div class="card">
        <h3>1. QRコードを読み取る</h3>
        <div class="f"><label for="rdText">QRリーダーで読んだ文字列を貼り付け（1行に1つ・複数可）</label><textarea id="rdText" rows="3" placeholder="FH1-XXXXXX-1-1-…"></textarea></div>
        <div class="row"><button class="btn primary" id="rdAdd">貼り付けた文字列を読む</button></div>
        <div class="f" style="margin-top:16px"><label for="rdFile">スキャンしたPDF・画像から読む（複数可）</label><input type="file" id="rdFile" accept="application/pdf,image/*" multiple></div>
        <div class="row"><button class="btn" id="rdCam">📷 カメラで読む</button><button class="btn small danger" id="rdClear">すべてクリア</button></div>
        <video id="rdVideo" playsinline muted hidden style="width:100%;max-height:50vh;margin-top:8px;border-radius:8px;background:#000"></video>
        <div id="rdStatus" class="muted" style="margin-top:8px"></div>
      </div>
      <div id="rdOut"></div>`;
    const status = t => { const x = $('#rdStatus', el); if (x) x.textContent = t; };
    const loadScript = src => new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('ライブラリを読み込めませんでした')); document.head.appendChild(s); });
    const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    function scanCanvas(cv) {
      const ctx = cv.getContext('2d', { willReadFrequently: true }); const found = [];
      for (let k = 0; k < 8; k++) {
        const img = ctx.getImageData(0, 0, cv.width, cv.height);
        const r = jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
        if (!r || !r.data) break;
        found.push(r.data);
        const L = r.location; ctx.fillStyle = '#fff'; ctx.beginPath();
        [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath(); ctx.lineWidth = 12; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fill();
      }
      return found;
    }
    async function fromImage(file) {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const scale = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * scale); cv.height = Math.round(img.naturalHeight * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        return scanCanvas(cv);
      } finally { URL.revokeObjectURL(url); }
    }
    async function fromPDF(file) {
      // ワーカー本体も先に読み込み、メインスレッドで処理する（ファイル直開き・CDN配信でも確実に動かすため）
      await loadScript(PDFJS); await loadScript(PDFJS_WORKER); pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const found = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        status(`${file.name}：${p}/${pdf.numPages}ページを読み取り中…`);
        const page = await pdf.getPage(p); const vp0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: 2600 / vp0.width });
        const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp, intent: 'print' }).promise; // print：rAFに依存せず描画（裏タブでも止まらない）
        found.push(...scanCanvas(cv));
      }
      return found;
    }
    async function addTexts(list) { let n = 0; list.forEach(t => { t = String(t).trim(); if (t && !texts.has(t)) { texts.add(t); n++; } }); await show(); return n; }
    async function show() {
      const out = $('#rdOut', el); if (!out) return;
      if (!texts.size) { out.innerHTML = ''; return; }
      const { results, errors } = await QRData.decode([...texts]);
      window.__readerResults = results;
      const ok = results.filter(r => r.rows);
      out.innerHTML = `
        <div class="card"><h3>2. 読み取り結果（${results.length}件）</h3>
          ${errors.length ? `<div class="note compact">${errors.map(esc).join('<br>')}</div>` : ''}
          <div class="row">${ok.length ? '<button class="btn primary" id="rdCSV">CSVで保存（全件）</button><button class="btn" id="rdJSON">JSONで保存（全件）</button>' : ''}</div>
          ${results.map(r => {
            const m = new Map((r.rows || []).map(([s, l, v]) => [`${s}_${l}`, v]));
            const who = r.rows ? [m.get('母_氏名') || m.get('父_氏名'), ...[1, 2, 3].map(i => m.get(`児童${i}_氏名`))].filter(Boolean).join('・') : '';
            return `<div class="rd-item ${r.ok ? 'ok' : 'ng'}">
              <div class="row" style="justify-content:space-between"><strong>照合コード ${esc(r.code)}</strong><span class="pill ${r.ok ? 'accent' : 'warn'}">${r.ok ? '照合OK' : '要確認'}</span></div>
              ${r.error ? `<div class="chat-error">${esc(r.error)}</div>` : ''}
              ${r.rows ? `<div>${esc(who)}</div><details><summary>内容を表示（${r.rows.length}項目）</summary><div class="table-wrap"><table class="tbl"><tbody>${r.rows.map(([s, l, v]) => `<tr><th>${esc(s)}</th><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      const dl = (name, type, content) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
      const stamp = today();
      const csvBtn = $('#rdCSV', out); if (csvBtn) csvBtn.onclick = () => dl(`保育所申込データ_${stamp}.csv`, 'text/csv', QRData.toCSV(results));
      const jsBtn = $('#rdJSON', out); if (jsBtn) jsBtn.onclick = () => dl(`保育所申込データ_${stamp}.json`, 'application/json', JSON.stringify(ok.map(r => ({ 照合コード: r.code, 照合結果: r.ok ? '一致' : '不一致', 項目: Object.fromEntries(r.rows.map(([s, l, v]) => [`${s}_${l}`, v])), 元データ: r.data })), null, 2));
    }

    $('#rdAdd', el).onclick = async () => { const n = await addTexts($('#rdText', el).value.split(/\r?\n/)); $('#rdText', el).value = ''; status(`${n}件の文字列を追加しました。`); };
    $('#rdFile', el).onchange = async e => {
      try {
        await loadScript(JSQR); let total = 0;
        for (const f of e.target.files) { status(`${f.name} を読み取り中…`); const found = f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? await fromPDF(f) : await fromImage(f); total += await addTexts(found); }
        status(`QRコードを ${total}個 読み取りました。${total ? '' : '見つからない場合は、スキャンの解像度を300dpi以上にしてください。'}`);
      } catch (err) { status('読み取りに失敗しました：' + err.message); }
      e.target.value = '';
    };
    let stream = null, timer = null;
    const stopCam = () => { if (timer) clearInterval(timer); timer = null; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; const v = $('#rdVideo', el); if (v) v.hidden = true; const b = $('#rdCam', el); if (b) b.textContent = '📷 カメラで読む'; };
    $('#rdCam', el).onclick = async () => {
      if (stream) return stopCam();
      try {
        await loadScript(JSQR);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } });
        const v = $('#rdVideo', el); v.srcObject = stream; v.hidden = false; await v.play();
        $('#rdCam', el).textContent = '■ カメラを止める'; status('QRコードをカメラに向けてください。');
        const cv = document.createElement('canvas');
        timer = setInterval(async () => {
          if (!v.videoWidth) return; cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
          const n = await addTexts(scanCanvas(cv)); if (n) { toast('QRコードを読み取りました'); if (navigator.vibrate) navigator.vibrate(80); }
        }, 400);
      } catch (err) { stopCam(); status('カメラを使えませんでした：' + err.message); }
    };
    $('#rdClear', el).onclick = () => { texts.clear(); show(); status('クリアしました。'); };
    show();
    return stopCam;
  };

  // ============ 利用規約 ============
  views.terms = el => {
    el.innerHTML = `
      <div class="card">
        <h3>1. 本サイトについて</h3>
        <p>本サイト「藤沢市 保育所申込ポータル」は、藤沢市が公開している「ふじさわ認可保育施設 申込ナビ（令和9年度版）」等の情報をもとに、${OPERATOR}（以下「運営者」）が運営する<strong>非公式</strong>のツールです。藤沢市・藤沢市保育課その他の行政機関とは一切関係がありません。本サイトに関するお問い合わせは ${CONTACT_HTML} までご連絡ください（保育所の申込み内容に関するご質問には回答できません。藤沢市保育課へお問い合わせください）。</p>
        <h3>2. 正確性を保証しません</h3>
        <ul>
          <li>掲載している情報、点数・保育料の計算結果、必要書類の判定、保育施設の情報、作成した帳票（PDF）について、<strong>正確性・完全性・最新性・有用性を一切保証しません</strong>。</li>
          <li>情報は公式資料を要約・自動抽出したものであり、転記誤り・抽出誤り・解釈の誤り・制度改正による相違が含まれる可能性があります。</li>
          <li>作成した帳票は、印字位置のずれ・項目漏れ・様式改訂等により、そのまま提出できない場合があります。</li>
          <li>実際の保育の必要性の認定、利用調整（入所選考）、保育料の決定は藤沢市が行います。</li>
        </ul>
        <h3>3. 自己責任でのご利用</h3>
        <p>申込みにあたっては、必ず公式の申込ナビ原本・藤沢市ホームページ・保育課（${esc(R.contact)}）の案内に従ってください。本サイトの利用により生じた申込みの不備、締切の徒過、入所の可否、その他いかなる損害についても、運営者は責任を負いません。</p>
        <h3>4. 個人情報の取り扱い</h3>
        <p>個人情報・利用者情報の取り扱いは<a href="#privacy">プライバシーポリシー</a>に定めます。マイナンバーは本サイトに入力しないでください。</p>
        <h3>5. 出典</h3>
        <ul>
          <li>藤沢市「ふじさわ認可保育施設 申込ナビ（令和9年度版）」「申込書類チェックリスト」</li>
          <li>藤沢市ホームページ「申込書類等のダウンロード」掲載の各様式（2026年10月5日取得）</li>
          <li>藤沢市オープンデータ（保育施設の位置情報 GeoJSON）</li>
          <li>地図：&copy; OpenStreetMap contributors</li>
        </ul>
        <h3>6. 変更・停止</h3>
        <p>本サイトの内容および本規約は、予告なく変更・停止することがあります。</p>
        <h3>7. ライセンス</h3>
        <p>本サイトのソースコードは <a href="https://github.com/pons-llc/fujisawa-hoiku-portal" target="_blank" rel="noopener">GitHub</a> で Apache License 2.0 のもと公開しています。ただし、申込ナビ・申込書様式等の藤沢市の資料及びそこから転記・抽出したデータ、オープンデータ、外部ライブラリは対象外で、各権利者の条件に従います（リポジトリの NOTICE 参照）。</p>
        <h3>8. 運営者</h3>
        <p>${OPERATOR}<br>連絡先：${CONTACT_HTML}</p>
        <p class="muted">2026年10月5日 制定</p>
        <div class="row"><button class="btn primary" id="agree">${Store.termsAgreed() ? '同意済みです' : '上記に同意する'}</button></div>
      </div>`;
    $('#agree', el).onclick = () => { Store.agreeTerms(); toast('同意しました'); location.hash = '#home'; };
  };

  // ============ プライバシーポリシー ============
  views.privacy = el => {
    el.innerHTML = `
      <div class="card">
        <p>${OPERATOR}（以下「運営者」）は、「藤沢市 保育所申込ポータル（非公式）」（以下「本サイト」）における利用者の情報の取り扱いについて、以下のとおり定めます。</p>
        <h3>1. 運営者が取得する情報</h3>
        <p><strong>運営者は、本サイトを通じて利用者の個人情報を取得・収集しません。</strong>本サイトには入力内容を受け取るサーバーがなく、入力された情報が運営者に送信されることはありません。</p>
        <h3>2. 入力した情報の保存場所</h3>
        <ul>
          <li>「マイ申請」等で入力した情報（氏名・生年月日・住所・勤務先・お子様の健康状態など）は、お使いの端末のブラウザ内（localStorage）にのみ保存されます。</li>
          <li>保存した情報は、「マイ申請」→「この端末のデータをすべて削除」、又はブラウザのサイトデータ削除によっていつでも消去できます。共用端末では利用後に必ず削除してください。</li>
          <li>「ファイルに書き出す」で作成したファイルや、作成した申込書PDFには個人情報が含まれます。保管・送付は利用者ご自身の責任で行ってください。</li>
          <li>マイナンバーは本サイトに入力しないでください（入力欄も設けていません）。</li>
        </ul>
        <h3>3. アクセス解析・広告</h3>
        <p>本サイトは、Google Analytics 等のアクセス解析ツール、Google AdSense 等の広告配信サービスを<strong>一切使用していません</strong>。運営者がCookieを設定することもありません。</p>
        <h3>4. 外部サービスの利用</h3>
        <p>本サイトは表示や機能のために次の外部サービスから資源を読み込みます。読み込みの際、通常の通信に伴う情報（IPアドレス、ブラウザの種類、閲覧したページのURL等）が各提供元に送信されます。入力内容が送信されることはありません。各提供元における情報の取り扱いは、それぞれのプライバシーポリシーをご確認ください。</p>
        <ul>
          <li>cdnjs（Cloudflare）：PDF作成ライブラリ jsPDF、地図ライブラリ Leaflet、QRコード生成ライブラリ qrcode-generator、PDF読み込みライブラリ pdf.js の配信</li>
          <li>jsDelivr：QRコード読み取りライブラリ jsQR の配信（職員向けの読み取り画面のみ）</li>
          <li>OpenStreetMap：地図画像（タイル）の配信</li>
          <li>Google Fonts：フォント（Noto Sans JP）の配信</li>
        </ul>
        <p>また、施設HP・Googleマップ・藤沢市HP等の外部サイトへのリンクを開いた場合は、リンク先の取り扱いに従います。</p>
        <h3>5. QRコードとカメラ</h3>
        <p>「データ連携用シート」のQRコードには、申込書に印字した内容（個人情報を含む）が入ります。職員向けの読み取り画面でのQRコードの読み取り（カメラ・PDF・画像）は、すべてお使いのブラウザの中で処理され、映像や読み取った内容が運営者や外部に送信されることはありません。</p>
        <h3>6. 第三者提供</h3>
        <p>運営者は利用者の個人情報を取得しないため、第三者に提供することもありません。</p>
        <h3>7. お問い合わせ</h3>
        <p>本ポリシーに関するお問い合わせは ${CONTACT_HTML} までご連絡ください。</p>
        <h3>8. 改定</h3>
        <p>本ポリシーは必要に応じて改定することがあります。改定後の内容は本ページに掲載した時点から効力を生じます。</p>
        <p class="muted">2026年10月5日 制定<br>${OPERATOR}</p>
      </div>`;
  };

  // ============ 初回の同意モーダル ============
  function termsModal() {
    if (Store.termsAgreed()) return;
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">ご利用の前に</h2>
      <p>このサイトは藤沢市とは関係のない<strong>非公式</strong>の申込支援ツールです。</p>
      <ul><li>掲載情報・計算結果・作成したPDFの<strong>正確性は保証しません</strong>。</li><li>申込みの前に必ず市の「申込ナビ」原本と藤沢市ホームページで確認し、不明点は保育課へお問い合わせください。</li><li>入力した情報はこの端末のブラウザにだけ保存され、外部に送信されません。</li></ul>
      <p><a href="#terms">利用規約</a>・<a href="#privacy">プライバシーポリシー</a>を読む</p>
      <div class="row"><button class="btn primary" id="mok">理解して利用する</button></div></div>`;
    document.body.appendChild(back);
    $('#mok', back).onclick = () => { Store.agreeTerms(); back.remove(); };
    $$('a', back).forEach(x => (x.onclick = () => back.remove()));
  }

  // ============ ⋮メニュー ============
  function closeMenu() { const m = $('#menu'); if (m) { m.hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); } }
  $('#menuBtn').addEventListener('click', e => { e.stopPropagation(); const m = $('#menu'); m.hidden = !m.hidden; $('#menuBtn').setAttribute('aria-expanded', String(!m.hidden)); });
  document.addEventListener('click', e => { if (!e.target.closest('#menu')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  Store.load();
  window.addEventListener('hashchange', route);
  route();
  termsModal();
})();

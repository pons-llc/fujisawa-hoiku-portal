// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// ナレッジのキーワード検索（文字bigramのBM25）。申込ナビ本文とQ&Aが対象。外部通信なし・オフラインで動作。
(function () {
  const docs = [];
  (window.FAQ || []).forEach((f, i) => docs.push({ id: 'faq' + i, kind: 'faq', page: f.page, title: f.q, text: f.a }));
  (window.NAVI_CHUNKS || []).forEach(c => docs.push({ id: c.id, kind: 'navi', page: c.page, title: c.title, text: c.text }));

  const norm = s => s.normalize('NFKC').toLowerCase().replace(/[\s、。・「」『』（）()［］\[\]【】,.:：;；!！?？\-－―ー〜～…※◆◎○●■□☆★♦➡→⇒]/g, '');
  const SYN = [['保育料', '利用者負担'], ['締切', '締め切り', '締切日', '期限'], ['点数', '基礎点数', '選考基準'], ['育休', '育児休業'], ['転園', '転園申請'], ['必要書類', '提出書類'], ['保育園', '保育施設'], ['延長', '時間外'], ['求職', '求職活動'], ['見学', '事前見学'], ['辞退', '内定辞退'], ['取下', '取り下げ', '取下げ']];
  const expand = q => { let out = q; for (const g of SYN) if (g.some(w => q.includes(w))) out += ' ' + g.join(' '); return out; };
  const grams = s => { const t = norm(s); const a = []; for (let i = 0; i < t.length - 1; i++) a.push(t.slice(i, i + 2)); if (t.length === 1) a.push(t); return a; };
  // タイトルを2回数えて重みづけ
  const index = docs.map(d => { const g = grams(d.title + ' ' + d.title + ' ' + d.text); const tf = new Map(); g.forEach(x => tf.set(x, (tf.get(x) || 0) + 1)); return { tf, len: g.length }; });
  const avgLen = index.reduce((a, b) => a + b.len, 0) / Math.max(1, index.length);
  const df = new Map(); index.forEach(ix => ix.tf.forEach((_, k) => df.set(k, (df.get(k) || 0) + 1)));

  function search(query, { topK = 8 } = {}) {
    if (!query || !query.trim()) return [];
    const qg = [...new Set(grams(expand(query)))];
    const N = docs.length, k1 = 1.2, b = 0.75;
    const scored = index.map((ix, i) => {
      let s = 0;
      for (const g of qg) {
        const f = ix.tf.get(g); if (!f) continue;
        const idf = Math.log(1 + (N - df.get(g) + 0.5) / (df.get(g) + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * ix.len / avgLen));
      }
      if (docs[i].kind === 'faq') s *= 1.6; // 要約Q&Aを少し優先
      return { doc: docs[i], score: s };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return [];
    const max = scored[0].score;
    // 低スコアを切り、同じページは2件まで
    const seen = new Map(); const res = [];
    for (const r of scored) {
      if (r.score < max * 0.2) break;
      const key = r.doc.kind + r.doc.page; const c = seen.get(key) || 0; if (c >= 2) continue;
      seen.set(key, c + 1); res.push(r); if (res.length >= topK) break;
    }
    return res;
  }

  // 検索語のハイライト用：クエリを2文字以上の語に分割
  function terms(query) {
    return [...new Set(query.normalize('NFKC').split(/[\s、。？?！!はがをにでとのもへや]+/).filter(t => t.length >= 2))];
  }

  window.Search = { docs, search, terms };
})();

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// 申込ナビPDFからキーワード検索用の本文チャンク（data/navi-chunks.js）を生成する
// 使い方: node tools/build-navi-chunks.js   （poppler の pdftotext が必要）
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const pdf = path.join(root, 'docs/r9moushikomi_navi.pdf');
const PAGE_OFFSET = 3; // PDF4ページ目 = 冊子P1
const titles = {1:'保育施設のクラス年齢・保育の必要性の認定',2:'保育の必要量・延長保育',3:'保育料の決定方法',4:'3〜5歳児クラスの保育料・支払い方法',5:'幼児教育・保育の無償化',6:'利用者負担額（保育料）表',7:'申込から入所までの流れ',8:'内定・入所保留後の流れ',9:'利用調整の対象となる保育施設',10:'申込みができる方・申込可能期間',11:'4月入所申込（1次）・その他の月の申込',12:'市外在住の方の申込・申込方法',13:'利用申込に必要な書類一覧',14:'提出書類の注意事項',15:'保育の必要性事由を証明する書類',16:'書類不足・書類不備について',17:'藤沢市保育施設入所選考基準（基礎点数）',18:'入所選考基準（優先順位・調整項目）',19:'申込みに関する注意事項（見学・基準日・転園・出生前）',20:'きょうだい同時申込・産前産後・育児休業中の申込',21:'2月・3月審査・状況変更・取下げ・市外施設',22:'内定後・入所後の注意事項',23:'よくある質問',24:'保育コンシェルジュ・二次元コード集',25:'一時預かり・休日保育',26:'病児・病後児保育・こども誰でも通園制度',27:'認可保育施設マップ（北部）',28:'認可保育施設マップ（南部）',29:'認可保育施設マップ（駅周辺）',30:'認可保育施設基本情報（公立）',31:'認可保育施設基本情報（法人立）',32:'認可保育施設基本情報（法人立）',33:'認可保育施設基本情報（法人立）',34:'認可保育施設基本情報（法人立）',35:'認可保育施設基本情報（小規模・家庭的・認定こども園）',36:'申込書記入例（表面）',37:'申込書記入例（確認事項・祖父母）',38:'申込書記入例（保育の必要性事由）',39:'申込書記入例（きょうだいの申込み条件）',40:'児童調査書記入例①',41:'児童調査書記入例②',42:'受理通知・誓約書記入例'};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'navi-'));
const out = [];
for (let p = PAGE_OFFSET + 1; ; p++) {
  const page = p - PAGE_OFFSET; if (!titles[page]) break;
  const file = path.join(tmp, 'p.txt');
  execFileSync('pdftotext', ['-f', String(p), '-l', String(p), '-raw', pdf, file]);
  let t = fs.readFileSync(file, 'utf8').replace(/\f/g, '').replace(/-\s*\d+\s*-/g, '').replace(/[ \t\u3000]+/g, ' ');
  const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
  let cur = ''; const chunks = [];
  for (const l of lines) { if ((cur + l).length > 380 && cur.length > 120) { chunks.push(cur); cur = cur.slice(-60) + '\n'; } cur += l + '\n'; }
  if (cur.trim().length > 20) chunks.push(cur);
  chunks.forEach((c, i) => out.push({ id: `p${page}-${i}`, page, title: titles[page], text: c.trim() }));
}
fs.writeFileSync(path.join(root, 'data/navi-chunks.js'), '// 自動生成: node tools/build-navi-chunks.js（出典：藤沢市 申込ナビ 令和9年度版。page=冊子のページ番号）\nwindow.NAVI_CHUNKS = ' + JSON.stringify(out) + ';\n');
console.log(out.length, 'chunks');

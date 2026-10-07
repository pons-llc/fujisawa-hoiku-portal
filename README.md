# 藤沢市保育所申込ポータル（非公式）

運営：合同会社Pons ／ お問い合わせ：[X @ponsllc](https://x.com/ponsllc) ／ ライセンス：[Apache-2.0](LICENSE)

[保育所申込システム.md](保育所申込システム.md) の仕様に基づく実装です。ビルド不要の完全フロントエンド（HTML/CSS/JavaScript）。

## 使い方

`index.html` をブラウザで開くだけで動きます（`file://` でも動作）。ビルド不要の静的サイトなので、リポジトリをそのまま配信できます。

インターネット接続が必要なもの：PDF作成（jsPDF）、地図（Leaflet + OpenStreetMap）、フォント（Google Fonts）。点数計算・入力保存はオフラインでも動作します。

UIはスマホ向け（Android風のトップバー＋ボトムナビ、デジタル庁デザインシステム風の配色）。PCでも中央寄せで表示されます。

## 機能と対応ファイル

| 機能 | 画面 | 主なファイル |
|---|---|---|
| 入園案内 | 入園案内 | `js/app.js`（guide）、`docs/r9moushikomi_navi.pdf`（原本、ページ指定リンク） |
| 点数計算・必要書類選択 | 点数・書類 | `js/calc.js`、`data/rules.js`（保育料表・選考基準・締切） |
| 帳票作成 | 帳票PDF | `js/forms.js`、`data/forms-bg.js`（市の様式を画像化） |
| 保育園検索 | 保育園 | `data/facilities.js`、地図は Leaflet |
| 自己情報の保存 | マイ申請 | `js/store.js`（localStorage のみ。JSONで書き出し／読み込み可） |
| 利用規約・免責 | 各画面の注意表示・最下部の注意文・初回モーダル・利用規約画面 | `index.html`、`js/app.js` |

### 帳票作成
市HPの公式様式PDF（2026/10/5取得）を150dpiのグレースケールJPEGにして `forms-bg.js` に埋め込み、Canvas上に入力内容を描画して jsPDF で A4 の画像PDFにします（文字は画像に焼き込み済みのため、コンビニのマルチコピー機でそのまま印刷できます）。

対象：申込書（4ページ）／児童調査書（児童ごと2ページ）／誓約書・受理通知（2ページ）。マイナンバー・署名・誓約書のチェック欄は意図的に印字しません。印字位置は画面から微調整できます。

### データ連携用シート（QRコード）

申込書PDFに、申込内容をQRコードにした「データ連携用シート」（市の様式ではない追加の1枚）を付けられます。職員は `#reader`（⋮メニュー「職員向け：QRコード読み取り」）で、QRリーダーの文字列貼り付け・スキャンしたPDF/画像・カメラから読み取り、CSV／JSONで保存できます。

- 形式：`FH1-<照合コード>-<何枚目>-<全枚数>-<データ>`。データは短いキーのJSONを deflate-raw で圧縮し Base45 化（QRの英数字モード）。1QRあたり最大1,300文字で、超える場合は分割
- 照合コード：JSONのSHA-256先頭6桁。シートに印字し、読み取り時に一致を確認
- 実装：`js/qrdata.js`（エンコード・デコード・項目展開・CSV）、`js/forms.js`（シート描画）、`js/app.js` の `views.reader`
- 手書きで修正・追記された場合は紙の記載が優先（シートに明記）。マイナンバー・署名・誓約書のチェックは含まない
- 受け付けるかどうかは自治体の判断です

## データの更新

- **保育園データ**：`facilities/*.geojson`（藤沢市オープンデータ）を差し替えて `node tools/build-facilities.js` を実行すると `data/facilities.js` が再生成されます。定員・受入月齢・預かり時間・施設番号は申込ナビP27〜35から抽出した `tools/navi-facility-*.{json,txt}` と名称・電話番号で照合しています。照合できない施設は「R9申込ナビ未掲載」として表示されます。
- **様式が改訂された場合**：新しい様式PDFを `forms-src/` に置き、`pdftoppm -r 150 -gray -jpeg` で画像化して `data/forms-bg.js` を作り直し、`js/forms.js` の座標（pt単位）を調整してください（帳票作成画面の「座標グリッド表示」が便利です）。
- **申込ナビの年度更新**：`data/rules.js`（締切・保育料表）、`data/faq.js` を更新します。

## 注意

本ツールは非公式で、内容・計算結果・作成帳票の正確性を保証しません（画面各所とPDF作成時の確認ダイアログで明示しています）。

## テスト

```sh
node --test tests/*.test.js   # 点数計算・保育料・必要量・締切（期待値は申込ナビP1〜P18の記載から作成）
```

## ライセンス

ソースコードは [Apache License 2.0](LICENSE) で公開しています。Copyright 2026 合同会社Pons。

ただし、藤沢市の資料（`docs/`・`forms-src/` の PDF、`data/forms-bg.js` の様式画像）、そこから転記・抽出したデータ、藤沢市オープンデータ（`facilities/`）、実行時に読み込む外部ライブラリは Apache-2.0 の対象外です。詳細は [NOTICE](NOTICE) を参照してください。

## AI向けテキスト

- `llms.txt`：サイト概要・非公式である旨・主要ページと公式情報源（[llmstxt.org](https://llmstxt.org/) の形式）
- `llms-full.txt`：締切・選考基準・保育料・必要書類の要点（申込ナビのページ番号付き）。年度更新時は `data/rules.js` とあわせて更新してください。

## デプロイ（Cloudflare Pages）

GitHub リポジトリ（pons-llc/fujisawa-hoiku-portal）と Cloudflare Pages を連携しており、`main` への push で自動デプロイされます。

- ビルドコマンド：なし
- 出力ディレクトリ：`/`（リポジトリのルート）
- カスタムドメイン：https://hoiku.pons-llc.com/
- レスポンスヘッダーは `_headers` で設定

# Lesson 05：Flexbox基礎

対象動画：3:44:02〜4:15:06  
練習見本：[PRACTICE-TARGET.svg](PRACTICE-TARGET.svg)  
本体見本：[TARGET.svg](TARGET.svg)

## 動画どおりの進行

| 時刻 | 作業対象 | 内容 |
|---|---|---|
| 3:44:02〜3:53:57 | flexbox.html | 2要素、row、高さ違い、100px＋flex: 1、100px＋1＋2、Gridとの並び替え比較 |
| 3:53:57〜3:59:18 | flexbox.html | 高さ70px・枠線・3要素でjustify-contentとalign-itemsを順番に確認 |
| 3:59:24〜4:01:14 | youtube.html | ヘッダーを作り、左・中央・右の3区画に分ける。検索欄は中央へ移す |
| 4:01:21〜4:04:36 | CSSファイル | styles/video.css、styles/header.css、styles/general.cssへ役割別に分け、HTMLから3枚読む |
| 4:04:47〜4:14:07 | ヘッダー外枠 | body marginを0、ヘッダー55px、3区画をFlexbox化。左150px、中央flex: 1・左右margin・最大500px、右200px |

練習では動画と同じくinline styleを使う。本体では役割別CSSファイルを使う。

## 理解確認

- Gridは列を先に決め、Flexboxは要素自身の幅やflexを持ったまま並び替えやすい。
- justify-contentは主軸、align-itemsは交差軸へ働く。
- max-widthは「それ以下には縮めるが、それ以上には広げない」上限である。
- CSSを3ファイルへ分けても、HTMLからすべて読み込めば見た目は維持される。

## 合格条件

- 練習例が動画順に残っている。
- ヘッダーの3区画が横並びで、中央だけが画面幅に応じて伸縮する。
- CSS分割後も表示が変わらない。
- GridとFlexboxの違いを本人が説明できる。

合格後は動画4:15:24、Lesson 06へ進む。


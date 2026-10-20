# 應援資料維護

歌曲基本資訊只維護於 `src/song-metadata.js`：歌名、影片 ID、翻譯署名與授權。`src/song-content.js` 匯出 `SONG_CONTENT`，每首只有 `id` 與 `lyrics`，歌曲頁才延遲載入。每筆歌詞物件只占一個實體行，包含巢狀應援；請使用編輯器軟換行閱讀，不要展開排版。

## 逐行內容

以下是格式示例，不代表實際歌曲的應援內容：

```js
{ time: 49, jp: "今 チェンジ", tr: "此刻 Change", chants: { jp: { actions: [{ at: "start", marks: "[wave]" }], chant: { kind: "partial", parts: [{ jp: { text: "チェンジ", occurrence: 1 }, romaji: { text: "chenji", occurrence: 1 } }] } }, kr: { chant: { kind: "full" } } } },
```

- 時間只維護該行 `time`，沒有另一份 cue 時間、行 ID 或 expectedText 需要同步。
- `jp` 是不含動作標記的日文，`tr`、`pic` 等原有行資料維持用途。
- 每行的 `chants.jp` 與 `chants.kr` 是獨立版本設定，缺少設定表示這個版本該行沒有應援，不會隱含沿用。
- 省略 `chant` 表示不合唱；`kind: "full"` 標示完整日文與羅馬字，不接受 parts。
- `kind: "partial"` 要有非空 `parts`，每段必填 jp、romaji，需要中文時才填 zh。整行合唱的中文對應使用 `translationParts: [{ text, occurrence }]`，不從翻譯猜測。
- 片段忽略空白，保留大小寫及標點。`occurrence` 必填且從 1 開始。解析產生 Unicode code point 半開區間，不手填字元索引。
- 找不到目標、片段重疊或切入 ruby 內部都會檢查失敗，不能擴大範圍掩蓋錯誤。

## 動作位置

每版 `actions` 是有序陣列；省略或空陣列表示無動作。每筆只能指定一種位置：

```js
{ at: "start", marks: "[wave]" }
{ at: "end", marks: "[clap][clap]" }
{ before: { jp: { text: "チェンジ", occurrence: 1 }, romaji: { text: "chenji", occurrence: 1 } }, marks: "[clap]" }
{ after: { jp: { text: "チェンジ", occurrence: 1 }, romaji: { text: "chenji", occurrence: 1 } }, marks: "[wave]" }
```

`marks` 只接受 `[clap]`、`[wave]`、`[jump]`、`[spin]`，可重複，順序保留。句中位置同時指定日文與羅馬字目標，不以日文字元數推算羅馬字。before 位於目標第一字之前，after 位於最後一字之後，空白保持原樣；相同實際位置的圖示依宣告順序排列。

只有動作的行保留原時間與空的 jp，使用 start/end。圖示位置是視覺提示，沒有新增動作時間碼。句中位置不能切開 ruby。kana/both 的圖示顯示於日文行，romaji-only 顯示於羅馬字行，both 不重複顯示圖示。

## 版本與來源

`src/chant/version-data.js` 保存每首歌曲的版本資訊與 `CHANT_SOURCES`：

```js
{ versions: { jp: { kind: "guide", sourceIds: ["jp-canva"], notes: [] }, kr: { kind: "inherit", from: "jp" } } }
```

兩版必須存在。明確 inherit 才會沿用整版，缺漏、循環繼承、在繼承版本另寫行 override 都會失敗。獨立空指南使用 `{ kind: "guide", sourceIds: [], notes: [] }`；來源不明可留空。來源與提示依選擇版本顯示。`src/chant-guide.js` 保存版本名稱與差異摘要。

## 讀音與顯示

`furigana.js` 保存基礎假名與羅馬字，`src/furigana-corrections.js` 保存人工新增與修正。兩份資料的鍵與值皆不含動作標記；鍵必須與完整純歌詞一致，保留空白、標點及大小寫。`src/readings/lookup.js` 先驗證兩份資料，再以人工修正覆蓋相同鍵，建立唯讀查詢表。查詢採精確比對，不再移除動作或自動修正字串。空鍵、空讀音或動作標記會使驗證失敗，即使錯誤基礎讀音被人工修正覆蓋也不能忽略。網站與檢查工具共用此規則。

流程：讀音 DOM → 共用解析器計算合唱與動作位置 → 標記 `.chant-range` → 插入圖示 → 建立卡拉 OK 單位。圖示不在合唱 span 或卡拉 OK 單位中，rt/rp 不計入正文位置。切換版本與讀音會重新建立內容，避免圖示累積。

合唱主題色沿用原版 `--chant`：黑暗模式 `#f5942c`、明亮模式 `#9a4000`。歌詞狀態色集中於 `src/theme.css`，不另設重複的 `--chant-text`。`--chant-lyric-base` 為兩種模式共用的亮橘色 `rgba(245,148,44,.72)`，`--chant-reading` 為假名淡金色 `rgba(245,210,145,.9)`，`--chant-glow` 為正在唱的橘色光暈 `rgba(245,148,44,.55)`。

整行與部分合唱、日韓兩版使用相同規則；日文與羅馬字的 `.chant-range` 在尚未建立卡拉 OK 單位時也使用預設亮橘，避免讀音載入前後變色。中文的合唱範圍保留主題色，動作圖示保留各自識別色，非目前播放行的整行透明度維持原有行為。

| 狀態 | 合唱日文／羅馬字 | 光暈 |
|---|---|---|
| 關閉卡拉 OK | `--chant-lyric-base` | 無 |
| 開啟，未唱或非目前播放行 | `--chant-lyric-base` | 無 |
| 目前播放行，只有 `karaoke-current` | `--chant-lyric-base` | `--chant-glow` |
| 目前播放行，具有 `karaoke-lit` | `--chant` | 無 |
| 目前播放行，同時具有 `lit` 與 `current` | `--chant` | `--chant-glow` |

假名在上述狀態皆保留 `--chant-reading`。進度色與光暈選擇器限定卡拉 OK 開啟時生效；關閉後即使單位仍帶進度 class，也不套用完成色或光暈。`karaoke-lit` 表示已唱、`karaoke-current` 表示正在唱，兩者不合併，也不因應援版本而改變意義。

`summary.js` 從解析結果服務列表與歌曲頁：合唱每行只計一次，重複圖示不增加行數，動作摘要只表示是否存在。「只聽合唱」提前 1.2 秒、延後 0.6 秒、間隔小於 2.5 秒合併，最後一行沿用 8 秒推算。首頁只讀生成的 `src/song-mark-metadata.js`。

## 驗證

```sh
npm run test:content
npm run check:lyrics
npm run check:karaoke
npm run test:karaoke
npm run generate:chant-metadata
npm run check:chants
npm run test:chants
npm run test:chant-app
git diff --check
```

`check:chants` 檢查單行排版、metadata 分工、版本、讀音、目標位置、ruby 邊界與摘要；build 也執行此檢查。`test:content` 驗證純文字讀音鍵、人工修正優先順序、非法資料拒絕與歌詞單行格式。`test:chants` 驗證版本解析、合唱範圍、行內圖示、全曲文字保留、統計與練習區間；正常修改歌詞不需要更新整曲雜湊基準。

`test:chant-app` 建置後以 LinkeDOM 測試全曲兩版雙向切換、三種讀音與卡拉 OK，共 432 組案例，包括圖示數量及隔離。它無法代表實際瀏覽器的配色、排版、影片、PiP 或 Service Worker 驗收。

## 維護範例與已確認行為

修改歌詞文字或斷句時，在 `src/furigana-corrections.js` 同步補上新的完整純文字鍵與讀音；只改時間或動作時，不需變更讀音鍵。人工修正與基礎資料分開維護，不把兩者合成一份來源檔。基礎表源自歷史生成資料，repo 目前未提供重新生成它的工具；未來重新匯入資料時也必須遵守純文字鍵與人工修正優先規則。

〈不可幸力〉102.5 秒的日韓兩版皆在完整 `welcome to the dirty night` 前方揮手，不在單字中間插圖示；此行有實際歌曲的渲染回歸測試。其他行內動作仍可使用 before／after 定位。

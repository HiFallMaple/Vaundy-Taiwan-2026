# 歌曲內容與版本應援重構實作計畫

## 交接狀態與範圍

- 工作分支：`refactor/song-content`，由 `develop` 的 `24afe41611391da1993e5e57b1472fd332a0d6f2` 建立。使用者的 `devlopx` 按前文視為 `develop` 筆誤，當時沒有該名稱的本機或已知遠端分支。
- 本文件是實作規格，建立文件時尚未修改應用程式。接手時先讀 `AGENTS.md`、`docs/chant-data.md`、README 與 DESIGN，確認 status；不要重建或重設分支。
- 保留未追蹤的 `review/`，不要加入提交、刪除或覆寫。
- 使用者要求：每筆歌詞物件只占一個實體行，包含所有巢狀應援資料。禁止 formatter 將其展開。歌曲外層、陣列與其他程式可正常分行。
- 不改歌詞文字內容、翻譯、時間、影片、配色或卡拉 OK 演算法；移除已知動作 token 不算歌詞校正，但空白、標點必須保留。
- 不手改 `furigana.js`，不全面清理 corrections，不新增程式註解。說明寫在文件。
- 不改版本號、CHANGELOG、部署設定，不 merge、不發 PR、不部署。實作以小筆 Conventional Commits 留在本分支；是否推送由當次使用者指示決定。

## 目標與檔案分工

1. `src/song-lyrics.js` 改名 `src/song-content.js`，唯一匯出 `SONG_CONTENT`，移除舊 `SONGS` / `SONG_LYRICS` 別名並更新全部引用。
2. 每首內容物件只維護 `id`、`lyrics` 及查核後確實屬於歌曲內容的其他既有欄位。不可因為只認識兩個欄位就刪掉其餘資料。
3. 標題、影片 ID、翻譯署名只保留於 `src/song-metadata.js`。載入前後都使用這份 metadata，不再被內容物件覆寫。
4. 每行直接保存 `chants.jp` / `chants.kr`，取消跨檔以 `time` 與 `expectedText` 連接；不新增行 ID。
5. `src/chant/version-data.js` 保留 `CHANT_SOURCES` 及歌曲版本的 `kind/sourceIds/notes/from`；刪掉舊 `actions/cues/actionOverrides`。維持現有 export 名稱，避免無必要改名。
6. 保留 `resolve.js`、`render.js`、`summary.js`、`validate.js` 共用架構，調整輸入；生成摘要仍在 `src/song-mark-metadata.js`。
7. 新增 `src/readings/lookup.js`，放不依賴 DOM、window 或 Node 的讀音合併與正規化函式；lazy loader 及檢查腳本共用。

## 最終 authoring schema

下列資料只是格式範例，不得拿來覆寫歌曲的真實內容：

```js
export const SONG_CONTENT = [
  {
    id: "ExampleSong",
    lyrics: [
      { time: 49, jp: "今 チェンジ", tr: "此刻 Change", chants: { jp: { actions: [{ at: "start", marks: "[wave]" }], chant: { kind: "partial", parts: [{ jp: { text: "チェンジ", occurrence: 1 }, romaji: { text: "chenji", occurrence: 1 } }] } }, kr: { actions: [{ before: { jp: { text: "チェンジ", occurrence: 1 }, romaji: { text: "chenji", occurrence: 1 } }, marks: "[clap]" }], chant: { kind: "full" } } } },
      { time: 55, jp: "", chants: { jp: { actions: [{ at: "start", marks: "[clap][clap]" }] } } },
    ]
  }
];
```

- 欄位順序：`time`, `jp`, `tr`（原來有才保留）, `pic` 等既有行欄位, `chants`。不重新排序歌詞行。
- `chants` 無內容則省略。獨立 guide 的版本沒有行設定，表示該行沒有動作與合唱；不能回退到另一版。
- 整版 inherit 先依歌曲設定找出 resolvedVersion，再讀該版行資料。禁止在 inherit 版本下另放行 override，驗證應報錯，避免資料被忽略。禁止循環繼承。
- `chant` 省略表示 none；完整合唱 `kind: "full"`；部分合唱 `kind: "partial"` 保留現有 `parts`。
- 保留 `parts[].zh` 與 `translationParts` 的全部行為，不推測中文合唱範圍。
- `actions` 省略或空陣列表示無動作。兩個獨立版本各自保存完整有效動作，不再有共用動作加 override 的隱含優先級。

### 動作定位

- 每筆只允許一個位置欄位：`at: "start" | "end"`、`before` 或 `after`。
- `before` / `after` 同時具有 `jp` 與 `romaji` target，每個 target 是 `{ text, occurrence }`；occurrence 是從 1 開始的正整數。
- 尋找 target 沿用現有忽略空白、Unicode code point、保留大小寫與標點的範圍規則。before 指向目標起點，after 指向終點；前後空白保留原文，不新增斷詞規則。
- `marks` 必須完全由 `[clap]`、`[wave]`、`[jump]`、`[spin]` 組成；可重複，順序有意義。不能容許額外文字或不認識 token 悄悄消失。
- 同位置多筆按宣告順序；不同位置按文字順序呈現。日文及羅馬字定位各自計算。
- 空歌詞只能使用 start/end，不得使用文字 target。
- 動作不增加時間碼。圖示、rt/rp 不算正文，不參與逐字 timing。
- 不能切開 ruby 內部，遇到該情形報出歌曲、行、版本、目標；不要擴大位置或修改 ruby 猜測修復。

## 讀音入口

提供 `stripActionMarkers(text)`、`buildReadingLookup(base, corrections)` 及 `getReading(lookup, text)` 或等價的明確 API。base/corrections 都包含 furigana 與 romaji 兩張表。

處理順序不可顛倒：

1. 每張表先用原始完整鍵套用 corrections，維持原優先順序。
2. 移除鍵與值的已知動作 token。舊 token 語法應與現有 parser 對齊，包括括號與大小寫；不要順便 trim、壓縮空白或改標點。
3. 建立純文字索引。相同 key、相同 value 可合併；不同 value 收集成衝突並保留來源 key 供報告，不採 last-write-wins。
4. 僅有動作的舊空白鍵可排除索引；對應歌詞行不可刪除。
5. 衝突必須先處理才可遷移。若是明確已校正內容，可新增純文字 correction 並制定、測試其明確優先規則；若涉及真正不同語境讀音，回報使用者，不自行選擇、不另加未核准的例外系統。
6. 沒有讀音時保持既有純文字顯示 fallback；檢查仍必須擋住本來有映射的行退化成 fallback。

歷史 token 檔可原樣保留。瀏覽器不再直接由 main 取 `window.JP_*[line.jp]`；只有載入適配器接觸 legacy window 變數。scripts 使用 vm 讀取舊資料後，呼叫同一純函式，不自行實作另一套 normalize。

## 第零階段：先盤點，不能猜測

建立可重複執行的唯讀盤點工具，輸出緊湊報告（不要輸出整份歌詞）。

- 檢查所有歌曲／行欄位與 metadata 重複欄位，一致才刪重複；不一致列明兩值，不能任意選一份。
- 合併讀音後列出去標記衝突、缺失與空鍵。
- 對每行列出舊 token 的種類、順序、純文字位置；盤點句中、句尾、重複及純動作行。
- 對照目前各版本的有效 actions。以目前版本資料決定有哪些動作；舊 token 只提供可核對的位置資訊。
- 原始句中位置若能在日文與羅馬字唯一對應，才轉為 before/after。不能把日文字元索引套到 romaji，也不能只用文字長度比例。
- 舊標記與當前版本動作不同、缺少羅馬字位置、別名含義不清等情況，輸出待確認表；不要復活已取消動作或新增重複拍手。
- 新的行內位置功能用合成測試完整覆蓋；實際遷移遇到不能確認的位置，保留目前已知行首行為並列明差異，不能宣稱已恢復歷史位置。
- 若使用者要求恢復但定位無法確認，該部分需等待確認；其他獨立工作可繼續。

從固定 base 產生一次遷移基準：文字（只剝 token）、翻譯、時間、圖片、有效讀音、每版合唱範圍、動作、來源、notes、統計、練習區間。禁止遷移後用新結果整份覆蓋基準使測試過關。

## 實作階段與 commit 邊界

### 1. `test(chant): capture content migration invariants`

加入盤點工具及必要基準測試，不改 production 行為。沿用 `tests/fixtures/chant-baseline.json` 檢查合唱與原有效動作，另補位置與內容基準。報告衝突清單；這一步不得刪除讀音資料。

### 2. `refactor(readings): normalize action-free reading lookup`

加入讀音純模組、接到 lazy loader、main 與 scripts。此時歌詞仍含 token：使用獨立的純文字查詢，保留目前結構化動作 renderer，不可因此讓舊動作圖示重複出現。保持各讀音模式和 timing 的有效文字不變。

驗收：同一純文字加不同動作 token 能查到相同讀音；衝突會失敗；所有現有映射維持；重試載入不會重複處理或丟失修正。

### 3. `refactor(songs): consolidate song metadata`

只有完成 metadata 差異盤點後，從內容檔移除重複標題／影片／署名。更新 `loadSongLyrics` 呼叫端的合併方式，保留首頁輕量載入及歌曲頁 lazy load。檢查完整鍵集合，不能丟失 pic 或其他欄位。

### 4. `refactor(songs): rename lyrics module to song content`

使用 git mv 或等價 rename。匯出改成 `SONG_CONTENT`，loader 改名 `loadSongContent`，更新 scripts/tests/main/docs/AGENTS 全部引用。只改名稱，不同時搬應援資料，讓 rename 易審查。舊檔與舊匯出別名不保留。

### 5. `refactor(chant): colocate version cues and inline actions`

以一次性、可重跑的遷移工具讀取舊 schema，依毫秒時間與 expectedText 嚴格 join（僅遷移使用），產生新行資料；無匹配、重複、孤兒 cue 都失敗。不能只用文字 join，因副歌會重複。

- 將每個獨立版本的有效 chant/action 搬到行內，inherit 繼續在歌曲層處理。
- 剝離 jp 的動作 token；保留其他所有行欄位和值、順序。
- 移除舊跨檔 cues/actions/actionOverrides，runtime 不留雙 schema fallback。
- resolver 回傳既有 `time/chant/ranges/requestedVersion/resolvedVersion`，增加 `actionPlacements`（每筆含各顯示模式位置及有序圖示）；`actions` 保留為由 placements 派生的唯一動作種類清單，供摘要等消費，不能另手填。
- renderer 先生成讀音 DOM、標合唱，再插入動作；移除「先產生舊 token 圖示再刪掉」路徑。確認圖示不被 .chant-range 包覆而改色。
- kana / both 的動作顯示在日文行；romaji-only 顯示在羅馬字行，both 模式不在兩行重複顯示圖示，沿用現有視覺規則。
- 卡拉 OK 單位建立排除動作 DOM 及 rt/rp。切換版本或讀音必須重建乾淨 DOM，不能越切圖示越多。
- 更新 validate、summary、生成摘要腳本、check:lyrics、check:karaoke 及 smoke。
- 使用新格式 serializer 保證每個 lyric object 僅一個實體行，不用整份 JSON.stringify(..., null, 2) 展開歌曲。
- 舊 schema 遷移工具可保留為明確只接受歷史輸入的工具，或不提交一次性工具；不要將它接入 production/build。

每一階段同步相關文件、測試，不能提交破壞 build 的中間狀態。第五階段較大是因資料與消費端需原子遷移；不要混入歌詞校正或 UI 改版。

## 格式規則與防回歸

- 一行一筆歌詞，巢狀 actions、parts、chants 不換行；長行可用編輯器軟換行閱讀。
- 新增格式檢查，確認每個 lyrics 頂層元素從開始到結束只占一個實體行。若掃描原始碼，需能正確處理引號、跳脫與巢狀括號，不以簡單逗號切割。
- 不改成每曲一行，也不把整個模組壓成一行。
- 不引入 formatter、TypeScript、框架或其他無關依賴。

## 驗證矩陣

1. 讀音：原 key 覆蓋優先、剝 token 後碰撞、空白保留、ruby 內容、缺失 fallback、既有全曲映射。
2. 應援：full/partial/none、中文範圍、明確 inherit、空 guide、循環或無效版本、文字不存在、occurrence 與重疊。
3. 動作：start/end/before/after、同位置順序、重複、多種類、兩版本不同位置、純動作行、錯誤 token、ruby 內部邊界。
4. 時間：只改測試中的 line.time，應援仍正確跟隨；無額外 cue 時間需同步。既有卡拉 OK 13 項測試保留。
5. 統計：多圖示不增加合唱行數；列表與歌曲頁一致；練習區間仍 lead 1.2s / tail 0.6s / merge gap 2.5s / last fallback 8s。
6. 整合：所有歌曲、兩版切換、三種讀音與 karaoke on/off；舊 smoke 範圍不能縮小。檢查時間、純文字、翻譯與 metadata 相等。
7. 實際瀏覽器：明／暗配色、圖示位置、ruby、切換後不重複、卡拉 OK 圖示不占時間、懶載入。LinkeDOM 不代表視覺驗收通過；無法驗收需明確標示。

最終執行（變更期間每階段跑相關子集）：

```sh
npm run check:lyrics
npm run check:karaoke
npm run test:karaoke
npm run generate:chant-metadata
npm run check:chants
npm run test:chants
npm run test:chant-app
git diff --check
```

`test:chant-app` 已含 build，成功後不必無理由再 build。新增讀音與格式測試需加入 package scripts 並確保上述流程或明列的新指令有執行。

## 最終交接報告

- 列出每筆 commit 與用途、通過的指令、未完成的瀏覽器驗收。
- 列出實際恢復的行內位置，以及仍保留行首但無法確認歷史位置的項目；沒有就明寫零項。
- 說明日常怎麼改時間、合唱、動作位置與讀音，給一個單行資料範例。
- 確認 `furigana.js` 未修改、沒有無關歌詞更動、review/ 未動、每行歌詞格式符合要求。
- 更新 AGENTS、README、docs/chant-data.md 的 source-of-truth 與格式；不留下與實際 schema 相矛盾的指示。
- 停在本分支供使用者審核。不得將完成實作自行解讀為發布或合併授權。

## 實作結果

- 已依上述五階段完成。36 首／1,463 行均使用 `SONG_CONTENT`，每筆歌詞只有一個實體行；沒有新增行 ID 或重複應援時間。
- 全曲 metadata、純文字、翻譯、時間、圖片、讀音、版本來源、合唱範圍、統計與練習區間通過遷移前基準。生成摘要未變。
- `furigana.js` 與 `src/furigana-corrections.js` 均未修改，純文字讀音索引沒有衝突。21 個純動作行保留，重複歷史標記不自動改變已確認的版本動作。
- 唯一歷史句中標記〈不可幸力〉102.5 秒的 `w[wave]elcome…` 保留目前的行首位置；未擅自恢復單字內圖示。新行內定位由合成測試覆蓋，實際恢復零處、待確認一處。
- `test:content` 42 項、`test:chants` 93 項、`test:karaoke` 13 項、`check:lyrics`、`check:karaoke`、摘要生成檢查與 `git diff --check` 通過。`test:chant-app` 包含 build 與 432 組雙向版本／讀音／卡拉 OK 切換案例，亦通過。
- 當前瀏覽器工具沒有可用瀏覽器連線，明暗模式實際排版、影片、PiP 與 Service Worker 未在真實瀏覽器驗收；DOM 測試不代替此項。
- 日常維護與單行資料示例見 `docs/chant-data.md`。版本號、部署設定、既有配色與未追蹤的 `review/` 保持原樣。

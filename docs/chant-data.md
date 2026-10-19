# 應援資料維護

讀音由 `src/readings/lookup.js` 統一處理：先以完整舊鍵值套用人工修正，再移除鍵值與讀音內容的動作標記，建立純文字索引。標記不同但純文字相同的項目必須具有相同讀音，否則報錯；不會任意覆蓋。`furigana.js` 保留生成資料，修正仍放在 `src/furigana-corrections.js`。瀏覽器與檢查腳本共用此規則。

歌詞、翻譯、影片時間與圖片存於 `src/song-lyrics.js`。應援內容存於 `src/chant/version-data.js`；`src/chant-guide.js` 保留版本名稱、指南差異摘要與共用來源入口。完整應援資料與歌詞一起延遲載入，首頁只讀生成的 `src/song-mark-metadata.js`。

## 歌曲與版本

每首歌曲必須有 `actions` 及 `versions.jp`、`versions.kr`。兩版使用相同結構：

```js
{
  actions: [],
  versions: {
    jp: {
      kind: "guide",
      sourceIds: ["jp-canva"],
      notes: [],
      cues: [
        {
          time: 49,
          expectedText: "今 チェンジ",
          chant: {
            kind: "partial",
            parts: [
              {
                jp: { text: "チェンジ", occurrence: 1 },
                romaji: { text: "chenji", occurrence: 1 }
              }
            ]
          }
        }
      ]
    },
    kr: {
      kind: "guide",
      sourceIds: [],
      notes: [],
      cues: [
        {
          time: 49,
          expectedText: "今 チェンジ",
          chant: { kind: "full" }
        }
      ]
    }
  }
}
```

`time` 以整數毫秒比對現有歌詞行，`expectedText` 必須與該行完整 `jp` 字串完全相同，包含空白及保留的動作標記。每版同一行只放一筆 cue。修改時間或歌詞時，同步更新 cue 與共用動作的引用。

`kind: "full"` 標示完整日文與羅馬字，不接受 `parts`。`kind: "partial"` 必須提供非空的 `parts`，每段必填 `jp` 與 `romaji`；需要中文對應時才填 `zh`。整行合唱若有獨立中文對應，使用 `chant.translationParts: [{ text, occurrence }]`。中文不依翻譯內容自動推測合唱範圍。

片段忽略空白與動作標記比對，保留大小寫及標點。`occurrence` 必填、從 1 開始，可指定同一句中第二次出現的相同文字。解析結果採 Unicode 字元索引與半開區間 `[start, end)`，由程式產生，維護資料時不用手填索引。找不到文字、片段重疊或切入同一個 ruby 的內部，都會使檢查失敗；先修正對應或拆分讀音標記，不能擴大合唱範圍掩蓋問題。

明確沿用另一版本：

```js
jp: { kind: "inherit", from: "kr" }
```

明確沒有合唱：

```js
jp: { kind: "guide", sourceIds: [], notes: [], cues: [] }
```

空指南不會沿用另一版。缺漏版本或循環繼承會使檢查失敗。`sourceIds` 指向同檔案的 `CHANT_SOURCES`；來源不明時留空，提示與來源連結會依所選版本顯示。

## 動作

共用動作使用：

```js
actions: [
  {
    time: 52.5,
    expectedText: "[wave]輝いて消えないものに 手を伸ばして",
    values: ["wave"]
  }
]
```

動作只允許 `clap`、`wave`、`jump`、`spin`。各版本可提供 `actionOverrides`，每筆格式與共用動作相同；該行的 `values` 整組取代共用值，空陣列表示取消。

原始歌詞中的 `[wave]`、`[clap]` 等標記保留作為整行讀音查表鍵值的一部分，顯示時移除；動作圖示由解析後的 `actions` 產生，不再從歌詞推斷。新動作也應修改結構資料。

## 顯示與統計

`src/chant/resolve.js` 解析版本、合唱範圍與動作；`render.js` 使用 `.chant-range` 包覆對應文字。初次載入、切換版本及切換讀音都先產生讀音 DOM，再標記合唱，最後建立卡拉 OK 單位。歌詞行以 `data-chant="none|full|partial"` 表示狀態。

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

`summary.js` 同時服務列表摘要與歌曲頁。每行只計一次合唱，不按片段數計算。「只聽合唱」仍以行為單位，提前 1.2 秒、延後 0.6 秒，間隔小於 2.5 秒時合併；最後一行沿用 8 秒的結尾推算。

## 修改後驗證

```sh
npm run generate:chant-metadata
npm run check:lyrics
npm run check:karaoke
npm run check:chants
npm run test:chants
npm run test:chant-app
git diff --check
```

`generate:chant-metadata` 更新生成摘要；`check:chants` 檢查時間、文字、版本、來源、讀音、ruby 邊界與摘要是否過期。正式 `build` 也會先執行這項檢查。

`test:chants` 包含遷移基準、解析、全曲 DOM 渲染與練習區間測試。`tests/fixtures/chant-baseline.json` 記錄遷移時的合唱範圍與動作；經確認的內容修正需同步調整對應基準，不能為讓測試通過而整份盲目重生。

`test:chant-app` 先建置，再以 LinkeDOM 載入建置產物，執行 36 首歌曲的日韓雙向切換、三種讀音與卡拉 OK 切換，共 432 組案例。它不載入外部影片，也不提供瀏覽器排版、computed color、Document PiP 或 Service Worker 執行環境；這些仍需在支援的瀏覽器驗收。

import { buildReadingLookup, getReading } from "../readings/lookup.js";

let furiganaPromise = null;
let karaokeSourcesPromise = null;
let songLyricsPromise = null;
let readingLookup = null;
let correctionsPromise = null;
let chantGuides = null;
let chantSources = null;

export function getChantGuides(){
  return chantGuides;
}

export function getChantSources(){
  return chantSources;
}

export function loadSongLyrics(){
  if (!songLyricsPromise){
    songLyricsPromise = Promise.all([
      import("../song-lyrics.js"),
      import("../chant/version-data.js")
    ])
      .then(([{ SONG_LYRICS }, { CHANT_GUIDES, CHANT_SOURCES }]) => {
        chantGuides = CHANT_GUIDES;
        chantSources = CHANT_SOURCES;
        return new Map(SONG_LYRICS.map(song => [song.id, song]));
      })
      .catch((error) => {
        songLyricsPromise = null;
        throw error;
      });
  }
  return songLyricsPromise;
}

function loadCorrections(){
  if (!correctionsPromise){
    correctionsPromise = import("../furigana-corrections.js").catch(error => {
      correctionsPromise = null;
      throw error;
    });
  }
  return correctionsPromise;
}

export function getJapaneseReading(text, mode){
  return getReading(readingLookup?.[mode], text);
}

export function loadFurigana(){
  if (readingLookup) return Promise.resolve();
  if (!furiganaPromise){
    furiganaPromise = Promise.all([
      import("../../furigana.js"),
      loadCorrections()
    ]).then(([, corrections]) => {
      readingLookup = buildReadingLookup(
        { furigana: window.JP_FURIGANA, romaji: window.JP_ROMAJI },
        { furigana: corrections.FURIGANA_CORRECTIONS, romaji: corrections.ROMAJI_CORRECTIONS }
      );
    }).catch(error => {
      furiganaPromise = null;
      console.error("Reading data could not be loaded", error);
    });
  }
  return furiganaPromise;
}

export function loadKaraokeSources(){
  if (window.KARAOKE_SOURCES) return Promise.resolve(window.KARAOKE_SOURCES);
  if (!karaokeSourcesPromise){
    karaokeSourcesPromise = import("../../karaoke-sources.js")
      .then(() => window.KARAOKE_SOURCES || null)
      .catch(() => null);
  }
  return karaokeSourcesPromise;
}

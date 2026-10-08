/**
 * Styles of the DJ backing tracks: tempo, key, progression and the patterns of each instrument.
 * Drum patterns are one 16-step bar per string ("x" hit, "o" soft hit, "r" two 32nds, "t" three
 * hits, "." rest); an array cycles bar by bar.
 */

export type Drum = "kick" | "snare" | "clap" | "rim" | "hatC" | "hatO" | "ride" | "shaker" | "congaHigh" | "congaLow" | "bongo" | "cowbell" | "guiro" | "clave" | "tom";

export type Quality = "m" | "M" | "m7" | "M7" | "7" | "m9" | "sus";

export type BassSound = "sub" | "saw" | "acid" | "reese" | "wobble" | "808" | "octave";

export type HarmonySound = "stab" | "pad" | "piano" | "organ" | "strings";

/** [step, semitones above the chord root, length in steps, velocity]. */
export type BassNote = [number, number, number, number?];

export type HarmonyPart = { sound: HarmonySound; hits: [number, number][]; octave: number };

export type Lead = { steps: number[]; octave: number; order: "up" | "updown" };

export type Style = {
  bpm: number;
  /** MIDI note of the tonic in the bass register. */
  key: number;
  progression: [number, Quality][];
  swing?: number;
  /** The music ducks on every beat, like a sidechained house mix. */
  pump?: boolean;
  crackle?: boolean;
  drums?: Partial<Record<Drum, string | string[]>>;
  bass?: { sound: BassSound; notes: BassNote[] };
  harmony?: HarmonyPart[];
  lead?: Lead;
};

const FOUR = "x...x...x...x...";
const BACKBEAT = "....x.......x...";
const OFFBEAT = "..x...x...x...x.";
const EIGHTHS = "x.x.x.x.x.x.x.x.";
const SOFT_EIGHTHS = "o.o.o.o.o.o.o.o.";
const SIXTEENTHS = "oooooooooooooooo";
const DEMBOW = "...x..x....x..x.";
const OFFBEAT_HITS: [number, number][] = [
  [2, 1],
  [6, 1],
  [10, 1],
  [14, 1],
];
const WHOLE_BAR: [number, number][] = [[0, 16]];
const ALL_STEPS = Array.from({ length: 16 }, (_, step) => step);

const DEMBOW_BASS: BassNote[] = [
  [0, 0, 3],
  [3, 0, 2],
  [6, 0, 2],
  [8, 0, 3],
  [11, 0, 2],
  [14, 0, 2],
];

export const STYLES = {
  house: {
    bpm: 124,
    key: 33,
    progression: [
      [0, "m7"],
      [0, "m7"],
      [8, "M7"],
      [10, "M"],
    ],
    pump: true,
    drums: { kick: FOUR, clap: BACKBEAT, hatO: OFFBEAT, hatC: SOFT_EIGHTHS },
    bass: {
      sound: "saw",
      notes: [
        [2, 0, 2],
        [6, 0, 2],
        [10, 0, 2],
        [14, 12, 1],
        [15, 0, 1],
      ],
    },
    harmony: [
      {
        sound: "stab",
        hits: [
          [3, 1],
          [6, 1],
          [11, 1],
          [14, 1],
        ],
        octave: 24,
      },
    ],
  },
  deep: {
    bpm: 120,
    key: 26,
    progression: [
      [0, "m9"],
      [5, "m9"],
      [8, "M7"],
      [7, "m7"],
    ],
    swing: 0.1,
    pump: true,
    drums: { kick: FOUR, clap: BACKBEAT, rim: "...x.....x..x...", hatO: OFFBEAT, shaker: SIXTEENTHS },
    bass: {
      sound: "sub",
      notes: [
        [0, 0, 3],
        [6, 0, 2],
        [10, 7, 2],
        [14, 0, 2],
      ],
    },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
  },
  tech: {
    bpm: 126,
    key: 31,
    progression: [[0, "m"]],
    pump: true,
    drums: { kick: FOUR, clap: BACKBEAT, hatC: "x.oxx.oxx.oxx.ox", hatO: OFFBEAT, rim: "......x.....x...", shaker: SIXTEENTHS },
    bass: {
      sound: "saw",
      notes: [
        [2, 0, 1],
        [3, 0, 1],
        [6, 0, 1],
        [7, 12, 1],
        [10, 0, 1],
        [11, 0, 1],
        [14, 0, 1],
        [15, 3, 1],
      ],
    },
  },
  techno: {
    bpm: 130,
    key: 29,
    progression: [[0, "m"]],
    drums: { kick: FOUR, clap: "....o.......o...", hatO: OFFBEAT, ride: SOFT_EIGHTHS, rim: "...o..o....o.o.." },
    bass: {
      sound: "sub",
      notes: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((step): BassNote => [step, 0, 1, step % 4 === 2 ? 0.9 : 0.6]),
    },
  },
  acid: {
    bpm: 132,
    key: 33,
    progression: [[0, "m"]],
    drums: { kick: FOUR, clap: BACKBEAT, hatO: OFFBEAT, hatC: SIXTEENTHS },
    bass: {
      sound: "acid",
      notes: [
        [0, 0, 1, 1],
        [2, 12, 1, 0.7],
        [3, 0, 1, 0.6],
        [5, 3, 1, 1],
        [6, 0, 1, 0.6],
        [8, 12, 1, 0.8],
        [10, 0, 1, 0.6],
        [11, 15, 1, 1],
        [13, 0, 1, 0.6],
        [14, 7, 2, 0.9],
      ],
    },
  },
  trance: {
    bpm: 138,
    key: 33,
    progression: [
      [0, "m"],
      [8, "M"],
      [3, "M"],
      [10, "M"],
    ],
    pump: true,
    drums: { kick: FOUR, clap: BACKBEAT, hatO: OFFBEAT, hatC: "x.oxx.oxx.oxx.ox" },
    bass: { sound: "saw", notes: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((step): BassNote => [step, 0, 1]) },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
    lead: { steps: ALL_STEPS, octave: 36, order: "updown" },
  },
  dnb: {
    bpm: 174,
    key: 29,
    progression: [
      [0, "m7"],
      [8, "M7"],
      [10, "M"],
      [7, "m"],
    ],
    drums: { kick: ["x.........x.....", "x.........x..x.."], snare: BACKBEAT, hatC: EIGHTHS, shaker: SIXTEENTHS },
    bass: {
      sound: "reese",
      notes: [
        [0, 0, 10],
        [10, 0, 6],
      ],
    },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
  },
  boombap: {
    bpm: 90,
    key: 36,
    progression: [
      [0, "m7"],
      [8, "M7"],
      [5, "m7"],
      [7, "7"],
    ],
    swing: 0.18,
    drums: { kick: ["x......x..x.....", "x......x..x..x.."], snare: BACKBEAT, hatC: "x.x.x.x.x.x.x.o.", hatO: ".............x.." },
    bass: {
      sound: "sub",
      notes: [
        [0, 0, 3],
        [7, 0, 2],
        [10, 0, 3],
      ],
    },
    harmony: [
      {
        sound: "piano",
        hits: [
          [0, 10],
          [10, 6],
        ],
        octave: 24,
      },
    ],
  },
  trap: {
    bpm: 140,
    key: 30,
    progression: [
      [0, "m"],
      [0, "m"],
      [8, "M"],
      [10, "M"],
    ],
    drums: {
      kick: ["x......x..x.....", "x.....x...x..x.."],
      clap: "........x.......",
      hatC: ["x.x.x.x.x.x.rrx.", "x.x.x.x.t.x.x.x.", "x.x.x.x.x.x.x.x.", "x.x.rrx.x.x.ttx."],
    },
    bass: {
      sound: "808",
      notes: [
        [0, 0, 6],
        [7, 0, 3],
        [10, 0, 4],
        [14, -2, 2],
      ],
    },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
    lead: { steps: [0, 3, 6, 10, 12], octave: 36, order: "up" },
  },
  lofi: {
    bpm: 82,
    key: 29,
    progression: [
      [0, "M7"],
      [11, "m7"],
      [9, "m7"],
      [7, "M7"],
    ],
    swing: 0.2,
    crackle: true,
    drums: { kick: ["x.....x...x.....", "x.....x..x......"], snare: BACKBEAT, hatC: "x.o.x.o.x.o.x.oo" },
    bass: {
      sound: "sub",
      notes: [
        [0, 0, 4, 0.8],
        [10, 0, 3, 0.7],
      ],
    },
    harmony: [
      {
        sound: "piano",
        hits: [
          [0, 7],
          [7, 9],
        ],
        octave: 24,
      },
    ],
  },
  reggaeton: {
    bpm: 94,
    key: 33,
    progression: [
      [0, "m"],
      [8, "M"],
      [3, "M"],
      [10, "M"],
    ],
    drums: { kick: FOUR, snare: DEMBOW, hatC: EIGHTHS, shaker: SIXTEENTHS },
    bass: { sound: "808", notes: DEMBOW_BASS },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
    lead: { steps: [0, 3, 6, 8, 11, 14], octave: 36, order: "up" },
  },
  moombah: {
    bpm: 108,
    key: 31,
    progression: [
      [0, "m"],
      [8, "M"],
      [3, "M"],
      [10, "M"],
    ],
    drums: { kick: FOUR, snare: DEMBOW, clap: BACKBEAT, hatO: OFFBEAT, hatC: EIGHTHS },
    bass: { sound: "saw", notes: DEMBOW_BASS },
    harmony: [
      {
        sound: "stab",
        hits: [
          [0, 1],
          [3, 1],
          [6, 1],
          [10, 1],
        ],
        octave: 24,
      },
    ],
  },
  cumbia: {
    bpm: 95,
    key: 31,
    progression: [
      [0, "M"],
      [5, "M"],
      [7, "M"],
      [0, "M"],
    ],
    drums: { kick: "x.......x.......", guiro: "x.oox.oox.oox.oo", congaLow: "......x.......x.", congaHigh: "...x.....x.x....", cowbell: "o...o...o...o..." },
    bass: {
      sound: "saw",
      notes: [
        [0, 0, 4],
        [6, 7, 2],
        [8, 7, 4],
        [14, 0, 2],
      ],
    },
    harmony: [{ sound: "organ", hits: OFFBEAT_HITS, octave: 24 }],
  },
  electrocumbia: {
    bpm: 100,
    key: 33,
    progression: [
      [0, "m"],
      [5, "m"],
      [7, "M"],
      [0, "m"],
    ],
    drums: { kick: FOUR, clap: BACKBEAT, guiro: "x.oox.oox.oox.oo", congaHigh: "...x.....x.x....", congaLow: "......x.......x." },
    bass: {
      sound: "saw",
      notes: [
        [0, 0, 2],
        [3, 0, 1],
        [6, 7, 2],
        [8, 0, 2],
        [11, 0, 1],
        [14, 7, 2],
      ],
    },
    harmony: [{ sound: "organ", hits: OFFBEAT_HITS, octave: 24 }],
    lead: { steps: [0, 2, 4, 7, 8, 10, 12, 15], octave: 36, order: "updown" },
  },
  guaracha: {
    bpm: 128,
    key: 33,
    progression: [
      [0, "m"],
      [0, "m"],
      [8, "M"],
      [7, "M"],
    ],
    pump: true,
    drums: { kick: FOUR, clap: BACKBEAT, hatO: OFFBEAT, congaHigh: "x.xx.xx.x.xx.x.x", tom: "......x.......x.", cowbell: "..o...o...o...o.", shaker: SIXTEENTHS },
    bass: { sound: "saw", notes: OFFBEAT_HITS.map(([step]): BassNote => [step, 0, 2]) },
    harmony: [{ sound: "stab", hits: OFFBEAT_HITS, octave: 24 }],
  },
  afro: {
    bpm: 118,
    key: 26,
    progression: [
      [0, "m7"],
      [5, "m7"],
      [0, "m7"],
      [10, "M"],
    ],
    swing: 0.08,
    drums: { kick: FOUR, shaker: SIXTEENTHS, congaHigh: "..x.x..x..x.x..x", congaLow: "x.....x.....x...", rim: "x..x..x...x..x..", hatO: "..o...o...o...o." },
    bass: {
      sound: "sub",
      notes: [
        [0, 0, 3],
        [6, 0, 1],
        [10, 7, 2],
        [13, 10, 2],
      ],
    },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
    lead: { steps: [0, 3, 6, 10, 13], octave: 36, order: "updown" },
  },
  disco: {
    bpm: 116,
    key: 28,
    progression: [
      [0, "m7"],
      [5, "7"],
      [0, "m7"],
      [5, "7"],
    ],
    drums: { kick: FOUR, snare: BACKBEAT, hatO: OFFBEAT, hatC: SOFT_EIGHTHS, shaker: SIXTEENTHS },
    bass: { sound: "octave", notes: [0, 2, 4, 6, 8, 10, 12, 14].map((step): BassNote => [step, step % 4 === 0 ? 0 : 12, 1]) },
    harmony: [
      { sound: "strings", hits: WHOLE_BAR, octave: 24 },
      { sound: "stab", hits: OFFBEAT_HITS, octave: 36 },
    ],
  },
  synthwave: {
    bpm: 100,
    key: 33,
    progression: [
      [0, "m"],
      [8, "M"],
      [3, "M"],
      [10, "M"],
    ],
    drums: { kick: "x.......x.......", snare: BACKBEAT, hatC: EIGHTHS },
    bass: { sound: "saw", notes: [0, 2, 4, 6, 8, 10, 12, 14].map((step): BassNote => [step, 0, 1]) },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
    lead: { steps: ALL_STEPS, octave: 36, order: "up" },
  },
  dubstep: {
    bpm: 140,
    key: 29,
    progression: [
      [0, "m"],
      [0, "m"],
      [8, "M"],
      [7, "M"],
    ],
    drums: { kick: "x.........x.....", snare: "........x.......", hatC: SOFT_EIGHTHS },
    bass: {
      sound: "wobble",
      notes: [
        [0, 0, 6],
        [8, 0, 4],
        [12, 3, 4],
      ],
    },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
  },
  reggae: {
    bpm: 76,
    key: 31,
    progression: [
      [0, "M"],
      [5, "M"],
      [7, "M"],
      [5, "M"],
    ],
    swing: 0.15,
    drums: { kick: "........x.......", rim: "........x.......", hatC: "x.oxx.oxx.oxx.ox" },
    bass: {
      sound: "sub",
      notes: [
        [0, 0, 3],
        [4, 7, 2],
        [7, 12, 1],
        [8, 10, 3],
        [12, 7, 3],
      ],
    },
    harmony: [{ sound: "organ", hits: OFFBEAT_HITS, octave: 24 }],
  },
  ambient: {
    bpm: 90,
    key: 28,
    progression: [
      [0, "M7"],
      [5, "sus"],
      [9, "m7"],
      [7, "M"],
    ],
    bass: { sound: "sub", notes: [[0, 0, 16, 0.6]] },
    harmony: [{ sound: "pad", hits: WHOLE_BAR, octave: 24 }],
    lead: { steps: [0, 6, 10], octave: 36, order: "updown" },
  },
  latin: {
    bpm: 100,
    key: 31,
    progression: [[0, "M"]],
    drums: {
      congaHigh: "..x...x...x.....",
      congaLow: "............x.x.",
      bongo: "x.ox..ox..ox..ox",
      cowbell: "x.o.x.o.x.o.x.o.",
      clave: ["x..x..x.........", "....x...x......."],
      guiro: "x.oox.oox.oox.oo",
      shaker: SIXTEENTHS,
    },
  },
  afroPerc: {
    bpm: 118,
    key: 26,
    progression: [[0, "m"]],
    swing: 0.08,
    drums: { congaHigh: "..x.x..x..x.x..x", congaLow: "x.....x.....x...", bongo: ".x...x.x.x...x..", rim: "x..x..x...x..x..", shaker: SIXTEENTHS },
  },
  topLoop: {
    bpm: 124,
    key: 33,
    progression: [[0, "m"]],
    drums: { shaker: "xooxxooxxooxxoox", hatC: "..x...x...x...x.", rim: "...o..o....o..o.", ride: SOFT_EIGHTHS },
  },
} satisfies Record<string, Style>;

export type StyleId = keyof typeof STYLES;

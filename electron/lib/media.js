// media.js — audio conversion helpers.
// midiToOgg renders a Standard MIDI File to Ogg Vorbis. It prefers
// fluidsynth + a SoundFont when available (best quality), otherwise it uses
// the built-in synthesizer below, and encodes with ffmpeg.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const SAMPLE_RATE = 44100;

function which(bin) {
    const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}

function findSoundFont() {
    const candidates = [
        process.env.RPG9K_SOUNDFONT,
        "/usr/share/sounds/sf2/FluidR3_GM.sf2",
        "/usr/share/sounds/sf2/default-GM.sf2",
        "/usr/share/soundfonts/FluidR3_GM.sf2",
        "/usr/share/soundfonts/default.sf2"
    ].filter(Boolean);
    return candidates.find(f => fs.existsSync(f)) || null;
}

function describeMidiSupport() {
    const fluidsynth = which("fluidsynth");
    const soundfont = findSoundFont();
    const ffmpeg = which("ffmpeg");
    return {
        ffmpeg: !!ffmpeg,
        fluidsynth: !!(fluidsynth && soundfont),
        renderer: fluidsynth && soundfont ? "fluidsynth" : "builtin",
        soundfont
    };
}

//-----------------------------------------------------------------------------
// MIDI parsing

function parseMidi(buffer) {
    let pos = 0;
    const u8 = () => buffer[pos++];
    const u16 = () => (buffer[pos++] << 8) | buffer[pos++];
    const u32 = () => ((buffer[pos++] << 24) | (buffer[pos++] << 16) | (buffer[pos++] << 8) | buffer[pos++]) >>> 0;
    const str = n => {
        const s = buffer.toString("latin1", pos, pos + n);
        pos += n;
        return s;
    };
    const vlq = () => {
        let v = 0;
        for (;;) {
            const b = u8();
            v = (v << 7) | (b & 0x7f);
            if (!(b & 0x80)) return v;
        }
    };
    if (str(4) !== "MThd") throw new Error("Not a MIDI file");
    const headerLength = u32();
    const format = u16();
    const numTracks = u16();
    const division = u16();
    pos += headerLength - 6;
    if (division & 0x8000) throw new Error("SMPTE time division is not supported");
    const events = [];
    for (let t = 0; t < numTracks; t++) {
        while (pos < buffer.length && str(4) !== "MTrk") {
            const len = u32();
            pos += len;
        }
        const len = u32();
        const end = pos + len;
        let tick = 0;
        let running = 0;
        while (pos < end) {
            tick += vlq();
            let status = buffer[pos];
            if (status & 0x80) pos++;
            else status = running;
            if (status === 0xff) {
                const type = u8();
                const l = vlq();
                if (type === 0x51 && l === 3) {
                    const tempo = (buffer[pos] << 16) | (buffer[pos + 1] << 8) | buffer[pos + 2];
                    events.push({ tick, type: "tempo", tempo, order: 0 });
                }
                pos += l;
            } else if (status === 0xf0 || status === 0xf7) {
                pos += vlq();
            } else {
                running = status;
                const kind = status & 0xf0;
                const ch = status & 0x0f;
                const a = u8();
                const b = kind === 0xc0 || kind === 0xd0 ? 0 : u8();
                if (kind === 0x90 && b > 0) events.push({ tick, type: "on", ch, note: a, vel: b, order: 2 });
                else if (kind === 0x80 || kind === 0x90) events.push({ tick, type: "off", ch, note: a, order: 1 });
                else if (kind === 0xc0) events.push({ tick, type: "program", ch, program: a, order: 0 });
                else if (kind === 0xb0) events.push({ tick, type: "cc", ch, cc: a, value: b, order: 0 });
                else if (kind === 0xe0) events.push({ tick, type: "bend", ch, value: ((b << 7) | a) - 8192, order: 0 });
            }
        }
        pos = end;
    }
    events.sort((x, y) => x.tick - y.tick || x.order - y.order);
    // Convert ticks to seconds with the tempo map.
    let tempo = 500000;
    let lastTick = 0;
    let seconds = 0;
    for (const ev of events) {
        seconds += ((ev.tick - lastTick) * tempo) / division / 1e6;
        lastTick = ev.tick;
        ev.time = seconds;
        if (ev.type === "tempo") tempo = ev.tempo;
    }
    return { format, division, events, duration: seconds };
}

//-----------------------------------------------------------------------------
// Built-in synthesizer (General MIDI approximation)

function instrumentFor(program, drum) {
    if (drum) return { kind: "drum" };
    const family = Math.floor(program / 8);
    switch (family) {
        case 0: // pianos
            return { wave: "tri2", attack: 0.004, decay: 1.2, sustain: 0.15, release: 0.25, gain: 0.9 };
        case 1: // chromatic percussion
            return { wave: "sine2", attack: 0.002, decay: 0.9, sustain: 0.0, release: 0.3, gain: 0.8 };
        case 2: // organs
            return { wave: "organ", attack: 0.01, decay: 0.1, sustain: 0.85, release: 0.08, gain: 0.55 };
        case 3: // guitars
            return { wave: "pluck", attack: 0.003, decay: 0.8, sustain: 0.2, release: 0.2, gain: 0.8 };
        case 4: // bass
            return { wave: "bass", attack: 0.005, decay: 0.4, sustain: 0.6, release: 0.1, gain: 1.0 };
        case 5: // strings
        case 6: // ensemble
            return { wave: "saw", attack: 0.12, decay: 0.3, sustain: 0.8, release: 0.35, gain: 0.45, vibrato: 0.004 };
        case 7: // brass
            return { wave: "saw", attack: 0.03, decay: 0.2, sustain: 0.75, release: 0.15, gain: 0.5 };
        case 8: // reed
            return { wave: "square", attack: 0.03, decay: 0.2, sustain: 0.75, release: 0.12, gain: 0.4, vibrato: 0.003 };
        case 9: // pipe
            return { wave: "sine2", attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.15, gain: 0.7, vibrato: 0.004 };
        case 10: // synth lead
            return { wave: "square", attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.1, gain: 0.4 };
        case 11: // synth pad
            return { wave: "saw", attack: 0.3, decay: 0.5, sustain: 0.8, release: 0.6, gain: 0.35 };
        default:
            return { wave: "tri2", attack: 0.01, decay: 0.5, sustain: 0.5, release: 0.2, gain: 0.6 };
    }
}

function waveSample(wave, phase) {
    const p = phase - Math.floor(phase);
    switch (wave) {
        case "sine2":
            return Math.sin(2 * Math.PI * p) * 0.85 + Math.sin(4 * Math.PI * p) * 0.15;
        case "tri2": {
            const tri = 1 - 4 * Math.abs(p - 0.5);
            return tri * 0.7 + Math.sin(4 * Math.PI * p) * 0.3;
        }
        case "organ":
            return (Math.sin(2 * Math.PI * p) + 0.5 * Math.sin(4 * Math.PI * p) + 0.3 * Math.sin(6 * Math.PI * p)) / 1.8;
        case "pluck":
            return (2 * p - 1) * 0.5 + Math.sin(2 * Math.PI * p) * 0.5;
        case "bass":
            return Math.sin(2 * Math.PI * p) * 0.8 + (p < 0.5 ? 0.2 : -0.2);
        case "saw":
            return 2 * p - 1;
        case "square":
            return p < 0.5 ? 0.8 : -0.8;
        default:
            return Math.sin(2 * Math.PI * p);
    }
}

function renderDrum(note, vel, out, start, seed) {
    const n = out.length / 2;
    let rnd = seed;
    const noise = () => {
        rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
        return rnd / 0x3fffffff - 1;
    };
    let len, fn;
    if (note === 35 || note === 36) {
        len = 0.35;
        fn = t => Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9);
    } else if (note === 38 || note === 40) {
        len = 0.25;
        fn = t => (noise() * 0.7 + Math.sin(2 * Math.PI * 180 * t) * 0.4) * Math.exp(-t * 18);
    } else if (note === 42 || note === 44 || note === 46) {
        len = note === 46 ? 0.3 : 0.08;
        fn = t => noise() * 0.4 * Math.exp(-t * (note === 46 ? 10 : 45));
    } else if (note >= 49 && note <= 57) {
        len = 1.0;
        fn = t => noise() * 0.35 * Math.exp(-t * 3.5);
    } else if (note >= 41 && note <= 50) {
        len = 0.4;
        const f = 80 + (note - 41) * 18;
        fn = t => Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8);
    } else {
        len = 0.12;
        fn = t => noise() * 0.3 * Math.exp(-t * 30);
    }
    const amp = (vel / 127) * 0.6;
    const count = Math.min(Math.floor(len * SAMPLE_RATE), n - start);
    for (let i = 0; i < count; i++) {
        const v = fn(i / SAMPLE_RATE) * amp;
        out[(start + i) * 2] += v;
        out[(start + i) * 2 + 1] += v;
    }
}

function synthesize(midi) {
    const tail = 2.0;
    const total = Math.ceil((midi.duration + tail) * SAMPLE_RATE);
    const out = new Float32Array(total * 2);
    const channels = [];
    for (let c = 0; c < 16; c++) {
        channels.push({ program: 0, volume: 100 / 127, expression: 1, pan: 0.5, bend: 0, sustain: false });
    }
    const active = new Map(); // key "ch:note" -> note
    const notes = [];
    for (const ev of midi.events) {
        const ch = channels[ev.ch];
        if (ev.type === "program") ch.program = ev.program;
        else if (ev.type === "cc") {
            if (ev.cc === 7) ch.volume = ev.value / 127;
            else if (ev.cc === 11) ch.expression = ev.value / 127;
            else if (ev.cc === 10) ch.pan = ev.value / 127;
            else if (ev.cc === 64) {
                ch.sustain = ev.value >= 64;
                if (!ch.sustain) {
                    for (const [key, n] of active) {
                        if (n.ch === ev.ch && n.releasedWhileSustained) {
                            n.end = ev.time;
                            active.delete(key);
                        }
                    }
                }
            }
        } else if (ev.type === "bend") ch.bend = ev.value / 8192;
        else if (ev.type === "on") {
            const key = ev.ch + ":" + ev.note;
            const prev = active.get(key);
            if (prev) prev.end = ev.time;
            const n = {
                ch: ev.ch, note: ev.note, vel: ev.vel, start: ev.time, end: null, program: ch.program,
                volume: ch.volume * ch.expression, pan: ch.pan, bend: ch.bend
            };
            notes.push(n);
            active.set(key, n);
        } else if (ev.type === "off") {
            const key = ev.ch + ":" + ev.note;
            const n = active.get(key);
            if (n) {
                if (ch.sustain) n.releasedWhileSustained = true;
                else {
                    n.end = ev.time;
                    active.delete(key);
                }
            }
        }
    }
    for (const n of active.values()) n.end = midi.duration;
    let seed = 1;
    for (const n of notes) {
        const start = Math.floor(n.start * SAMPLE_RATE);
        if (n.ch === 9) {
            renderDrum(n.note, n.vel * n.volume, out, start, seed++);
            continue;
        }
        const inst = instrumentFor(n.program, false);
        const freq = 440 * Math.pow(2, (n.note - 69 + n.bend * 2) / 12);
        const held = Math.max(0.02, (n.end || n.start + 0.5) - n.start);
        const length = held + inst.release;
        const count = Math.min(Math.floor(length * SAMPLE_RATE), total - start);
        const amp = Math.pow(n.vel / 127, 1.4) * n.volume * inst.gain * 0.22;
        const left = Math.cos((n.pan * Math.PI) / 2);
        const right = Math.sin((n.pan * Math.PI) / 2);
        let phase = 0;
        let lp = 0;
        const cutoff = Math.min(0.9, (freq * 6) / SAMPLE_RATE + 0.05);
        for (let i = 0; i < count; i++) {
            const t = i / SAMPLE_RATE;
            let env;
            if (t < inst.attack) env = t / inst.attack;
            else if (t < inst.attack + inst.decay) {
                const d = (t - inst.attack) / inst.decay;
                env = 1 - (1 - inst.sustain) * d;
            } else env = inst.sustain;
            if (t > held) env *= Math.max(0, 1 - (t - held) / inst.release);
            if (env <= 0 && t > held) break;
            const vib = inst.vibrato ? 1 + inst.vibrato * Math.sin(2 * Math.PI * 5.5 * t) : 1;
            phase += (freq * vib) / SAMPLE_RATE;
            // One-pole low-pass softens the raw oscillators.
            lp += cutoff * (waveSample(inst.wave, phase) - lp);
            const v = lp * env * amp;
            out[(start + i) * 2] += v * left;
            out[(start + i) * 2 + 1] += v * right;
        }
    }
    // Normalise with headroom.
    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    const gain = peak > 0.9 ? 0.9 / peak : 1;
    // Trim trailing silence.
    let last = out.length - 1;
    while (last > 0 && Math.abs(out[last]) < 1e-4) last--;
    const frames = Math.min(total, Math.floor(last / 2) + SAMPLE_RATE / 4);
    return { data: out.subarray(0, frames * 2), gain, frames };
}

function encodeWav(pcm) {
    const { data, gain, frames } = pcm;
    const buffer = Buffer.alloc(44 + frames * 4);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + frames * 4, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(2, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
    buffer.writeUInt16LE(4, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(frames * 4, 40);
    for (let i = 0; i < frames * 2; i++) {
        const v = Math.max(-1, Math.min(1, data[i] * gain));
        buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
    }
    return buffer;
}

function renderMidiToWav(midiFile, wavFile) {
    const midi = parseMidi(fs.readFileSync(midiFile));
    fs.writeFileSync(wavFile, encodeWav(synthesize(midi)));
    return midi;
}

async function midiToOgg(midiFile, oggFile, options = {}) {
    const support = describeMidiSupport();
    const tmp = path.join(os.tmpdir(), "rpg9k-" + process.pid + "-" + Date.now() + ".wav");
    try {
        if (support.fluidsynth && !options.forceBuiltin) {
            execFileSync("fluidsynth", ["-ni", "-g", "0.8", "-F", tmp, "-r", String(SAMPLE_RATE), support.soundfont, midiFile], { stdio: "ignore" });
        } else {
            renderMidiToWav(midiFile, tmp);
        }
        if (!support.ffmpeg) {
            // Without ffmpeg keep a WAV next to the target so nothing is lost.
            fs.copyFileSync(tmp, oggFile.replace(/\.ogg$/i, ".wav"));
            throw new Error("ffmpeg is required to encode OGG; saved WAV instead.");
        }
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-c:a", "libvorbis", "-q:a", "5", oggFile], { stdio: "ignore" });
        return oggFile;
    } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
}

module.exports = { parseMidi, synthesize, encodeWav, renderMidiToWav, midiToOgg, describeMidiSupport };

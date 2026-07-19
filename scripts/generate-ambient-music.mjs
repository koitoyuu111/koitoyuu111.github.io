/**
 * 生成一段舒缓的环境纯音乐 (Ambient Piano-like tones)
 * 输出为 WAV 格式 (PCM 16-bit, 44100Hz, stereo)
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLE_RATE = 44100;
const DURATION = 120; // 2 minutes
const NUM_SAMPLES = SAMPLE_RATE * DURATION;
const NUM_CHANNELS = 2;

// Piano-like frequencies (C major pentatonic scale across octaves)
const NOTES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
];

// Generate a soft note with envelope
function generateNote(freq, startTime, duration, volume = 0.15) {
  const samples = new Float32Array(NUM_SAMPLES * NUM_CHANNELS);
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const noteSamples = Math.floor(duration * SAMPLE_RATE);
  const attackSamples = Math.floor(0.3 * SAMPLE_RATE);
  const releaseSamples = Math.floor(1.5 * SAMPLE_RATE);

  for (let i = 0; i < noteSamples && (startSample + i) < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const globalIdx = startSample + i;

    // Envelope
    let envelope = 1.0;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i > noteSamples - releaseSamples) {
      envelope = (noteSamples - i) / releaseSamples;
    }
    envelope = Math.max(0, Math.min(1, envelope));

    // Piano-like tone (fundamental + harmonics)
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
    const harmonic3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
    const harmonic4 = 0.125 * Math.sin(2 * Math.PI * freq * 4 * t);

    // Slight detune for warmth
    const detune = 0.002 * Math.sin(2 * Math.PI * 0.5 * t);
    const warm = Math.sin(2 * Math.PI * freq * (1 + detune) * t);

    let sample = (fundamental + harmonic2 + harmonic3 + harmonic4 + warm * 0.3) * envelope * volume;

    // Stereo panning (slight random)
    const pan = 0.5 + 0.3 * Math.sin(freq * 0.01);
    samples[globalIdx * NUM_CHANNELS] += sample * (1 - pan * 0.3);
    samples[globalIdx * NUM_CHANNELS + 1] += sample * (0.7 + pan * 0.3);
  }

  return samples;
}

// Generate ambient pad (very soft background)
function generatePad(freq, duration, volume = 0.03) {
  const samples = new Float32Array(NUM_SAMPLES * NUM_CHANNELS);
  const noteSamples = Math.floor(duration * SAMPLE_RATE);
  const attackSamples = Math.floor(3 * SAMPLE_RATE);
  const releaseSamples = Math.floor(3 * SAMPLE_RATE);

  for (let i = 0; i < noteSamples && i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    let envelope = 1.0;
    if (i < attackSamples) envelope = i / attackSamples;
    else if (i > noteSamples - releaseSamples) envelope = (noteSamples - i) / releaseSamples;
    envelope = Math.max(0, Math.min(1, envelope));

    // Soft pad with slow LFO
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.1 * t);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * volume * lfo;

    samples[i * NUM_CHANNELS] += sample;
    samples[i * NUM_CHANNELS + 1] += sample;
  }

  return samples;
}

console.log('Generating ambient music...');

// Mix all samples
const mixed = new Float32Array(NUM_SAMPLES * NUM_CHANNELS);

// Add ambient pads (C3 and G3)
const pad1 = generatePad(130.81, DURATION, 0.025);
const pad2 = generatePad(196.00, DURATION, 0.02);
for (let i = 0; i < mixed.length; i++) {
  mixed[i] += pad1[i] + pad2[i];
}

// Generate random gentle melody
let time = 2;
const rng = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};
const random = rng(42);

while (time < DURATION - 5) {
  const noteIdx = Math.floor(random() * NOTES.length);
  const freq = NOTES[noteIdx];
  const noteDuration = 2 + random() * 4;
  const volume = 0.08 + random() * 0.1;

  const noteSamples = generateNote(freq, time, noteDuration, volume);
  for (let i = 0; i < mixed.length; i++) {
    mixed[i] += noteSamples[i];
  }

  // Sometimes add a harmony note
  if (random() > 0.5) {
    const harmIdx = Math.min(noteIdx + 2, NOTES.length - 1);
    const harmFreq = NOTES[harmIdx];
    const harmSamples = generateNote(harmFreq, time + 0.5, noteDuration * 0.8, volume * 0.5);
    for (let i = 0; i < mixed.length; i++) {
      mixed[i] += harmSamples[i];
    }
  }

  time += 1.5 + random() * 3;
}

// Normalize and convert to 16-bit PCM
let maxVal = 0;
for (let i = 0; i < mixed.length; i++) {
  maxVal = Math.max(maxVal, Math.abs(mixed[i]));
}
const normalizeFactor = maxVal > 0 ? 0.8 / maxVal : 1;

// Write WAV file
const dataSize = NUM_SAMPLES * NUM_CHANNELS * 2; // 16-bit = 2 bytes
const buffer = Buffer.alloc(44 + dataSize);

// WAV header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // fmt chunk size
buffer.writeUInt16LE(1, 20); // PCM format
buffer.writeUInt16LE(NUM_CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * 2, 28); // byte rate
buffer.writeUInt16LE(NUM_CHANNELS * 2, 32); // block align
buffer.writeUInt16LE(16, 34); // bits per sample
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Write audio data
for (let i = 0; i < NUM_SAMPLES * NUM_CHANNELS; i++) {
  const sample = Math.max(-1, Math.min(1, mixed[i] * normalizeFactor));
  const intSample = Math.floor(sample * 32767);
  buffer.writeInt16LE(intSample, 44 + i * 2);
}

const outputPath = join(__dirname, '..', 'public', 'music', 'background.wav');
writeFileSync(outputPath, buffer);
console.log(`Generated: ${outputPath}`);
console.log(`Duration: ${DURATION}s, Size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

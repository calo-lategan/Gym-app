#!/usr/bin/env python3
"""
Synthesizes the game's sound effects into assets/sounds as small MP3 files.

    python3 scripts/build-sounds.py

Everything is generated from oscillators, noise and envelopes, so there are
no third-party audio licenses to track. Requires numpy and ffmpeg (libmp3lame).
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(7)


def t(duration):
    return np.arange(int(SR * duration)) / SR


def env(n, attack=0.005, decay=0.1, sustain=0.0, release=0.05, hold=0.0):
    """ADSR envelope with times in seconds, total length n samples."""
    a, d, h, r = (int(SR * x) for x in (attack, decay, hold, release))
    e = np.zeros(n)
    i = 0
    seg = min(a, n - i)
    e[i:i + seg] = np.linspace(0, 1, seg, endpoint=False) if seg > 0 else []
    i += seg
    seg = min(d, n - i)
    if seg > 0:
        e[i:i + seg] = np.linspace(1, sustain, seg, endpoint=False)
    i += seg
    seg = min(h, n - i)
    if seg > 0:
        e[i:i + seg] = sustain
    i += seg
    rest = n - i
    if rest > 0:
        start = e[i - 1] if i > 0 else sustain
        e[i:] = start * np.exp(-np.linspace(0, 6, rest)) if r > 0 else 0
    return e


def exp_decay(n, seconds):
    return np.exp(-np.arange(n) / (SR * seconds))


def filt(x, low=None, high=None):
    """Zero-phase FFT band filter with soft edges."""
    spectrum = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    mask = np.ones_like(freqs)
    if low:
        mask *= 1 / (1 + (low / np.maximum(freqs, 1)) ** 4)
    if high:
        mask *= 1 / (1 + (freqs / high) ** 4)
    return np.fft.irfft(spectrum * mask, len(x))


def sweep_filter(x, start, end, steps=24):
    """Crude time-varying low-pass by crossfading filtered chunks."""
    out = np.zeros_like(x)
    edges = np.linspace(0, len(x), steps + 1).astype(int)
    for k in range(steps):
        cutoff = start * (end / start) ** (k / max(1, steps - 1))
        seg = x[edges[k]:edges[k + 1]]
        if len(seg) > 8:
            out[edges[k]:edges[k + 1]] = filt(seg, high=cutoff)
    return out


def osc(freq, duration, shape='sine', detune=0.0):
    tt = t(duration)
    f = np.asarray(freq) if np.ndim(freq) else freq
    phase = 2 * np.pi * np.cumsum(np.broadcast_to(f, tt.shape)) / SR
    phase = phase * (1 + detune)
    if shape == 'sine':
        return np.sin(phase)
    if shape == 'square':
        return np.tanh(4 * np.sin(phase))
    if shape == 'saw':
        return 2 * ((phase / (2 * np.pi)) % 1) - 1
    if shape == 'tri':
        return 2 * np.abs(2 * ((phase / (2 * np.pi)) % 1) - 1) - 1
    raise ValueError(shape)


def noise(duration):
    return rng.uniform(-1, 1, int(SR * duration))


def reverb(x, seconds=1.2, mix=0.3, tone=6000):
    n = int(SR * seconds)
    ir = rng.uniform(-1, 1, n) * np.exp(-np.arange(n) / (SR * seconds / 5))
    ir = filt(ir, high=tone)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = np.fft.irfft(np.fft.rfft(np.pad(x, (0, n))) * np.fft.rfft(np.pad(ir, (0, len(x)))), len(x) + n)
    dry = np.pad(x, (0, n))
    return (1 - mix) * dry + mix * wet * 0.6


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def place(x, at, total):
    out = np.zeros(int(SR * total))
    i = int(SR * at)
    end = min(len(out), i + len(x))
    out[i:end] += x[:end - i]
    return out


def note(name):
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    base = names[name[0]]
    accidental = 1 if '#' in name else -1 if 'b' in name[1:] else 0
    octave = int(name[-1])
    return 440 * 2 ** ((base + accidental + (octave - 4) * 12) / 12)


def pluck(freq, duration, shape='tri', bright=4000, decay=0.25):
    x = osc(freq, duration, shape) + 0.4 * osc(freq * 2.005, duration, 'sine')
    return filt(x, high=bright) * exp_decay(len(x), decay)


def bell(freq, duration=1.4):
    partials = [(1, 1.0), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)]
    x = sum(a * osc(freq * r, duration) * exp_decay(int(SR * duration), duration / (2 + r)) for r, a in partials)
    return x


def normalize(x, peak=0.89):
    m = np.max(np.abs(x))
    return x / m * peak if m > 0 else x


def fade(x, ms=8):
    n = int(SR * ms / 1000)
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


# ── Sound definitions ─────────────────────────────────────────────

def s_tap():
    x = osc(np.linspace(1400, 900, int(SR * 0.05)), 0.05, 'sine') * env(int(SR * 0.05), 0.001, 0.045)
    return normalize(x, 0.5)


def s_set_start():
    a = pluck(note('E5'), 0.18, 'square', 3000, 0.08)
    b = pluck(note('B5'), 0.3, 'square', 3500, 0.12)
    return normalize(reverb(mix(a, place(b, 0.07, 0.4)), 0.5, 0.15), 0.7)


def s_slash():
    n = noise(0.32)
    x = sweep_filter(n, 900, 7000) * env(len(n), 0.04, 0.25)
    return normalize(filt(x, low=500), 0.8)


def s_set_end():
    # Sword pulled clear: whoosh into a bright metallic ring.
    whoosh = sweep_filter(noise(0.25), 1500, 9000) * env(int(SR * 0.25), 0.02, 0.2)
    ring_t = 0.9
    ring = sum(a * osc(f, ring_t) for f, a in [(2637, 0.6), (3951, 0.35), (5274, 0.2), (6950, 0.1)])
    ring = ring * exp_decay(len(ring), 0.25) * (1 + 0.15 * osc(9, ring_t))
    out = mix(whoosh * 0.7, place(ring, 0.08, 1.0) * 0.6)
    return normalize(reverb(out, 0.6, 0.2), 0.85)


def s_hit():
    body = osc(np.linspace(180, 55, int(SR * 0.22)), 0.22, 'sine') * env(int(SR * 0.22), 0.002, 0.2)
    crunch = filt(noise(0.12), low=800, high=5000) * env(int(SR * 0.12), 0.001, 0.1)
    return normalize(np.tanh(2.5 * mix(body, crunch * 0.6)), 0.95)


def s_crit():
    hit = s_hit()
    sparkle = sum(pluck(note(n), 0.5, 'tri', 9000, 0.18) * 0.5 for n in ['E6', 'B6'])
    return normalize(mix(hit, place(sparkle, 0.03, 0.6) * 0.5), 0.95)


def s_monster_death():
    clacks = sum(
        place(filt(noise(0.03), low=1500, high=7000) * env(int(SR * 0.03), 0.001, 0.028), at, 0.7) * (1 - at)
        for at in [0.0, 0.07, 0.13, 0.22, 0.3, 0.41, 0.5]
    )
    groan = osc(np.linspace(220, 70, int(SR * 0.6)), 0.6, 'saw') * env(int(SR * 0.6), 0.02, 0.55)
    return normalize(mix(clacks, filt(groan, high=900) * 0.4), 0.8)


def s_coin():
    a = osc(note('B5'), 0.08, 'square') * env(int(SR * 0.08), 0.001, 0.07, 0.6)
    b = osc(note('E6'), 0.35, 'square') * env(int(SR * 0.35), 0.001, 0.3)
    x = filt(mix(a, place(b, 0.075, 0.42)), high=7000)
    return normalize(reverb(x, 0.4, 0.12), 0.55)


def s_xp_tick():
    x = osc(note('A6'), 0.035, 'tri') * env(int(SR * 0.035), 0.001, 0.03)
    return normalize(x, 0.35)


def s_chest_open():
    creak_t = 0.55
    vib = 1 + 0.08 * osc(23, creak_t)
    creak = filt(osc(140 * vib, creak_t, 'saw'), low=300, high=2000) * env(int(SR * creak_t), 0.05, 0.4, 0.4, 0.1)
    thunk = s_hit() * 0.5
    sparkle = mix(*[place(pluck(note(n), 0.6, 'tri', 10000, 0.2), i * 0.06, 1.2) for i, n in enumerate(['E6', 'G#6', 'B6', 'E7'])])
    out = mix(creak * 0.5, place(thunk, 0.5, 1.4), place(sparkle, 0.55, 1.6) * 0.45)
    return normalize(reverb(out, 1.0, 0.25), 0.85)


def shimmer_chord(notes, duration, sparkle_notes, size=1.0):
    pad = mix(*[osc(note(n), duration, 'saw', detune=d) for n in notes for d in (-0.003, 0.003)])
    pad = filt(pad, high=2500 * size) * env(len(pad), 0.08, 0.4, 0.5, 0.6, hold=duration * 0.3)
    spark = mix(*[place(pluck(note(n), 0.7, 'tri', 11000, 0.25), i * 0.07, duration) for i, n in enumerate(sparkle_notes)])
    swell = sweep_filter(noise(duration), 600, 9000) * env(int(SR * duration), duration * 0.6, duration * 0.4)
    return mix(pad * 0.25, spark * 0.5, swell * 0.12 * size)


def s_loot_rare():
    return normalize(reverb(shimmer_chord(['E4', 'G#4', 'B4'], 1.2, ['B5', 'E6', 'G#6', 'B6']), 1.4, 0.3), 0.85)


def s_loot_epic():
    return normalize(reverb(shimmer_chord(['C#4', 'E4', 'G#4', 'B4'], 1.6, ['G#5', 'C#6', 'E6', 'G#6', 'C#7'], 1.3), 1.8, 0.35), 0.9)


def s_loot_legendary():
    choir = mix(*[filt(osc(note(n), 2.4, 'saw', detune=d), high=1800) for n in ['A3', 'E4', 'A4', 'C#5'] for d in (-0.004, 0.0, 0.004)])
    choir *= env(len(choir), 0.3, 0.6, 0.6, 0.8, hold=0.8)
    boom = osc(np.linspace(90, 40, int(SR * 0.8)), 0.8) * env(int(SR * 0.8), 0.005, 0.7)
    sparkle = shimmer_chord(['A4', 'C#5', 'E5'], 2.4, ['E6', 'A6', 'C#7', 'E7', 'A7'], 1.6)
    return normalize(reverb(mix(choir * 0.18, boom * 0.7, sparkle), 2.5, 0.4), 0.95)


def s_level_up():
    seq = ['C5', 'E5', 'G5', 'C6']
    lead = mix(*[place(filt(osc(note(n), 0.5, 'saw') + 0.5 * osc(note(n) * 2, 0.5, 'square'), high=4500) * env(int(SR * 0.5), 0.005, 0.2, 0.5, 0.2, hold=0.1), i * 0.11, 1.9) for i, n in enumerate(seq)])
    final = place(shimmer_chord(['C4', 'E4', 'G4', 'C5'], 1.4, ['G6', 'C7', 'E7'], 1.4), 0.44, 1.9)
    drum = place(s_hit() * 0.6, 0.44, 1.9)
    return normalize(reverb(mix(lead * 0.35, final, drum), 1.6, 0.3), 0.95)


def s_pr():
    stab = filt(mix(*[osc(note(n), 0.6, 'saw', detune=d) for n in ['D5', 'F#5', 'A5', 'D6'] for d in (-0.004, 0.004)]), high=5000)
    stab *= env(len(stab), 0.004, 0.25, 0.4, 0.3, hold=0.1)
    riser = sweep_filter(noise(0.5), 400, 8000) * env(int(SR * 0.5), 0.45, 0.05)
    out = mix(riser * 0.3, place(stab * 0.35, 0.45, 1.3), place(s_hit() * 0.5, 0.45, 1.3))
    return normalize(reverb(out, 1.2, 0.3), 0.95)


def s_rest_done():
    x = mix(bell(note('E5'), 1.6), place(bell(note('B5'), 1.6) * 0.7, 0.18, 1.9))
    return normalize(reverb(x, 1.2, 0.25), 0.75)


def s_countdown():
    x = osc(note('A5'), 0.09, 'square') * env(int(SR * 0.09), 0.002, 0.085)
    return normalize(filt(x, high=5000), 0.4)


def s_boss_roar():
    d = 1.6
    pitch = np.concatenate([np.linspace(70, 110, int(SR * 0.4)), np.linspace(110, 45, int(SR * (d - 0.4)))])
    growl = osc(pitch, d, 'saw') * (1 + 0.6 * osc(31, d))
    rasp = filt(noise(d), low=200, high=2500) * (0.5 + 0.5 * osc(17, d))
    x = np.tanh(3 * (growl * 0.6 + rasp * 0.5)) * env(int(SR * d), 0.15, 0.6, 0.6, 0.6, hold=0.4)
    return normalize(reverb(filt(x, high=3000), 1.6, 0.35), 0.95)


def s_gate_open():
    d = 1.8
    rumble = filt(noise(d), high=180) * env(int(SR * d), 0.2, 0.6, 0.7, 0.6, hold=0.6)
    chain = sum(place(filt(noise(0.04), low=2500, high=9000) * env(int(SR * 0.04), 0.001, 0.035), a, d) for a in np.arange(0.1, 1.3, 0.09))
    slam = place(s_hit(), 1.35, d)
    return normalize(reverb(mix(rumble * 1.6, chain * 0.3, slam * 0.8), 1.5, 0.35), 0.9)


def s_streak():
    whoosh = sweep_filter(noise(0.6), 300, 6000) * env(int(SR * 0.6), 0.25, 0.35)
    rise = filt(osc(np.geomspace(220, 880, int(SR * 0.6)), 0.6, 'saw'), high=3000) * env(int(SR * 0.6), 0.1, 0.5)
    return normalize(reverb(mix(whoosh * 0.6, rise * 0.25, place(s_coin() * 0.5, 0.45, 0.9)), 0.9, 0.25), 0.8)


def s_dragon_roar():
    roar = s_boss_roar()
    fire = sweep_filter(noise(2.2), 400, 3000) * env(int(SR * 2.2), 0.3, 1.0, 0.5, 0.8, hold=0.3)
    return normalize(mix(roar, place(fire, 0.6, 3.0) * 0.5), 0.95)


def s_ambience():
    """Seamless 24 second dungeon ambience: low drone, air and distant drips."""
    d = 24.0
    n = int(SR * d)
    drone = sum(a * osc(f, d, 'sine') for f, a in [(55, 0.5), (82.4, 0.25), (110.3, 0.12)])
    drone *= 0.6 + 0.4 * osc(0.125, d)  # whole cycles over the loop
    air = filt(noise(d), low=200, high=900) * (0.5 + 0.5 * osc(1 / 6, d, 'sine'))
    drips = np.zeros(n)
    for at in [1.7, 5.3, 9.8, 13.1, 17.6, 21.2]:
        drip = osc(np.geomspace(1800, 900, int(SR * 0.12)), 0.12) * exp_decay(int(SR * 0.12), 0.03)
        drips += place(drip, at, d)
    drips = reverb(drips, 2.0, 0.6)[:n]
    x = drone * 0.35 + air * 0.25 + drips * 0.15
    # Crossfade the tail into the head so the loop is seamless.
    k = int(SR * 1.0)
    x[:k] = x[:k] * np.linspace(0, 1, k) + x[-k:] * np.linspace(1, 0, k)
    return normalize(x[: n - k], 0.4)


SOUNDS = {
    'tap': s_tap,
    'set-start': s_set_start,
    'set-end': s_set_end,
    'slash': s_slash,
    'hit': s_hit,
    'crit': s_crit,
    'monster-death': s_monster_death,
    'coin': s_coin,
    'xp-tick': s_xp_tick,
    'chest-open': s_chest_open,
    'loot-rare': s_loot_rare,
    'loot-epic': s_loot_epic,
    'loot-legendary': s_loot_legendary,
    'level-up': s_level_up,
    'pr': s_pr,
    'rest-done': s_rest_done,
    'countdown': s_countdown,
    'boss-roar': s_boss_roar,
    'gate-open': s_gate_open,
    'streak': s_streak,
    'dragon-roar': s_dragon_roar,
    'ambience-dungeon': s_ambience,
}


def write_mp3(name, samples):
    os.makedirs(OUT, exist_ok=True)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        path = tmp.name
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    target = os.path.join(OUT, f'{name}.mp3')
    bitrate = '64k' if name.startswith('ambience') else '96k'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-ac', '1', '-b:a', bitrate, target], check=True)
    os.remove(path)
    print(f'{name:20s} {len(samples) / SR:5.2f}s {os.path.getsize(target) / 1024:6.1f} KB')


if __name__ == '__main__':
    for name, fn in SOUNDS.items():
        x = fn()
        if not name.startswith('ambience'):
            x = fade(x, 4)
        write_mp3(name, x)

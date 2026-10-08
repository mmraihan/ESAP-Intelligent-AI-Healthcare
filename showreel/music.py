"""Synthesises the showreel score (stereo, 44.1 kHz, 60 s, 120 BPM, C major).

Structure (matches reel.js timeline):
  0-5   hook      ambient pad, ECG blips, snap + chime at 2.4 s
  5-10  problem   pulse + hats + snare roll + riser, 9.93-10.0 dropout
  10    DROP      kick / sub / crash / chord stab
  10-26 drive     four-on-floor, offbeat bass, supersaw arp, card bells
  26-32 why       half-time breather, marimba bars, build back
  32-44 decide/team  full groove, hits on tile pops
  44-51 patients  warm, lighter drums, flip whoosh
  51-55 trust     impact hits at 51/52/53, riser to 55
  55-60 resolve   final hit, drums stop, collapse sweep, logo bell, long C major ring-out
Everything is generated with numpy/scipy; no samples.
"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)

L = np.zeros(N); R = np.zeros(N)           # dry bus
PADL = np.zeros(N); PADR = np.zeros(N)     # sidechained bus (pads, bass, arps)
REV = np.zeros(N)                          # reverb send (mono)


def hz(m):  # midi -> Hz
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, t0, sig, gain=1.0):
    i = int(t0 * SR)
    if i >= len(buf) or i < 0:
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def stereo(t0, sig, gain=1.0, pan=0.0, bus='dry', rev=0.0):
    pl = np.cos((pan + 1) * np.pi / 4); pr = np.sin((pan + 1) * np.pi / 4)
    if bus == 'dry':
        place(L, t0, sig, gain * pl); place(R, t0, sig, gain * pr)
    else:
        place(PADL, t0, sig, gain * pl); place(PADR, t0, sig, gain * pr)
    if rev:
        place(REV, t0, sig, gain * rev)


def tt(d):
    return np.arange(int(d * SR)) / SR


def adsr(d, a=.005, dcy=.1, s=.7, r=.1):
    n = int(d * SR); e = np.ones(n)
    na, nd, nr = int(a * SR), int(dcy * SR), int(r * SR)
    na = max(1, na)
    e[:na] = np.linspace(0, 1, na)
    nd = min(nd, max(0, n - na))
    if nd: e[na:na + nd] = np.linspace(1, s, nd)
    e[na + nd:] = s
    if nr and nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lp(sig, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), sig)


def hp(sig, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), sig)


def bp(sig, f1, f2, order=2):
    return sosfilt(butter(order, [f1, f2], 'band', fs=SR, output='sos'), sig)


def noise(d):
    return rng.standard_normal(int(d * SR))


# ---------------------------------------------------------------- drums
def kick(t0, vol=1.0):
    t = tt(.45)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 7.5)
    click = np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 400) * .3
    stereo(t0, np.tanh((sig + click) * 1.6) * .9, vol)


def clap(t0, vol=1.0):
    n = noise(.28)
    sig = bp(n, 1100, 6500)
    e = np.zeros(len(sig))
    for k, off in enumerate([0, .011, .022, .034]):
        i = int(off * SR); m = len(sig) - i
        e[i:] += np.exp(-tt(.28)[:m] * (40 if k < 3 else 16)) * (.6 if k < 3 else 1)
    stereo(t0, sig * e * .55, vol, 0.0, rev=.35)


def snare(t0, vol=1.0, tone=True):
    t = tt(.3)
    n = hp(noise(.3), 1500) * np.exp(-t * 18)
    b = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) if tone else 0
    stereo(t0, (n * .5 + b * .5), vol, 0.0, rev=.25)


def hat(t0, vol=1.0, open_=False, pan=.2):
    d = .25 if open_ else .06
    t = tt(d)
    sig = hp(noise(d), 7500) * np.exp(-t * (14 if open_ else 70))
    stereo(t0, sig * .3, vol, pan)


def crash(t0, vol=1.0, d=2.6):
    t = tt(d)
    sig = hp(noise(d), 4000) * np.exp(-t * 1.8)
    stereo(t0, sig * .5, vol, 0, rev=.5)


def riser(t0, d, vol=1.0, f0=400, f1=9000):
    n = int(d * SR); t = np.arange(n) / SR
    x = noise(d)
    out = np.zeros(n)
    steps = 40
    for s in range(steps):
        a, b = int(n * s / steps), int(n * (s + 1) / steps)
        fc = f0 * (f1 / f0) ** (s / steps)
        seg = x[max(0, a - 64):b]
        out[a:b] = hp(seg, min(fc, 18000), 2)[-(b - a):]
    out *= (t / d) ** 2.2
    stereo(t0, out * .45, vol, 0, rev=.3)


def whoosh(t0, d, vol=1.0, up=True, f0=300, f1=7000):
    n = int(d * SR); t = np.arange(n) / SR
    x = noise(d); out = np.zeros(n); steps = 30
    for s in range(steps):
        a, b = int(n * s / steps), int(n * (s + 1) / steps)
        u = s / steps
        fc = f0 * (f1 / f0) ** (u if up else 1 - u)
        seg = x[max(0, a - 64):b]
        out[a:b] = bp(seg, fc * .7, min(fc * 1.5, 20000), 2)[-(b - a):]
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    pan = np.sin(np.linspace(-1, 1, n)) * .6
    sig = out * env * .9
    place(L, t0, sig * (1 - np.clip(pan, 0, 1)) * .7, vol); place(R, t0, sig * (1 + np.clip(pan, -1, 0)) * .7, vol)
    place(REV, t0, sig, vol * .3)


def sub_hit(t0, f=48, vol=1.0, d=1.2):
    t = tt(d)
    sig = np.sin(2 * np.pi * (f + 40 * np.exp(-t * 9)) * t) * np.exp(-t * 3.0)
    stereo(t0, sig * .9, vol)


# ---------------------------------------------------------------- tonal
def saw_stack(f, d, detune=(-.12, -.05, 0, .05, .12), harm=14):
    t = tt(d); out = np.zeros(len(t))
    for dt in detune:
        ff = f * 2 ** (dt / 12)
        ph0 = rng.random() * 2 * np.pi
        for k in range(1, harm + 1):
            if ff * k > 11000: break
            out += np.sin(2 * np.pi * ff * k * t + ph0 * k) / k
    return out / len(detune) * 1.0


def pluck(t0, midi, d=.5, vol=1.0, pan=0.0, bright=3500, rev=.35, bus='pad'):
    f = hz(midi); t = tt(d)
    sig = saw_stack(f, d, detune=(-.08, 0, .08), harm=10) * np.exp(-t * 7)
    sig = lp(sig, bright)
    stereo(t0, sig * .35, vol, pan, bus=bus, rev=rev)


def bell(t0, midi, d=1.6, vol=1.0, pan=0.0, rev=.6):
    f = hz(midi); t = tt(d)
    sig = (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4) + .3 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 7))
    sig *= np.exp(-t * 2.6) * adsr(d, .002, .05, 1, .05)
    stereo(t0, sig * .3, vol, pan, rev=rev)


def marimba(t0, midi, vol=1.0, pan=0.0):
    f = hz(midi); t = tt(.7)
    sig = (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30)) * np.exp(-t * 6)
    stereo(t0, sig * .4, vol, pan, rev=.4)


def pad(t0, midis, d, vol=1.0, bright=2200, bus='pad'):
    t = tt(d); sig = np.zeros(len(t))
    for m in midis:
        sig += saw_stack(hz(m), d, detune=(-.14, -.06, 0, .06, .14), harm=9)
    e = adsr(d, min(1.6, d * .3), .1, .85, min(1.4, d * .3))
    sig = lp(sig * e, bright) * .18
    stereo(t0, sig, vol, 0.0, bus=bus, rev=.5)
    # width: slightly delayed copy on other side
    place(PADR if bus == 'pad' else R, t0 + .012, sig, vol * .5)


def bass(t0, midi, d=.45, vol=1.0):
    f = hz(midi); t = tt(d)
    sig = np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 5) + .25 * np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 9)
    sig = lp(sig, 600) * adsr(d, .004, .08, .8, .06)
    stereo(t0, sig * .7, vol, 0.0, bus='pad')


def stab(t0, midis, d=.55, vol=1.0):
    sig = np.zeros(int(d * SR))
    for m in midis:
        sig += saw_stack(hz(m), d, harm=12)
    t = tt(d)
    sig = lp(sig * np.exp(-t * 5) * adsr(d, .003, .1, .6, .08), 5200) * .2
    stereo(t0, sig, vol, 0.0, rev=.5)


# ---------------------------------------------------------------- arrangement
CHORDS = [  # I  V  vi  IV  (2 s each)
    ([48, 55, 60, 64, 67], 36, [60, 64, 67, 72]),   # C
    ([43, 55, 59, 62, 67], 31, [59, 62, 67, 71]),   # G
    ([45, 57, 60, 64, 69], 33, [57, 60, 64, 69]),   # Am
    ([41, 53, 57, 60, 65], 29, [60, 65, 69, 72]),   # F
]
def chord_at(t):
    return CHORDS[int(t // 2) % 4]

# --- pads: whole piece, per bar
for bar in range(30):
    t0 = bar * 2.0
    if t0 >= 58: break
    notes = chord_at(t0)[0]
    vol = .55 if t0 < 10 else .75
    if 26 <= t0 < 32: vol = .85
    if t0 >= 55: continue
    pad(t0, notes, 2.4, vol, bright=1800 + 40 * min(t0, 40))

# ---- 0-5 hook
for k, tb in enumerate([.9, 1.55, 2.0]):  # ECG blips (line draw)
    t = tt(.12); stereo(tb, np.sin(2 * np.pi * (900 + 300 * k) * t) * np.exp(-t * 40) * .25, 1.0, -.2 + k * .2, rev=.6)
riser(.15, 2.3, .5, 300, 6000)
sub_hit(2.4, 44, .9, 1.6); bell(2.4, 84, 2.0, .9); bell(2.5, 79, 2.0, .6, .3); bell(2.62, 88, 2.0, .5, -.3)
whoosh(3.0, .8, .45, True)
for i, m in enumerate([72, 76, 79, 84, 79, 76, 72, 76]):   # soft arp from 3.0
    pluck(3.0 + i * .25, m, .6, .28, -.4 + i * .1, 2800, .5)
sub_hit(3.55, 44, .5, 1.0)

# ---- 5-10 problem: pulse, hats, snare roll, riser
for tb in [5.0, 6.5, 8.0]:
    sub_hit(tb, 46, 1.0, 1.0); whoosh(tb - .15, .55, .5, True, 500, 5000)
for b in range(10):                      # soft pulse quarter-notes 5..10
    t0 = 5 + b * .5
    kick(t0, .35 + .08 * b)
for b in range(int((9.9 - 6.5) / .25)):  # 16th hats from 6.5
    t0 = 6.5 + b * .25
    hat(t0, .25 + .02 * b, pan=.3 if b % 2 else -.3)
# snare roll 8.0..9.93 accelerating
t0 = 8.0; step = .25
while t0 < 9.93:
    snare(t0, .35 + (t0 - 8) * .25, tone=False); step = max(.0625, step * .9); t0 += step
bass(5.0, 36, 4.0, .7); bass(8.0, 31, 1.9, .7)
riser(5.0, 4.93, 1.0, 400, 12000)
bell(9.6, 91, 1.2, .5, .0, .8)
for i, tb in enumerate([5.0, 6.5, 8.0]):  # tension notes
    pluck(tb, 60 + 7 * i, .8, .4, 0, 1800, .6)

# ---- DROP 10.0
kick(10.0, 1.0); sub_hit(10.0, 40, 1.0, 2.2); crash(10.0, 1.0, 3.0)
stab(10.0, [60, 64, 67, 72], .9, 1.0); stab(10.0, [48, 55], .9, .7)
whoosh(9.93, .5, .0, True)

# ---- 10-60 groove
def groove(start, end, drums=True, hats=True, bassline=True, arp=True, vol=1.0, kick_=True):
    t = start
    while t < end - 1e-6:
        beat = int(round((t - start) / BEAT))
        if drums and kick_:
            kick(t, vol)
        if drums and (int(round(t / BEAT)) % 4 in (2,)):   # beats 2 & 4 -> every 2nd quarter
            pass
        t += BEAT
    return

# kick on quarters
def kicks(a, b, v=1.0):
    t = a
    while t < b - 1e-6:
        kick(t, v); t += BEAT

def claps(a, b, v=.9):
    t = a + BEAT
    while t < b - 1e-6:
        clap(t, v); t += BEAT * 2

def hats16(a, b, v=.5):
    t = a; i = 0
    while t < b - 1e-6:
        acc = [1, .35, .65, .35][i % 4]
        hat(t + (.0 if i % 4 else 0), v * acc, open_=(i % 8 == 6), pan=.35 if i % 2 else -.35)
        t += .125; i += 1

def offbass(a, b, v=1.0):
    t = a
    while t < b - 1e-6:
        ch = chord_at(t)
        bass(t + .25, ch[1], .22, v)
        bass(t + .75 if False else t + .5 + .25, ch[1], .22, v * .9)
        t += BEAT * 2

def arp16(a, b, v=1.0, bright=4200):
    t = a; i = 0
    pat = [0, 1, 2, 3, 2, 1, 2, 3]
    while t < b - 1e-6:
        ch = chord_at(t)[2]
        m = ch[pat[i % 8]] + (12 if (i // 8) % 2 else 0)
        pluck(t, m, .32, v, -.5 + (i % 8) / 8, bright, .4)
        t += .25; i += 1

def stabs(a, b, v=.7):   # chord stabs on bar starts
    t = a
    while t < b - 1e-6:
        if int(t / 2) * 2 == t: stab(t, chord_at(t)[2], .5, v)
        t += 2

kicks(10.5, 26, 1.0); claps(10.0, 26); hats16(10.0, 26, .45); offbass(10.0, 26)
arp16(10.0, 16, .8, 3600); arp16(16, 26, 1.0, 4600); stabs(10, 16, .8)
# 26-32 why: breather, no kick 26.6-31
kicks(26, 26.6, .9)
for b in range(int((31 - 26.6) / .5)):
    kick(26.6 + b * .5, .0)
hats16(26.5, 31, .22); arp16(26.5, 31, .55, 3000)
bass(26.5, 36, 1.9, .6); bass(28.5, 31, 1.9, .6)
riser(30.4, 1.6, .7, 500, 10000)
t0 = 31.0; step = .25
while t0 < 31.97:
    snare(t0, .5 + (t0 - 31) * .5, tone=False); step = max(.0625, step * .85); t0 += step
# 32+ full groove
kick(32.0, 1.0); crash(32.0, .7, 2.0); sub_hit(32.0, 44, .8, 1.0)
kicks(32.5, 55, 1.0); claps(32, 55); hats16(32, 55, .45); offbass(32, 55)
arp16(32, 44, .9, 4600); arp16(44, 51, .65, 3200); arp16(51, 55, .5, 3600)
stabs(32, 44, .7)
# 44-51 patients: lighter drums
# (reduce by overlaying negative? simpler: skip claps in 44-51 by re-rendering) -> handled below via gain automation

# card pop bells 18.95 + .3i  (pentatonic ascending)
for i, m in enumerate([76, 79, 81, 84, 86]):
    bell(18.95 + i * .3, m, 1.4, .8, -.6 + i * .3, .5)
# Why bars marimba rising
for i, m in enumerate([67, 71, 74, 76, 79, 83]):
    marimba(29.4 + i * .22, m, .9, -.4 + i * .16)
bell(26.2, 88, 1.8, .5, .3)
# decide: click + check chime
t = tt(.05); stereo(34.05, np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 90) * .5, 1.0, .2)
bell(34.9, 84, 2.0, .9); bell(34.97, 88, 2.0, .7, .3); bell(35.05, 91, 2.2, .6, -.3)
# team tile pops
for i, tb in enumerate([37.0, 37.5, 38.0, 38.5]):
    pluck(tb, [72, 76, 79, 84][i], .5, .9, [-.5, .5, -.3, .3][i], 5000, .4)
    whoosh(tb - .1, .35, .35, True, 800, 6000)
for b in range(10, 14):  # on-beat cut accents 39..43 (each second)
    pass
for tb in np.arange(39.0, 44.0, 1.0):
    snare(tb + .0, .4, tone=True); hat(tb, .6, True)
whoosh(36.7, .6, .5, True); whoosh(43.7, .5, .45, True)
# patients flip
whoosh(47.0, 1.1, .7, True, 400, 8000)
bell(47.6, 79, 1.6, .6, .3); bell(47.68, 84, 1.6, .5, -.3)
for tb in [44.8, 46.3, 48.6]:
    pluck(tb, 79, .6, .6, 0, 3200, .6)
# trust hits
for i, tb in enumerate([51.0, 52.0, 53.0]):
    sub_hit(tb, 44, .9, 1.0); bell(tb + .05, [79, 83, 86][i], 1.8, .8, [-.4, 0, .4][i], .6)
    whoosh(tb - .2, .45, .4, True)
riser(53.0, 2.0, .9, 400, 12000)
whoosh(54.3, .7, .6, True)
# 55 resolve: final hit
kick(55.0, 1.0); sub_hit(55.0, 38, 1.0, 2.6); crash(55.0, 1.0, 3.2)
stab(55.0, [60, 64, 67, 72, 76], 1.6, .9)
whoosh(56.2, .95, .6, False, 7000, 500)               # collapse suck-in
sub_hit(56.95, 55, .6, 1.4)
# logo ding: C major add9 bells
for i, m in enumerate([72, 76, 79, 84, 86]):
    bell(56.95 + i * .06, m, 3.0, .85 - i * .06, -.5 + i * .25, .8)
# final resolve pad: long C major
pad(55.0, [48, 55, 60, 64, 67, 72], 5.0, .9, 2600)
bass(55.0, 36, 4.8, .9)
bell(58.1, 91, 2.5, .45, .2, .8); bell(58.65, 88, 2.4, .4, -.2, .8); bell(59.1, 96, 2.0, .35, .0, .9)
# shimmer arps in final
for i in range(12):
    pluck(57.5 + i * .25, [72, 76, 79, 84, 88, 84][i % 6] + 0, .9, .2, -.6 + (i % 6) * .24, 3600, .8)

# ------------------------------------------------------------ mix-down
t = np.arange(N) / SR

# sidechain duck (kick every .5s) from 10 s to 55 s except the breather
duck = np.ones(N)
def duck_range(a, b, depth=.62):
    tt_ = t[int(a * SR):int(b * SR)]
    ph = (tt_ - a) % BEAT
    duck[int(a * SR):int(b * SR)] = 1 - depth * np.exp(-ph / .11)
duck_range(10.0, 26.0); duck_range(32.0, 55.0)
duck_range(26.0, 26.6);
# ease ducking in breather
PADL *= duck; PADR *= duck

# patients section: soften percussion by dipping the dry bus a touch (44-51)
dip = np.ones(N); a, b = int(44 * SR), int(51 * SR)
dip[a:b] = .72
# breather dip 26.6-31 (no kick anyway; calm drums)
a2, b2 = int(26.6 * SR), int(31 * SR); dip[a2:b2] = .8
L *= dip; R *= dip

# reverb
ir_n = int(2.6 * SR); irt = np.arange(ir_n) / SR
ir = rng.standard_normal(ir_n) * np.exp(-irt * 2.3)
ir = lp(ir, 7500); ir[: int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR))
irL = ir; irR = np.roll(ir, 37) * (1 + .0)
revL = fftconvolve(REV, irL)[:N] * .10
revR = fftconvolve(REV, irR)[:N] * .10

outL = L + PADL + revL
outR = R + PADR + revR

# build automation: master level climbs through the first 10 s, full level from the drop
bg = np.ones(N); nb = int(10 * SR)
bg[:nb] = .42 + .40 * (np.arange(nb) / nb) ** 1.6
outL *= bg; outR *= bg
# dropout before the drop: 9.93-10.0
g = np.ones(N); g[int(9.93 * SR):int(10.0 * SR)] = np.linspace(1, 0, int(.07 * SR)) ** 2
# keep tails natural: apply only to dry+pad (approx via global)
outL *= g; outR *= g
# fades
fi = int(.05 * SR); outL[:fi] *= np.linspace(0, 1, fi); outR[:fi] *= np.linspace(0, 1, fi)
fo = int(.9 * SR); outL[-fo:] *= np.linspace(1, 0, fo) ** 1.5; outR[-fo:] *= np.linspace(1, 0, fo) ** 1.5

# master: soft clip + normalise to -1 dBFS peak, gentle hp
sos = butter(2, 28, 'high', fs=SR, output='sos')
outL = sosfilt(sos, outL); outR = sosfilt(sos, outR)
# loudness target: drive section (10-55 s) at about -15 dBFS RMS, then gentle soft-clip
seg = np.concatenate([outL[10 * SR:55 * SR], outR[10 * SR:55 * SR]])
rms = np.sqrt((seg ** 2).mean())
k = 10 ** (-15 / 20) / rms
outL *= k; outR *= k
def softclip(x, ceil=.93):
    return ceil * np.tanh(x / ceil)
outL = softclip(outL); outR = softclip(outR)
peak = max(np.abs(outL).max(), np.abs(outR).max())
print('peak', peak)

import wave
pcm = (np.stack([outL, outR], 1) * 32767).astype('<i2')
with wave.open('out/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote out/music.wav', len(outL) / SR, 's')
# loudness-ish report per 5 s
for a in range(0, 60, 5):
    seg = np.concatenate([outL[a * SR:(a + 5) * SR], outR[a * SR:(a + 5) * SR]])
    print(f'{a:2d}-{a + 5:2d}s rms {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dBFS')

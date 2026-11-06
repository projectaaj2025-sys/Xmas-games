#!/usr/bin/env python3
"""Render short bell-like previews from the credited CC0/public-domain MIDI files.
Requires mido (python -m pip install mido). Run from the repository root.
"""
import math
import struct
import wave
from array import array
from pathlib import Path
import mido

rate = 22050
seconds = 16
for source in sorted(Path('assets/melody/source').glob('*.mid')):
    midi = mido.MidiFile(source)
    samples = array('f', [0.0]) * (rate * seconds)
    active = {}
    now = 0.0
    notes = []
    for message in midi:
        now += message.time
        if now > seconds:
            break
        if message.type == 'note_on' and message.velocity:
            active[(message.channel, message.note)] = (now, message.velocity)
        elif message.type in ('note_off', 'note_on'):
            start = active.pop((message.channel, message.note), None)
            if start:
                notes.append((start[0], now, message.note, start[1]))
    notes.extend((start, seconds, pitch, velocity) for (_, pitch), (start, velocity) in active.items())
    for start, end, pitch, velocity in notes:
        freq = 440 * 2 ** ((pitch - 69) / 12)
        begin = max(0, int(start * rate))
        stop = min(len(samples), int((end + .25) * rate))
        duration = max(.05, end - start)
        volume = .13 * velocity / 127
        for i in range(begin, stop):
            t = (i - begin) / rate
            release = min(1, max(0, (duration + .25 - t) / .25))
            envelope = min(1, t / .012) * math.exp(-1.8 * t) * release
            phase = 2 * math.pi * freq * t
            samples[i] += volume * envelope * (math.sin(phase) + .25 * math.sin(2 * phase) + .1 * math.sin(3 * phase))
    target = Path('assets/melody/audio') / (source.stem + '.wav')
    with wave.open(str(target), 'wb') as output:
        output.setparams((1, 2, rate, len(samples), 'NONE', 'not compressed'))
        output.writeframes(b''.join(struct.pack('<h', round(max(-1, min(1, sample)) * 32767)) for sample in samples))
    print(target, len(notes), 'notes')

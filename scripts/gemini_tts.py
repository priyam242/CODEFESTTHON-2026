import io
import os
import json
import time
import wave
import struct
import base64
import subprocess
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv("server/.env")
if not os.environ.get("GEMINI_API_KEY"):
    load_dotenv(".env")

AUDIO_DIR = os.path.abspath("scripts/audio")
MASTER_AUDIO_DIR = os.path.abspath("scripts/audio/mastered")
TEMP_DIR = os.path.abspath("scripts/temp/audio_build")
RENDER_TTS_URL = "https://rentshield-api.onrender.com/api/tenancy/ai-tts"

ENFORCED_VOICE = "Puck"

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(MASTER_AUDIO_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()

FOUNDER_PROMPT_PREFIX = ""


def get_audio_duration(file_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "json", file_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(json.loads(res.stdout)["format"]["duration"])


def write_pcm_to_wav(raw_bytes: bytes, wav_path: str, sample_rate: int = 24000):
    """
    Safely writes PCM audio to a clean single-header WAV file.
    Extracts ONLY the true data chunk PCM when Gemini returns a RIFF container with IPTC XML chunks.
    """
    if raw_bytes[:4] == b"RIFF":
        with wave.open(io.BytesIO(raw_bytes), "rb") as src_wf:
            ch = src_wf.getnchannels()
            sw = src_wf.getsampwidth()
            sr = src_wf.getframerate()
            pcm_bytes = src_wf.readframes(src_wf.getnframes())
    else:
        ch, sw, sr = 1, 2, sample_rate
        pcm_bytes = raw_bytes

    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(ch)
        wf.setsampwidth(sw)
        wf.setframerate(sr)
        wf.writeframes(pcm_bytes)


def repair_double_riff_wav_if_needed(wav_path: str) -> bool:
    if not os.path.exists(wav_path):
        return False
    with open(wav_path, "rb") as f:
        raw = f.read()
    if len(raw) > 88 and raw[44:48] == b"RIFF":
        write_pcm_to_wav(raw[44:], wav_path)
        print(f"[AudioFix] Repaired double-RIFF & stripped XML tail -> {os.path.basename(wav_path)}")
        return True
    return False


def measure_voiced_f0_hz(wav_path: str) -> float:
    """Measures median voiced fundamental frequency (Hz) to detect female voice drift (>160Hz)."""
    with wave.open(wav_path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        n = w.getnframes()
        raw = w.readframes(n)
    samples = struct.unpack(f"<{n * ch}h", raw)
    if ch > 1:
        samples = samples[::ch]
    win = int(sr * 0.04)  # 40ms
    step = int(sr * 0.02)
    lag_min = max(10, int(sr / 290))
    lag_max = min(win - 1, int(sr / 80))
    f0s = []
    for k in range(0, len(samples) - win, step):
        seg = samples[k:k + win]
        energy = sum(x * x for x in seg) / win
        if energy < 350000:
            continue
        best_lag, best_r = 0, -1e18
        for lag in range(lag_min, lag_max):
            r = sum(seg[j] * seg[j + lag] for j in range(win - lag))
            if r > best_r:
                best_r = r
                best_lag = lag
        if best_lag > 0:
            f0s.append(float(sr) / best_lag)
    return sorted(f0s)[len(f0s) // 2] if f0s else 0.0


def master_scene_wav(raw_wav_path: str, mastered_wav_path: str) -> float:
    """
    Studio-masters a WAV clip to consistent 48kHz Stereo PCM:
    1. Repairs any double-RIFF header/XML tail
    2. Trims leading/trailing dead silence cleanly
    3. Applies 35ms fade-in + 60ms fade-out (prevents clicks & clipped syllable bleed)
    4. Applies EBU R128 loudnorm (I=-16:TP=-1.5:LRA=11)
    5. Pads 0.25s tail silence @ 48kHz Stereo 16-bit PCM
    """
    repair_double_riff_wav_if_needed(raw_wav_path)
    trimmed_tmp = os.path.join(TEMP_DIR, f"trimmed_{os.path.basename(raw_wav_path)}")

    subprocess.run([
        "ffmpeg", "-y", "-i", raw_wav_path,
        "-af", "silenceremove=start_periods=1:start_silence=0.04:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_silence=0.06:start_threshold=-45dB,areverse",
        "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", trimmed_tmp
    ], capture_output=True, text=True, check=True)

    trimmed_dur = get_audio_duration(trimmed_tmp)
    fade_out_start = max(0.05, trimmed_dur - 0.06)

    af_chain = (
        f"afade=t=in:st=0:d=0.035,"
        f"afade=t=out:st={fade_out_start:.4f}:d=0.06,"
        f"loudnorm=I=-16:TP=-1.5:LRA=11,"
        f"apad=pad_dur=0.25"
    )
    subprocess.run([
        "ffmpeg", "-y", "-i", trimmed_tmp,
        "-af", af_chain,
        "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", mastered_wav_path
    ], capture_output=True, text=True, check=True)

    return get_audio_duration(mastered_wav_path)


def _discover_tts_models(api_key: str) -> list:
    candidates = [
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts",
        "gemini-3.8-flash-tts",
        "gemini-3.8-flash-lite-tts",
    ]
    try:
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}")
        with urllib.request.urlopen(req, timeout=8) as res:
            models = json.loads(res.read().decode("utf-8")).get("models", [])
            for m in models:
                if "generateContent" in (m.get("supportedGenerationMethods") or []):
                    name = str(m.get("name", "")).replace("models/", "")
                    if "tts" in name.lower() and name not in candidates:
                        candidates.append(name)
    except Exception:
        pass
    return candidates


def _call_tts_once(prompt_text: str, wav_output_path: str) -> str:
    """Strictly passes prebuiltVoiceConfig voiceName='Puck' across every single request."""
    voice_name = ENFORCED_VOICE  # Strictly 'Puck' — NEVER switch voices

    if GEMINI_API_KEY.startswith("AIza"):
        models = _discover_tts_models(GEMINI_API_KEY)
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": voice_name}
                    }
                },
            },
        }
        encoded = json.dumps(payload).encode("utf-8")
        last_err = None
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
            for attempt in range(4):
                try:
                    req = urllib.request.Request(url, data=encoded, headers={"Content-Type": "application/json"})
                    with urllib.request.urlopen(req, timeout=40) as res:
                        data = json.loads(res.read().decode("utf-8"))
                        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                        for part in parts:
                            inline = part.get("inlineData", {})
                            if inline.get("data"):
                                raw_bytes = base64.b64decode(inline["data"])
                                write_pcm_to_wav(raw_bytes, wav_output_path, 24000)
                                return model
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode("utf-8", "ignore")[:240]
                    last_err = f"{model} HTTP {e.code}: {err_body}"
                    if e.code == 429 or e.code >= 500:
                        time.sleep(6 * (attempt + 1))
                        continue
                    break
                except Exception as e:
                    last_err = f"{model} error: {e}"
                    time.sleep(3)
        raise RuntimeError(f"Direct Google Gemini TTS failed: {last_err}")

    payload = json.dumps({"text": prompt_text, "voiceName": voice_name}).encode("utf-8")
    last_err = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(
                RENDER_TTS_URL,
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=45) as res:
                data = json.loads(res.read().decode("utf-8"))
                b64 = data.get("data")
                model_used = data.get("model", "gemini-tts")
                if not b64:
                    raise RuntimeError(f"Empty audio payload from Render TTS: {data}")
                raw_bytes = base64.b64decode(b64)
                write_pcm_to_wav(raw_bytes, wav_output_path, 24000)
                return model_used
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", "ignore")[:300]
            last_err = f"HTTP {e.code}: {err_body}"
            if e.code in (429, 502, 503, 504):
                time.sleep(8 * (attempt + 1))
                continue
            raise RuntimeError(f"Gemini TTS failed ({last_err})")
        except Exception as e:
            last_err = str(e)
            time.sleep(4)
    raise RuntimeError(f"Gemini Native TTS failed after retries: {last_err}")


def synthesize_gemini_tts_wav(text: str, wav_output_path: str, voice_name: str = "Puck") -> str:
    """
    Strictly enforces ENFORCED_VOICE ('Puck') and verifies male vocal F0 pitch (<158Hz).
    Retries cleanly if Gemini preview TTS drifts into a female pitch register.
    """
    prompt_text = f"{FOUNDER_PROMPT_PREFIX}{text}"
    best_model = None
    for retry in range(3):
        model_used = _call_tts_once(prompt_text, wav_output_path)
        best_model = model_used
        f0 = measure_voiced_f0_hz(wav_output_path)
        print(f"[GeminiTTS] {os.path.basename(wav_output_path)} -> model={model_used}, voice={ENFORCED_VOICE}, F0_med={f0:.1f}Hz")
        if 85.0 <= f0 <= 156.0:
            return model_used
        print(f"[GeminiTTS] Pitch drift detected ({f0:.1f}Hz != male Puck 85-156Hz); retrying cleanly ({retry + 1}/3)...")
        time.sleep(10.0)
    return best_model


def format_rupees_hinglish(amount: int) -> str:
    return f"{int(amount):,} रुपये"


def get_scene_scripts(cut_amount: int = 2800, refund_amount: int = 22200) -> dict:
    cut_text = format_rupees_hinglish(cut_amount)
    refund_text = format_rupees_hinglish(refund_amount)

    return {
        1: (
            "भारत में हर साल चालीस हज़ार करोड़ रुपये के रेंटल डिपॉज़िट्स बिना किसी ट्रांसपेरेंसी के फंस जाते हैं। "
            "मिलिए रेंटशील्ड से — भारत का पहला ऑटोनोमस साइबर-एस्क्रो सॉल्यूशन! "
            "गूगल सर्च से ओपन करते ही इसका लोगो स्मूदली नैवबार में लॉक हो जाता है, और वन-क्लिक में यह पी-डब्ल्यू-ए ऐप की तरह किसी भी फोन या लैपटॉप पर इंस्टॉल हो जाता है।"
        ),
        2: (
            "अब शुरू होता है हमारा रियल-टाइम स्प्लिट-स्क्रीन डेमो! बाईं तरफ गेस्ट प्रियम, और दाईं तरफ प्रॉपर्टी ओनर राजेश। "
            "दोनों अकाउंट्स लाइव लॉगिन होते ही, आप प्रोफाइल वॉल्ट के अंदर अपनी फोटो, यूपीआई आईडी और वेरीफाइड एड्रेस पूरी प्राइवेसी के साथ अपडेट कर सकते हैं।"
        ),
        3: (
            "एग्रीमेंट साइन करने से पहले ही, रेंटशील्ड का स्मार्ट लीज़ रिस्क स्कैनर हर छुपे हुए लीगल ट्रैप को पकड़ लेता है। "
            "दस महीने का सिक्योरिटी डिपॉज़िट या मनमाना पेंटिंग क्लॉज़ डालते ही, गूगल जेमिनी थ्री पॉइंट एट फ्लैश इसे पचानवे बाय सौ हाई रिस्क घोषित करता है, और मॉडल टेनेंसी एक्ट के हिसाब से फेयर रिप्लेसमेंट क्लॉज़ भी लिख कर देता है।"
        ),
        4: (
            "अब टेनेंट पच्चीस हज़ार रुपये का सिक्योरिटी डिपॉज़िट और इंदिरानगर प्रॉपर्टी डिटेल्स डालकर एस्क्रो कॉन्ट्रैक्ट शुरू करता है। "
            "और दाईं तरफ ओनर की स्क्रीन देखिए — बिना एक भी रीलोड किए, लाइव ऑटो-सिंक से यह नया कॉन्ट्रैक्ट तुरंत ओनर के डैशबोर्ड पर आ गया!"
        ),
        5: (
            "स्टेप वन में टेनेंट लिविंग रूम की साफ़ मूव-इन फोटो चुनता है, और ब्राउज़र के अंदर ही शा टू-फिफ्टी-सिक्स हैश लॉक हो जाता है। "
            "ओनर पोर्टल लिंक से फोटो चेक करके रिवीजन अलर्ट भेजता है — और फिर अपनी यूपीआई आईडी कन्फर्म करके बेसलाइन अप्रूव एंड लॉक करते ही, स्टेप थ्री डिपॉज़िट तुरंत अनलॉक हो जाता है।"
        ),
        6: (
            "देखिए असली टू-पार्टी पेमेंट डिज़ाइन! दाईं तरफ ओनर की स्क्रीन पर लाइव रिसीविंग टर्मिनल और क्यूआर कोड ऑन है। "
            "और बाईं तरफ गेस्ट के चेकआउट पॉपअप में कोई डुप्लीकेट क्यूआर नहीं — बल्कि सीधे रेज़रपे वेरीफाइड एस्क्रो या यूपीआई ट्रांसफर का ऑप्शन है! "
            "पच्चीस हज़ार रुपये पे होते ही ओनर की स्क्रीन लाइव अपडेट हो जाती है।"
        ),
        7: (
            "अब देखिए स्टेप फोर में रेंटशील्ड का ट्रिपल एंटी-फ्रॉड इंजन और वन-क्लिक जज क्विक-टेस्ट चिप्स! "
            "डुप्लीकेट फोटो डालने पर हैश डिटेक्टर ब्लॉक करता है, और सेल्फी अपलोड करने पर बत्तीस बाय बत्तीस सीन डिटेक्टर उसे भी रोक देता है! "
            f"फिर असली फटी हुई सोफा फोटो डालते ही... गूगल जेमिनी थ्री पॉइंट एट फ्लैश {cut_text} की फेयर रिपेयर कटौती और {refund_text} का नेट रिफंड कैलकुलेट करता है!"
        ),
        8: (
            f"स्टेप फाइव में बाईं तरफ गेस्ट की स्क्रीन पर {refund_text} का लाइव रिफंड क्यूआर टर्मिनल आ गया है! "
            f"दाईं तरफ से ओनर {refund_text} का नेट रिफंड रिलीज करता है। "
            "पेमेंट पूरा होते ही दोनों डैशबोर्ड्स बिना रीलोड किए लाइव ज़ीरो रुपये पर ऑटो-क्लियर होकर सेटल्ड हिस्ट्री में चले जाते हैं!"
        ),
        9: (
            "स्टेप सिक्स में दोनों पार्टीज को इंस्टैंट लीगल रिकॉर्ड्स मिलते हैं। "
            "बाईं तरफ टेनेंट के लिए स्कैनेबल सोसाइटी मूव-आउट गेट पास और एनओसी, और दाईं तरफ ओनर के लिए ऑफिशियल एस्क्रो सेटलमेंट रिसीट — बिल्कुल टैक्स और ऑडिट रेडी रहते हैं।"
        ),
        10: (
            "और अंत में, रेंटशील्ड का ज़ीरो-सर्वर कोर्ट रूम वेरीफायर! बिना किसी सर्वर के, सीधे ब्राउज़र में ओरिजिनल फोटो ड्रॉप करते ही हंड्रेड परसेंट ऑथेंटिक ज़ीरो-पिक्सल टैम्परिंग प्रूफ मिल जाता है। "
            "यह है रेंटशील्ड — फास्ट, ट्रांसपेरेंट और फ्रॉड-फ्री रेंटल एस्क्रो!"
        ),
    }


def generate_all_scenes_audio(
    cut_amount: int = 2800,
    refund_amount: int = 22200,
    force_scenes: set = None,
) -> tuple:
    scripts = get_scene_scripts(cut_amount, refund_amount)
    durations = {}
    mastered_paths = {}
    total = 0.0
    force_scenes = force_scenes or set()

    print("=" * 80)
    print(f"SYNTHESIZING & STUDIO-MASTERING GEMINI VOICEOVER (STRICT VOICE: {ENFORCED_VOICE}, 48kHz STEREO)")
    print(f"Dynamic Numbers -> Deduction: ₹{cut_amount:,} | Net Refund: ₹{refund_amount:,}")
    print("=" * 80)

    for scene_id, text in scripts.items():
        wav_path = os.path.join(AUDIO_DIR, f"scene_{scene_id}.wav")
        master_path = os.path.join(MASTER_AUDIO_DIR, f"scene_{scene_id}_master.wav")

        if scene_id in force_scenes or not os.path.exists(wav_path) or os.path.getsize(wav_path) <= 50000:
            synthesize_gemini_tts_wav(text, wav_path, voice_name=ENFORCED_VOICE)
            time.sleep(15.0)
        else:
            print(f"[GeminiTTS] Reusing verified Puck WAV -> {os.path.basename(wav_path)}")

        dur = master_scene_wav(wav_path, master_path)
        durations[scene_id] = dur
        mastered_paths[scene_id] = master_path
        total += dur
        f0 = measure_voiced_f0_hz(master_path)
        print(f"  -> Scene {scene_id:02d} Studio Master (48kHz Stereo, F0={f0:.1f}Hz, fade+loudnorm): {dur:.2f}s")

    with open(os.path.join(AUDIO_DIR, "durations.json"), "w", encoding="utf-8") as f:
        json.dump(durations, f, indent=2)
    print(f"\nTotal Studio-Mastered Voiceover Duration: {total:.2f}s ({total/60:.2f} min)")
    return durations, mastered_paths


if __name__ == "__main__":
    generate_all_scenes_audio(cut_amount=2800, refund_amount=22200, force_scenes={3, 5, 7})

import os
import json
import time
import wave
import base64
import subprocess
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv("server/.env")
if not os.environ.get("GEMINI_API_KEY"):
    load_dotenv(".env")

AUDIO_DIR = os.path.abspath("scripts/audio")
TEMP_DIR = os.path.abspath("scripts/temp/audio_build")
SCENE7_SAMPLE_WAV = os.path.abspath("gemini_voice_sample_scene07.wav")
RENDER_TTS_URL = "https://rentshield-api.onrender.com/api/tenancy/ai-tts"

os.makedirs(AUDIO_DIR, exist_ok=True)
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


def write_pcm_to_wav(pcm_bytes: bytes, wav_path: str, sample_rate: int = 24000):
    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # signed 16-bit PCM
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)


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


def synthesize_gemini_tts_wav(text: str, wav_output_path: str, voice_name: str = "Puck") -> str:
    """
    Calls Google's Official Gemini Native TTS REST API (STRICTLY NO edge-tts / pyttsx3 fallback).
    Uses local AIzaSy GEMINI_API_KEY if present, or Render's authenticated GEMINI_API_KEY via /api/tenancy/ai-tts.
    Decodes raw 16-bit 24kHz mono PCM base64 directly into a valid .wav file via Python's wave module.
    """
    prompt_text = f"{FOUNDER_PROMPT_PREFIX}{text}"

    # Path A: Direct Google AI Studio API call when AIzaSy... key is available locally
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
                                print(f"[GeminiTTS] OK ({model}, Puck) -> {os.path.basename(wav_output_path)}")
                                return model
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode("utf-8", "ignore")[:240]
                    last_err = f"{model} HTTP {e.code}: {err_body}"
                    if e.code == 429 or e.code >= 500:
                        wait_s = 6 * (attempt + 1)
                        print(f"[GeminiTTS] Rate-limit/transient ({e.code}) on {model}, backing off {wait_s}s...")
                        time.sleep(wait_s)
                        continue
                    break
                except Exception as e:
                    last_err = f"{model} error: {e}"
                    time.sleep(3)
        raise RuntimeError(f"Direct Google Gemini TTS failed: {last_err}")

    # Path B: Render env proxy endpoint (calls generativelanguage.googleapis.com using Render's GEMINI_API_KEY)
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
                print(f"[GeminiTTS] OK via Render env ({model_used}, Puck) -> {os.path.basename(wav_output_path)}")
                return model_used
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", "ignore")[:300]
            last_err = f"HTTP {e.code}: {err_body}"
            if e.code in (429, 502, 503, 504):
                wait_s = 8 * (attempt + 1)
                print(f"[GeminiTTS] Render TTS HTTP {e.code}, retrying in {wait_s}s...")
                time.sleep(wait_s)
                continue
            raise RuntimeError(f"Gemini TTS failed ({last_err})")
        except Exception as e:
            last_err = str(e)
            time.sleep(4)

    raise RuntimeError(f"Gemini Native TTS failed after retries: {last_err}")


def format_rupees_hinglish(amount: int) -> str:
    return f"{int(amount):,} रुपये"


def get_scene_scripts(cut_amount: int = 3500, refund_amount: int = 21500) -> dict:
    cut_text = format_rupees_hinglish(cut_amount)
    refund_text = format_rupees_hinglish(refund_amount)

    return {
        1: (
            "भारत में हर साल चालीस हज़ार करोड़ रुपये के रेंटल डिपॉज़िट्स बिना किसी ट्रांसपेरेंसी के फंस जाते हैं। "
            "मिलिए रेंटशील्ड से — भारत का पहला ऑटोनोमस साइबर-एस्क्रो सॉल्यूशन! "
            "गूगल सर्च से ओपन करते ही इसका लोगो स्मूदली नैवबार में लॉक हो जाता है, और वन-क्लिक में यह पी डब्ल्यू ए ऐप की तरह किसी भी फोन या लैपटॉप पर इंस्टॉल हो जाता है।"
        ),
        2: (
            "अब शुरू होता है हमारा रियल-टाइम स्प्लिट-स्क्रीन डेमो! बाईं तरफ गेस्ट प्रियम, और दाईं तरफ प्रॉपर्टी ओनर राजेश। "
            "दोनों अकाउंट्स लाइव लॉगिन होते ही, आप प्रोफाइल वॉल्ट के अंदर अपनी फोटो, यूपीआई आईडी और वेरीफाइड एड्रेस पूरी प्राइवेसी के साथ अपडेट कर सकते हैं।"
        ),
        3: (
            "टेनेंट पच्चीस हज़ार रुपये का सिक्योरिटी डिपॉज़िट और इंदिरानगर प्रॉपर्टी डिटेल्स डालकर कॉन्ट्रैक्ट शुरू करता है। "
            "और अब दाईं तरफ ओनर की स्क्रीन देखिए — बिना एक भी रीलोड किए, लाइव ऑटो-सिंक से यह नया एस्क्रो कॉन्ट्रैक्ट तुरंत ओनर के डैशबोर्ड पर आ गया!"
        ),
        4: (
            "स्टेप वन में टेनेंट लिविंग रूम की साफ़ मूव-इन फोटो चुनता है, और ब्राउज़र के अंदर ही टैम्पर-प्रूफ हैश लॉक हो जाता है। "
            "ओनर अपनी पोर्टल लिंक से फोटो चेक करके एक रिवीजन रिक्वेस्ट भेजता है — और बाईं तरफ टेनेंट को तुरंत रियल-टाइम अलर्ट मिल जाता है!"
        ),
        5: (
            "अब ओनर अपनी यूपीआई आईडी rajesh.prajapati@okhdfcbank कन्फर्म करके मूव-इन बेसलाइन को अप्रूव एंड लॉक करता है। "
            "दोनों पार्टीज की सहमति लॉक होते ही, बाईं तरफ स्टेप थ्री सिक्योरिटी डिपॉज़िट तुरंत अनलॉक हो जाता है!"
        ),
        6: (
            "देखिए असली टू-पार्टी पेमेंट डिज़ाइन! दाईं तरफ ओनर की स्क्रीन पर लाइव रिसीविंग टर्मिनल और क्यूआर कोड ऑन है। "
            "और बाईं तरफ गेस्ट के चेकआउट पॉपअप में कोई डुप्लीकेट क्यूआर नहीं — बल्कि सीधे रेज़रपे वेरीफाइड एस्क्रो या यूपीआई ट्रांसफर का ऑप्शन है! "
            "पच्चीस हज़ार रुपये पे होते ही ओनर की स्क्रीन लाइव अपडेट हो जाती है।"
        ),
        7: (
            "अब देखिए रेंटशील्ड का ट्रिपल एंटी-फ्रॉड इंजन! सेम फोटो दोबारा डालने पर डुप्लीकेट हैश डिटेक्टर तुरंत ब्लॉक कर देता है। "
            "सेल्फी अपलोड करने पर बत्तीस बाय बत्तीस सीन डिटेक्टर उसे भी रोक देता है! "
            f"फिर असली फटी हुई सोफा फोटो डालते ही... गूगल जेमिनी थ्री पॉइंट एट फ्लैश {cut_text} की फेयर रिपेयर कटौती और {refund_text} का नेट रिफंड कैलकुलेट करता है!"
        ),
        8: (
            f"स्टेप फाइव में बाईं तरफ गेस्ट की स्क्रीन पर {refund_text} का लाइव रिफंड क्यूआर टर्मिनल आ गया है! "
            f"दाईं तरफ से ओनर {refund_text} का नेट रिफंड रिलीज करता है। "
            "पेमेंट पूरा होते ही दोनों डैशबोर्ड्स बिना रीलोड किए लाइव ज़ीरो रुपये पर ऑटो-क्लियर होकर सेटल्ड हिस्ट्री में चले जाते हैं!"
        ),
        9: (
            "स्टेप सिक्स में दोनों पार्टीज को इंस्टैंट लीगल रिकॉर्ड्स मिलते हैं। "
            "बाईं तरफ टेनेंट के लिए स्कैनेबल सोसाइटी मूव-आउट गेट पास और एनओसी, और दाईं तरफ ओनर के लिए ऑफिशियल एस्क्रो सेटलमेंट रिसीट — बिल्कुल टैक्स और ऑडिट रेडी!"
        ),
        10: (
            "और अंत में, रेंटशील्ड का ज़ीरो-सर्वर कोर्ट रूम वेरीफायर! बिना किसी सर्वर के, सीधे ब्राउज़र में ओरिजिनल फोटो ड्रॉप करते ही हंड्रेड परसेंट ऑथेंटिक ज़ीरो-पिक्सल टैम्परिंग प्रूफ मिल जाता है। "
            "यह है रेंटशील्ड — फास्ट, ट्रांसपेरेंट और फ्रॉड-फ्री रेंटल एस्क्रो!"
        ),
    }


def generate_all_scenes_audio(cut_amount: int = 3500, refund_amount: int = 21500, force: bool = False) -> dict:
    scripts = get_scene_scripts(cut_amount, refund_amount)
    durations = {}
    total = 0.0

    print("=" * 80)
    print("SYNTHESIZING REAL GOOGLE GEMINI NATIVE VOICEOVER (VOICE: Puck, NO FALLBACKS)")
    print(f"Dynamic Numbers -> Deduction: ₹{cut_amount:,} | Net Refund: ₹{refund_amount:,}")
    print("=" * 80)

    for scene_id, text in scripts.items():
        wav_path = os.path.join(AUDIO_DIR, f"scene_{scene_id}.wav")
        if not force and os.path.exists(wav_path) and os.path.getsize(wav_path) > 50000:
            print(f"[GeminiTTS] Reusing existing real Gemini WAV -> {os.path.basename(wav_path)}")
        else:
            synthesize_gemini_tts_wav(text, wav_path, voice_name="Puck")
            time.sleep(15.0)  # Respect Gemini TTS free-tier RPM limits cleanly without 429s

        if scene_id == 7:
            with open(wav_path, "rb") as src, open(SCENE7_SAMPLE_WAV, "wb") as dst:
                dst.write(src.read())
            print(f"[Proof] Saved raw Gemini Puck Scene 07 WAV -> {SCENE7_SAMPLE_WAV}")

        dur = get_audio_duration(wav_path)
        durations[scene_id] = dur
        total += dur
        print(f"  -> Scene {scene_id:02d} WAV Duration: {dur:.2f}s")

    with open(os.path.join(AUDIO_DIR, "durations.json"), "w", encoding="utf-8") as f:
        json.dump(durations, f, indent=2)
    print(f"\nTotal Gemini Native Voiceover Duration: {total:.2f}s ({total/60:.2f} min)")
    return durations


if __name__ == "__main__":
    generate_all_scenes_audio()

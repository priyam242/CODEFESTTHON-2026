import os
import json
import base64
import subprocess
import urllib.request
import urllib.error
import asyncio

AUDIO_DIR = os.path.abspath("scripts/audio")
SFX_DIR = os.path.join(AUDIO_DIR, "sfx")
TEMP_DIR = os.path.abspath("scripts/temp/audio_build")

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(SFX_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""

FOUNDER_SYSTEM_PROMPT = (
    "You are an energetic, warm, passionate Indian startup founder pitching live at a hackathon grand finale in natural everyday Hinglish. "
    "Use natural human pauses, genuine excitement on live sync & instant settlement, and serious urgency on fraud detection. "
    "Do NOT use robotic jargon or monotone cadence. Speak crisply and confidently."
)

def get_audio_duration(file_path):
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "json", file_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(res.stdout)
    return float(data["format"]["duration"])

def synthesize_with_gemini_native(text: str, output_path: str, voice_name: str = "Puck") -> bool:
    """
    Attempts Google's Gemini 2.5 Flash Native TTS REST API.
    Returns True if successfully generated audio from Google, False otherwise.
    """
    if not GEMINI_API_KEY or not GEMINI_API_KEY.strip() or GEMINI_API_KEY.startswith("AQ."):
        # AQ. token returns 401 on Google's public REST endpoint
        return False

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={GEMINI_API_KEY.strip()}"
    payload = {
        "contents": [{
            "parts": [{
                "text": f"{FOUNDER_SYSTEM_PROMPT}\n\nRead the following script verbatim:\n{text}"
            }]
        }],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": voice_name
                    }
                }
            }
        }
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                for part in parts:
                    inline = part.get("inlineData", {})
                    if inline and "data" in inline:
                        raw_bytes = base64.b64decode(inline["data"])
                        mime = inline.get("mimeType", "audio/mp3")
                        temp_raw = output_path + ".raw"
                        with open(temp_raw, "wb") as f:
                            f.write(raw_bytes)
                        if "pcm" in mime:
                            subprocess.run([
                                "ffmpeg", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1",
                                "-i", temp_raw, "-c:a", "libmp3lame", "-b:a", "192k", output_path
                            ], check=True, capture_output=True)
                            if os.path.exists(temp_raw): os.remove(temp_raw)
                        else:
                            os.rename(temp_raw, output_path)
                        print(f"[GeminiTTS] ✅ Native Gemini Audio generated for: {output_path}")
                        return True
    except Exception as e:
        print(f"[GeminiTTS] Gemini Native TTS fallback triggered ({e})")
    return False

async def synthesize_founder_segment(text: str, output_path: str, rate: str = "+12%", pitch: str = "+5Hz"):
    """
    Synthesizes natural founder voiceover using the high-fidelity neural engine.
    """
    import edge_tts
    c = edge_tts.Communicate(text, "hi-IN-MadhurNeural", rate=rate, pitch=pitch)
    await c.save(output_path)

async def generate_scene_audio_pipeline(scene_id: int, segments: list, sfx_list: list = None) -> float:
    """
    Full pipeline:
    1. Tries Gemini Native Audio first.
    2. Falls back to founder voice synthesis if needed.
    3. Mixes subtle UI sound effects at -22dB.
    4. Returns exact measured duration.
    """
    full_text = " ".join([s[0] for s in segments])
    final_output = os.path.join(AUDIO_DIR, f"scene_{scene_id}.mp3")
    
    # Try native Gemini audio first
    if synthesize_with_gemini_native(full_text, final_output):
        return get_audio_duration(final_output)

    # Multi-segment neural founder synthesis
    seg_files = []
    for idx, (txt, rate, pitch, pause) in enumerate(segments):
        seg_file = os.path.join(TEMP_DIR, f"s{scene_id}_seg_{idx}.mp3")
        await synthesize_founder_segment(txt, seg_file, rate=rate, pitch=pitch)
        seg_files.append((seg_file, pause))

    # Concat segments
    inputs = []
    filter_chains = []
    for i, (f, _) in enumerate(seg_files):
        inputs.extend(["-i", f])
        filter_chains.append(f"[{i}:a]")
    
    concat_filter = "".join(filter_chains) + f"concat=n={len(seg_files)}:v=0:a=1[voice]"

    # If SFX is provided, mix at -22dB
    if sfx_list:
        mix_inputs = list(inputs)
        mix_filters = [concat_filter]
        current_input_idx = len(seg_files)
        
        sfx_mix_parts = ["[voice]"]
        for sfx_name, delay_s in sfx_list:
            sfx_path = os.path.join(SFX_DIR, f"{sfx_name}.wav")
            if os.path.exists(sfx_path):
                mix_inputs.extend(["-i", sfx_path])
                delay_ms = int(delay_s * 1000)
                tag = f"sfx{current_input_idx}"
                mix_filters.append(f"[{current_input_idx}:a]adelay={delay_ms}|{delay_ms},volume=0.08[{tag}]")
                sfx_mix_parts.append(f"[{tag}]")
                current_input_idx += 1
        
        if len(sfx_mix_parts) > 1:
            mix_chain = "".join(sfx_mix_parts) + f"amix=inputs={len(sfx_mix_parts)}:duration=first:dropout_transition=2[a]"
            mix_filters.append(mix_chain)
            full_filter = ";".join(mix_filters)
            cmd = ["ffmpeg", "-y"] + mix_inputs + ["-filter_complex", full_filter, "-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k", final_output]
        else:
            cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", concat_filter, "-map", "[voice]", "-c:a", "libmp3lame", "-b:a", "192k", final_output]
    else:
        cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", concat_filter, "-map", "[voice]", "-c:a", "libmp3lame", "-b:a", "192k", final_output]

    subprocess.run(cmd, check=True, capture_output=True)
    return get_audio_duration(final_output)

def get_scene_script_definition(cut_amount: int = 3500, refund_amount: int = 21500):
    """
    Returns the scene script definitions with dynamic rupee amounts and zero robotic jargon!
    """
    cut_text = f"{cut_amount:,} रुपये" if cut_amount else "पैंतीस सौ रुपये"
    refund_text = f"{refund_amount:,} रुपये" if refund_amount else "इक्कीस हज़ार पांच सौ रुपये"

    return {
        1: {
            "segments": [
                ("भारत में हर साल 40,000 करोड़ रुपये के सिक्योरिटी डिपॉजिट्स बिना किसी ट्रांसपेरेंसी के फंस जाते हैं।", "+12%", "+6Hz", 0.15),
                ("रेंटशील्ड इसी का पहला ऑटोनोमस साइबर-एस्क्रो सॉल्यूशन है! गूगल सर्च से ओपन करते ही इसका लोगो स्मूदली नैवबार में डॉक हो जाता है, और यह पी-डब्ल्यू-ए ऐप की तरह किसी भी फोन या लैपटॉप पर इंस्टॉल हो जाता है।", "+13%", "+5Hz", 0.15)
            ],
            "sfx": None
        },
        2: {
            "segments": [
                ("शुरू होता है हमारा रियल-टाइम स्प्लिट-स्क्रीन डेमो! बाईं तरफ टेनेंट प्रियम, और दाईं तरफ लैंडलॉर्ड राजेश।", "+12%", "+5Hz", 0.15),
                ("1-क्लिक जज डेमो से दोनों अकाउंट्स रेडी हैं। आइए लॉगिन करते हैं। प्रोफाइल वॉल्ट में यूजर्स फोटो, यूपीआई आईडी और लीगल एड्रेस पूरी सिक्योरिटी के साथ मैनेज कर सकते हैं।", "+12%", "+4Hz", 0.15)
            ],
            "sfx": [("click_pop", 1.8)]
        },
        3: {
            "segments": [
                ("टेनेंट 25,000 रुपये का डिपॉजिट और इंदिरानगर प्रॉपर्टी दर्ज करके सबमिट करता है।", "+12%", "+5Hz", 0.15),
                ("अब दाईं तरफ ओनर का डैशबोर्ड देखिए — बिना किसी रिफ्रेश के, लाइव ऑटो-सिंक से नई प्रॉपर्टी तुरंत ओनर की स्क्रीन पर आ गई!", "+13%", "+6Hz", 0.15)
            ],
            "sfx": [("click_pop", 0.3), ("success_chime", 1.5)]
        },
        4: {
            "segments": [
                ("स्टेप वन में टेनेंट लिविंग रूम की बेसलाइन फोटो अपलोड करता है, और इन-ब्राउज़र शा 256 हैश लॉक हो जाता है।", "+12%", "+4Hz", 0.15),
                ("ओनर रिवीजन रिक्वेस्ट फ्लैग करता है — और बाईं तरफ टेनेंट को बिना रिफ्रेश किए तुरंत अलर्ट मिल जाता है!", "+13%", "+5Hz", 0.15)
            ],
            "sfx": [("click_pop", 0.4), ("alert_chime", 1.2)]
        },
        5: {
            "segments": [
                ("ओनर यूपीआई आईडी कंफर्म करके बेसलाइन अप्रूव करता है।", "+12%", "+4Hz", 0.15),
                ("और देखिए, दोनों पार्टीज के डिजिटल साइन होते ही स्टेप थ्री एस्क्रो डिपॉजिट अनलॉक हो जाता है!", "+13%", "+5Hz", 0.15)
            ],
            "sfx": [("click_pop", 0.4), ("success_chime", 0.8)]
        },
        6: {
            "segments": [
                ("अब ध्यान से देखिए — दाईं तरफ ओनर की स्क्रीन पर लाइव रिसीविंग टर्मिनल और क्यूआर कोड दिख रहा है!", "+12%", "+5Hz", 0.15),
                ("बाईं तरफ टेनेंट 25,000 रुपये का डिपॉजिट पे करता है। बिना किसी यूटीआर झंझट के... रेज़रपे वेरिफाइड चेकआउट दो सौ मिलीसेकंड में ऑटो-क्लोज़ हो जाता है! ओनर का डैशबोर्ड लाइव 25,000 रुपये प्रोटेक्टेड डिपॉजिट में अपडेट हो गया।", "+13%", "+6Hz", 0.15)
            ],
            "sfx": [("click_pop", 0.4), ("success_chime", 1.2)]
        },
        7: {
            "segments": [
                ("अब आता है रेंटशील्ड का ट्रिपल एंटी-फ्रॉड इंजन! सेम फोटो दोबारा डालने पर डुप्लीकेट हैश डिटेक्टर इसे तुरंत ब्लॉक कर देता है!", "+13%", "+7Hz", 0.2),
                ("सेल्फी या डार्क स्क्रीनशॉट डालने पर बत्तीस बाय बत्तीस सीन डिटेक्टर सबमिशन हार्ड-लॉक कर देता है!", "+13%", "+6Hz", 0.2),
                (f"फिर असली डैमेज फोटो डालते ही... गूगल जेमिनी थ्री पॉइंट एट फ्लैश {cut_text} की रिपेयर डिडक्शन और {refund_text} का नेट रिफंड असेस करता है!", "+12%", "+4Hz", 0.2),
                ("ओनर की स्क्रीन लाइव प्रॉपर्टी वेकेटेड में अपडेट हो जाती है।", "+12%", "+3Hz", 0.15)
            ],
            "sfx": [("alert_chime", 1.0), ("alert_chime", 3.0), ("success_chime", 6.5)]
        },
        8: {
            "segments": [
                (f"स्टेप फाइव में बाईं तरफ टेनेंट की स्क्रीन पर रिफंड रिसीविंग टर्मिनल और क्यूआर आ गया है! ओनर दाईं तरफ से {refund_text} का नेट रिफंड रिलीज करता है।", "+12%", "+4Hz", 0.15),
                ("पेमेंट कन्फर्म होते ही दोनों स्क्रीन्स बिना रिफ्रेश किए लाइव जीरो रुपये पर ऑटो-क्लियर हो जाती हैं, और कॉन्ट्रैक्ट सेटल्ड हिस्ट्री में चला जाता है!", "+13%", "+5Hz", 0.15)
            ],
            "sfx": [("click_pop", 0.4), ("success_chime", 1.0)]
        },
        9: {
            "segments": [
                ("स्टेप सिक्स में दोनों पार्टीज को ऑफिशियल डॉक्यूमेंट्स मिलते हैं।", "+12%", "+4Hz", 0.15),
                ("टेनेंट के लिए स्कैनेबल सोसाइटी गेट पास और एनओसी, और ओनर के लिए ऑफिशियल एस्क्रो सेटलमेंट रिसीट, जिसे एक क्लिक में प्रिंट या पीडीएफ एक्सपोर्ट किया जा सकता है!", "+13%", "+5Hz", 0.15)
            ],
            "sfx": [("click_pop", 0.3), ("success_chime", 1.0)]
        },
        10: {
            "segments": [
                ("और अंत में, रेंटशील्ड का जीरो-सर्वर कोर्ट रूम वेरीफायर! जहां बिना किसी बैकएंड सर्वर के, वेब-क्रिप्टो से ओरिजिनल फोटो मैच करके जीरो पिक्सल टैम्परिंग का 100% ऑथेंटिक प्रूफ मिलता है।", "+12%", "+5Hz", 0.15),
                ("यह है रेंटशील्ड — भारत के रेंटल इकोसिस्टम का सबसे भरोसेमंद और सिक्योर साइबर-एस्क्रो प्रोटोकॉल!", "+12%", "+5Hz", 0.15)
            ],
            "sfx": [("success_chime", 1.2)]
        }
    }

async def generate_all_scenes_audio(cut_amount=3500, refund_amount=21500):
    script_def = get_scene_script_definition(cut_amount, refund_amount)
    durations = {}
    total_dur = 0.0

    print("================================================================================")
    print("SYNTHESIZING FOUNDER VOICEOVER (NATURAL HINGLISH • ZERO JARGON • DYNAMIC NUMBERS)")
    print(f"Parameters: Deductions = ₹{cut_amount:,} | Net Refund = ₹{refund_amount:,}")
    print("================================================================================")

    for scene_id, data in script_def.items():
        dur = await generate_scene_audio_pipeline(scene_id, data["segments"], data.get("sfx"))
        durations[scene_id] = dur
        total_dur += dur
        print(f"  -> Scene {scene_id} Duration: {dur:.2f}s")

    print(f"\n✅ Total Voiceover Duration: {total_dur:.2f}s ({total_dur/60:.2f} minutes)")
    with open(os.path.join(AUDIO_DIR, "durations.json"), "w") as f:
        json.dump(durations, f, indent=2)
    return durations

if __name__ == "__main__":
    asyncio.run(generate_all_scenes_audio())

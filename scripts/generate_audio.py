import asyncio
import edge_tts
import os
import subprocess
import json

AUDIO_DIR = os.path.abspath("scripts/audio")
SFX_DIR = os.path.join(AUDIO_DIR, "sfx")
TEMP_DIR = os.path.abspath("scripts/temp/audio_build")

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(SFX_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# Tightly paced segments for 3:00 to 3:30 min target (180s - 210s)
SCENE_SEGMENTS = {
    1: [
        ("भारत में हर साल चालीस हज़ार करोड़ रुपये के सिक्योरिटी डिपॉजिट्स बिना किसी ट्रांसपेरेंसी के फंस जाते हैं।", "+12%", "+6Hz", 0.15, None, 0),
        ("रेंटशील्ड पहला ऑटोनोमस साइबर-एस्क्रो सॉल्यूशन है! गूगल सर्च से ओपन करते ही इसका लोगो स्मूदली नैवबार में डॉक हो जाता है, और यह पी-डब्ल्यू-ए ऐप की तरह किसी भी डिवाइस पर इंस्टॉल हो जाता है।", "+13%", "+5Hz", 0.15, None, 0)
    ],
    2: [
        ("शुरू होता है रियल-टाइम डुअल-विंडो स्प्लिट-स्क्रीन डेमो! बाईं तरफ टेनेंट प्रियम, दाईं तरफ लैंडलॉर्ड राजेश।", "+12%", "+5Hz", 0.15, None, 0),
        ("आइए लॉगिन करते हैं। प्रोफाइल वॉल्ट में यूजर्स फोटो, यूपीआई आईडी और एड्रेस सिक्योरिटी के साथ मैनेज कर सकते हैं।", "+12%", "+4Hz", 0.15, "click_pop", 0.3)
    ],
    3: [
        ("टेनेंट पच्चीस हज़ार रुपये का डिपॉजिट और इंदिरानगर प्रॉपर्टी दर्ज करके सबमिट करता है।", "+12%", "+5Hz", 0.15, "click_pop", 0.3),
        ("अब दाईं तरफ ओनर का डैशबोर्ड देखिए — बिना किसी पेज रिफ्रेश के, लाइव ऑटो-सिंक से नई प्रॉपर्टी तुरंत पॉप-अप हो गई!", "+13%", "+6Hz", 0.15, "success_chime", 0.6)
    ],
    4: [
        ("स्टेप वन में टेनेंट लिविंग रूम की बेसलाइन फोटो अपलोड करता है, और इन-ब्राउज़र शा टू-फिफ्टी-सिक्स हैश लॉक हो जाता है।", "+12%", "+4Hz", 0.15, "click_pop", 0.4),
        ("ओनर पोर्टल से रिवीजन रिक्वेस्ट फ्लैग करता है — और बाईं तरफ टेनेंट को बिना रिफ्रेश किए तुरंत रिवीजन का अलर्ट मिल जाता है!", "+13%", "+5Hz", 0.15, "alert_chime", 0.8)
    ],
    5: [
        ("ओनर यूपीआई आईडी कंफर्म करके लॉक एंड अप्रूव बेसलाइन पर क्लिक करता है।", "+12%", "+4Hz", 0.15, "click_pop", 0.4),
        ("टेनेंट का कार्ड ग्रीन होकर काउंटरपार्टी क्रिप्टोग्राफिकली सील्ड में बदल जाता है और स्टेप थ्री एस्क्रो डिपॉजिट अनलॉक हो जाता है!", "+13%", "+5Hz", 0.15, "success_chime", 0.5)
    ],
    6: [
        ("स्ट्रिक्ट रोल-आइसोलेशन में टेनेंट पच्चीस हज़ार रुपये का डिपॉजिट पे करता है।", "+12%", "+5Hz", 0.15, "click_pop", 0.4),
        ("बिना किसी बारह डिजिट यूटीआर झंझट के... पॉपअप दो सौ मिलीसेकंड में ऑटो-क्लोज़ हो जाता है! ओनर का डैशबोर्ड लाइव अपडेट हो गया।", "+13%", "+6Hz", 0.15, "success_chime", 0.6)
    ],
    7: [
        ("रेंटशील्ड का ट्रिपल एंटी-फ्रॉड इंजन! सेम फोटो दोबारा डालने पर एंटी-फ्रॉड डुप्लीकेट हैश डिटेक्टर इसे तुरंत ब्लॉक कर देता है!", "+13%", "+7Hz", 0.2, "alert_chime", 0.5),
        ("सेल्फी या डार्क स्क्रीनशॉट डालने पर बत्तीस बाय बत्तीस सीन डिटेक्टर सबमिशन हार्ड-लॉक कर देता है!", "+13%", "+6Hz", 0.2, "alert_chime", 0.5),
        ("असली डैमेज फोटो डालते ही... गूगल जेमिनी थ्री पॉइंट एट फ्लैश पैंतीस सौ रुपये की डिडक्शन और इक्कीस हज़ार पांच सौ रुपये का रिफंड असेस करता है!", "+12%", "+4Hz", 0.2, "success_chime", 1.2),
        ("ओनर की स्क्रीन लाइव प्रॉपर्टी वेकेटेड में अपडेट हो जाती है।", "+12%", "+3Hz", 0.15, None, 0)
    ],
    8: [
        ("स्टेप फाइव में ओनर इक्कीस हज़ार पांच सौ रुपये का रिफंड रिलीज करता है।", "+12%", "+4Hz", 0.15, "click_pop", 0.4),
        ("पेमेंट होते ही दोनों स्क्रीन्स बिना रिफ्रेश किए लाइव जीरो रुपये पर ऑटो-क्लियर हो जाती हैं, और कॉन्ट्रैक्ट सेटल्ड हिस्ट्री में चला जाता है!", "+13%", "+5Hz", 0.15, "success_chime", 0.6)
    ],
    9: [
        ("स्टेप सिक्स में टेनेंट को स्कैनेबल सोसाइटी गेट पास और एनओसी मिलता है...", "+12%", "+4Hz", 0.15, "click_pop", 0.3),
        ("और ओनर को ऑफिशियल एस्क्रो सेटलमेंट रिसीट, जिसे एक क्लिक में प्रिंट या पीडीएफ एक्सपोर्ट किया जा सकता है!", "+13%", "+5Hz", 0.15, "success_chime", 0.5)
    ],
    10: [
        ("और अंत में, रेंटशील्ड का जीरो-सर्वर कोर्ट रूम वेरीफायर! जहां बिना बैकएंड सर्वर के, वेब-क्रिप्टो से जीरो पिक्सल टैम्परिंग का लीगल प्रूफ मिलता है।", "+12%", "+5Hz", 0.15, "success_chime", 0.8),
        ("यह है रेंटशील्ड — भारत के रेंटल इकोसिस्टम का सबसे भरोसेमंद और सिक्योर साइबर-एस्क्रो प्रोटोकॉल!", "+12%", "+5Hz", 0.15, None, 0)
    ]
}

SUBTITLES = {
    1: "Scene 1: Google Search -> Live Cyber-Shield Logo Morph & PWA Install Ready",
    2: "Scene 2: Dual-Tab Split Screen • 1-Click Judge Demo & Profile Identity Vault",
    3: "Scene 3: Fresh Tenancy Creation • Live Dynamic Sync to Owner (0 Reloads)",
    4: "Scene 4: Step 01 SHA-256 Move-In Baseline & Step 02 Owner Flag Discrepancy Alert",
    5: "Scene 5: Step 02 Owner UPI Vault Approval -> Live Step 03 Escrow Unlock",
    6: "Scene 6: Step 03 Stage-1 Deposit Payment -> Instant Auto-Close (<200ms)",
    7: "Scene 7: Step 04 Triple Anti-Fraud Engine • Duplicate Hash + Scene Mismatch + Gemini 3.8 AI",
    8: "Scene 8: Step 05 Stage-2 Owner Net Refund Payout -> Auto-Clear to ₹0",
    9: "Scene 9: Step 06 Society Move-Out Gate Pass NOC & Owner Escrow Settlement Receipt",
    10: "Scene 10: Zero-Server Courtroom Byte Verifier (/verify) • Authentic Tamper-Proof Seal"
}

def get_audio_duration(file_path):
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "json", file_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(res.stdout)
    return float(data["format"]["duration"])

async def generate_scene_audio(scene_id, segs):
    seg_files = []
    for idx, (txt, rate, pitch, pause, sfx, sfx_del) in enumerate(segs):
        seg_out = os.path.join(TEMP_DIR, f"s{scene_id}_seg_{idx}.mp3")
        c = edge_tts.Communicate(txt, "hi-IN-MadhurNeural", rate=rate, pitch=pitch)
        await c.save(seg_out)
        
        if sfx and os.path.exists(os.path.join(SFX_DIR, f"{sfx}.wav")):
            sfx_file = os.path.join(SFX_DIR, f"{sfx}.wav")
            mixed_out = os.path.join(TEMP_DIR, f"s{scene_id}_seg_{idx}_mixed.mp3")
            delay_ms = int(sfx_del * 1000)
            mix_cmd = [
                "ffmpeg", "-y", "-i", seg_out, "-i", sfx_file,
                "-filter_complex",
                f"[1:a]adelay={delay_ms}|{delay_ms},volume=0.08[s];[0:a][s]amix=inputs=2:duration=first:dropout_transition=2[a]",
                "-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k", mixed_out
            ]
            subprocess.run(mix_cmd, check=True, capture_output=True)
            seg_files.append((mixed_out, pause))
        else:
            seg_files.append((seg_out, pause))

    inputs = []
    filter_chains = []
    for i, (f, _) in enumerate(seg_files):
        inputs.extend(["-i", f])
        filter_chains.append(f"[{i}:a]")
    
    concat_filter = "".join(filter_chains) + f"concat=n={len(seg_files)}:v=0:a=1[a]"
    final_scene_audio = os.path.join(AUDIO_DIR, f"scene_{scene_id}.mp3")
    cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", concat_filter, "-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k", final_scene_audio]
    subprocess.run(cmd, check=True, capture_output=True)
    dur = get_audio_duration(final_scene_audio)
    return dur

async def main():
    print("================================================================================")
    print("GENERATING OPTIMIZED 3:00-3:30 MINUTE AUDIO SUITE")
    print("================================================================================")
    durations = {}
    total_dur = 0.0

    for scene_id, segs in SCENE_SEGMENTS.items():
        print(f"Generating Scene {scene_id} audio...")
        dur = await generate_scene_audio(scene_id, segs)
        durations[scene_id] = dur
        total_dur += dur
        print(f"  -> Scene {scene_id} Duration: {dur:.2f}s")

    print(f"\n✅ Total Voiceover Duration: {total_dur:.2f}s ({total_dur/60:.2f} minutes)")
    print("Target Window: 180s to 210s (3:00 to 3:30 mins)")

    with open(os.path.join(AUDIO_DIR, "durations.json"), "w") as f:
        json.dump(durations, f, indent=2)
    print("Durations JSON saved to scripts/audio/durations.json")

if __name__ == "__main__":
    asyncio.run(main())

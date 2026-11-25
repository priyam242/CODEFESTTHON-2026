import asyncio
import os
import sys
import time
import json
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath("scripts"))
from gemini_tts import generate_all_scenes_audio

load_dotenv("server/.env")
DB_URL = os.environ.get("DATABASE_URL") or ""
if not DB_URL:
    load_dotenv(".env")
    DB_URL = os.environ.get("DATABASE_URL") or ""

BASE_URL = "https://rentshield-web.onrender.com"
TENANT_EMAIL = "priyam@gmail.com"
TENANT_PASS = "priyam1200"
LANDLORD_EMAIL = "rajesh@gmail.com"
LANDLORD_PASS = "rajesh6005"

CANDIDATES_DIR = os.path.abspath("scripts/temp/candidates")
MOVE_IN_IMG = os.path.join(CANDIDATES_DIR, "living_room_clean.jpg")
DUP_IMG = os.path.join(CANDIDATES_DIR, "living_room_duplicate.jpg")
SELFIE_IMG = os.path.join(CANDIDATES_DIR, "human_selfie_test.jpg")
MOVE_OUT_IMG = os.path.join(CANDIDATES_DIR, "living_room_sofa_tear.jpg")

TEMP_DIR = os.path.abspath("scripts/temp/video_build")
AUDIO_DIR = os.path.abspath("scripts/audio")
OUTPUT_VIDEO = os.path.abspath("RentShield_Full_SplitScreen_Demo.mp4")
CONTACT_SHEET = os.path.abspath("VIDEO_KEYFRAMES_CONTACT_SHEET.png")
os.makedirs(TEMP_DIR, exist_ok=True)

with open(os.path.join(CANDIDATES_DIR, "thumbnails.json"), "r", encoding="utf-8") as f:
    THUMBNAILS = json.load(f)


def wipe_user_tenancies_preserve_demo():
    """Surgically wipes ONLY priyam@gmail.com & rajesh@gmail.com tenancies/items; preserves Judge Demo accounts."""
    import bcrypt
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(
        'DELETE FROM "Item" WHERE "tenancyId" IN ('
        '  SELECT t.id FROM "Tenancy" t '
        '  LEFT JOIN "User" u ON t."userId" = u.id '
        '  WHERE u.email IN (\'priyam@gmail.com\', \'rajesh@gmail.com\') '
        '     OR t."landlordEmail" IN (\'priyam@gmail.com\', \'rajesh@gmail.com\')'
        ')'
    )
    cur.execute(
        'DELETE FROM "Tenancy" WHERE "userId" IN ('
        '  SELECT id FROM "User" WHERE email IN (\'priyam@gmail.com\', \'rajesh@gmail.com\')'
        ') OR "landlordEmail" IN (\'priyam@gmail.com\', \'rajesh@gmail.com\')'
    )

    p1 = bcrypt.hashpw(b"priyam1200", bcrypt.gensalt()).decode()
    p2 = bcrypt.hashpw(b"rajesh6005", bcrypt.gensalt()).decode()
    cur.execute('UPDATE "User" SET password = %s, name = \'Priyam Prajapati\', role = \'TENANT\' WHERE email = \'priyam@gmail.com\'', (p1,))
    cur.execute('UPDATE "User" SET password = %s, name = \'Rajesh Prajapati\', role = \'LANDLORD\' WHERE email = \'rajesh@gmail.com\'', (p2,))
    conn.close()
    print("[DB] Cleaned priyam@gmail.com & rajesh@gmail.com tenancies cleanly (Judge Demo accounts preserved).")


def run_cmd(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("CMD FAILED:", " ".join(cmd))
        print("STDERR:", res.stderr[-1200:])
        raise RuntimeError(f"FFmpeg command failed ({res.returncode})")
    return res.stdout


def probe_duration(path: str) -> float:
    out = run_cmd(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path])
    return float(json.loads(out)["format"]["duration"])


OVERLAY_JS = f"""
(function() {{
    if (window.__OVERLAY_INSTALLED__) return;
    window.__OVERLAY_INSTALLED__ = true;
    document.documentElement.style.backgroundColor = '#060d13';
    if (document.body) document.body.style.backgroundColor = '#060d13';
    window.__THUMBNAILS__ = {json.dumps(THUMBNAILS)};
    window.__SCENE_COLOR__ = '#10b981';

    window.installHeaderBar = function(tabType, sceneIdx) {{
        let bar = document.getElementById('top-split-bar');
        const isTenant = tabType === 'TENANT';
        if (sceneIdx !== undefined && sceneIdx !== null) {{
            window.__SCENE_COLOR__ = (sceneIdx % 2 === 0) ? '#10b981' : '#38bdf8';
        }}
        if (!bar) {{
            bar = document.createElement('div');
            bar.id = 'top-split-bar';
            bar.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; height: 32px;
                background: ${{isTenant ? '#064e3b' : '#0f172a'}};
                color: ${{isTenant ? '#6ee7b7' : '#38bdf8'}};
                font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800;
                display: flex; align-items: center; justify-content: center;
                z-index: 9999999; border-bottom: 2px solid ${{isTenant ? '#10b981' : '#0284c7'}};
                box-shadow: 0 4px 15px rgba(0,0,0,0.6); letter-spacing: 0.5px;
            `;
            const dot = document.createElement('span');
            dot.id = 'scene-sync-led';
            dot.style.cssText = `
                position: absolute; left: 10px; top: 8px; width: 14px; height: 14px;
                border-radius: 3px; background: ${{window.__SCENE_COLOR__}};
                display: inline-block;
            `;
            const lbl = document.createElement('span');
            lbl.textContent = isTenant
                ? 'TAB 1: GUEST / TENANT • https://rentshield-web.onrender.com (LIVE)'
                : 'TAB 2: OWNER / LANDLORD • https://rentshield-web.onrender.com (LIVE)';
            bar.appendChild(dot);
            bar.appendChild(lbl);
            document.body.prepend(bar);
            document.body.style.marginTop = '32px';
        }} else {{
            const dot = document.getElementById('scene-sync-led');
            if (dot) dot.style.background = window.__SCENE_COLOR__;
        }}
    }};

    window.setSceneLed = function(sceneIdx) {{
        window.__SCENE_COLOR__ = (sceneIdx % 2 === 0) ? '#10b981' : '#38bdf8';
        const dot = document.getElementById('scene-sync-led');
        if (dot) dot.style.background = window.__SCENE_COLOR__;
    }};

    window.showAutoSyncBadge = function(msg) {{
        const existing = document.getElementById('sync-badge');
        if (existing) existing.remove();
        const badge = document.createElement('div');
        badge.id = 'sync-badge';
        badge.style.cssText = `
            position: fixed; top: 40px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #059669, #0284c7);
            color: #ffffff; padding: 7px 16px; border-radius: 9999px;
            font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 900;
            letter-spacing: 0.5px; box-shadow: 0 0 25px rgba(16,185,129,0.9);
            border: 1.5px solid #6ee7b7; z-index: 99999999;
        `;
        badge.textContent = msg || 'LIVE DYNAMIC AUTO-SYNC (0 RELOADS)';
        document.body.appendChild(badge);
        setTimeout(() => {{ if (badge) badge.remove(); }}, 3200);
    }};

    let cursor = document.getElementById('demo-cursor');
    if (!cursor) {{
        cursor = document.createElement('div');
        cursor.id = 'demo-cursor';
        cursor.dataset.x = '480';
        cursor.dataset.y = '400';
        cursor.style.cssText = `
            position: fixed; width: 18px; height: 18px; border-radius: 50%;
            background: radial-gradient(circle, #10b981 0%, rgba(16,185,129,0.25) 70%);
            border: 2px solid #34d399; pointer-events: none; z-index: 999999999;
            box-shadow: 0 0 12px #10b981; top: 400px; left: 480px;
        `;
        document.body.appendChild(cursor);
    }}

    window.smoothMoveCursor = function(targetX, targetY, durationMs = 300) {{
        const startX = parseFloat(cursor.dataset.x || 480);
        const startY = parseFloat(cursor.dataset.y || 400);
        const startTime = performance.now();
        return new Promise(resolve => {{
            function step(now) {{
                const p = Math.min(1, (now - startTime) / durationMs);
                const ease = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
                const cx = startX + (targetX - startX) * ease;
                const cy = startY + (targetY - startY) * ease;
                cursor.style.left = (cx - 9) + 'px';
                cursor.style.top = (cy - 9) + 'px';
                cursor.dataset.x = cx;
                cursor.dataset.y = cy;
                if (p < 1) requestAnimationFrame(step);
                else resolve();
            }}
            requestAnimationFrame(step);
        }});
    }};

    window.triggerClick = function(x, y) {{
        cursor.style.left = (x - 9) + 'px';
        cursor.style.top = (y - 9) + 'px';
        cursor.dataset.x = x;
        cursor.dataset.y = y;
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: fixed; left: ${{x - 20}}px; top: ${{y - 20}}px; width: 40px; height: 40px;
            border-radius: 50%; border: 3px solid #10b981; background: rgba(16,185,129,0.35);
            pointer-events: none; z-index: 999999998;
            transition: transform 0.45s ease-out, opacity 0.45s ease-out;
        `;
        document.body.appendChild(ripple);
        requestAnimationFrame(() => {{
            ripple.style.transform = 'scale(2.1)';
            ripple.style.opacity = '0';
        }});
        setTimeout(() => ripple.remove(), 480);
    }};

    window.showVisualFilePicker = function(activeFileName, titleText) {{
        const existing = document.getElementById('demo-file-picker-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'demo-file-picker-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(2, 6, 23, 0.88);
            display: flex; align-items: center; justify-content: center;
            z-index: 999999999; backdrop-filter: blur(8px);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        const files = [
            {{ name: 'living_room_clean.jpg', size: '2.4 MB', tag: 'BASELINE' }},
            {{ name: 'living_room_duplicate.jpg', size: '2.4 MB', tag: 'DUPLICATE' }},
            {{ name: 'human_selfie_test.jpg', size: '1.8 MB', tag: 'SELFIE' }},
            {{ name: 'dark_screenshot.png', size: '42 KB', tag: 'MISMATCH' }},
            {{ name: 'living_room_sofa_tear.jpg', size: '2.6 MB', tag: 'DAMAGED' }}
        ];
        let cardsHtml = '';
        files.forEach(f => {{
            const thumb = window.__THUMBNAILS__[f.name] || '';
            const isTarget = f.name === activeFileName;
            const cardId = 'picker-card-' + f.name.replace(/[^a-zA-Z0-9]/g, '_');
            cardsHtml += `
                <div id="${{cardId}}" style="
                    background: #0f172a; border: 1.5px solid ${{isTarget ? '#10b981' : '#334155'}};
                    border-radius: 10px; padding: 10px; width: 138px; text-align: center;
                    box-shadow: ${{isTarget ? '0 0 18px rgba(16,185,129,0.55)' : 'none'}};
                    position: relative;
                ">
                    <div style="height: 90px; border-radius: 6px; overflow: hidden; margin-bottom: 8px; background: #020617;">
                        <img src="${{thumb}}" style="width: 100%; height: 100%; object-fit: cover;" />
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${{f.name}}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${{f.size}} • <span style="color: ${{isTarget ? '#34d399' : '#64748b'}}; font-weight: bold;">${{f.tag}}</span></div>
                    ${{isTarget ? '<div style="position: absolute; top: 6px; right: 6px; background: #10b981; color: #000; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center;">✓</div>' : ''}}
                </div>
            `;
        }});
        modal.innerHTML = `
            <div style="width: 770px; background: #0b1329; border: 1.5px solid #1e293b; border-radius: 16px; box-shadow: 0 25px 60px rgba(0,0,0,0.8); overflow: hidden;">
                <div style="background: #0f172a; padding: 12px 18px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 13px; font-weight: 700; color: #f8fafc;">${{titleText || 'File Explorer — Select Evidence Photo'}}</span>
                    <span style="font-size: 11px; color: #64748b; font-family: monospace;">Evidence Vault</span>
                </div>
                <div style="padding: 16px; display: flex; gap: 12px; justify-content: center; background: #060d13;">${{cardsHtml}}</div>
                <div style="background: #0f172a; padding: 12px 18px; border-top: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 12px; color: #94a3b8;">Selected: <strong style="color: #6ee7b7;">${{activeFileName}}</strong></span>
                    <button id="picker-btn-open" style="padding: 6px 20px; border-radius: 6px; background: #059669; border: 1px solid #10b981; color: #ffffff; font-size: 12px; font-weight: 700;">Open</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }};

    window.closeVisualFilePicker = function() {{
        const modal = document.getElementById('demo-file-picker-modal');
        if (modal) modal.remove();
    }};
}})();
"""


async def attach_overlay(page, tab_type=None, scene_idx=None):
    try:
        await page.evaluate(OVERLAY_JS)
        if tab_type:
            s_arg = str(scene_idx) if scene_idx is not None else "null"
            await page.evaluate(f"window.installHeaderBar('{tab_type}', {s_arg});")
    except Exception:
        pass


async def wait_no_spinners(page):
    for txt in [
        "Synchronizing cryptographic escrow ledger...",
        "Loading landlord cryptographic sign-off session...",
        "Loading protected tenancies...",
    ]:
        loc = page.locator(f"text={txt}")
        if await loc.count() > 0:
            await loc.first.wait_for(state="detached", timeout=25000)


async def animated_click(page, selector, timeout=15000):
    loc = page.locator(selector).first if isinstance(selector, str) else selector
    await loc.wait_for(state="visible", timeout=timeout)
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    if box:
        cx = box["x"] + box["width"] / 2
        cy = box["y"] + box["height"] / 2
        await page.evaluate(f"window.smoothMoveCursor && window.smoothMoveCursor({cx}, {cy}, 260);")
        await asyncio.sleep(0.28)
        await page.evaluate(f"window.triggerClick && window.triggerClick({cx}, {cy});")
    await loc.click()


async def animated_type(page, selector, text, delay=0.065):
    """Calm, natural human typing cadence (default 65ms/char)."""
    loc = page.locator(selector).first if isinstance(selector, str) else selector
    await loc.wait_for(state="visible", timeout=12000)
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    if box:
        cx = box["x"] + box["width"] / 2
        cy = box["y"] + box["height"] / 2
        await page.evaluate(f"window.smoothMoveCursor && window.smoothMoveCursor({cx}, {cy}, 220);")
        await asyncio.sleep(0.22)
        await page.evaluate(f"window.triggerClick && window.triggerClick({cx}, {cy});")
    await loc.click()
    await loc.fill("")
    await loc.press_sequentially(text, delay=int(delay * 1000))


async def pick_file_with_visual_overlay(page, file_input_selector, filename, real_path, title="File Explorer — Select Evidence Photo", hold_sec=1.3):
    await page.evaluate(f"window.showVisualFilePicker('{filename}', '{title}');")
    await asyncio.sleep(0.4)
    card_id = "#picker-card-" + filename.replace(".", "_")
    try:
        card = page.locator(card_id).first
        cbox = await card.bounding_box()
        if cbox:
            await page.evaluate(f"window.smoothMoveCursor && window.smoothMoveCursor({cbox['x']+cbox['width']/2}, {cbox['y']+cbox['height']/2}, 300);")
            await asyncio.sleep(0.25)
            await page.evaluate(f"window.triggerClick && window.triggerClick({cbox['x']+cbox['width']/2}, {cbox['y']+cbox['height']/2});")
    except Exception:
        pass
    await asyncio.sleep(hold_sec)
    try:
        open_btn = page.locator("#picker-btn-open").first
        obox = await open_btn.bounding_box()
        if obox:
            await page.evaluate(f"window.smoothMoveCursor && window.smoothMoveCursor({obox['x']+obox['width']/2}, {obox['y']+obox['height']/2}, 220);")
            await asyncio.sleep(0.2)
            await page.evaluate(f"window.triggerClick && window.triggerClick({obox['x']+obox['width']/2}, {obox['y']+obox['height']/2});")
    except Exception:
        pass
    await page.evaluate("window.closeVisualFilePicker();")
    await asyncio.sleep(0.2)
    await page.locator(file_input_selector).first.set_input_files(real_path)


# -----------------------------------------------------------------------------
# PASS 1: SCENE 01 (FULL-SCREEN 1920x1080)
# -----------------------------------------------------------------------------
async def record_scene_01(browser) -> str:
    print(">>> [PASS 1] Recording Scene 01 (Dark Google Search + Cyber-Shield Morph + PWA)...")
    s1_dir = os.path.join(TEMP_DIR, "s1")
    shutil.rmtree(s1_dir, ignore_errors=True)
    os.makedirs(s1_dir, exist_ok=True)
    ctx = await browser.new_context(record_video_dir=s1_dir, record_video_size={"width": 1920, "height": 1080}, viewport={"width": 1920, "height": 1080})
    await ctx.add_init_script("document.documentElement.style.backgroundColor = '#060d13';")
    page = await ctx.new_page()

    dark_google_html = """<!DOCTYPE html><html><head><style>
    body { margin: 0; background: #060d13; color: #f1f5f9; font-family: -apple-system, Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
    .logo { font-size: 62px; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 28px; }
    .logo span:nth-child(1){color:#4285f4}.logo span:nth-child(2){color:#ea4335}.logo span:nth-child(3){color:#fbbc05}.logo span:nth-child(4){color:#4285f4}.logo span:nth-child(5){color:#34a853}.logo span:nth-child(6){color:#ea4335}
    .box { width: 640px; height: 52px; border-radius: 26px; background: #0f172a; border: 1.5px solid #1e293b; display: flex; align-items: center; padding: 0 22px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); }
    input { flex: 1; background: transparent; border: none; outline: none; color: #f8fafc; font-size: 16px; margin-left: 12px; font-family: monospace; }
    </style></head><body>
    <div class="logo"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div>
    <div class="box"><input id="dark-q" placeholder="Search Google or type a URL" /></div>
    </body></html>"""

    await page.set_content(dark_google_html)
    await attach_overlay(page)
    await animated_type(page, "#dark-q", "https://rentshield-web.onrender.com", delay=0.065)
    await asyncio.sleep(0.5)

    await page.goto(f"{BASE_URL}/?intro=1", timeout=30000)
    await attach_overlay(page)
    await asyncio.sleep(4.2)  # Cyber-Shield Logo Morph animation

    install_btn = page.locator('button:has-text("Install App")').first
    if await install_btn.is_visible():
        await animated_click(page, install_btn)
        await asyncio.sleep(1.8)
        close_btn = page.locator('button:has-text("Got it"), button:has-text("Close")').first
        if await close_btn.is_visible():
            await animated_click(page, close_btn)
            await asyncio.sleep(0.5)

    signin_btn = page.locator('nav a:has-text("Sign In"), nav button:has-text("Sign In")').first
    if await signin_btn.is_visible():
        await animated_click(page, signin_btn)
        await asyncio.sleep(1.2)

    await ctx.close()
    raw_webm = str(max(Path(s1_dir).glob("*.webm"), key=os.path.getmtime))
    out_mp4 = os.path.join(TEMP_DIR, "scene_01_raw.mp4")
    run_cmd(["ffmpeg", "-y", "-i", raw_webm, "-vf", "scale=1920:1080,fps=60", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", out_mp4])
    return out_mp4


# -----------------------------------------------------------------------------
# EXACT FRAME-BOUNDARY SLICER FOR CONTINUOUS DUAL SPLIT-SCREEN
# -----------------------------------------------------------------------------
def slice_dual_video_by_led(dual_mp4: str, expected_scenes: list):
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", dual_mp4, "-vf", "crop=4:4:15:13", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE
    )
    frame_bytes = 4 * 4 * 3
    prev_state = None
    transitions = []
    idx = 0
    while True:
        chunk = proc.stdout.read(frame_bytes)
        if len(chunk) < frame_bytes:
            break
        g_sum = sum(chunk[i + 1] for i in range(0, frame_bytes, 3)) / 16.0
        b_sum = sum(chunk[i + 2] for i in range(0, frame_bytes, 3)) / 16.0
        if g_sum > 120 or b_sum > 150:
            state = "EMERALD" if g_sum > b_sum else "CYAN"
            if state != prev_state:
                if not transitions or (idx - transitions[-1][0] > 30):
                    transitions.append((idx, state))
                    prev_state = state
        idx += 1
    proc.wait()

    total_frames = idx
    print(f"[Slicer] Scanned {total_frames} frames @ 60fps; detected {len(transitions)} scene transitions: {transitions}")

    out_paths = {}
    for pos, scene_num in enumerate(expected_scenes):
        start_f = transitions[pos][0] if pos < len(transitions) else 0
        if pos == 0:
            start_f = 0
        end_f = transitions[pos + 1][0] if (pos + 1) < len(transitions) else total_frames
        t0 = start_f / 60.0
        dur = max(1.0, (end_f - start_f) / 60.0)
        out_p = os.path.join(TEMP_DIR, f"scene_{scene_num:02d}_raw.mp4")
        run_cmd([
            "ffmpeg", "-y", "-ss", f"{t0:.4f}", "-i", dual_mp4, "-t", f"{dur:.4f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "60", out_p
        ])
        out_paths[scene_num] = out_p
        print(f"  -> Sliced Scene {scene_num:02d}: frames [{start_f}..{end_f}] = {dur:.2f}s")
    return out_paths


# -----------------------------------------------------------------------------
# PASS 1: SCENES 02..09 (DUAL SPLIT SCREEN + LEASE SCANNER + CHIPS + GEMINI)
# -----------------------------------------------------------------------------
async def record_scenes_02_to_09(browser):
    print(">>> [PASS 1] Recording Scenes 02..09 (True Dual-Tab Live Sync + LED Frame Markers)...")
    dl_dir = os.path.join(TEMP_DIR, "dual_left")
    dr_dir = os.path.join(TEMP_DIR, "dual_right")
    shutil.rmtree(dl_dir, ignore_errors=True)
    shutil.rmtree(dr_dir, ignore_errors=True)
    os.makedirs(dl_dir, exist_ok=True)
    os.makedirs(dr_dir, exist_ok=True)

    ctx_l = await browser.new_context(record_video_dir=dl_dir, record_video_size={"width": 960, "height": 1080}, viewport={"width": 960, "height": 1080})
    ctx_r = await browser.new_context(record_video_dir=dr_dir, record_video_size={"width": 960, "height": 1080}, viewport={"width": 960, "height": 1080})
    await ctx_l.add_init_script("document.documentElement.style.backgroundColor = '#060d13';")
    await ctx_r.add_init_script("document.documentElement.style.backgroundColor = '#060d13';")

    page_l = await ctx_l.new_page()
    page_r = await ctx_r.new_page()

    # ---------------- SCENE 2 (Even -> EMERALD) ----------------
    print("  -> Scene 02: Dual Login + User Profile Vault Modal...")
    await asyncio.gather(page_l.goto(f"{BASE_URL}/login", timeout=30000), page_r.goto(f"{BASE_URL}/login", timeout=30000))
    await asyncio.gather(attach_overlay(page_l, "TENANT", 2), attach_overlay(page_r, "LANDLORD", 2))

    await animated_type(page_l, 'input[type="email"]', TENANT_EMAIL, delay=0.065)
    await animated_type(page_l, 'input[type="password"]', TENANT_PASS, delay=0.065)
    await animated_click(page_l, 'button[type="submit"]:has-text("Sign In")')

    await animated_type(page_r, 'input[type="email"]', LANDLORD_EMAIL, delay=0.065)
    await animated_type(page_r, 'input[type="password"]', LANDLORD_PASS, delay=0.065)
    await animated_click(page_r, 'button[type="submit"]:has-text("Sign In")')

    await page_l.wait_for_url(f"{BASE_URL}/", timeout=25000)
    await page_r.wait_for_url(f"{BASE_URL}/", timeout=25000)
    await wait_no_spinners(page_l)
    await wait_no_spinners(page_r)
    await asyncio.gather(attach_overlay(page_l, "TENANT", 2), attach_overlay(page_r, "LANDLORD", 2))

    user_pill = page_l.locator('nav button:has-text("Priyam"), [title*="Profile"]').first
    await animated_click(page_l, user_pill)
    await asyncio.sleep(2.2)
    # Close Profile modal cleanly (X button inside dialog)
    close_prof = page_l.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] button[aria-label*="Close"], [role="dialog"] button').first
    if await close_prof.is_visible():
        await animated_click(page_l, close_prof)
    await asyncio.sleep(0.5)

    # ---------------- SCENE 3 (Odd -> CYAN) ----------------
    print("  -> Scene 03: MTA 2021 Smart Lease & Deposit Clause Scanner Showcase...")
    await page_l.evaluate("window.setSceneLed && window.setSceneLed(3);")
    await animated_click(page_l, 'button:has-text("Lease Risk Scanner")')
    await page_l.locator('button:has-text("Predatory 10-Month Deposit")').first.wait_for(state="visible", timeout=10000)
    await animated_click(page_l, 'button:has-text("Predatory 10-Month Deposit")')
    await page_l.locator("#lease-audit-result").wait_for(state="visible", timeout=45000)
    await page_l.locator('text=Suggested Fair MTA 2021 Replacement Wording').first.scroll_into_view_if_needed()
    await page_r.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('MTA 2021 AI LEGAL SCANNER • 95/100 HIGH RISK');")
    await asyncio.sleep(5.5)

    # ---------------- SCENE 4 (Even -> EMERALD) ----------------
    print("  -> Scene 04: Create ₹25,000 Tenancy + Live Auto-Sync to Owner...")
    await page_l.evaluate("window.setSceneLed && window.setSceneLed(4);")
    close_scanner = page_l.locator('[role="dialog"] button').first
    if await close_scanner.is_visible():
        await animated_click(page_l, close_scanner)
    await asyncio.sleep(0.3)
    await page_l.goto(f"{BASE_URL}/tenancy/new", timeout=25000)
    await attach_overlay(page_l, "TENANT", 4)

    await animated_type(page_l, 'input[placeholder*="Green Glen"]', "Skyline Cyber-Vault 2BHK Indiranagar", delay=0.065)
    await animated_type(page_l, 'textarea', "88, 100ft Road, Indiranagar, Bengaluru, KA 560038", delay=0.065)
    await animated_type(page_l, 'input[type="number"]', "25000", delay=0.065)
    await animated_type(page_l, 'input[placeholder*="Ramesh Malik"]', "Rajesh Prajapati", delay=0.065)
    await animated_type(page_l, 'input[placeholder*="98765"]', "+91 99887 76655", delay=0.065)
    await animated_type(page_l, 'input[placeholder*="landlord.demo"]', LANDLORD_EMAIL, delay=0.065)
    await animated_type(page_l, 'input[placeholder*="okhdfcbank"]', "rajesh.prajapati@okhdfcbank", delay=0.065)
    await animated_type(page_l, 'input[placeholder*="BLR-IND"]', "BLR-IND-2026-KA-9912", delay=0.065)

    await animated_click(page_l, 'button[type="submit"]:has-text("Initialize & Protect Deposit")')
    await page_l.wait_for_url(lambda u: "/tenancy/" in u and "/tenancy/new" not in u, timeout=25000)
    await wait_no_spinners(page_l)
    await attach_overlay(page_l, "TENANT", 4)
    tenancy_id = page_l.url.split("/tenancy/")[1].split("?")[0]
    print(f"     Created Tenancy ID: {tenancy_id}")

    try:
        await page_r.locator('text=Skyline Cyber-Vault 2BHK Indiranagar').first.wait_for(state="visible", timeout=7000)
    except Exception:
        pass
    await page_r.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('LIVE DYNAMIC AUTO-SYNC: NEW PROPERTY RECEIVED!');")
    await asyncio.sleep(2.2)

    # ---------------- SCENE 5 (Odd -> CYAN) ----------------
    print("  -> Scene 05: Step 01 SHA-256 Upload + Revision Flag + Owner UPI Lock...")
    await page_l.evaluate("window.setSceneLed && window.setSceneLed(5);")
    await animated_click(page_l, 'button:has-text("Upload Room Item")')
    await asyncio.sleep(0.5)

    await animated_type(page_l, 'input[placeholder*="Living Room"]', "Living Room", delay=0.065)
    await animated_type(page_l, 'input[placeholder*="Inverter AC"]', "Italian Leather Sofa & Recliner", delay=0.065)
    await animated_type(page_l, 'textarea[placeholder*="pre-existing"]', "Pristine beige leather, zero tears or scratches.", delay=0.065)

    await pick_file_with_visual_overlay(page_l, 'input[type="file"]', 'living_room_clean.jpg', MOVE_IN_IMG, title="Baseline Inventory — Select Photo", hold_sec=1.3)
    await animated_click(page_l, 'button[type="submit"]:has-text("Lock Item Hash")')
    await page_l.locator('h3:has-text("Upload Baseline Move-In Item")').wait_for(state="detached", timeout=25000)
    await asyncio.sleep(0.5)
    await wait_no_spinners(page_l)
    await attach_overlay(page_l, "TENANT", 5)

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute('SELECT "landlordToken" FROM "Tenancy" WHERE id = %s', (tenancy_id,))
    landlord_token = cur.fetchone()[0]

    await page_r.goto(f"{BASE_URL}/verify/{landlord_token}", timeout=25000)
    await wait_no_spinners(page_r)
    await attach_overlay(page_r, "LANDLORD", 5)

    flag_btn = page_r.locator('button:has-text("Flag Discrepancy / Request Revision")').first
    if await flag_btn.is_visible():
        await animated_click(page_r, flag_btn)
        await asyncio.sleep(0.4)
        await animated_type(page_r, 'textarea', "Please confirm corner sofa cushion stitch detail.", delay=0.065)
        await animated_click(page_r, 'button:has-text("Send Revision Request")')
        await asyncio.sleep(1.2)

    try:
        await page_l.locator('text=/Revision Requested/i').first.wait_for(state="visible", timeout=7000)
    except Exception:
        pass
    await page_l.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('LIVE DYNAMIC AUTO-SYNC: REVISION REQUEST RECEIVED!');")
    await asyncio.sleep(1.5)

    # Confirm Owner UPI & Lock & Approve Baseline
    upi_owner = page_r.locator('input[placeholder*="okhdfcbank"], input[placeholder*="UPI"]').first
    if await upi_owner.is_visible():
        val = await upi_owner.input_value()
        if not val.strip():
            await animated_type(page_r, upi_owner, "rajesh.prajapati@okhdfcbank", delay=0.065)
    chk = page_r.locator('input[type="checkbox"]').first
    if await chk.is_visible() and not (await chk.is_checked()):
        await chk.check()
    await animated_click(page_r, 'button:has-text("Lock & Approve Baseline")')
    await asyncio.sleep(1.8)

    try:
        await page_l.locator('button:has-text("Pay Security Deposit"), button:has-text("Pay & Lock Deposit")').first.wait_for(state="visible", timeout=7000)
    except Exception:
        pass
    await page_l.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('CONTRACT CRYPTOGRAPHICALLY SEALED • STEP 03 UNLOCKED!');")
    await asyncio.sleep(1.8)

    # ---------------- SCENE 6 (Even -> EMERALD) ----------------
    print("  -> Scene 06: Stage 1 Deposit (#owner-receiving-terminal QR + Clean Payer Modal)...")
    await page_l.evaluate("window.setSceneLed && window.setSceneLed(6);")
    owner_term = page_r.locator('#owner-receiving-terminal').first
    await owner_term.wait_for(state="visible", timeout=15000)
    await owner_term.scroll_into_view_if_needed()
    await asyncio.sleep(0.4)

    await animated_click(page_l, 'button:has-text("Pay Security Deposit"), button:has-text("Pay & Lock Deposit")')
    await page_l.locator('text=Direct UPI Transfer to').first.wait_for(state="visible", timeout=12000)
    await asyncio.sleep(2.2)

    await animated_click(page_l, 'button:has-text("Judge Demo Simulate Razorpay Webhook")')
    await page_l.locator('button:has-text("Upload Move-Out & Audit")').first.wait_for(state="visible", timeout=15000)

    await page_r.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('₹25,000 ESCROW DEPOSIT VERIFIED & PROTECTED!');")
    await asyncio.sleep(2.2)

    # ---------------- SCENE 7 (Odd -> CYAN) ----------------
    print("  -> Scene 07: Step 04 1-Click Judge Quick-Test Chips + File Picker + Live Gemini 3.8 Audit...")
    await page_l.evaluate("window.setSceneLed && window.setSceneLed(7);")
    await animated_click(page_l, 'button:has-text("Upload Move-Out & Audit")')
    await asyncio.sleep(0.8)

    # (a) Duplicate Move-In Photo via Custom Visual File Picker -> Red ANTI-FRAUD block (1.8s)
    await pick_file_with_visual_overlay(page_l, 'input[type="file"]', 'living_room_duplicate.jpg', DUP_IMG, title="Move-Out Audit — Select Duplicate Photo (Test 1)", hold_sec=1.1)
    await page_l.locator('text=ANTI-FRAUD TRIGGERED').first.wait_for(state="visible", timeout=8000)
    await asyncio.sleep(1.8)

    # (b) 1-Click Judge Chip: Selfie Portrait -> Red 32x32 Portrait Block (1.8s)
    selfie_chip = page_l.locator('button:has-text("Load Selfie Portrait")').first
    await selfie_chip.scroll_into_view_if_needed()
    await animated_click(page_l, selfie_chip)
    await page_l.locator('text=SCENE MISMATCH BLOCKED').first.wait_for(state="visible", timeout=8000)
    await asyncio.sleep(1.8)

    # (c) Custom Dark Visual File Picker: Damaged Sofa + UPI + Gemini 3.8 Flash
    await pick_file_with_visual_overlay(page_l, 'input[type="file"]', 'living_room_sofa_tear.jpg', MOVE_OUT_IMG, title="Move-Out Audit — Select Real Damaged Photo", hold_sec=1.2)
    upi_inp = page_l.locator('input[placeholder*="yourname@okaxis"], input[placeholder*="UPI"]').first
    if await upi_inp.is_visible():
        await animated_type(page_l, upi_inp, "priyam.prajapati@okaxis", delay=0.065)
    override_chk = page_l.locator('label:has-text("Override") input, input[type="checkbox"]').last
    if await override_chk.count() > 0 and await override_chk.is_visible() and not (await override_chk.is_checked()):
        await override_chk.check()

    await animated_click(page_l, 'button[type="submit"]:has-text("Run AI Damage Audit")')
    print("     Waiting for Gemini 3.8 Flash AI Audit modal to finish completely...")
    await page_l.locator('h3:has-text("Move-Out Inspection")').wait_for(state="detached", timeout=60000)
    await wait_no_spinners(page_l)
    await page_l.locator('#guest-refund-terminal').first.wait_for(state="visible", timeout=25000)

    cur.execute('SELECT "suggestedCut", "aiVerdict" FROM "Item" WHERE "tenancyId" = %s LIMIT 1', (tenancy_id,))
    item_cut_row = cur.fetchone()
    actual_cut = int(float(item_cut_row[0] or 0)) if item_cut_row else 0
    cur.execute('SELECT "depositAmount", "estimatedRefund" FROM "Tenancy" WHERE id = %s', (tenancy_id,))
    t_row = cur.fetchone()
    dep_amt = int(float(t_row[0] or 25000))
    actual_refund = int(float(t_row[1])) if t_row[1] is not None else max(0, dep_amt - actual_cut)
    print(f"     [LIVE GEMINI SCRAPED] Verdict={item_cut_row[1] if item_cut_row else '?'} | Deduction = ₹{actual_cut:,} | Net Refund = ₹{actual_refund:,}")

    await page_l.locator('text=/Italian Leather Sofa/i').first.scroll_into_view_if_needed()
    await page_r.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('PROPERTY VACATED • GEMINI 3.8 AUDIT ARBITRATED!');")
    await asyncio.sleep(3.0)

    # ---------------- SCENE 8 (Even -> EMERALD) ----------------
    print("  -> Scene 08: Stage 2 Net Refund QR Handshake -> ₹0 Both Dashboards...")
    await page_l.evaluate("window.setSceneLed && window.setSceneLed(8);")
    guest_term = page_l.locator('#guest-refund-terminal').first
    await guest_term.wait_for(state="visible", timeout=20000)
    await guest_term.scroll_into_view_if_needed()

    pay_ref_btn = page_r.locator('button:has-text("Scan Guest QR / Pay Net Refund"), button:has-text("Pay Net Refund")').first
    await pay_ref_btn.wait_for(state="visible", timeout=25000)
    await animated_click(page_r, pay_ref_btn)
    await page_r.locator('text=Direct UPI Transfer to').first.wait_for(state="visible", timeout=12000)
    await asyncio.sleep(2.2)

    await animated_click(page_r, 'button:has-text("Judge Demo Simulate Razorpay Webhook")')
    await page_r.locator('button:has-text("Judge Demo Simulate Razorpay Webhook")').wait_for(state="detached", timeout=25000)
    await asyncio.sleep(0.8)

    for _ in range(10):
        cur.execute('SELECT status FROM "Tenancy" WHERE id = %s', (tenancy_id,))
        st = cur.fetchone()
        if st and st[0] == 'SETTLED':
            break
        await asyncio.sleep(0.5)

    await asyncio.gather(page_l.goto(f"{BASE_URL}/", timeout=25000), page_r.goto(f"{BASE_URL}/", timeout=25000))
    await wait_no_spinners(page_l)
    await wait_no_spinners(page_r)
    await asyncio.gather(attach_overlay(page_l, "TENANT", 8), attach_overlay(page_r, "LANDLORD", 8))

    await page_l.locator('text=₹0').first.wait_for(state="visible", timeout=15000)
    await page_r.locator('text=₹0').first.wait_for(state="visible", timeout=15000)
    await page_l.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('ACTIVE DEPOSIT AUTO-CLEARED TO ₹0!');")
    await page_r.evaluate("window.showAutoSyncBadge && window.showAutoSyncBadge('SETTLED & ARCHIVED TO HISTORY (₹0)!');")
    await asyncio.sleep(2.5)

    # ---------------- SCENE 9 (Odd -> CYAN) ----------------
    print("  -> Scene 09: Society Move-Out Gate Pass NOC & Official Settlement Receipt (4.2s)...")
    await page_l.evaluate("window.setSceneLed && window.setSceneLed(9);")
    await animated_click(page_l, 'button:has-text("Society Gate Pass & NOC")')
    await page_l.locator('text=Move-Out Gate Pass').first.wait_for(state="visible", timeout=15000)

    await animated_click(page_r, 'button:has-text("Settlement Receipt")')
    await page_r.locator('text=Escrow Settlement Receipt').first.wait_for(state="visible", timeout=15000)

    await asyncio.sleep(4.2)

    conn.close()
    await ctx_l.close()
    await ctx_r.close()

    left_webm = str(max(Path(dl_dir).glob("*.webm"), key=os.path.getmtime))
    right_webm = str(max(Path(dr_dir).glob("*.webm"), key=os.path.getmtime))
    dual_mp4 = os.path.join(TEMP_DIR, "dual_2_to_9_60fps.mp4")
    run_cmd([
        "ffmpeg", "-y", "-i", left_webm, "-i", right_webm,
        "-filter_complex", "[0:v]scale=960:1080,fps=60[v0];[1:v]scale=960:1080,fps=60[v1];[v0][v1]hstack=inputs=2[v]",
        "-map", "[v]", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "60", dual_mp4
    ])
    sliced = slice_dual_video_by_led(dual_mp4, [2, 3, 4, 5, 6, 7, 8, 9])
    return sliced, tenancy_id, landlord_token, actual_cut, actual_refund


# -----------------------------------------------------------------------------
# PASS 1: SCENE 10 (COURTROOM /verify VERIFIER + END CARD)
# -----------------------------------------------------------------------------
async def record_scene_10(browser) -> str:
    print(">>> [PASS 1] Recording Scene 10 (Zero-Server Courtroom Verifier /verify)...")
    s10_dir = os.path.join(TEMP_DIR, "s10")
    shutil.rmtree(s10_dir, ignore_errors=True)
    os.makedirs(s10_dir, exist_ok=True)
    ctx = await browser.new_context(record_video_dir=s10_dir, record_video_size={"width": 1920, "height": 1080}, viewport={"width": 1920, "height": 1080})
    await ctx.add_init_script("document.documentElement.style.backgroundColor = '#060d13';")
    page = await ctx.new_page()

    await page.goto(f"{BASE_URL}/verify", timeout=30000)
    await wait_no_spinners(page)
    await attach_overlay(page)

    load_btn = page.locator('button:has-text("Load Demo Certificate")').first
    if await load_btn.is_visible():
        await animated_click(page, load_btn)
        await asyncio.sleep(1.8)

    inp = page.locator('input[type="file"]').first
    if await inp.count() > 0:
        await pick_file_with_visual_overlay(page, 'input[type="file"]', 'living_room_clean.jpg', MOVE_IN_IMG, title="Courtroom Dropzone — Select Original Photo", hold_sec=1.2)

    await page.locator('text=/Authentic|100%|VERIFIED|Match/i').first.wait_for(state="visible", timeout=15000)
    await asyncio.sleep(3.2)

    await page.evaluate("""
    (() => {
        const card = document.createElement('div');
        card.style.cssText = 'position:fixed;inset:0;background:rgba(6,13,19,0.97);display:flex;align-items:center;justify-content:center;z-index:99999999;';
        card.innerHTML = `<div style="text-align:center;padding:48px 64px;border:2px solid rgba(16,185,129,0.35);border-radius:28px;background:#0b1329;box-shadow:0 0 80px rgba(16,185,129,0.28);">
            <div style="font-size:56px;font-weight:900;background:linear-gradient(135deg,#10b981,#38bdf8);-webkit-background-clip:text;color:transparent;margin-bottom:14px;">RentShield Protocol</div>
            <div style="font-size:20px;color:#94a3b8;font-family:monospace;margin-bottom:26px;">Autonomous Cryptographic & AI Rental Cyber-Escrow</div>
            <div style="font-size:15px;color:#6ee7b7;font-family:monospace;font-weight:bold;">https://rentshield-web.onrender.com • Gemini 3.8 Flash + SHA-256</div>
        </div>`;
        document.body.appendChild(card);
    })();
    """)
    await asyncio.sleep(2.4)

    await ctx.close()
    raw_webm = str(max(Path(s10_dir).glob("*.webm"), key=os.path.getmtime))
    out_mp4 = os.path.join(TEMP_DIR, "scene_10_raw.mp4")
    run_cmd(["ffmpeg", "-y", "-i", raw_webm, "-vf", "scale=1920:1080,fps=60", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", out_mp4])
    return out_mp4


# -----------------------------------------------------------------------------
# PASS 2: STUDIO-MASTERED SYNC + DARK #060D13 FADES + SINGLE-PASS 48kHz STEREO AAC
# -----------------------------------------------------------------------------
SUBTITLES = {
    1: "Scene 01: Google Search -> Cyber-Shield Logo Morph & PWA Install",
    2: "Scene 02: Split-Screen Login & User Profile Identity Vault",
    3: "Scene 03: MTA 2021 Lease Risk Scanner -> 95/100 High Risk Verdict",
    4: "Scene 04: ₹25,000 Tenancy Setup -> Live Auto-Sync to Owner",
    5: "Scene 05: SHA-256 Baseline Upload, Revision Alert & Owner Lock",
    6: "Scene 06: Owner Receiving QR Terminal + Clean Guest Checkout",
    7: "Scene 07: Judge Chips + Visual Picker + Triple Anti-Fraud & Gemini 3.8",
    8: "Scene 08: Guest Refund QR Terminal -> Both Dashboards Auto-Clear ₹0",
    9: "Scene 09: Society Gate Pass NOC & Official Escrow Settlement Receipt",
    10: "Scene 10: Zero-Server Courtroom Verifier (/verify) -> 100% Authentic",
}


def write_scene_ass(ass_path: str, duration: float, text: str):
    hrs = int(duration // 3600)
    mins = int((duration % 3600) // 60)
    secs = int(duration % 60)
    cs = int(round((duration - int(duration)) * 100))
    end_t = f"{hrs:d}:{mins:02d}:{secs:02d}.{cs:02d}"
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,28,&H00FFFFFF,&H000000FF,&H00000000,&HD8060D13,1,0,0,0,100,100,0,0,3,8,0,2,40,40,34,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,{end_t},Default,,0,0,0,,{text}
"""
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header)


def build_contact_sheet(frame_paths: list, out_path: str):
    cols, rows = 5, 2
    cw, ch = 480, 270
    sheet = Image.new("RGB", (cols * cw, rows * ch), (6, 13, 19))
    draw = ImageDraw.Draw(sheet)
    for idx, fpath in enumerate(frame_paths):
        img = Image.open(fpath).convert("RGB").resize((cw, ch), Image.Resampling.LANCZOS)
        r = idx // cols
        c = idx % cols
        x0, y0 = c * cw, r * ch
        sheet.paste(img, (x0, y0))
        draw.rectangle([x0 + 8, y0 + 8, x0 + 132, y0 + 34], fill=(6, 13, 19), outline=(16, 185, 129), width=2)
        draw.text((x0 + 16, y0 + 14), f"SCENE {idx + 1:02d}", fill=(110, 231, 183))
    sheet.save(out_path, format="PNG")
    print(f"[Proof] Saved 5x2 Contact Sheet -> {out_path}")


async def main():
    wipe_user_tenancies_preserve_demo()
    # Warm up Render API so Gemini endpoints respond in <1.5s without cold starts
    try:
        import urllib.request
        urllib.request.urlopen("https://rentshield-api.onrender.com/api/tenancy/ai-health", timeout=25).read()
    except Exception:
        pass

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox", "--start-maximized"]
        )
        s1_mp4 = await record_scene_01(browser)
        scene_clips, _, _, actual_cut, actual_refund = await record_scenes_02_to_09(browser)
        s10_mp4 = await record_scene_10(browser)
        await browser.close()

    scene_clips[1] = s1_mp4
    scene_clips[10] = s10_mp4

    # Reuse already-synthesized & cleaned Gemini WAVs if --reuse-audio passed
    if "--reuse-audio" in sys.argv:
        force_set = set()
    else:
        force_set = {3, 4, 5, 7, 9}
        if actual_cut != 3500 or actual_refund != 21500:
            force_set.add(8)

    durations, mastered_wavs = generate_all_scenes_audio(
        cut_amount=actual_cut,
        refund_amount=actual_refund,
        force_scenes=force_set,
    )

    video_parts = []
    audio_parts = []
    keyframe_pngs = []
    print("\n" + "=" * 80)
    print("PASS 2: STUDIO-MASTERING 60FPS VIDEO (CRF=19, #060D13 FADES) + 48kHz STEREO AAC")
    print("=" * 80)

    for i in range(1, 11):
        raw_v = scene_clips[i]
        wav_a = mastered_wavs[i]
        vid_dur = probe_duration(raw_v)
        target_dur = durations[i]  # already includes 35ms/60ms afades, loudnorm & 0.25s tail pad

        ass_rel = f"scripts/temp/video_build/s{i:02d}.ass"
        write_scene_ass(ass_rel, target_dur, SUBTITLES[i])

        fade_out_st = max(0.2, target_dur - 0.30)
        fade_vf = f"fade=t=in:st=0:d=0.30:color=#060D13,fade=t=out:st={fade_out_st:.4f}:d=0.30:color=#060D13"

        if vid_dur < target_dur:
            pad_s = target_dur - vid_dur
            v_filter = f"scale=1920:1080,fps=60,tpad=stop_mode=clone:stop_duration={pad_s:.4f},ass=filename={ass_rel},{fade_vf}"
        else:
            ratio = target_dur / vid_dur
            v_filter = f"scale=1920:1080,setpts={ratio:.6f}*PTS,fps=60,ass=filename={ass_rel},{fade_vf}"

        part_v = os.path.join(TEMP_DIR, f"scene_{i:02d}_video.mp4")
        run_cmd([
            "ffmpeg", "-y", "-i", raw_v,
            "-vf", v_filter,
            "-an", "-t", f"{target_dur:.4f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "60", part_v
        ])
        video_parts.append(part_v)
        audio_parts.append(wav_a)

        mid_t = target_dur * 0.50
        kf_png = os.path.join(TEMP_DIR, f"kf_{i:02d}.png")
        run_cmd(["ffmpeg", "-y", "-ss", f"{mid_t:.3f}", "-i", part_v, "-frames:v", "1", kf_png])
        keyframe_pngs.append(kf_png)
        print(f"  -> Scene {i:02d}: Raw={vid_dur:.2f}s | MasterAudio={target_dur:.2f}s (CRF=19, 48kHz Stereo PCM)")

    # Concatenate lossless video stream + lossless PCM audio concat encoded ONCE to 48kHz Stereo AAC 192kbps
    v_concat_txt = os.path.join(TEMP_DIR, "video_concat.txt")
    with open(v_concat_txt, "w", encoding="utf-8") as f:
        for vp in video_parts:
            f.write(f"file '{vp.replace(chr(92), '/')}'\n")

    concat_v_only = os.path.join(TEMP_DIR, "all_scenes_v_only.mp4")
    run_cmd(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", v_concat_txt, "-c:v", "copy", concat_v_only])

    master_audio_wav = os.path.join(TEMP_DIR, "master_all_48k_stereo.wav")
    a_cmd = ["ffmpeg", "-y"]
    for ap in audio_parts:
        a_cmd.extend(["-i", ap])
    a_inputs = "".join(f"[{idx}:a]" for idx in range(len(audio_parts)))
    a_cmd.extend([
        "-filter_complex", f"{a_inputs}concat=n={len(audio_parts)}:v=0:a=1[aout]",
        "-map", "[aout]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", master_audio_wav
    ])
    run_cmd(a_cmd)

    # Single clean mux: Video copy + 1-pass 48kHz Stereo AAC 192kbps encode (ZERO AAC boundary pops!)
    run_cmd([
        "ffmpeg", "-y", "-i", concat_v_only, "-i", master_audio_wav,
        "-map", "0:v", "-map", "1:a",
        "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest", OUTPUT_VIDEO
    ])

    build_contact_sheet(keyframe_pngs, CONTACT_SHEET)
    final_dur = probe_duration(OUTPUT_VIDEO)
    print(f"\nDONE! Studio-Mastered 60fps 48kHz Stereo MP4: {OUTPUT_VIDEO} ({final_dur:.2f}s)")


if __name__ == "__main__":
    asyncio.run(main())

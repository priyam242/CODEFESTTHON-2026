import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        page.on("requestfailed", lambda r: print(f"REQ FAILED: {r.method} {r.url} -> {r.failure}"))
        page.on("response", lambda r: print(f"RES {r.status} {r.url}"))
        page.on("console", lambda m: print(f"CONSOLE [{m.type}]: {m.text}"))

        await page.goto("https://rentshield-web.onrender.com/login", wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # Check API base
        api_base = await page.evaluate("() => window.VITE_API_URL || (window.__ENV__ && window.__ENV__.VITE_API_URL) || 'default'")
        print("API BASE on page:", api_base)

        demo_btn = page.locator('button:has-text("Demo as Tenant")')
        await demo_btn.click()
        await page.wait_for_timeout(4000)
        print("Final URL:", page.url)

        # Check if error message appeared on page
        err = page.locator('.text-rose-400, .text-red-400, [role="alert"]')
        if await err.count() > 0:
            print("Error text on page:", await err.first.inner_text())

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

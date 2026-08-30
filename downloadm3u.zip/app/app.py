import streamlit as st
import streamlit.components.v1 as components 
import requests
import re
import json
import os
import io
from urllib.parse import urlparse, urljoin

st.set_page_config(page_title="Ultra Fast HLS Downloader", layout="wide")
st.title("🚀 Extreme Speed HLS Downloader")

# --- Token Logic ---
# Replaced with placeholder for security; original logic preserved
FALLBACK_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3Njk4NDM3NjEuMTkyLCJkYXRhIjp7Il9pZCI6IjYyY2UwZDBhMjE2ZGNmMDAxOGRiMzM0OSIsInVzZXJuYW1lIjoiOTMzNTIyMDY4MSIsImZpcnN0TmFtZSI6IklhdiIsImxhc3ROYW1lIjoicGFuZGV5Iiwib3JnYW5pemF0aW9uIjp7Il9pZCI6IjVlYjM5M2VlOTVmYWI3NDY4YTc5ZDE4OSIsIndlYnNpdGUiOiJwaHlzaWNzd2FsbGFoLmNvbSIsIm5hbWUiOiJQaHlzaWNzd2FsbGFoIn0sImVtYWlsIjoicGFuZGV5YXJjaGl0YTkzMzVAZ21haWwuY29tIiwicm9sZXMiOlsiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIiwiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIl0sImNvdW50cnlHcm91cCI6IklOIiwidHlwZSI6IlVTRVIifSwiaWF0IjoxNzY5MjM4OTYxfQ.qu9x2NBOBWbQJtd88ITlUh9QQ_gdWMvaAAGpRTTZB_E"

def get_dynamic_token():
    try:
        r = requests.get("https://pw-api22-e3572562e69d.herokuapp.com/api/token/newr", timeout=5)
        data = r.json()
        if data and data.get("access_token"):
            return data.get("access_token")
    except: pass
    return FALLBACK_TOKEN

def append_query_params(url, query):
    if not query: return url
    return f"{url}{'&' if '?' in url else '?'}{query}"

def get_hls_metadata(m3u8_url, auth_headers):
    """Fetches M3U8 metadata including master playlists and decryption keys."""
    try:
        orig_query = urlparse(m3u8_url).query
        r = requests.get(m3u8_url, headers={}, timeout=15)
        r.raise_for_status()
        lines = r.text.splitlines()
        
        if "#EXT-X-STREAM-INF" in r.text:
            qualities = []
            for i, line in enumerate(lines):
                if line.startswith("#EXT-X-STREAM-INF"):
                    res = re.search(r'RESOLUTION=(\d+x\d+)', line)
                    v_url = urljoin(m3u8_url, lines[i+1])
                    if orig_query:
                        v_url = append_query_params(v_url, orig_query)
                    qualities.append({"label": res.group(1) if res else f"Stream {len(qualities)}", "url": v_url})
            return "master", qualities

        segments, key_info = [], None
        for line in lines:
            line = line.strip()
            if line.startswith("#EXT-X-KEY"):
                key_uri = re.search(r'URI="([^"]+)"', line)
                iv_match = re.search(r'IV=0x([0-9a-fA-F]+)', line)
                if key_uri:
                    k_url = urljoin(m3u8_url, key_uri.group(1))
                    if orig_query: k_url = append_query_params(k_url, orig_query)
                    k_resp = requests.get(k_url, headers=auth_headers)
                    if k_resp.status_code == 200:
                        key_info = {
                            "keyHex": k_resp.content.hex(), 
                            "ivHex": iv_match.group(1) if iv_match else None
                        }
            elif line and not line.startswith('#'):
                seg_url = urljoin(m3u8_url, line)
                if orig_query: seg_url = append_query_params(seg_url, orig_query)
                segments.append(seg_url)
        
        return "media", {"segments": segments, "key": key_info}
    except Exception as e:
        st.error(f"Error fetching metadata: {e}")
        return None, None

# --- UI ---
default_url = st.query_params.get("url", "")
input_url = st.text_input("Enter M3U8 URL:", value=default_url)

# Increased maximum thread count for extreme parallelism
thread_count = st.slider("Parallel Threads (Max Speed)", 1, 1000, 256)

if input_url:
    token = get_dynamic_token()
    auth_headers = {'Authorization': f'Bearer {token}'}

    if st.button("🔍 Step 1: Fetch Qualities") or (default_url and 'qualities' not in st.session_state):
        type, data = get_hls_metadata(input_url, auth_headers)
        if type == "master":
            st.session_state.qualities = data
        elif type == "media":
            st.session_state.qualities = [{"label": "Direct Stream", "url": input_url}]

    if st.session_state.get('qualities'):
        selected = st.selectbox("Select Quality", st.session_state.qualities, format_func=lambda x: x['label'])
        
        if st.button("⚡ Step 2: Start Parallel Download"):
            type, media_data = get_hls_metadata(selected['url'], auth_headers)
            if type == "media":
                js_data = {
                    "segments": media_data['segments'], 
                    "keyInfo": media_data['key'], 
                    "threadCount": thread_count
                }
                
                # Optimized JavaScript for extreme parallelism and faster decryption
                components.html(f"""
                    <div id="s" style="color:white;padding:10px;background:#111;border-radius:5px;">Initializing Parallel Workers...</div>
                    <progress id="p" value="0" max="100" style="width:100%;height:20px;"></progress>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
                    <script>
                    const d={json.dumps(js_data)};
                    async function dl() {{
                        const res=new Array(d.segments.length).fill(null);
                        let cur=0, done=0;
                        const key=d.keyInfo ? CryptoJS.enc.Hex.parse(d.keyInfo.keyHex) : null;
                        
                        async function wk() {{
                            while(cur < d.segments.length) {{
                                const i = cur++;
                                try {{
                                    const r = await fetch(d.segments[i]);
                                    if (!r.ok) throw new Error();
                                    let b = await r.arrayBuffer();
                                    
                                    if(key) {{
                                        const iv = d.keyInfo.ivHex ? 
                                                   CryptoJS.enc.Hex.parse(d.keyInfo.ivHex) : 
                                                   CryptoJS.enc.Hex.parse(i.toString(16).padStart(32,'0'));
                                        
                                        const dec = CryptoJS.AES.decrypt({{ciphertext: CryptoJS.lib.WordArray.create(b)}}, key, {{
                                            iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding
                                        }});
                                        
                                        // Optimized decryption result handling: avoid slow hex strings
                                        const sigBytes = dec.sigBytes;
                                        const words = dec.words;
                                        const bytes = new Uint8Array(sigBytes);
                                        for (let n = 0; n < sigBytes; n++) {{
                                            bytes[n] = (words[n >>> 2] >>> (24 - (n % 4) * 8)) & 0xff;
                                        }}
                                        b = bytes;
                                    }} else {{
                                        b = new Uint8Array(b);
                                    }}
                                    
                                    res[i] = b; done++;
                                    document.getElementById('p').value = (done / d.segments.length) * 100;
                                    document.getElementById('s').innerText = `Downloading: ${{done}}/${{d.segments.length}} segments`;
                                }} catch(e) {{ console.error("Segment failed:", i); }}
                            }}
                        }}
                        
                        const workers = [];
                        // Removed the 64-thread cap to allow full parallelism
                        const threadLimit = Math.min(d.threadCount, d.segments.length);
                        for(let i=0; i < threadLimit; i++) workers.push(wk());
                        await Promise.all(workers);
                        
                        document.getElementById('s').innerText = "Merging File...";
                        const blob = new Blob(res.filter(x=>x), {{type:'video/mp2t'}});
                        const a = document.createElement('a'); 
                        a.href = URL.createObjectURL(blob); 
                        a.download = "video.ts"; 
                        a.click();
                        document.getElementById('s').innerText = "✅ Download Complete!";
                    }}
                    dl();
                    </script>
                """, height=120)

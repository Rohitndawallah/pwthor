import os # Add this at the very top of your file
import json
import requests
import hashlib # Added missing import
from flask import Flask, request, jsonify
from flask_caching import Cache
from datetime import datetime

app = Flask(__name__)

# --- Configuration ---
cache_config = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 14400  # Set default to 5 hours (18000 seconds)
}
cache = Cache(app, config=cache_config)

API_URL = "https://api.penpencil.co/v3/files/send-analytics-data"
DECRYPT_API_URL = "https://master-api-py-v1-x-ac6bfd8ef11d.herokuapp.com/pw/cookie/decrypt"

# Modified to use ONLY mpd_url as the cache key
def make_cache_key():
    data = request.get_json()
    mpd_url = data.get('mpd_url', '')
    # The cache key is now solely dependent on the mpd_url
    return hashlib.md5(mpd_url.encode()).hexdigest()

def manual_get_param(query, param_name):
    try:
        parts = query.lstrip('?').split('&')
        for part in parts:
            if part.startswith(f"{param_name}="):
                return part.split('=', 1)[1]
        return ""
    except:
        return ""

def decrypt_single_value(raw_encrypted_value):
    try:
        decrypt_payload = {"data": raw_encrypted_value}
        response = requests.post(DECRYPT_API_URL, json=decrypt_payload, timeout=15)
        if response.status_code == 200:
            return response.json().get("decrypted")
        return None
    except Exception:
        return None

@app.route('/decrypt', methods=['POST'])
# Using @cache.cached with the custom key function and 5-hour timeout
@cache.cached(timeout=18000, make_cache_key=make_cache_key)
def process_mpd():
    data = request.json
    access_token = data.get("access_token")
    mpd_url = data.get("mpd_url")

    if not access_token or not mpd_url:
        return jsonify({"error": "Missing access_token or mpd_url"}), 400

    # Headers dynamically using the provided token
    headers = {
    "accept": "*/*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "audiocodeccapability": json.dumps({
        "AAC-LC": {"isSupported": True, "Profile": [{"container": "audio/mp4", "supported": True}, {"container": "audio/webm", "supported": False}, {"container": "audio/ogg", "supported": False}]},
        "HE-AAC v1": {"isSupported": True, "Profile": [{"container": "audio/mp4", "supported": True}, {"container": "audio/webm", "supported": False}, {"container": "audio/ogg", "supported": False}]},
        "HE-AAC v2": {"isSupported": True, "Profile": [{"container": "audio/mp4", "supported": True}, {"container": "audio/webm", "supported": False}, {"container": "audio/ogg", "supported": False}]}
    }),
    "authorization": f"Bearer {access_token.replace('Bearer ', '')}",
    "cache-control": "no-cache",
    "client-id": "5eb393ee95fab7468a79d189",
    "client-type": "WEB",
    "client-version": "200",
    "content-type": "application/json",
    "devicememory": "4096",
    "devicestreamingtechnology": json.dumps({"dash": {"isSupported": True, "formats": ["mp4", "m4a"], "codecs": ["avc1", "aac"]}, "hls": {"isSupported": False, "formats": [], "codecs": []}}),
    "devicetype": "mobile",
    "drmcapability": json.dumps({"aesSupport": "yes", "fairPlayDrmSupport": "no", "playreadyDrmSupport": "no", "widevineDRMSupport": "yes"}),
    "frameratecapability": json.dumps({"videoQuality": "480p (SD)"}),
    "networktype": "3g",
    "origin": "https://www.pw.live",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "randomid": "9c34fe49-ac55-4579-b068-b03dad2736b0",
    "referer": "https://www.pw.live/",
    "screenresolution": "1650 x 692",
    "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "user-agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
    "version": "0.0.1",
    "videocodeccapability": json.dumps({"Hevc": {"isSupported": "false", "Profile": []}, "AV1": {"isSupported": "true", "Profile": [{"name": "Main"}, {"name": "High"}, {"name": "Professional"}]}})
}

    # Hardcoded payload template as per your script
    # Note: In a real app, you might want these IDs to be dynamic too
    payload = {
        "userId": "60be4f4eada88100118299d1",
        "url": mpd_url,
        "videoUrl": mpd_url,
        "fileUrl": mpd_url,
        "link": mpd_url,
        "parentId": "6815ba54780160a48d8d4261",
        "childId": "e124514c-d4ce-4c4f-80bb-49b676d8dd0c",
        "isComplete": True,
        "batchId": "6891d87e0b9ae4539adcf034",
        "batchSubjectId": "6893659dddf2a670be708574",
        "programId": "5eb3b1017b1fb86475ec30eb",
        "subjectId": "6436677fe8b0e60018e98334",
        "chapterId": "68d61c2fdbb49e38e91bf04d",
        "topicId": "6921a41d164e007b73e5de34"
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        if response.status_code != 200:
            return jsonify({"error": "Auth API failed", "details": response.text}), response.status_code

        auth_query = response.json().get("data")
        if not auth_query:
            return jsonify({"error": "No auth data received"}), 500

        raw_policy = manual_get_param(auth_query, "Policy")
        raw_key_id = manual_get_param(auth_query, "Key-Pair-Id")
        raw_signature = manual_get_param(auth_query, "Signature")

        dec_policy = decrypt_single_value(raw_policy)
        dec_key_id = decrypt_single_value(raw_key_id)
        dec_signature = decrypt_single_value(raw_signature)

        if dec_policy and dec_key_id and dec_signature:
            final_url = f"{mpd_url}?Policy={dec_policy}&Key-Pair-Id={dec_key_id}&Signature={dec_signature}"
            return jsonify({
                "success": True,
                "final_url": final_url
            })
        else:
            return jsonify({"error": "Decryption failed"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Get the port from the environment variable provided by Heroku
    # Default to 5000 for local development if PORT is not set
    port = int(os.environ.get("PORT", 5000)) 
    app.run(host='0.0.0.0', port=port)

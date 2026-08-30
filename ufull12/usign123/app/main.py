from flask import Flask, request, jsonify
from flask_caching import Cache
import requests
import os

# --- Configuration ---
# Configure caching. We're using a simple in-memory cache.
config = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 3 * 60 * 60  # 3 hours in seconds
}

app = Flask(__name__)
# Initialize the cache with the app and the configuration
app.config.from_mapping(config)
cache = Cache(app)

@app.route('/get-signed-url', methods=['POST'])
def get_signed_url():
    """
    Fetches a signed URL. Checks for a cached result first.
    If not cached, it tries fetching from the API with multiple tokens.
    Successful API responses are cached for 3 hours.
    """
    data = request.get_json()
    batch_id = data.get('batch_id')
    schedule_id = data.get('schedule_id')
    tokens = data.get('tokens')

    if not batch_id or not schedule_id or not tokens:
        return jsonify({"success": False, "error": "Missing batch_id, schedule_id, or tokens"}), 400

    # --- 1. Check Cache ---
    # Create a unique key for the batch and schedule ID combination.
    cache_key = f"signed_url_{batch_id}_{schedule_id}"
    cached_data = cache.get(cache_key)

    if cached_data:
        # If a valid, non-expired entry is found, return it immediately.
        response = cached_data.copy() # Use a copy to avoid modifying the cache
        response['source'] = 'cache' # Add a field to indicate the source
        return jsonify(response)

    # --- 2. Fetch from API (if not in cache) ---
    for token in tokens:
        session = requests.Session()
        try:
            # --- 3. Changed User-Agent and related headers ---
            # The headers now mimic a request from an iPhone on Safari.
            headers = {
                "accept": "*/*",
                "accept-encoding": "gzip, deflate, br, zstd",
                "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
                "Authorization": f"Bearer {token['access_token']}",
                "cache-control": "no-cache",
                "client-id": "5eb393ee95fab7468a79d189",
                "client-type": "WEB",
                "content-type": "application/json",
                "origin": "https://www.pw.live",
                "pragma": "no-cache",
                "randomid": "9c34fe49-ac55-4579-b068-b03dad2736b0",
                "referer": "https://www.pw.live/",
                "sec-ch-ua": '"iPhone OS";v="16", "Safari";v="605.1.15", "Not A;Brand";v="99"',
                "sec-ch-ua-mobile": "?1",
                "sec-ch-ua-platform": '"iOS"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site",
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            }

            url = f"https://api.penpencil.co/v1/videos/video-url-details?type=BATCHES&childId={schedule_id}&parentId={batch_id}&reqType=query"
            response = session.get(url, headers=headers, timeout=10)
            session.close() # Session is closed after each attempt as in the original code.

            if response.status_code == 200:
                result = response.json().get("data", {})
                if "url" in result and "signedUrl" in result:
                    response_data = {
                        "success": True,
                        "signed_url": result["url"] + result["signedUrl"],
                        "token_used": token["tokenId"]
                    }
                    
                    # --- 4. Cache the successful response ---
                    # The timeout is handled by the default config (3 hours).
                    cache.set(cache_key, response_data)

                    response_to_send = response_data.copy()
                    response_to_send['source'] = 'api' # Indicate this was fetched live
                    return jsonify(response_to_send)

        except Exception as e:
            # Ensure the session is closed even if an error occurs.
            if session:
                session.close()
            # You might want to log the error `e` here for debugging.
            print(f"An error occurred: {e}")

    # This part is reached only if the loop completes without a successful API call.
    return jsonify({"success": False, "error": "No valid token worked"}), 403

if __name__ == '__main__':
    # Use the PORT environment variable if available, otherwise default to 5000.
    port = int(os.environ.get("PORT", 5000))
    # Run the app, accessible from any IP on the network.
    app.run(host='0.0.0.0', port=port)

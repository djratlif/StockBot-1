import urllib.request
import json
url = "https://query1.finance.yahoo.com/v8/finance/chart/SPY"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        price = data['chart']['result'][0]['meta']['regularMarketPrice']
        prev_close = data['chart']['result'][0]['meta']['chartPreviousClose']
        print(f"Yahoo SPY: {price}, prev: {prev_close}")
except Exception as e:
    print(f"Failed: {e}")

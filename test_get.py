import urllib.request
import ssl

ctx = ssl._create_unverified_context()
proxy_support = urllib.request.ProxyHandler({'https': 'http://127.0.0.1:51451'})
opener = urllib.request.build_opener(proxy_support, urllib.request.HTTPSHandler(context=ctx))
urllib.request.install_opener(opener)

req = urllib.request.Request("https://api.github.com/zen")
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print(f"Error: {e}")

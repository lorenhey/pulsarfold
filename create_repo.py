import http.client
import json
import ssl
import os

token = os.environ.get("GITHUB_TOKEN")
ctx = ssl._create_unverified_context()

conn = http.client.HTTPConnection("127.0.0.1", 51451)
conn.set_tunnel("api.github.com", 443)

# Now we need to wrap the socket with SSL manually
conn.connect()
sock = conn.sock
ssock = ctx.wrap_socket(sock, server_hostname="api.github.com")

conn = http.client.HTTPSConnection("api.github.com", 443, context=ctx)
conn.sock = ssock

headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Python"
}
data = json.dumps({"name": "pulsarfold", "private": False, "description": "A compact workbench for pulsar observation analysis"})
try:
    conn.request("POST", "/user/repos", body=data, headers=headers)
    res = conn.getresponse()
    print(res.status)
    print(res.read().decode())
except Exception as e:
    print(f"Error: {e}")

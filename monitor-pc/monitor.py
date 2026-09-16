import json, os, socket, time, urllib.request, urllib.error
from datetime import datetime, timezone

CONFIG="config.json"

def load_config():
    with open(CONFIG,"r",encoding="utf-8") as f:
        return json.load(f)

def tcp_probe(host, ports=(80,443,445,3389,8080)):
    for port in ports:
        s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
        s.settimeout(1.5)
        try:
            if s.connect_ex((host,port)) == 0:
                return True, port
        finally:
            s.close()
    return False, None

def write_status(cfg, asset, online, method):
    # REST write is intentionally optional. Configure firestore REST endpoint if desired.
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {asset.get('kodeAset', asset.get('id'))}: "
          f"{'ONLINE' if online else 'OFFLINE'} via {method}")

def main():
    cfg=load_config()
    interval=max(10,int(cfg.get("intervalSeconds",10)))
    assets=cfg.get("assets",[])
    print("IT Asset Monitor - Windows")
    print("Interval:", interval, "detik")
    print("Jumlah aset:", len(assets))
    print("Tekan Ctrl+C untuk berhenti.")
    while True:
        for asset in assets:
            ip=str(asset.get("ipAddress","")).strip()
            if not ip: continue
            online,port=tcp_probe(ip)
            write_status(cfg,asset,online,f"TCP:{port}" if online else "TCP")
        time.sleep(interval)

if __name__=="__main__":
    main()

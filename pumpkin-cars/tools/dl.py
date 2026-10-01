import os, urllib.request
from data import CARS
root = os.path.join(os.path.dirname(__file__), "..", "images", "cars")
for i, c in enumerate(CARS, 1):
    for j, h in enumerate(c["gal"].split(","), 1):
        out = os.path.join(root, f"car-{i:02d}-{j}.jpg")
        if os.path.exists(out): continue
        url = f"https://www.pumpkincars.com/images/vehicles/{c['p']}-{h}.jpg"
        try:
            req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0","Referer":"https://www.pumpkincars.com/"})
            open(out,"wb").write(urllib.request.urlopen(req, timeout=30).read())
        except Exception as e:
            print("FAIL", url, e)
print("done")

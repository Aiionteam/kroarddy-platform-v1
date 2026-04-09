# -*- coding: utf-8 -*-
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "app" / "customer" / "guide" / "page.tsx"


def main():
    s = SRC.read_text(encoding="utf-8")
    keys = sorted(set(re.findall(r'\bt\("([^"]+)"', s)))
    keys = [k for k in keys if k.startswith("customer.guide.")]
    print("keys", len(keys))
    for k in keys:
        print(k)


if __name__ == "__main__":
    main()

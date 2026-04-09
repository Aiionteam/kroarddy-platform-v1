# -*- coding: utf-8 -*-
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SRC_FILES = [
    ROOT / "app" / "customer" / "emergency" / "page.tsx",
    ROOT / "app" / "customer" / "emergency" / "share" / "page.tsx",
]


def main():
    keys = set()
    for p in SRC_FILES:
        s = p.read_text(encoding="utf-8")
        keys |= set(re.findall(r'\bt\("([^"]+)"', s))
    keys = sorted(k for k in keys if k.startswith("customer.emergency."))
    print("keys", len(keys))
    for k in keys:
        print(k)


if __name__ == "__main__":
    main()


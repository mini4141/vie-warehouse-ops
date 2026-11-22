"""Writes the OpenAPI document without running a server: python -m app.export_openapi openapi.json"""

import json
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.main import app  # noqa: E402

if __name__ == "__main__":
    with open(sys.argv[1] if len(sys.argv) > 1 else "openapi.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump(app.openapi(), f, indent=2, sort_keys=True)
        f.write("\n")

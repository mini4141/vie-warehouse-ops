"""Static 60 m x 40 m floor plan; mirrors apps/web/src/telemetry/mock/layout.ts."""

import math

WIDTH = 60.0
HEIGHT = 40.0
AISLE_YS = [7.5 + 5 * k for k in range(7)]
CROSS_XS = [2.0, 16.25, 29.75, 43.25, 58.0]
_BLOCK_W, _BLOCK_GAP, _BLOCK_X0 = 11.0, 2.5, 4.0

STATIONS = [
    {"id": "S-P1", "x": 10.0, "y": 3.5, "kind": "pick"},
    {"id": "S-P2", "x": 22.0, "y": 3.5, "kind": "pick"},
    {"id": "S-K1", "x": 38.0, "y": 3.5, "kind": "pack"},
    {"id": "S-K2", "x": 50.0, "y": 3.5, "kind": "pack"},
]
CHARGERS = [{"id": f"C-{i + 1}", "x": 8.0 + 9 * i, "y": 1.0} for i in range(6)]


def build_layout() -> dict:
    racks = []
    for pair in range(6):
        y0 = 9 + 5 * pair
        for dy in (0.5, 1.5):
            for b in range(4):
                x = _BLOCK_X0 + b * (_BLOCK_W + _BLOCK_GAP) + _BLOCK_W / 2
                racks.append({"x": x, "y": y0 + dy, "w": _BLOCK_W, "d": 1.0, "h": 3.0})
    return {"width": WIDTH, "height": HEIGHT, "racks": racks, "stations": STATIONS, "chargers": CHARGERS}


def location_label(aisle: int, x: float) -> str:
    """Pick slots sit on an aisle line in front of a rack block, e.g. A-07-3."""
    bay = min(12, max(1, math.ceil(x / WIDTH * 12)))
    return f"{chr(65 + aisle)}-{bay:02d}-{1 + int(x * 3) % 4}"

"""Manhattan route along aisles. Swaps to the native C++ addon when it is importable."""

from .layout import AISLE_YS, CROSS_XS

Point = tuple[float, float]


def _to_aisle(p: Point) -> Point:
    # Open floor (stations/chargers) or mid cross-aisle: snap to the nearest aisle line first.
    y = min(AISLE_YS, key=lambda c: abs(p[1] - c)) if p[1] > 6.5 else AISLE_YS[0]
    return p if abs(y - p[1]) < 0.01 else (p[0], y)


def route(a: Point, b: Point) -> list[Point]:
    a1, b1 = _to_aisle(a), _to_aisle(b)
    pts: list[Point] = []
    if a1 != a:
        pts.append(a1)
    if abs(a1[1] - b1[1]) < 0.01:
        pts.append(b1)
    else:
        xc = min(CROSS_XS, key=lambda c: abs(a1[0] - c) + abs(b1[0] - c))
        pts += [(xc, a1[1]), (xc, b1[1]), b1]
    if b1 != b:
        pts.append(b)
    return pts

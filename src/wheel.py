"""European roulette wheel layout, sector definitions, and position utilities."""

# Physical wheel order (clockwise from 0) — European single-zero
WHEEL_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
    8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
    28, 12, 35, 3, 26
]

TOTAL_POCKETS = len(WHEEL_ORDER)  # 37

# Number -> wheel position index (0-36)
NUMBER_TO_POSITION = {num: idx for idx, num in enumerate(WHEEL_ORDER)}

# Position index -> number
POSITION_TO_NUMBER = {idx: num for idx, num in enumerate(WHEEL_ORDER)}

# Number -> angle in degrees on the wheel
NUMBER_TO_ANGLE = {num: (idx / TOTAL_POCKETS) * 360 for idx, num in enumerate(WHEEL_ORDER)}

# Number -> color
RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
BLACK_NUMBERS = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}


def number_color(n: int) -> str:
    if n == 0:
        return "green"
    return "red" if n in RED_NUMBERS else "black"


# 6 sectors based on physical wheel position
SECTORS = {
    "A": WHEEL_ORDER[0:6],    # [0, 32, 15, 19, 4, 21]
    "B": WHEEL_ORDER[6:12],   # [2, 25, 17, 34, 6, 27]
    "C": WHEEL_ORDER[12:18],  # [13, 36, 11, 30, 8, 23]
    "D": WHEEL_ORDER[18:24],  # [10, 5, 24, 16, 33, 1]
    "E": WHEEL_ORDER[24:30],  # [20, 14, 31, 9, 22, 18]
    "F": WHEEL_ORDER[30:37],  # [29, 7, 28, 12, 35, 3, 26]
}

# Reverse lookup: number -> sector name
NUMBER_TO_SECTOR = {}
for sector_name, numbers in SECTORS.items():
    for num in numbers:
        NUMBER_TO_SECTOR[num] = sector_name


def get_sector(number: int) -> str:
    """Return the sector name for a given number."""
    return NUMBER_TO_SECTOR[number]


def get_neighbors(number: int, n: int = 2) -> list[int]:
    """Return n neighbors on each side of a number on the physical wheel."""
    pos = NUMBER_TO_POSITION[number]
    neighbors = []
    for offset in range(-n, n + 1):
        if offset == 0:
            continue
        neighbor_pos = (pos + offset) % TOTAL_POCKETS
        neighbors.append(POSITION_TO_NUMBER[neighbor_pos])
    return neighbors


def wheel_distance(a: int, b: int) -> int:
    """Minimum arc distance (in pockets) between two numbers on the wheel."""
    pos_a = NUMBER_TO_POSITION[a]
    pos_b = NUMBER_TO_POSITION[b]
    diff = abs(pos_a - pos_b)
    return min(diff, TOTAL_POCKETS - diff)

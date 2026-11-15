"""Dependency-free QR image for the short IPv4 room URL (Model 2, version 3-L)."""
from struct import pack
from zlib import compress, crc32


SIZE = 29
DATA_BYTES = 55
PARITY_BYTES = 15


def multiply(a, b):
    result = 0
    while b:
        if b & 1:
            result ^= a
        a <<= 1
        if a & 256:
            a ^= 0x11D
        b >>= 1
    return result


def codewords(message):
    if len(message) > 53:
        raise ValueError("QR room URL is too long")
    bits = f"0100{len(message):08b}" + "".join(f"{byte:08b}" for byte in message) + "0000"
    data = [int(bits[i:i + 8], 2) for i in range(0, len(bits), 8)]
    data.extend(0xEC if i % 2 == 0 else 0x11 for i in range(DATA_BYTES - len(data)))
    polynomial = [1]
    root = 1
    for _ in range(PARITY_BYTES):
        product = polynomial + [0]
        for i, coefficient in enumerate(polynomial):
            product[i + 1] ^= multiply(coefficient, root)
        polynomial = product
        root = multiply(root, 2)
    block = data + [0] * PARITY_BYTES
    for i in range(len(data)):
        lead = block[i]
        for j, coefficient in enumerate(polynomial):
            block[i + j] ^= multiply(lead, coefficient)
    return data + block[-PARITY_BYTES:]


def matrix(message):
    modules = [[None] * SIZE for _ in range(SIZE)]

    for position in range(SIZE):
        modules[6][position] = modules[position][6] = position % 2 == 0
    for center_x, center_y in ((3, 3), (SIZE - 4, 3), (3, SIZE - 4)):
        for y in range(max(0, center_y - 4), min(SIZE, center_y + 5)):
            for x in range(max(0, center_x - 4), min(SIZE, center_x + 5)):
                depth = max(abs(x - center_x), abs(y - center_y))
                modules[y][x] = depth not in (2, 4)
    for y in range(20, 25):
        for x in range(20, 25):
            modules[y][x] = max(abs(x - 22), abs(y - 22)) != 1

    # Two copies of the BCH-protected format word for error correction L and mask 0.
    format_word = 0x77C4
    around_finder = ([(8, y) for y in range(6)] + [(8, 7), (8, 8), (7, 8)]
                     + [(x, 8) for x in range(5, -1, -1)])
    opposite = ([(SIZE - 1 - i, 8) for i in range(8)]
                + [(8, y) for y in range(SIZE - 7, SIZE)])
    for positions in (around_finder, opposite):
        for i, (x, y) in enumerate(positions):
            modules[y][x] = bool((format_word >> i) & 1)
    modules[SIZE - 8][8] = True

    bits = iter(f"{word:08b}"[i] == "1" for word in codewords(message) for i in range(8))
    right, upward = SIZE - 1, True
    while right > 0:
        if right == 6:
            right -= 1
        rows = range(SIZE - 1, -1, -1) if upward else range(SIZE)
        for y in rows:
            for x in (right, right - 1):
                if modules[y][x] is None:
                    modules[y][x] = next(bits, False) ^ ((x + y) % 2 == 0)
        upward = not upward
        right -= 2
    assert next(bits, None) is None
    return modules


def png_qr(url):
    scale, margin = 8, 4
    width = (SIZE + 2 * margin) * scale
    modules = matrix(url.encode("ascii"))
    white_row = bytes([0]) + bytes([255]) * width
    rows = [white_row] * (margin * scale)
    for row in modules:
        pixels = [False] * margin + row + [False] * margin
        encoded = bytes([0]) + b"".join(bytes([0 if dark else 255]) * scale for dark in pixels)
        rows.extend([encoded] * scale)
    rows.extend([white_row] * (margin * scale))

    def chunk(name, data):
        return pack(">I", len(data)) + name + data + pack(">I", crc32(name + data))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", pack(">IIBBBBB", width, width, 8, 0, 0, 0, 0))
            + chunk(b"IDAT", compress(b"".join(rows))) + chunk(b"IEND", b""))

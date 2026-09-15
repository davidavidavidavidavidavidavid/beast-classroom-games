from PIL import Image, ImageEnhance

def pad_to_square(im, margin_frac=0.04):
    """Pad the full image to a square canvas (never crop content), centered,
    with a small transparent margin so the outline has room to render."""
    w, h = im.size
    side = max(w, h)
    side = int(side * (1 + margin_frac * 2))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    x = (side - w) // 2
    y = (side - h) // 2
    canvas.paste(im, (x, y), im)
    return canvas

def pixelate(src_path, out_path, grid=32, final_size=512, alpha_thresh=110,
             n_colors=14, saturation=1.0, outline_color=(30,30,40,255)):
    im = Image.open(src_path).convert('RGBA')
    im = pad_to_square(im)

    small = im.resize((grid, grid), Image.BOX)
    r, g, b, a = small.split()
    a = a.point(lambda p: 255 if p > alpha_thresh else 0)

    rgb = Image.merge('RGB', (r, g, b))
    white_bg = Image.new('RGB', rgb.size, (255, 255, 255))
    rgb_flat = Image.composite(rgb, white_bg, a)
    if saturation != 1.0:
        rgb_flat = ImageEnhance.Color(rgb_flat).enhance(saturation)

    quantized = rgb_flat.quantize(colors=n_colors, method=Image.MEDIANCUT).convert('RGB')
    out = Image.merge('RGBA', (*quantized.split(), a))

    px = out.load()
    alpha_px = a.load()
    outline_cells = []
    for y in range(grid):
        for x in range(grid):
            if alpha_px[x, y] == 0:
                neighbors = [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]
                if any(0 <= nx < grid and 0 <= ny < grid and alpha_px[nx, ny] > 0 for nx, ny in neighbors):
                    outline_cells.append((x, y))
    for x, y in outline_cells:
        px[x, y] = outline_color

    out = out.resize((final_size, final_size), Image.NEAREST)
    out.save(out_path)
    print(f"saved {out_path}  (source padded to square, full body, grid={grid})")

pixelate('/mnt/user-data/uploads/BAO_Grogg_11.png', 'grogg_fullbody.png', grid=32, saturation=1.15)
pixelate('/mnt/user-data/uploads/BAO_Bot_2.png', 'bot_fullbody.png', grid=32, saturation=1.45, n_colors=10)

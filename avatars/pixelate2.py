from PIL import Image, ImageEnhance

def pixelate(src_path, out_path, grid=28, final_size=512, alpha_thresh=110,
             n_colors=14, saturation=1.0, outline_color=(30,30,40,255)):
    im = Image.open(src_path).convert('RGBA')
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

    # Add a 1-pixel-cell dark outline around the silhouette: any transparent
    # cell adjacent to an opaque cell becomes an opaque outline cell. Classic
    # sprite-readability trick so the icon pops against any background.
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
    print(f"saved {out_path}")

pixelate('grogg_crop_test2.png', 'grogg_final.png', grid=28, saturation=1.15)
pixelate('bot_crop_test.png', 'bot_final.png', grid=28, saturation=1.45, n_colors=10)

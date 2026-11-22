"""Optional vendor maintenance; normal builds do not require fontTools/network.
Download NotoSansSC[wght].ttf from google/fonts/ofl/notosanssc and run:
python3 scripts/prepare_pdf_font.py /path/to/NotoSansSC[wght].ttf
"""
from pathlib import Path
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = instantiateVariableFont(TTFont(sys.argv[1]), {"wght": 400}, inplace=True)
# The bundled fontkit subsetter expects even glyph offsets; do not remove padding.
font["glyf"].padding = 4
font.save(Path(__file__).resolve().parents[1] / "vendor/NotoSansSC-Regular.ttf")

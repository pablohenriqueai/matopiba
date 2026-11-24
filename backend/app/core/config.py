from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "dados"
UPLOAD_DIR = DATA / "uploads"
RESULT_DIR = DATA / "resultados"
DB_PATH = DATA / "historico" / "sojao.sqlite3"
MAX_UPLOAD_BYTES = int(os.getenv("SOJAO_MAX_UPLOAD_BYTES", 20 * 1024 * 1024))
MAX_PIXELS = int(os.getenv("SOJAO_MAX_PIXELS", 40_000_000))
DEVICE = "cuda" if os.getenv("SOJAO_DEVICE", "auto") == "auto" else os.getenv("SOJAO_DEVICE")
WEIGHTS = {
    "folhas": Path(os.getenv("SOJAO_FOLHAS_WEIGHTS", ROOT / "artefatos/classificador_folhas/best_model.pth")),
    "daninhas": Path(os.getenv("SOJAO_DANINHAS_WEIGHTS", ROOT / "artefatos/classificador_daninhas/best_model.pth")),
    "insetos": Path(os.getenv("SOJAO_INSETOS_WEIGHTS", ROOT / "artefatos/detector_insetos/best.pt")),
}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "BMP", "TIFF"}

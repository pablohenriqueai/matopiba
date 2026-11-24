from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException, UploadFile
from app.core.config import ALLOWED_FORMATS, MAX_PIXELS, MAX_UPLOAD_BYTES


def decode_image(data: bytes):
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Arquivo vazio ou acima do limite de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format not in ALLOWED_FORMATS:
                raise HTTPException(415, "Formato não suportado. Use JPG, PNG, WEBP, BMP ou TIFF.")
            if image.width * image.height > MAX_PIXELS:
                raise HTTPException(413, "Imagem excede o limite de resolução permitido.")
            image.verify()
        with Image.open(BytesIO(data)) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.load()
            return image
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(422, "Não foi possível decodificar a imagem; o arquivo pode estar corrompido.") from exc


async def read_upload(upload: UploadFile):
    chunks, total = [], 0
    while chunk := await upload.read(1024 * 1024):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"{upload.filename}: arquivo acima do limite de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
        chunks.append(chunk)
    return b"".join(chunks)

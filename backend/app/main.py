from contextlib import asynccontextmanager
from datetime import date
from io import BytesIO
import base64
import uuid
import torch
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from torchvision import transforms
from PIL import Image
from app.core.config import RESULT_DIR
from app.database import history
from app.models.manager import CLASSES, manager
from app.services.images import decode_image, read_upload

EVAL = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])

@asynccontextmanager
async def lifespan(app: FastAPI):
    history.initialize()
    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    manager.load_all()
    yield

app = FastAPI(title="SoJão — Inteligência Agrícola", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
def health():
    return {"status": "ok", "device": str(manager.device), "database": "sqlite", "models_ready": sum(m is not None for m in manager.models.values()), "models_total": len(CLASSES)}

@app.get("/api/models/status")
def models_status():
    return {"device": str(manager.device), "models": [{"id": key, "name": key, "classes": CLASSES[key], **manager.status[key]} for key in CLASSES]}

@app.post("/api/analyze/folhas")
async def analyze_folhas(files: list[UploadFile] = File(...)):
    return await _classify(files, "folhas")

@app.post("/api/analyze/daninhas")
async def analyze_daninhas(files: list[UploadFile] = File(...)):
    return await _classify(files, "daninhas")

async def _classify(files, model_id):
    if not files:
        raise HTTPException(400, "Envie ao menos uma imagem.")
    model = _require(model_id)
    results = []
    for upload in files:
        image = decode_image(await read_upload(upload))
        tensor = EVAL(image).unsqueeze(0).to(manager.device)
        with torch.inference_mode():
            logits = model(tensor)[0]
            probabilities = torch.softmax(logits, dim=0).cpu().tolist()
        index = int(max(range(len(probabilities)), key=probabilities.__getitem__))
        payload = {"predicted_class": CLASSES[model_id][index], "confidence": probabilities[index], "probabilities": dict(zip(CLASSES[model_id], probabilities))}
        entry = history.insert(upload.filename or "imagem", model_id, payload["predicted_class"], payload["confidence"], payload)
        results.append({**entry, **payload})
    return {"model": model_id, "results": results}

@app.post("/api/analyze/insetos")
async def analyze_insetos(files: list[UploadFile] = File(...), confidence: float = Query(0.25, ge=0, le=1), iou: float = Query(0.45, ge=0, le=1)):
    if not files:
        raise HTTPException(400, "Envie ao menos uma imagem.")
    model = _require("insetos")
    results = []
    for upload in files:
        data = await read_upload(upload)
        image = decode_image(data)
        prediction = model.predict(image, imgsz=640, conf=confidence, iou=iou, device=str(manager.device), verbose=False)[0]
        boxes = []
        if prediction.boxes is not None:
            for box in prediction.boxes:
                cls = int(box.cls.item())
                boxes.append({"class": CLASSES["insetos"][cls], "confidence": float(box.conf.item()), "xyxy": [float(value) for value in box.xyxy[0].tolist()]})
        annotated = Image.fromarray(prediction.plot()[:, :, ::-1])
        name = f"{uuid.uuid4().hex}.jpg"
        path = RESULT_DIR / name
        annotated.save(path, format="JPEG", quality=90)
        payload = {"detections": boxes, "annotated_url": f"/api/results/{name}", "image_size": {"width": image.width, "height": image.height}, "confidence_threshold": confidence, "iou": iou}
        top = boxes[0]["class"] if boxes else "Nenhum objeto detectado"
        entry = history.insert(upload.filename or "imagem", "insetos", top, max((b["confidence"] for b in boxes), default=0.0), payload, str(path))
        results.append({**entry, **payload, "original_image": "data:image/jpeg;base64," + base64.b64encode(_jpeg(image)).decode()})
    return {"model": "insetos", "results": results}

def _jpeg(image):
    out = BytesIO(); image.save(out, format="JPEG", quality=88); return out.getvalue()

def _require(model_id):
    try:
        return manager.require(model_id)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc

@app.get("/api/results/{filename}")
def get_result(filename: str):
    if "/" in filename or "\\" in filename or not filename.endswith(".jpg"):
        raise HTTPException(404, "Resultado não encontrado")
    path = RESULT_DIR / filename
    if not path.is_file():
        raise HTTPException(404, "Resultado não encontrado")
    return FileResponse(path, media_type="image/jpeg")

@app.get("/api/history")
def get_history(model: str | None = None, date_from: date | None = None, date_to: date | None = None, q: str | None = None, limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0)):
    return {"items": history.list_items(model, date_from.isoformat() if date_from else None, date_to.isoformat() + "T23:59:59" if date_to else None, q, limit, offset)}

@app.get("/api/history/{item_id}")
def get_history_item(item_id: str):
    item = history.get_item(item_id)
    if not item:
        raise HTTPException(404, "Análise não encontrada")
    return item

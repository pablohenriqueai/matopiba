from pathlib import Path
import torch
from torchvision import models
from ultralytics import YOLO
from app.core.config import DEVICE, WEIGHTS

CLASSES = {
    "folhas": ["saudavel", "lagarta", "vaquinha"],
    "daninhas": ["broadleaf", "grass", "soil", "soybean"],
    "insetos": ["Anticarsia_gemmatalis", "Coccinellidae", "Diabrotica_speciosa", "Edessa_meditabunda", "Euschistus_heros_adulto", "Euschistus_heros_ninfa", "Gastropoda", "Lagria_villosa", "Nezara_viridula_adulto", "Nezara_viridula_ninfa", "Rhammatocerus_schistocercoides", "Spodoptera_albula"],
}


class ModelManager:
    def __init__(self):
        requested_device = DEVICE or "auto"
        self.device = torch.device("cuda" if requested_device in {"auto", "cuda"} and torch.cuda.is_available() else "cpu")
        self.models = {key: None for key in CLASSES}
        self.status = {key: {"state": "not_loaded", "detail": "Aguardando inicialização"} for key in CLASSES}

    def load_all(self):
        for name in CLASSES:
            path = Path(WEIGHTS[name])
            if not path.is_file():
                self.status[name] = {"state": "unavailable", "detail": f"Checkpoint não encontrado: {path}"}
                continue
            try:
                if name == "insetos":
                    model = YOLO(str(path), task="detect")
                    names = model.names
                    names_by_index = [names[index] for index in sorted(names)] if isinstance(names, dict) else list(names)
                    if names_by_index != CLASSES["insetos"]:
                        raise ValueError(f"Classes incompatíveis: {names_by_index}; esperadas {CLASSES['insetos']}")
                    model.predict(torch.zeros((640, 640, 3), dtype=torch.uint8).numpy(), verbose=False, device=str(self.device))
                else:
                    model = models.resnet18(weights=None)
                    model.fc = torch.nn.Linear(model.fc.in_features, len(CLASSES[name]))
                    state = torch.load(path, map_location="cpu", weights_only=True)
                    if not isinstance(state, dict):
                        raise TypeError("O checkpoint não contém um state_dict compatível")
                    if "state_dict" in state and isinstance(state["state_dict"], dict):
                        state = state["state_dict"]
                    if state and all(key.startswith("module.") for key in state):
                        state = {key.removeprefix("module."): value for key, value in state.items()}
                    model.load_state_dict(state, strict=True)
                    model.to(self.device).eval()
                    with torch.inference_mode():
                        output = model(torch.zeros(1, 3, 224, 224, device=self.device))
                    if tuple(output.shape) != (1, len(CLASSES[name])):
                        raise ValueError(f"Saída incompatível: {tuple(output.shape)}")
                self.models[name] = model
                self.status[name] = {"state": "ready", "detail": f"Carregado e smoke test concluído em {self.device}"}
            except Exception as exc:
                self.models[name] = None
                self.status[name] = {"state": "error", "detail": f"Falha ao carregar ou validar checkpoint: {exc.__class__.__name__}: {exc}"}

    def require(self, name):
        model = self.models.get(name)
        if model is None:
            raise RuntimeError(self.status[name]["detail"])
        return model


manager = ModelManager()

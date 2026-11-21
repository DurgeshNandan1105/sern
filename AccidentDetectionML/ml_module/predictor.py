
from pathlib import Path
import joblib

from .feature_extraction import extract_features, FEATURE_COLUMNS

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "models" / "accident_detection_final.pkl"


class AccidentPredictor:

    def __init__(self):
        self.package = joblib.load(MODEL_PATH)

        self.model = self.package["model"]
        self.threshold = float(self.package["threshold"])
        self.feature_columns = self.package["feature_columns"]

        if list(self.feature_columns) != FEATURE_COLUMNS:
            raise ValueError("Feature columns do not match the trained model.")

    def predict(self, sensor_data):

        features = extract_features(sensor_data)
        features = features[self.feature_columns]

        probability = float(
            self.model.predict_proba(features)[0][1]
        )

        accident_detected = probability >= self.threshold

        return {
            "accident_detected": bool(accident_detected),
            "accident_probability": probability,
            "threshold": self.threshold
        }

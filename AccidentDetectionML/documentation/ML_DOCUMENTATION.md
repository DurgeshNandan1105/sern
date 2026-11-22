# Accident Detection ML Module

## 1. Overview

This module detects potential vehicle accidents using vehicle sensor data.

It uses a trained Random Forest classification model to classify sensor readings into:
- Accident
- No Accident

The model is trained using the VZCrash dataset.

## 2. Model Details

- Algorithm: Random Forest Classifier
- Task: Binary Classification
- Input: Vehicle sensor data
- Output: Accident probability and accident detection result
- Decision threshold: 0.33567089961170193

## 3. Input Data

The prediction module expects a Python dictionary containing:

| Field | Description |
|---|---|
| gsensor | Accelerometer readings (X, Y, Z) |
| gyro | Gyroscope readings (X, Y, Z) |
| gps_speed | Vehicle speed readings |
| vehiclesize | Vehicle size/category |
| gyro_is_hd | Boolean indicating gyroscope high-definition status |

Sensor readings should follow the same structure and units as the training dataset.

## 4. Feature Extraction

The feature extraction module processes raw sensor readings and generates 29 features.

These include:
- Accelerometer statistics
- Gyroscope statistics
- Speed statistics
- Speed change and speed drop
- Vehicle metadata

The extracted features are passed to the trained model.

## 5. Prediction Usage

Import the predictor:

```python
from ml_module.predictor import AccidentPredictor

predictor = AccidentPredictor()
```

Pass sensor data:

```python
sensor_data = {
    "gsensor": [[0.1, 0.2, 9.8], [0.2, 0.1, 9.7]],
    "gyro": [[0.01, 0.02, 0.03], [0.02, 0.01, 0.04]],
    "gps_speed": [40.0, 38.0],
    "vehiclesize": "car",
    "gyro_is_hd": True
}

result = predictor.predict(sensor_data)
print(result)
```

The example readings above are illustrative only. Actual inputs must follow the training data's expected format.

## 6. Prediction Output

The predictor returns a dictionary:

```python
{
    "accident_detected": True,
    "accident_probability": 0.85,
    "threshold": 0.33567089961170193
}
```

- `accident_detected`: Boolean prediction.
- `accident_probability`: Model-estimated accident probability.
- `threshold`: Decision threshold used by the model.

An accident is detected when the predicted probability is greater than or equal to the threshold.

## 7. Model Evaluation

Evaluation on the held-out VZCrash test split:

| Metric | Score |
|---|---:|
| Accuracy | 96.68% |
| Precision | 85.62% |
| Recall | 97.32% |
| F1-score | 91.10% |
| ROC-AUC | 99.48% |
| PR-AUC | 97.48% |

Confusion matrix:

| | Predicted No Accident | Predicted Accident |
|---|---:|---:|
| Actual No Accident | 19,263 | 690 |
| Actual Accident | 113 | 4,108 |

## 8. Important Limitations

- These results are from the VZCrash held-out test split.
- Real-world vehicle and smartphone validation is still required.
- The model detects accident events; it does not predict injury severity.
- Predictions should be treated as decision-support signals, not guaranteed confirmation of an accident.
- False positives and false negatives are possible. Additional verification and human oversight are recommended.

## 9. Project Structure

```text
AccidentDetectionML/
├── models/
│   └── accident_detection_final.pkl
├── ml_module/
│   ├── __init__.py
│   ├── feature_extraction.py
│   └── predictor.py
├── documentation/
│   ├── ML_DOCUMENTATION.md
│   └── evaluation_report.json
└── requirements.txt
```

## 10. Integration Responsibility

This repository provides the machine learning module only.

The backend application is responsible for:
- Collecting and preparing sensor data.
- Calling the ML prediction module.
- Handling prediction results.
- Managing alerts, ambulance dispatch, routing, and other application workflows.

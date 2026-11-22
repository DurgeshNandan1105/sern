
import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "vehiclesize",
    "gyro_is_hd",
    "acc_x_mean",
    "acc_y_mean",
    "acc_z_mean",
    "acc_x_std",
    "acc_y_std",
    "acc_z_std",
    "acc_xy_mean",
    "acc_xy_max",
    "acc_xy_std",
    "acc_mag_mean",
    "acc_mag_max",
    "acc_mag_std",
    "gyro_x_mean",
    "gyro_y_mean",
    "gyro_z_mean",
    "gyro_x_std",
    "gyro_y_std",
    "gyro_z_std",
    "gyro_mag_mean",
    "gyro_mag_max",
    "gyro_mag_std",
    "speed_mean",
    "speed_max",
    "speed_min",
    "speed_std",
    "speed_change",
    "speed_drop"
]


def extract_features(sensor_data):

    acc = np.asarray(
        sensor_data["gsensor"], dtype=np.float32
    )

    gyro = np.asarray(
        sensor_data["gyro"], dtype=np.float32
    )

    speed = np.asarray(
        sensor_data["gps_speed"], dtype=np.float32
    )

    # Validate sensor inputs
    if acc.ndim != 2 or acc.shape[1] != 3 or len(acc) == 0:
        raise ValueError("Accelerometer must have shape (N, 3).")

    if gyro.ndim != 2 or gyro.shape[1] != 3 or len(gyro) == 0:
        raise ValueError("Gyroscope must have shape (N, 3).")

    if speed.ndim != 1 or len(speed) == 0:
        raise ValueError("GPS speed must be a non-empty array.")

    if not (
        np.isfinite(acc).all()
        and np.isfinite(gyro).all()
        and np.isfinite(speed).all()
    ):
        raise ValueError("Sensor readings contain invalid values.")

    if len(acc) != len(gyro):
        raise ValueError("Accelerometer and gyroscope lengths differ.")

    ax, ay, az = acc[:, 0], acc[:, 1], acc[:, 2]
    gx, gy, gz = gyro[:, 0], gyro[:, 1], gyro[:, 2]

    acc_xy = np.sqrt(ax**2 + ay**2)
    acc_mag = np.sqrt(ax**2 + ay**2 + az**2)

    gyro_mag = np.sqrt(gx**2 + gy**2 + gz**2)

    features = {
        "vehiclesize": sensor_data.get("vehiclesize", "Unknown"),
        "gyro_is_hd": int(sensor_data.get("gyro_is_hd", False)),

        "acc_x_mean": np.mean(ax),
        "acc_y_mean": np.mean(ay),
        "acc_z_mean": np.mean(az),

        "acc_x_std": np.std(ax),
        "acc_y_std": np.std(ay),
        "acc_z_std": np.std(az),

        "acc_xy_mean": np.mean(acc_xy),
        "acc_xy_max": np.max(acc_xy),
        "acc_xy_std": np.std(acc_xy),

        "acc_mag_mean": np.mean(acc_mag),
        "acc_mag_max": np.max(acc_mag),
        "acc_mag_std": np.std(acc_mag),

        "gyro_x_mean": np.mean(gx),
        "gyro_y_mean": np.mean(gy),
        "gyro_z_mean": np.mean(gz),

        "gyro_x_std": np.std(gx),
        "gyro_y_std": np.std(gy),
        "gyro_z_std": np.std(gz),

        "gyro_mag_mean": np.mean(gyro_mag),
        "gyro_mag_max": np.max(gyro_mag),
        "gyro_mag_std": np.std(gyro_mag),

        "speed_mean": np.mean(speed),
        "speed_max": np.max(speed),
        "speed_min": np.min(speed),
        "speed_std": np.std(speed),

        "speed_change": speed[-1] - speed[0],
        "speed_drop": max(0, speed[0] - speed[-1])
    }

    return pd.DataFrame(
        [[features[col] for col in FEATURE_COLUMNS]],
        columns=FEATURE_COLUMNS
    )

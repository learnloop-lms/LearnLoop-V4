"""
================================================================================
Learner Classification (Slow / Medium / Fast) — Model Training & Comparison
================================================================================
Trains an Artificial Neural Network (ANN) and compares it against four classical
machine-learning algorithms on the K-Means-labelled quiz dataset (DS1).

The ANN is exported as the deployment model in three formats (.keras, .h5), and
the preprocessing objects required to run it are exported as a pickle (.pkl).

Outputs written next to this script:
    learner_ann_model.keras   - ANN in Keras native format
    learner_ann_model.h5      - ANN in HDF5 format
    preprocessing.pkl         - {scaler, label_encoder, feature_names}
    best_rf_model.pkl         - Random Forest (best classical baseline)
    metrics.json              - all evaluation numbers used in the report
    confusion_matrix.png      - ANN confusion matrix on the held-out test set
    training_history.png      - ANN accuracy/loss learning curves

Author: (your name)  |  Reproducible: all seeds fixed to 42
================================================================================
"""

import os, json, pickle, warnings
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"          # silence TensorFlow info logs

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, f1_score, precision_score, recall_score,
                             classification_report, confusion_matrix)

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, Input
from tensorflow.keras.callbacks import EarlyStopping

# ------------------------------------------------------------------ config ----
SEED       = 42
DATA_PATH  = "DS1_FINAL_labeled_for_ANN.xlsx"     # labelled dataset
SHEET      = "Sheet1"
FEATURES   = ["msq", "TTQ_sec", "accuracy", "HIT_encoded"]   # raw quiz signals
TARGET     = "label_final_KMeans"                             # Slow/Medium/Fast
HERE       = os.path.dirname(os.path.abspath(__file__))

np.random.seed(SEED)
tf.random.set_seed(SEED)


# --------------------------------------------------------------- load data ----
def load_data():
    df = pd.read_excel(os.path.join(HERE, DATA_PATH), sheet_name=SHEET)
    X = df[FEATURES].values.astype("float32")
    le = LabelEncoder()
    y = le.fit_transform(df[TARGET])              # encodes to 0,1,2
    return X, y, le


# ------------------------------------------------------------ build the ANN ----
def build_ann(input_dim, n_classes):
    """A compact, well-regularised feed-forward network (MLP)."""
    model = Sequential([
        Input(shape=(input_dim,)),
        Dense(32, activation="relu"),
        Dropout(0.20),
        Dense(16, activation="relu"),
        Dropout(0.10),
        Dense(n_classes, activation="softmax"),
    ])
    model.compile(optimizer="adam",
                  loss="sparse_categorical_crossentropy",
                  metrics=["accuracy"])
    return model


def macro_metrics(y_true, y_pred):
    return dict(
        accuracy = accuracy_score(y_true, y_pred),
        f1_macro = f1_score(y_true, y_pred, average="macro"),
        precision_macro = precision_score(y_true, y_pred, average="macro"),
        recall_macro = recall_score(y_true, y_pred, average="macro"),
    )


# ---------------------------------------------------------------- pipeline ----
def main():
    X, y, le = load_data()
    classes = list(le.classes_)
    print("Classes:", classes, "| samples:", len(y), "| features:", FEATURES)

    # 70 / 15 / 15  train / validation / test  (stratified)
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=SEED)
    X_val, X_te, y_val, y_te = train_test_split(
        X_tmp, y_tmp, test_size=0.50, stratify=y_tmp, random_state=SEED)

    # scale (fit on train only — no leakage)
    scaler = StandardScaler().fit(X_tr)
    Xtr, Xval, Xte, Xall = (scaler.transform(a) for a in (X_tr, X_val, X_te, X))

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    results = {}

    # ---- classical baselines -------------------------------------------------
    baselines = {
        "Random Forest":       RandomForestClassifier(n_estimators=300, random_state=SEED),
        "Gradient Boosting":   GradientBoostingClassifier(random_state=SEED),
        "SVM (RBF)":           SVC(kernel="rbf", C=10, gamma="scale",
                                   probability=True, random_state=SEED),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=SEED),
    }
    fitted = {}
    for name, clf in baselines.items():
        clf.fit(Xtr, y_tr)
        fitted[name] = clf
        test = macro_metrics(y_te, clf.predict(Xte))
        cv   = cross_val_score(clf, Xall, y, cv=skf, scoring="accuracy")
        results[name] = {"test": test, "cv_mean": float(cv.mean()),
                         "cv_std": float(cv.std())}
        print(f"{name:22s} test_acc={test['accuracy']*100:6.2f}  "
              f"cv={cv.mean()*100:6.2f} ± {cv.std()*100:.2f}")

    # ---- ANN -----------------------------------------------------------------
    ann = build_ann(Xtr.shape[1], len(classes))
    es = EarlyStopping(monitor="val_loss", patience=15, restore_best_weights=True)
    hist = ann.fit(Xtr, y_tr, validation_data=(Xval, y_val),
                   epochs=200, batch_size=32, verbose=0, callbacks=[es])
    y_pred_ann = ann.predict(Xte, verbose=0).argmax(axis=1)
    ann_test = macro_metrics(y_te, y_pred_ann)

    # manual stratified CV for the ANN (comparable to the baselines)
    cv_acc = []
    for tr_idx, va_idx in skf.split(Xall, y):
        m = build_ann(Xall.shape[1], len(classes))
        m.fit(Xall[tr_idx], y[tr_idx], epochs=120, batch_size=32, verbose=0,
              callbacks=[EarlyStopping(monitor="loss", patience=12,
                                       restore_best_weights=True)])
        cv_acc.append(accuracy_score(y[va_idx], m.predict(Xall[va_idx],
                                                          verbose=0).argmax(1)))
    results["ANN (MLP)"] = {"test": ann_test,
                            "cv_mean": float(np.mean(cv_acc)),
                            "cv_std": float(np.std(cv_acc)),
                            "epochs_trained": len(hist.history["loss"])}
    print(f"{'ANN (MLP)':22s} test_acc={ann_test['accuracy']*100:6.2f}  "
          f"cv={np.mean(cv_acc)*100:6.2f} ± {np.std(cv_acc)*100:.2f}")

    # ---- per-class report + confusion matrix for the chosen ANN --------------
    report = classification_report(y_te, y_pred_ann, target_names=classes,
                                   output_dict=True, zero_division=0)
    cm = confusion_matrix(y_te, y_pred_ann)
    results["ANN (MLP)"]["per_class"] = report
    results["ANN (MLP)"]["confusion_matrix"] = cm.tolist()
    results["_meta"] = {"features": FEATURES, "classes": classes,
                        "n_train": len(y_tr), "n_val": len(y_val), "n_test": len(y_te)}

    # ---- plots ---------------------------------------------------------------
    plt.figure(figsize=(5, 4))
    plt.imshow(cm, cmap="Blues")
    plt.colorbar()
    plt.xticks(range(len(classes)), classes, rotation=30, ha="right")
    plt.yticks(range(len(classes)), classes)
    for i in range(len(classes)):
        for j in range(len(classes)):
            plt.text(j, i, cm[i, j], ha="center",
                     color="white" if cm[i, j] > cm.max()/2 else "black")
    plt.ylabel("True"); plt.xlabel("Predicted")
    plt.title("ANN — Confusion Matrix (test set)")
    plt.tight_layout(); plt.savefig(os.path.join(HERE, "confusion_matrix.png"), dpi=130)
    plt.close()

    plt.figure(figsize=(8, 3.5))
    plt.subplot(1, 2, 1)
    plt.plot(hist.history["accuracy"], label="train")
    plt.plot(hist.history["val_accuracy"], label="val")
    plt.title("Accuracy"); plt.xlabel("epoch"); plt.legend()
    plt.subplot(1, 2, 2)
    plt.plot(hist.history["loss"], label="train")
    plt.plot(hist.history["val_loss"], label="val")
    plt.title("Loss"); plt.xlabel("epoch"); plt.legend()
    plt.tight_layout(); plt.savefig(os.path.join(HERE, "training_history.png"), dpi=130)
    plt.close()

    # ---- save artifacts ------------------------------------------------------
    ann.save(os.path.join(HERE, "learner_ann_model.keras"))
    ann.save(os.path.join(HERE, "learner_ann_model.h5"))
    with open(os.path.join(HERE, "preprocessing.pkl"), "wb") as f:
        pickle.dump({"scaler": scaler, "label_encoder": le,
                     "feature_names": FEATURES}, f)
    with open(os.path.join(HERE, "best_rf_model.pkl"), "wb") as f:
        pickle.dump(fitted["Random Forest"], f)
    with open(os.path.join(HERE, "metrics.json"), "w") as f:
        json.dump(results, f, indent=2)

    print("\nSaved: learner_ann_model.keras / .h5, preprocessing.pkl, "
          "best_rf_model.pkl, metrics.json, plots")

    # ---- inference example ---------------------------------------------------
    demo = np.array([[10, 200, 1.0, 0],     # high score, fast, no mistakes
                     [9, 900, 0.9, 0],      # high score, slow
                     [5, 300, 0.5, 3]],     # low score, hard mistakes
                    dtype="float32")
    probs = ann.predict(scaler.transform(demo), verbose=0)
    for row, p in zip(demo, probs):
        print(f"  {row} -> {le.classes_[p.argmax()]}  (p={p.max():.2f})")


if __name__ == "__main__":
    main()

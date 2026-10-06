import os
import joblib
import numpy as np
import pandas as pd
from app.config import settings

# Lazy tensorflow import to avoid blocking startup
_tf = None
def get_tf():
    global _tf
    if _tf is None:
        try:
            import tensorflow as tf
            _tf = tf
        except ImportError:
            _tf = False
    return _tf

class AIEngine:
    def __init__(self):
        self.models_dir = settings.MODELS_DIR
        self.model1 = None
        self.preprocessor1 = None
        self.model2 = None
        self.preprocessor2 = None
        self.rf_model2 = None
        self.model3 = None
        self.preprocessor3 = None
        self.model4 = None
        self.preprocessor4 = None
        
        self.load_models()

    def load_models(self):
        tf = get_tf()

        # -------------------------------------------------------------
        # Model 1: ANN_PT_LS
        # -------------------------------------------------------------
        p1_path = os.path.join(self.models_dir, "model1_pt_ls.pkl")
        m1_path = os.path.join(self.models_dir, "model1_pt_ls.h5")
        if os.path.exists(p1_path):
            try:
                self.preprocessor1 = joblib.load(p1_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 1 preprocessor: {e}")
        if tf and os.path.exists(m1_path):
            try:
                self.model1 = tf.keras.models.load_model(m1_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 1 h5: {e}")

        # -------------------------------------------------------------
        # Model 2: ANN_Quiz_Cognitive
        # -------------------------------------------------------------
        p2_path = os.path.join(self.models_dir, "model2_quiz_cognitive.pkl")
        m2_path = os.path.join(self.models_dir, "model2_quiz_cognitive.h5")
        rf2_path = os.path.join(self.models_dir, "ANN_Quiz_Cognitive", "best_rf_model.pkl")
        if os.path.exists(p2_path):
            try:
                self.preprocessor2 = joblib.load(p2_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 2 preprocessor: {e}")
        if os.path.exists(rf2_path):
            try:
                self.rf_model2 = joblib.load(rf2_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 2 RF: {e}")
        if tf and os.path.exists(m2_path):
            try:
                self.model2 = tf.keras.models.load_model(m2_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 2 h5: {e}")

        # -------------------------------------------------------------
        # Model 3: ANN_Task_Complexity
        # -------------------------------------------------------------
        p3_path = os.path.join(self.models_dir, "model3_task_complexity.pkl")
        m3_path = os.path.join(self.models_dir, "model3_task_complexity.h5")
        if os.path.exists(p3_path):
            try:
                self.preprocessor3 = joblib.load(p3_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 3 preprocessor: {e}")
        if tf and os.path.exists(m3_path):
            try:
                self.model3 = tf.keras.models.load_model(m3_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 3 h5: {e}")

        # -------------------------------------------------------------
        # Model 4: ANN_Cognitive_Update
        # -------------------------------------------------------------
        p4_path = os.path.join(self.models_dir, "model4_cognitive_update.pkl")
        m4_path = os.path.join(self.models_dir, "model4_cognitive_update.h5")
        if os.path.exists(p4_path):
            try:
                self.preprocessor4 = joblib.load(p4_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 4 preprocessor: {e}")
        if tf and os.path.exists(m4_path):
            try:
                self.model4 = tf.keras.models.load_model(m4_path)
            except Exception as e:
                print(f"[AI Engine] Notice: Model 4 h5: {e}")

    # =========================================================================
    # Model 1 Prediction: get_PT_LS
    # =========================================================================
    def predict_pt_ls(self, ppt: str, spt: str, ld1: str, ld2: str, ld3: str, ld4: str) -> str:
        """
        Classifies learner into Archetype: Visionaries, Mentors, Pioneers, Conquerors
        """
        pt_ls_classes = ['Conquerors', 'Mentors', 'Pioneers', 'Visionaries']
        
        # If preprocessor and keras model are loaded
        if self.model1 is not None and self.preprocessor1 is not None:
            try:
                df = pd.DataFrame([[ppt, spt, ld1, ld2, ld3, ld4]], columns=[
                    'primary_type', 
                    'secondary_type', 
                    'LearningStyle_DimensionMentors_Active/ Reflective', 
                    'LearningStyle_DimensionPioneers_Sequential/ Global',
                    'LearningStyle_DimensionConquerors_Sensing/ Intuitive',
                    'LearningStyle_Dimension4_Visual/ Verbal'
                ])
                processed = self.preprocessor1.transform(df)
                pred = self.model1.predict(processed)
                idx = int(np.argmax(pred, axis=1)[0])
                return pt_ls_classes[idx]
            except Exception as e:
                print(f"[AI Engine] Model 1 inference fallback: {e}")

        # Exact Fuzzy C-Means cluster rules from research paper:
        # Visionaries: Achiever + Socializer (or Active, Global, Intuitive, Visual)
        # Mentors: Socializer + Achiever (or Reflective, Sequential, Sensing, Verbal)
        # Conquerors: Achiever + Killer (or Reflective, Sequential, Sensing, Visual)
        # Pioneers: Achiever + Explorer (or Active, Sequential, Sensing, Verbal)
        if (ppt == "Achiever" and spt == "Killer") or (ppt == "Killer" and spt == "Achiever"):
            return "Conquerors"
        if (ppt == "Socializer" and spt == "Achiever") or (ppt == "Achiever" and spt == "Socializer" and ld4 == "Verbal"):
            return "Mentors"
        if (ppt == "Achiever" and spt == "Explorer") or (ppt == "Explorer" and spt == "Achiever"):
            return "Pioneers"
        return "Visionaries"

    # =========================================================================
    # Model 2 Prediction: Quiz Cognitive Level (INTERNAL ONLY - NEVER LEADERBOARD)
    # =========================================================================
    def predict_quiz_cognitive(self, msq: float, ttq_sec: int, accuracy: float, hit_encoded: int) -> str:
        """
        Output: 'Slow Learner', 'Medium Learner', 'Fast Learner' (INTERNAL coq ONLY)
        """
        classes = ['Fast Learner', 'Medium Learner', 'Slow Learner']
        
        # Priority 1: Check Best Random Forest Baseline
        if self.rf_model2 is not None:
            try:
                X = np.array([[msq, ttq_sec, accuracy, hit_encoded]], dtype="float32")
                if isinstance(self.preprocessor2, dict) and "scaler" in self.preprocessor2:
                    X = self.preprocessor2["scaler"].transform(X)
                pred = self.rf_model2.predict(X)[0]
                if isinstance(pred, (int, np.integer)):
                    return classes[pred]
                return str(pred)
            except Exception as e:
                print(f"[AI Engine] Model 2 RF fallback: {e}")

        # Priority 2: ANN Keras Model
        if self.model2 is not None:
            try:
                X = np.array([[msq, ttq_sec, accuracy, hit_encoded]], dtype="float32")
                if isinstance(self.preprocessor2, dict) and "scaler" in self.preprocessor2:
                    X = self.preprocessor2["scaler"].transform(X)
                pred = self.model2.predict(X)
                idx = int(np.argmax(pred, axis=1)[0])
                return classes[idx]
            except Exception as e:
                print(f"[AI Engine] Model 2 ANN fallback: {e}")

        # Fallback heuristic based on quiz accuracy
        if accuracy >= 0.8:
            return "Fast Learner"
        elif accuracy >= 0.5:
            return "Medium Learner"
        else:
            return "Slow Learner"

    # =========================================================================
    # Model 3 Prediction: Task Complexity Level (qlc)
    # =========================================================================
    def predict_task_complexity(self, prev_complexity: int, curr_complexity: int, 
                                prev_cognitive: str, curr_quiz_cognitive: str) -> str:
        """
        Output: 'Basic', 'Intermediate', 'Advanced'
        """
        types = ['Basic', 'Intermediate', 'Advanced']
        
        if self.model3 is not None and self.preprocessor3 is not None:
            try:
                df = pd.DataFrame([[prev_complexity, curr_complexity, prev_cognitive, curr_quiz_cognitive]],
                                  columns=['Previous Complexity Level', 'Current Complexity Level', 
                                           'Previous Cognitive Level', 'Current Quiz Cognitive Level'])
                processed = self.preprocessor3.transform(df)
                pred = self.model3.predict(processed)
                idx = int(np.argmax(pred, axis=1)[0])
                return types[idx]
            except Exception as e:
                print(f"[AI Engine] Model 3 inference fallback: {e}")

        # Rule-based fallback
        if "Fast" in curr_quiz_cognitive:
            return "Advanced"
        elif "Medium" in curr_quiz_cognitive:
            return "Intermediate"
        else:
            return "Basic"

    # =========================================================================
    # Model 4 Prediction: Cognitive Level Update (THIS ALONE UPDATES LEADERBOARD)
    # =========================================================================
    def predict_cognitive_update(self, complexity: int, total_points: float) -> tuple[str, str]:
        """
        Input: complexity (cmc), total_points (tp = W1*msq + W2*mst)
        Output: (raw_label, leaderboard_level)
                where leaderboard_level is 'Stepper', 'Jogger', 'Glider'
        """
        levels = ['Fast Learner', 'Medium Learner', 'Slow Learner']
        raw_output = "Medium Learner"

        if self.model4 is not None and self.preprocessor4 is not None:
            try:
                df = pd.DataFrame([[complexity, total_points]], columns=['Complexity', 'Total points'])
                scaled = self.preprocessor4.transform(df)
                pred = self.model4.predict(scaled)
                idx = int(np.argmax(pred, axis=1)[0])
                raw_output = levels[idx]
            except Exception as e:
                print(f"[AI Engine] Model 4 inference fallback: {e}")
                # Rule-based fallback based on total_points (out of 100)
                if total_points >= 75:
                    raw_output = "Fast Learner"
                elif total_points >= 50:
                    raw_output = "Medium Learner"
                else:
                    raw_output = "Slow Learner"
        else:
            if total_points >= 75:
                raw_output = "Fast Learner"
            elif total_points >= 50:
                raw_output = "Medium Learner"
            else:
                raw_output = "Slow Learner"

        # Explicit mapping to student-facing terminology:
        # Slow Learner   --> Stepper
        # Medium Learner --> Jogger
        # Fast Learner   --> Glider
        if "Fast" in raw_output:
            leaderboard_level = "Glider"
        elif "Medium" in raw_output:
            leaderboard_level = "Jogger"
        else:
            leaderboard_level = "Stepper"

        return raw_output, leaderboard_level

ai_engine = AIEngine()

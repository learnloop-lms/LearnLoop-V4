from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd

# Load the model and the scaler
model = tf.keras.models.load_model('learning_level_model.h5')
scaler = joblib.load('scaler.pkl')

app = Flask(__name__)

@app.route('/predict', methods=['POST'])
def predict():
    # Get the input JSON data
    data = request.get_json()
    
    # Extract 'Complexity' and 'Total points' from the input data
    complexity = data['Complexity']
    total_points = data['Total points']
    
    # Prepare the input data as a DataFrame with the same column names as during training
    input_data = pd.DataFrame([[complexity, total_points]], columns=['Complexity', 'Total points'])
    
    # Scale the input using the loaded scaler (which was fitted with the original feature names)
    input_data_scaled = scaler.transform(input_data)
    
    # Make the prediction
    prediction = model.predict(input_data_scaled)
    
    # Get the index of the highest predicted probability
    predicted_class = np.argmax(prediction, axis=1)[0]
    
    # Map the predicted class back to the 'learning_level' (assuming you know the column names)
    learning_levels = ['Fast Learner', 'Medium Learner', 'Slow Learner']  # Adjust based on your one-hot encoding
    predicted_label = learning_levels[predicted_class]
    
    # Return the prediction as a JSON response
    return jsonify({'learning_level': predicted_label})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

    
"""
To invoke the Flask API, follow these steps:

1. **Start the Flask API Server**:
   - Ensure that the Flask app is running. If not, start the app using the command:
     ```bash
     python app.py
     ```
     This will start the Flask API server on the default `localhost:5000`.

2. **Making Predictions**:
   - The `/predict` endpoint expects a POST request with a JSON body that includes two values:
     - "Complexity": A numerical value indicating the complexity of the task.
     - "Total points": A numerical value indicating the total points.

3. **Send the Request**:
   - You can use `cURL` (or any HTTP client like Postman) to send a POST request to the API with the appropriate JSON data. The API will return a JSON response with the predicted learning level based on the inputs.

### Example cURL Commands for Each Class:

Below are three cURL commands for each class (`Slow Learner`, `Medium Learner`, `Fast Learner`), using the IP address `172.17.0.2` for the Flask server:

1. **Slow Learner Prediction**:
   This cURL command sends data that should be predicted as "Slow Learner" based on the given values:
   ```bash
   curl -X POST http://172.17.0.2:5000/predict \
       -H "Content-Type: application/json" \
       -d '{"Complexity": 2, "Total points": 30}'

"""


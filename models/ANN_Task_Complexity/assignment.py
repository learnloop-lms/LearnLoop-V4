from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
from sklearn.preprocessing import OneHotEncoder

# Load the trained model and preprocessor
model = tf.keras.models.load_model('question_type_model.h5')
preprocessor = joblib.load('preprocessor.pkl')

# List of possible question types (update this if there are more classes)
question_types = ['Basic', 'Intermediate', 'Advanced']  # Adjust based on your training data

# Update the encoder to handle unknown categories
encoder = OneHotEncoder(sparse=False, handle_unknown='ignore')

app = Flask(__name__)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get the input JSON data
        data = request.get_json()

        # Extract values from the input
        prev_complexity = data['Previous Complexity Level']
        curr_complexity = data['Current Complexity Level']
        prev_cognitive = data['Previous Cognitive Level']
        curr_cognitive = data['Current Quiz Cognitive Level']

        # Prepare the input data as a DataFrame with the same column names as during training
        input_data = pd.DataFrame([[prev_complexity, curr_complexity, prev_cognitive, curr_cognitive]],
                                  columns=['Previous Complexity Level', 'Current Complexity Level', 'Previous Cognitive Level', 'Current Quiz Cognitive Level'])

        print(input_data)
        # Apply preprocessing using the loaded preprocessor (scaling and encoding)
        input_data_processed = preprocessor.transform(input_data)
        
        # Make the prediction
        prediction = model.predict(input_data_processed)

        # Get the predicted class (i.e., the proposed question type)
        predicted_class = np.argmax(prediction, axis=1)[0]

        # Map the predicted index back to the proposed question type
        predicted_question_type = question_types[predicted_class]

        # Return the prediction as a JSON response
        return jsonify({'Proposed Question Type': predicted_question_type})

    except KeyError as e:
        # Handle missing keys in input JSON
        return jsonify({'error': f'Missing required parameter: {str(e)}'}), 400
    except Exception as e:
        # Handle other potential errors
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)


    
"""
To interact with the Flask API using `curl`, follow these steps:

1. **Ensure Flask is Running**:
   - Make sure your Flask app is running on the specified IP (`172.17.0.2`) and port (`5000`).
   - You should have started your Flask app by running `python app.py` (or equivalent) in the directory where your `app.py` is located.

2. **Test the `/predict` Endpoint**:
   - The Flask app exposes a `/predict` endpoint that accepts `POST` requests. This endpoint expects a JSON payload containing the following features:
     - `Previous Complexity Level`: Numerical value for the complexity level of the previous question (e.g., `1`, `2`, `3`).
     - `Current Complexity Level`: Numerical value for the complexity level of the current question.
     - `Previous Cognitive Level`: Categorical value indicating the cognitive level of the previous question (e.g., `Slow`, `Medium`, `High`).
     - `Current Quiz Cognitive Level`: Categorical value for the cognitive level of the current quiz (e.g., `Slow`, `Medium`, `High`).

3. **Sending a `POST` Request with `curl`**:
   - To send a prediction request, you need to use the `curl` command with the appropriate data format (JSON).
   - The following examples demonstrate how to use `curl` to send data to the API and receive predictions for different classes (`Basic`, `Intermediate`, `Advanced`).

4. **Example `curl` Requests**:
   - **For `Basic` Question Type**:
     This request is designed to predict a "Basic" question type based on low complexity and cognitive levels.
     ```bash
     curl -X POST http://172.17.0.2:5000/predict -H "Content-Type: application/json" -d '{"Previous Complexity Level": 1, "Current Complexity Level": 1, "Previous Cognitive Level": "Slow", "Current Quiz Cognitive Level": "Slow"}'
     ```

   - **For `Intermediate` Question Type**:
     This request is designed to predict an "Intermediate" question type with moderate complexity and cognitive levels.
     ```bash
     curl -X POST http://172.17.0.2:5000/predict -H "Content-Type: application/json" -d '{"Previous Complexity Level": 3, "Current Complexity Level": 3, "Previous Cognitive Level": "Medium", "Current Quiz Cognitive Level": "Medium"}'
     ```

   - **For `Advanced` Question Type**:
     This request is designed to predict an "Advanced" question type based on high complexity and cognitive levels.
     ```bash
     curl -X POST http://172.17.0.2:5000/predict -H "Content-Type: application/json" -d '{"Previous Complexity Level": 5, "Current Complexity Level": 5, "Previous Cognitive Level": "High", "Current Quiz Cognitive Level": "High"}'
     ```

5. **Response from the API**:
   After sending the `curl` request, the Flask API will respond with a JSON object that contains the predicted proposed question type. For example:
   
   - **Response for `Basic`**:
     ```json
     {
         "Proposed Question Type": "Basic"
     }
     ```

   - **Response for `Intermediate`**:
     ```json
     {
         "Proposed Question Type": "Intermediate"
     }
     ```

   - **Response for `Advanced`**:
     ```json
     {
         "Proposed Question Type": "Advanced"
     }
     ```

6. **Common Errors**:
   - If you get a `400 Bad Request` error, ensure that the JSON payload is correctly formatted, and that all required fields are included in the request body.
   - If you receive a `500 Internal Server Error`, check the Flask terminal output for more details on what went wrong (e.g., missing data, issues with the model, etc.).

7. **Testing Locally**:
   - Ensure that the IP `172.17.0.2` is accessible from the machine where you're running `curl`. This IP address can be useful if you are running the Flask app inside a Docker container or in a virtualized environment.

By following these steps, you can test the Flask API with `curl` and get predictions for the proposed question types based on the input data.
"""


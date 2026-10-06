from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
import joblib
import pandas as pd
from sklearn.preprocessing import OneHotEncoder

# Load the trained model and preprocessor
model = tf.keras.models.load_model('PT_LS_Model.h5')
preprocessor = joblib.load('preprocessor_PT_LS.pkl')

# List of possible PT_LS types (update this if there are more classes)
PT_LS_types = ['Conquerors', 'Mentors', 'Pioneers','Visionaries']  # Adjust based on your training data

# Update the encoder to handle unknown categories
encoder = OneHotEncoder(sparse=False, handle_unknown='ignore')

app = Flask(__name__)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get the input JSON data
        data = request.get_json()

        # Extract values from the input
        PrT = data['primary_type']
        ST = data['secondary_type']
        LSAR = data['LearningStyle_DimensionMentors_Active/ Reflective']
        LSSG = data['LearningStyle_DimensionPioneers_Sequential/ Global']
        LSSI = data['LearningStyle_DimensionConquerors_Sensing/ Intuitive']
        LSVV = data['LearningStyle_Dimension4_Visual/ Verbal']

        # Prepare the input data as a DataFrame with the same column names as during training
        input_data = pd.DataFrame([[PrT, ST, LSAR, LSSG, LSSI, LSVV]],
                                  columns=['primary_type', 'secondary_type', 'LearningStyle_DimensionMentors_Active/ Reflective', 'LearningStyle_DimensionPioneers_Sequential/ Global','LearningStyle_DimensionConquerors_Sensing/ Intuitive','LearningStyle_Dimension4_Visual/ Verbal'])

        print(input_data)
        # Apply preprocessing using the loaded preprocessor (scaling and encoding)
        input_data_processed = preprocessor.transform(input_data)
        
        # Make the prediction
        prediction = model.predict(input_data_processed)

        # Get the predicted class (i.e., the proposed question type)
        predicted_class = np.argmax(prediction, axis=1)[0]

        # Map the predicted index back to the proposed question type
        predicted_PT_LS_types = PT_LS_types[predicted_class]

        # Return the prediction as a JSON response
        return jsonify({'Proposed PT_LS Type': predicted_PT_LS_types})

    except KeyError as e:
        # Handle missing keys in input JSON
        return jsonify({'error': f'Missing required parameter: {str(e)}'}), 400
    except Exception as e:
        # Handle other potential errors
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)


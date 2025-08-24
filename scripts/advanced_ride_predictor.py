import json
import math
import random
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.cluster import KMeans # For demonstrating clustering concept
# In a real scenario, you'd use joblib or pickle to save/load models
# import joblib

# --- Helper Functions ---
def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the distance between two points on Earth using the Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Radius of Earth in kilometers
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance

# --- 1. Data Generation and Model Training (Simulated) ---
# In a real project, you'd load historical data from a database or CSV.
def generate_synthetic_data(num_samples=1000):
    data = []
    for _ in range(num_samples):
        distance_km = random.uniform(1, 50) # 1 to 50 km
        time_of_day_hour = random.randint(0, 23) # 0-23 hours
        day_of_week = random.randint(0, 6) # 0=Monday, 6=Sunday
        is_rainy = random.choice([0, 1]) # 0=No, 1=Yes
        ride_category = random.randint(0, 4) # 0=Economy, 1=Premium, 2=Motorbike, 3=Riksha, 4=Auto Riksha

        # Base fare and cost per km vary by category
        if ride_category == 0: # Economy
            base_fare_bdt = 50
            cost_per_km_bdt = 25
            eta_multiplier = 1.0
            max_distance = 30
        elif ride_category == 1: # Premium
            base_fare_bdt = 100
            cost_per_km_bdt = 40
            eta_multiplier = 0.8
            max_distance = 50
        elif ride_category == 2: # Motorbike
            base_fare_bdt = 30
            cost_per_km_bdt = 15
            eta_multiplier = 0.7
            max_distance = 40
        elif ride_category == 3: # Riksha
            base_fare_bdt = 20
            cost_per_km_bdt = 10
            eta_multiplier = 1.5
            max_distance = 10
        else: # ride_category == 4: Auto Riksha
            base_fare_bdt = 35
            cost_per_km_bdt = 18
            eta_multiplier = 1.2 # Slower than motorbike, faster than riksha
            max_distance = 20 # Longer than riksha, shorter than motorbike

        current_distance_km = min(distance_km, max_distance)

        # Linear component of fare and ETA (before Random Forest refines it)
        # This demonstrates a "linear algorithm" aspect in feature engineering
        fare_linear_base = (current_distance_km * cost_per_km_bdt) + base_fare_bdt
        eta_linear_base = (current_distance_km * 2 * eta_multiplier)

        # Add time, day, and weather impact
        fare = fare_linear_base + (time_of_day_hour * 3) + (day_of_week * 5) + (is_rainy * 70)
        eta = eta_linear_base + (time_of_day_hour * 0.5) + (day_of_week * 1) + (is_rainy * 10)

        fare = max(base_fare_bdt, fare + random.uniform(-25, 25)) # Add noise, min fare
        eta = max(5, eta + random.uniform(-5, 5)) # Add noise, min ETA 5 mins

        data.append([current_distance_km, time_of_day_hour, day_of_week, is_rainy, ride_category, fare, eta])

    df = pd.DataFrame(data, columns=['distance_km', 'time_of_day_hour', 'day_of_week', 'is_rainy', 'ride_category', 'fare_bdt', 'eta_minutes'])
    return df

# Train models (this would typically be a separate script/process)
def train_models():
    df = generate_synthetic_data()
    X = df[['distance_km', 'time_of_day_hour', 'day_of_week', 'is_rainy', 'ride_category']]
    y_fare = df['fare_bdt']
    y_eta = df['eta_minutes']

    # Split data (optional for this simple demo, but good practice)
    X_train, X_test, y_fare_train, y_fare_test, y_eta_train, y_eta_test = train_test_split(
        X, y_fare, y_eta, test_size=0.2, random_state=42
    )

    # Train Random Forest Regressor for Fare
    fare_model = RandomForestRegressor(n_estimators=100, random_state=42)
    fare_model.fit(X_train, y_fare_train)

    # Train Random Forest Regressor for ETA
    eta_model = RandomForestRegressor(n_estimators=100, random_state=42)
    eta_model.fit(X_train, y_eta_train)

    # In a real application, you'd save these models:
    # joblib.dump(fare_model, 'fare_model.pkl')
    # joblib.dump(eta_model, 'eta_model.pkl')

    return fare_model, eta_model

# --- Simulated Surge Zone Clustering ---
# In a real scenario, these would be derived from clustering historical high-demand points.
# For demonstration, we define a few fixed "surge centers" in Dhaka.
SURGE_ZONE_CENTERS = [
    (23.78, 90.41, 1.5), # Gulshan/Banani area, 1.5x surge
    (23.75, 90.38, 1.3), # Dhanmondi area, 1.3x surge
    (23.72, 90.40, 1.8)  # Old Dhaka/Motijheel area, 1.8x surge
]
SURGE_RADIUS_KM = 2.0 # Pickup location must be within this radius of a surge center

def get_surge_multiplier(pickup_lat, pickup_lon):
    """
    Determines if a pickup location is in a simulated surge zone using clustering concept.
    """
    for center_lat, center_lon, multiplier in SURGE_ZONE_CENTERS:
        dist = haversine_distance(pickup_lat, pickup_lon, center_lat, center_lon)
        if dist <= SURGE_RADIUS_KM:
            return multiplier
    return 1.0 # No surge

# --- Simulated Prediction Confidence ---
def get_prediction_confidence(distance_km, time_of_day_hour, is_rainy, ride_category):
    """
    Simulates prediction confidence based on input features.
    Factors reducing confidence: long distance, rush hour, rain, certain ride categories.
    """
    confidence_score = 3 # Start with High (3=High, 2=Medium, 1=Low)

    if distance_km > 30:
        confidence_score -= 1 # Longer distances can be less predictable

    # Rush hour (e.g., 7-9 AM, 5-7 PM)
    if (7 <= time_of_day_hour <= 9) or (17 <= time_of_day_hour <= 19):
        confidence_score -= 1

    if is_rainy:
        confidence_score -= 1

    # Riksha and Auto Riksha might have more variable ETAs/fares due to traffic/route limitations
    if ride_category in [3, 4]: # Riksha, Auto Riksha
        confidence_score -= 1

    confidence_score = max(1, confidence_score) # Ensure minimum confidence is Low

    if confidence_score == 3:
        return "High"
    elif confidence_score == 2:
        return "Medium"
    else:
        return "Low"

def get_recommended_destination(pickup_location_name):
    pickup_location_name = pickup_location_name.lower()
    if "gulshan" in pickup_location_name:
        return "Bashundhara R/A"
    elif "dhanmondi" in pickup_location_name:
        return "Motijheel"
    elif "mirpur" in pickup_location_name:
        return "Uttara"
    return None 


_fare_model = None
_eta_model = None

def get_trained_models():
    global _fare_model, _eta_model
    if _fare_model is None or _eta_model is None:
        # In a real app, you'd load from file:
        # _fare_model = joblib.load('fare_model.pkl')
        # _eta_model = joblib.load('eta_model.pkl')
        # For this demo, we retrain every time if not loaded (not efficient for real use)
        _fare_model, _eta_model = train_models()
    return _fare_model, _eta_model

def predict_ride_details_advanced(pickup_coords, destination_coords, time_of_day_hour, day_of_week, is_rainy, ride_category, pickup_location_name):
    fare_model, eta_model = get_trained_models()

    try:
        pickup_lat, pickup_lon = pickup_coords
        dest_lat, dest_lon = destination_coords
    except (TypeError, ValueError):
        return {"error": "Invalid coordinates format. Expected (latitude, longitude)."}

    distance_km = haversine_distance(pickup_lat, pickup_lon, dest_lat, dest_lon)

    # Apply max distance cap based on category (as in data generation)
    max_distance_map = {0: 30, 1: 50, 2: 40, 3: 10, 4: 20} # Added Auto Riksha (4)
    distance_km = min(distance_km, max_distance_map.get(ride_category, 50))

    # Prepare features for prediction
    features = pd.DataFrame([[distance_km, time_of_day_hour, day_of_week, is_rainy, ride_category]],
                            columns=['distance_km', 'time_of_day_hour', 'day_of_week', 'is_rainy', 'ride_category'])

    predicted_fare = fare_model.predict(features)[0]
    predicted_eta = eta_model.predict(features)[0]

    # Apply surge pricing based on pickup location (Clustering concept)
    surge_multiplier = get_surge_multiplier(pickup_lat, pickup_lon)
    predicted_fare *= surge_multiplier
    surge_applied_status = surge_multiplier > 1.0

    # Get prediction confidence
    prediction_confidence = get_prediction_confidence(distance_km, time_of_day_hour, is_rainy, ride_category)

    # Get recommended destination
    recommended_destination = get_recommended_destination(pickup_location_name)

    # Simulated Feature Impacts (for display in UI)
    # These are illustrative percentages. In a real ML system, you'd use
    # feature importance from your model (e.g., model.feature_importances_ for RandomForest)
    # or explainability tools (e.g., SHAP, LIME).

    # Time of Day Impact
    time_impact_val = 5 # Base
    if (7 <= time_of_day_hour <= 9) or (17 <= time_of_day_hour <= 19): # Rush hour
        time_impact_val = 25
    elif (10 <= time_of_day_hour <= 11) or (12 <= time_of_day_hour <= 16) or (20 <= time_of_day_hour <= 21): # Moderate
        time_impact_val = 15

    # Demand Level Impact
    demand_impact_val = 5 # Base
    if is_rainy:
        demand_impact_val += 10
    if surge_applied_status:
        demand_impact_val += 15
    demand_impact_val = min(demand_impact_val, 40) # Cap

    # Location and Situation Data Impact
    loc_sit_impact_val = 5 # Base
    if is_rainy:
        loc_sit_impact_val += 10
    if surge_applied_status:
        loc_sit_impact_val += 15
    loc_sit_impact_val = min(loc_sit_impact_val, 40) # Cap


    feature_impacts = {
        "distance": 38, # Fixed for simplicity
        "time_of_day": time_impact_val,
        "demand_level": demand_impact_val,
        "location_situation": loc_sit_impact_val # New field
    }


    return {
        "fare": f"{predicted_fare:.2f} BDT",
        "eta": f"{int(predicted_eta)} mins",
        "distance_km": f"{distance_km:.2f} km",
        "surge_applied": surge_applied_status,
        "prediction_confidence": prediction_confidence,
        "recommended_destination": recommended_destination,
        "feature_impacts": feature_impacts # New field
    }

# --- Example Usage (for testing the script directly) ---
if __name__ == "__main__":
    print("Training models (this happens once on server startup in a real app)...")
    fare_model, eta_model = train_models()
    print("Models trained.")

    # Example prediction 1: Pickup in a surge zone (e.g., near Gulshan)
    pickup_coords_ex1 = (23.785, 90.415) # Close to Gulshan surge center
    destination_coords_ex1 = (23.8200, 90.4220) # Bashundhara R/A
    pickup_name_ex1 = "Gulshan 1"
    current_time_hour_ex1 = 18 # 6 PM (rush hour)
    current_day_of_week_ex1 = 4 # Friday
    is_raining_now_ex1 = 0 # No rain
    selected_category_ex1 = 4 # Auto Riksha

    print("\n--- Prediction Example 1 (Rush Hour, Auto Riksha, Surge Zone, Gulshan Pickup) ---")
    prediction_result_ex1 = predict_ride_details_advanced(
        pickup_coords_ex1, destination_coords_ex1, current_time_hour_ex1, current_day_of_week_ex1,
        is_raining_now_ex1, selected_category_ex1, pickup_name_ex1
    )
    print(json.dumps(prediction_result_ex1, indent=2))

    # Example prediction 2: Off-peak, sunny Monday, Motorbike, Mirpur Pickup (should recommend Uttara)
    pickup_coords_ex2 = (23.8070, 90.3680) # Mirpur 10
    destination_coords_ex2 = (23.8759, 90.3978) # Uttara
    pickup_name_ex2 = "Mirpur 10"
    current_time_hour_ex2 = 10 # 10 AM
    current_day_of_week_ex2 = 0 # Monday
    is_raining_now_ex2 = 0 # No rain
    selected_category_ex2 = 2 # Motorbike

    print("\n--- Prediction Example 2 (Off-peak, Sunny Monday, Motorbike, Mirpur Pickup) ---")
    prediction_result_ex2 = predict_ride_details_advanced(
        pickup_coords_ex2, destination_coords_ex2, current_time_hour_ex2, current_day_of_week_ex2,
        is_raining_now_ex2, selected_category_ex2, pickup_name_ex2
    )
    print(json.dumps(prediction_result_ex2, indent=2))

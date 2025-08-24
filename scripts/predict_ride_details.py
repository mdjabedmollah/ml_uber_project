import json
import math
import random

# This script simulates a simple ML model for ride prediction.
# In a real scenario, this would involve a trained model (e.g., scikit-learn, TensorFlow, PyTorch)
# and more complex features like traffic data, time of day, weather, etc.

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

def predict_ride_details(pickup_coords, destination_coords):
    """
    Simulates predicting ride fare and ETA based on pickup and destination coordinates.
    pickup_coords and destination_coords are tuples (latitude, longitude).
    """
    try:
        pickup_lat, pickup_lon = pickup_coords
        dest_lat, dest_lon = destination_coords
    except (TypeError, ValueError):
        return {"error": "Invalid coordinates format. Expected (latitude, longitude)."}

    distance_km = haversine_distance(pickup_lat, pickup_lon, dest_lat, dest_lon)

    # Simple linear model for fare prediction (e.g., base fare + cost per km)
    # These values are illustrative for Bangladesh context
    base_fare_bdt = 50
    cost_per_km_bdt = 25
    fare = base_fare_bdt + (distance_km * cost_per_km_bdt)

    # Add some random noise to make it more "realistic"
    fare = fare * (1 + random.uniform(-0.1, 0.1)) # +/- 10% variation
    fare = max(fare, base_fare_bdt) # Ensure fare doesn't go below base fare

    # Simple model for ETA prediction (e.g., time per km + fixed overhead)
    # Assuming average speed of 20 km/h for urban areas
    avg_speed_kmph = 20
    time_hours = distance_km / avg_speed_kmph
    eta_minutes = (time_hours * 60) + random.randint(5, 15) # Add fixed overhead + random delay

    return {
        "fare": f"{fare:.2f} BDT",
        "eta": f"{int(eta_minutes)} mins",
        "distance_km": f"{distance_km:.2f} km"
    }

if __name__ == "__main__":
    # Example usage:
    # In a real backend, these coordinates would come from the frontend request.
    # For demonstration, let's use approximate coordinates for Dhaka locations.
    # Gulshan 1: (23.7939, 90.4078)
    # Bashundhara R/A: (23.8200, 90.4220)

    # Simulate a request from the frontend
    pickup = (23.7939, 90.4078) # Gulshan 1
    destination = (23.8200, 90.4220) # Bashundhara R/A

    prediction_result = predict_ride_details(pickup, destination)
    print(json.dumps(prediction_result, indent=2))

    # Another example: shorter distance
    pickup_short = (23.7939, 90.4078) # Gulshan 1
    destination_short = (23.7950, 90.4085) # Nearby point in Gulshan
    prediction_result_short = predict_ride_details(pickup_short, destination_short)
    print("\nShort distance prediction:")
    print(json.dumps(prediction_result_short, indent=2))

    # Example with invalid input
    invalid_prediction = predict_ride_details((1,2), "invalid")
    print("\nInvalid input prediction:")
    print(json.dumps(invalid_prediction, indent=2))

"use client"

import { useState, useEffect } from "react"
import { MapPin, Car, Clock, Calendar, CloudRain, Loader2, X, ArrowDownUp, Flag, BikeIcon as Motorcycle, Bike as RikshaIcon, Gauge, TrendingUp, Ruler } from 'lucide-react'
import { Progress } from "@/components/ui/progress"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Define popular locations with approximate dummy coordinates for better simulation
const popularLocations = [
  { name: "Gulshan 1", lat: 23.7939, lon: 90.4078 },
  { name: "Bashundhara R/A", lat: 23.8200, lon: 90.4220 },
  { name: "Dhanmondi", lat: 23.7462, lon: 90.3740 },
  { name: "Mirpur 10", lat: 23.8070, lon: 90.3680 },
  { name: "Motijheel", lat: 23.7270, lon: 90.4100 },
  { name: "Uttara", lat: 23.8759, lon: 90.3978 },
];

// Helper to get dummy coordinates: prioritize popular locations, then use hash-based for others
function getDummyCoords(locationName: string) {
  const found = popularLocations.find(loc => loc.name.toLowerCase() === locationName.toLowerCase());
  if (found) {
    return { lat: found.lat, lon: found.lon };
  }

  // Fallback to hash-based for unknown locations
  const baseLat = 23.7939; // Dhaka center-ish
  const baseLon = 90.4078;
  const hash = locationName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latOffset = (hash % 100) / 10000; // Small offset
  const lonOffset = ((hash * 7) % 100) / 10000; // Small offset

  return {
    lat: baseLat + latOffset,
    lon: baseLon + lonOffset
  };
}

// Haversine distance function (duplicated for client-side simulation)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in kilometers
  const toRadians = (deg: number) => deg * Math.PI / 180;

  const lat1_rad = toRadians(lat1);
  const lon1_rad = toRadians(lon1);
  const lat2_rad = toRadians(lat2);
  const lon2_rad = toRadians(lon2);

  const dlon = lon2_rad - lon1_rad;
  const dlat = lat2_rad - lat1_rad;

  const a = Math.sin(dlat / 2)**2 + Math.cos(lat1_rad) * Math.cos(lat2_rad) * Math.sin(dlon / 2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Simulated Surge Zone Centers (matching Python script for consistency)
const SURGE_ZONE_CENTERS = [
  { lat: 23.78, lon: 90.41, multiplier: 1.5 }, // Gulshan/Banani area
  { lat: 23.75, lon: 90.38, multiplier: 1.3 }, // Dhanmondi area
  { lat: 23.72, lon: 90.40, multiplier: 1.8 }  // Old Dhaka/Motijheel area
];
const SURGE_RADIUS_KM = 2.0; // Pickup location must be within this radius of a surge center

function getSurgeMultiplier(pickupLat: number, pickupLon: number): number {
  for (const center of SURGE_ZONE_CENTERS) {
    const dist = haversineDistance(pickupLat, pickupLon, center.lat, center.lon);
    if (dist <= SURGE_RADIUS_KM) {
      return center.multiplier;
    }
  }
  return 1.0; // No surge
}

// Simulated Prediction Confidence (matching Python script for consistency)
function getPredictionConfidence(distance_km: number, time_of_day_hour: number, is_rainy: boolean, ride_category: number): string {
  let confidence_score = 3; // Start with High (3=High, 2=Medium, 1=Low)

  if (distance_km > 30) {
      confidence_score -= 1; // Longer distances can be less predictable
  }

  // Rush hour (e.g., 7-9 AM, 5-7 PM)
  if ((7 <= time_of_day_hour && time_of_day_hour <= 9) || (17 <= time_of_day_hour && time_of_day_hour <= 19)) {
      confidence_score -= 1;
  }

  if (is_rainy) {
      confidence_score -= 1;
  }

  // Riksha and Auto Riksha might have more variable ETAs/fares due to traffic/route limitations
  if (ride_category === 3 || ride_category === 4) { // Riksha, Auto Riksha
      confidence_score -= 1;
  }

  confidence_score = Math.max(1, confidence_score); // Ensure minimum confidence is Low

  if (confidence_score === 3) {
      return "High";
  } else if (confidence_score === 2) {
      return "Medium";
  } else {
      return "Low";
  }
}

// Simulated Recommended Destination (matching Python script for consistency)
function getRecommendedDestination(pickupLocationName: string): string | null {
  const lowerCaseName = pickupLocationName.toLowerCase();
  if (lowerCaseName.includes("gulshan")) {
      return "Bashundhara R/A";
  } else if (lowerCaseName.includes("dhanmondi")) {
      return "Motijheel";
  } else if (lowerCaseName.includes("mirpur")) {
      return "Uttara";
  }
  return null; // No specific recommendation
}

// Simulated Feature Impacts (matching Python script for consistency)
interface FeatureImpacts {
  distance: number;
  time_of_day: number;
  demand_level: number;
  location_situation: number; // New field
}

async function getAdvancedRidePrediction(
  pickup: string,
  destination: string,
  timeOfDayHour: number,
  dayOfWeek: number,
  isRainy: boolean,
  rideCategory: number
) {
  const pickupCoords = getDummyCoords(pickup);
  const destCoords = getDummyCoords(destination);

  if (!pickup || !destination) {
    return { fare: null, eta: null, error: "Please enter both pickup and destination." };
  }

  let distance_km = haversineDistance(pickupCoords.lat, pickupCoords.lon, destCoords.lat, destCoords.lon);

  let base_fare_bdt, cost_per_km_bdt, eta_multiplier, max_distance_km;
  if (rideCategory === 0) { // Economy
      base_fare_bdt = 50;
      cost_per_km_bdt = 25;
      eta_multiplier = 1.0;
      max_distance_km = 30;
  } else if (rideCategory === 1) { // Premium
      base_fare_bdt = 100;
      cost_per_km_bdt = 40;
      eta_multiplier = 0.8;
      max_distance_km = 50;
  } else if (rideCategory === 2) { // Motorbike
      base_fare_bdt = 30;
      cost_per_km_bdt = 15;
      eta_multiplier = 0.7;
      max_distance_km = 40;
  } else if (rideCategory === 3) { // Riksha
      base_fare_bdt = 20;
      cost_per_km_bdt = 10;
      eta_multiplier = 1.5;
      max_distance_km = 10; // Riksha typically for shorter distances
  } else { // rideCategory == 4: Auto Riksha
      base_fare_bdt = 35;
      cost_per_km_bdt = 18;
      eta_multiplier = 1.2;
      max_distance_km = 20;
  }

  // Cap distance based on category
  distance_km = Math.min(distance_km, max_distance_km);

  // Simulated ML prediction logic (mimicking Python script)
  let simulatedFare = (distance_km * cost_per_km_bdt) + base_fare_bdt +
                      (timeOfDayHour * 3) + (dayOfWeek * 5) + (isRainy ? 70 : 0); // Stronger rain impact
  simulatedFare = Math.max(base_fare_bdt, simulatedFare + (Math.random() * 25 - 12.5)); // Add noise, min fare

  let simulatedEta = (distance_km * 2 * eta_multiplier) + (timeOfDayHour * 0.5) +
                     (dayOfWeek * 1) + (isRainy ? 10 : 0); // Stronger rain impact on ETA
  simulatedEta = Math.max(5, simulatedEta + (Math.random() * 6 - 3)); // Add noise, min ETA 5 mins

  // Apply surge pricing (Clustering concept)
  const surgeMultiplier = getSurgeMultiplier(pickupCoords.lat, pickupCoords.lon);
  simulatedFare *= surgeMultiplier;
  const surgeAppliedStatus = surgeMultiplier > 1.0;

  // Get prediction confidence
  const predictionConfidence = getPredictionConfidence(distance_km, timeOfDayHour, isRainy, rideCategory);

  // Get recommended destination
  const recommendedDestination = getRecommendedDestination(pickup);

  // Simulated Feature Impacts (for display in UI)
  // These are illustrative percentages. In a real ML system, you'd use
  // feature importance from your model (e.g., model.feature_importances_ for RandomForest)
  // or explainability tools (e.g., SHAP, LIME).

  // Time of Day Impact
  let time_impact_val = 5; // Base
  if ((7 <= timeOfDayHour && timeOfDayHour <= 9) || (17 <= timeOfDayHour && timeOfDayHour <= 19)) { // Rush hour
      time_impact_val = 25;
  } else if ((10 <= timeOfDayHour && timeOfDayHour <= 11) || (12 <= timeOfDayHour && timeOfDayHour <= 16) || (20 <= timeOfDayHour && timeOfDayHour <= 21)) { // Moderate
      time_impact_val = 15;
  }

  // Demand Level Impact
  let demand_impact_val = 5; // Base
  if (isRainy) {
      demand_impact_val += 10;
  }
  if (surgeAppliedStatus) {
      demand_impact_val += 15;
  }
  demand_impact_val = Math.min(demand_impact_val, 40); // Cap

  // Location and Situation Data Impact
  let loc_sit_impact_val = 5; // Base
  if (isRainy) {
      loc_sit_impact_val += 10;
  }
  if (surgeAppliedStatus) {
      loc_sit_impact_val += 15;
  }
  loc_sit_impact_val = Math.min(loc_sit_impact_val, 40); // Cap


  const featureImpacts: FeatureImpacts = {
    distance: 38, // Fixed for simplicity
    time_of_day: time_impact_val,
    demand_level: demand_impact_val,
    location_situation: loc_sit_impact_val // New field
  };


  return new Promise<{ fare: string | null; eta: string | null; error: string | null; surgeApplied: boolean; predictionConfidence: string; recommendedDestination: string | null; featureImpacts: FeatureImpacts }>((resolve) => {
    setTimeout(() => {
      resolve({
        fare: `${simulatedFare.toFixed(2)} BDT`,
        eta: `${Math.floor(simulatedEta)} mins`,
        error: null,
        surgeApplied: surgeAppliedStatus,
        predictionConfidence: predictionConfidence,
        recommendedDestination: recommendedDestination,
        featureImpacts: featureImpacts
      });
    }, 1500); // Simulate a 1.5 second API call
  });
}

export function RideRequestCard() {
  const [pickupLocation, setPickupLocation] = useState("")
  const [destinationLocation, setDestinationLocation] = useState("")
  const [timeOfDay, setTimeOfDay] = useState<string>("12") // Default to 12 PM
  const [dayOfWeek, setDayOfWeek] = useState<string>("0") // Default to Monday
  const [isRainy, setIsRainy] = useState(false)
  const [rideCategory, setRideCategory] = useState<string>("0") // Default to Economy (0)

  const [predictedFare, setPredictedFare] = useState<string | null>(null)
  const [predictedETA, setPredictedETA] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rideConfirmed, setRideConfirmed] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [surgeApplied, setSurgeApplied] = useState(false); // New state for surge
  const [predictionConfidence, setPredictionConfidence] = useState<string | null>(null); // New state for confidence
  const [recommendedDestination, setRecommendedDestination] = useState<string | null>(null); // New state for recommended destination
  const [featureImpacts, setFeatureImpacts] = useState<FeatureImpacts | null>(null); // New state for feature impacts


  useEffect(() => {
    setPredictedFare(null);
    setPredictedETA(null);
    setRideConfirmed(false);
    setError(null);
    setSurgeApplied(false); // Reset surge state
    setPredictionConfidence(null); // Reset confidence state
    setRecommendedDestination(null); // Reset recommended destination
    setFeatureImpacts(null); // Reset feature impacts
  }, [pickupLocation, destinationLocation, timeOfDay, dayOfWeek, isRainy, rideCategory]);

  const handleRequestRide = async () => {
    if (!pickupLocation || !destinationLocation) {
      setError("Please enter both pickup and destination.");
      return;
    }

    setLoading(true)
    setError(null)
    setPredictedFare(null)
    setPredictedETA(null)
    setRideConfirmed(false);
    setSurgeApplied(false);
    setPredictionConfidence(null);
    setRecommendedDestination(null);
    setFeatureImpacts(null);

    const result = await getAdvancedRidePrediction(
      pickupLocation,
      destinationLocation,
      parseInt(timeOfDay),
      parseInt(dayOfWeek),
      isRainy,
      parseInt(rideCategory)
    )
    if (result.error) {
      setError(result.error)
    } else {
      setPredictedFare(result.fare)
      setPredictedETA(result.eta)
      setSurgeApplied(result.surgeApplied); // Update surge state
      setPredictionConfidence(result.predictionConfidence); // Update confidence state
      setRecommendedDestination(result.recommendedDestination); // Update recommended destination
      setFeatureImpacts(result.featureImpacts); // Update feature impacts
    }
    setLoading(false)
  }

  const handleConfirmRide = async () => {
    setBookingLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
    setBookingLoading(false);
    setRideConfirmed(true);
  };

  const handleSwapLocations = () => {
    setPickupLocation(destinationLocation);
    setDestinationLocation(pickupLocation);
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold">Ride Estimate in Dhaka</CardTitle>
        <CardDescription>
          Get an estimated fare and arrival time based on your route and conditions.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="relative grid gap-3">
          <div className="relative">
            <Label htmlFor="pickup" className="sr-only">Pickup Location</Label>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="pickup"
              placeholder="Enter pickup location"
              className={`pl-10 pr-8 py-2 ${!pickupLocation && error ? 'border-red-500' : ''}`}
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              aria-label="Pickup Location"
            />
            {pickupLocation && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                onClick={() => setPickupLocation("")}
                aria-label="Clear pickup location"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {popularLocations.map((loc) => (
              <Badge
                key={loc.name}
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setPickupLocation(loc.name)}
              >
                {loc.name}
              </Badge>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 bg-white border-2 border-gray-200 rounded-full shadow-sm hover:bg-gray-50"
            onClick={handleSwapLocations}
            aria-label="Swap pickup and destination locations"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>

          <div className="relative">
            <Label htmlFor="destination" className="sr-only">Destination</Label>
            <Flag className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="destination"
              placeholder="Enter destination"
              className={`pl-10 pr-8 py-2 ${!destinationLocation && error ? 'border-red-500' : ''}`}
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              aria-label="Destination"
            />
            {destinationLocation && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                onClick={() => setDestinationLocation("")}
                aria-label="Clear destination"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {popularLocations.map((loc) => (
              <Badge
                key={loc.name}
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setDestinationLocation(loc.name)}
              >
                {loc.name}
              </Badge>
            ))}
          </div>
          {recommendedDestination && destinationLocation !== recommendedDestination && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span className="font-medium">Recommended:</span>
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setDestinationLocation(recommendedDestination)}
              >
                {recommendedDestination}
              </Badge>
            </div>
          )}

          <div className="absolute left-5 top-1/2 -translate-y-1/2 h-[calc(100%-4rem)] w-px bg-gray-300 flex flex-col justify-between items-center">
            <div className="w-2 h-2 rounded-full bg-primary -mt-1" />
            <div className="flex-grow border-l border-dashed border-gray-400 mx-auto" />
            <div className="w-2 h-2 rounded-full bg-green-500 -mb-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="timeOfDay" className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {'Time of Day'}
            </Label>
            <Select value={timeOfDay} onValueChange={setTimeOfDay}>
              <SelectTrigger id="timeOfDay">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i < 12 ? `${i === 0 ? 12 : i} AM` : `${i === 12 ? 12 : i - 12} PM`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dayOfWeek" className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {'Day of Week'}
            </Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger id="dayOfWeek">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {days.map((day, index) => (
                  <SelectItem key={index} value={String(index)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isRainy"
            checked={isRainy}
            onCheckedChange={(checked) => setIsRainy(Boolean(checked))}
          />
          <Label htmlFor="isRainy" className="flex items-center gap-1 cursor-pointer">
            <CloudRain className="w-4 h-4 text-muted-foreground" />
            {'Is it raining?'}
          </Label>
        </div>

        <div className="grid gap-2">
          <Label className="flex items-center gap-1">
            <Car className="h-4 w-4 text-muted-foreground" />
            {'Ride Category'}
          </Label>
          <RadioGroup
            defaultValue="0"
            value={rideCategory}
            onValueChange={setRideCategory}
            className="grid grid-cols-2 gap-2"
          >
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="0" id="economy" className="peer sr-only" />
              <Label htmlFor="economy" className="flex flex-col items-center justify-center w-full text-center cursor-pointer peer-data-[state=checked]:text-primary">
                <Car className="h-6 w-6 mb-1" />
                <span className="text-sm font-medium">Economy</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="1" id="premium" className="peer sr-only" />
              <Label htmlFor="premium" className="flex flex-col items-center justify-center w-full text-center cursor-pointer peer-data-[state=checked]:text-primary">
                <Car className="h-6 w-6 mb-1" />
                <span className="text-sm font-medium">Premium</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="2" id="motorbike" className="peer sr-only" />
              <Label htmlFor="motorbike" className="flex flex-col items-center justify-center w-full text-center cursor-pointer peer-data-[state=checked]:text-primary">
                <Motorcycle className="h-6 w-6 mb-1" />
                <span className="text-sm font-medium">Motorbike</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="3" id="riksha" className="peer sr-only" />
              <Label htmlFor="riksha" className="flex flex-col items-center justify-center w-full text-center cursor-pointer peer-data-[state=checked]:text-primary">
                <RikshaIcon className="h-6 w-6 mb-1" />
                <span className="text-sm font-medium">Riksha</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="4" id="auto-riksha" className="peer sr-only" />
              <Label htmlFor="auto-riksha" className="flex flex-col items-center justify-center w-full text-center cursor-pointer peer-data-[state=checked]:text-primary">
                <Car className="h-6 w-6 mb-1" /> {/* Using Car icon for Auto Riksha */}
                <span className="text-sm font-medium">Auto Riksha</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Button
          onClick={handleRequestRide}
          disabled={loading || !pickupLocation || !destinationLocation}
          className="w-full py-2 text-lg font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {'Calculating Estimate...'}
            </>
          ) : (
            'Get Ride Estimate'
          )}
        </Button>

        {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}

        {(predictedFare || predictedETA) && !rideConfirmed && (
          <>
            <Separator className="my-2" />
            <div className="grid gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Estimated Ride Details</h3>
                {surgeApplied && <Badge variant="destructive" className="text-sm">Surge Applied!</Badge>}
                <Badge variant="secondary" className="text-sm">Estimated</Badge>
              </div>
              <div className="flex items-center justify-between text-lg font-medium">
                <div className="flex items-center gap-2">
                  <Car className="w-6 h-6 text-primary" />
                  <span>Fare:</span>
                </div>
                <span className="text-primary-foreground bg-primary px-3 py-1 rounded-full">
                  {predictedFare}
                </span>
              </div>
              <div className="flex items-center justify-between text-lg font-medium">
                <div className="flex items-center gap-2">
                  <Clock className="w-6 h-6 text-green-600" />
                  <span>Arrival:</span>
                </div>
                <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full">
                  {predictedETA}
                </span>
              </div>
              {predictionConfidence && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    <span>Confidence:</span>
                  </div>
                  <Badge
                    variant={
                      predictionConfidence === "High"
                        ? "default"
                        : predictionConfidence === "Medium"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {predictionConfidence}
                  </Badge>
                </div>
              )}
              <Button
                onClick={handleConfirmRide}
                disabled={bookingLoading}
                className="mt-4 w-full py-2 text-lg font-semibold bg-green-500 hover:bg-green-600"
              >
                {bookingLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {'Booking Ride...'}
                  </>
                ) : (
                  'Confirm Ride'
                )}
              </Button>
            </div>
            {featureImpacts && (
              <Card className="mt-4 border-dashed border-gray-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">ML Feature Analysis</CardTitle>
                  <CardDescription className="text-sm">
                    Based on 4,424 similar rides
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm">
                  <div className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Distance Impact</span>
                      </div>
                      <span className="text-primary font-semibold">{featureImpacts.distance}%</span>
                    </div>
                    <Progress value={featureImpacts.distance} className="h-2" />
                  </div>

                  <div className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Time of Day</span>
                      </div>
                      <span className="text-primary font-semibold">{featureImpacts.time_of_day}%</span>
                    </div>
                    <Progress value={featureImpacts.time_of_day} className="h-2" />
                  </div>

                  <div className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Demand Level</span>
                      </div>
                      <span className="text-primary font-semibold">{featureImpacts.demand_level}%</span>
                    </div>
                    <Progress value={featureImpacts.demand_level} className="h-2" />
                  </div>

                  <div className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Location & Situation Data</span>
                      </div>
                      <span className="text-primary font-semibold">{featureImpacts.location_situation}%</span>
                    </div>
                    <Progress value={featureImpacts.location_situation} className="h-2" />
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between">
                    <span className="font-medium text-base">Surge Pricing</span>
                    <Badge variant={surgeApplied ? "destructive" : "outline"} className="text-base px-3 py-1">
                      {surgeApplied ? "On" : "Off"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {rideConfirmed && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <h3 className="text-xl font-bold text-green-700">Ride Confirmed! 🎉</h3>
            <p className="text-green-600 mt-2">Your ride is on its way.</p>
            <Button variant="outline" className="mt-4" onClick={() => {
              setRideConfirmed(false);
              setPredictedFare(null);
              setPredictedETA(null);
              setPickupLocation("");
              setDestinationLocation("");
            }}>
              Book Another Ride
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

package com.foodie.api.servicearea;

public final class DistanceCalculator {

    private static final double EARTH_RADIUS_MILES = 3958.7613;

    private DistanceCalculator() {}

    public static double miles(double fromLat, double fromLng, double toLat, double toLng) {
        double latDifference = Math.toRadians(toLat - fromLat);
        double lngDifference = Math.toRadians(toLng - fromLng);
        double sinLat = Math.sin(latDifference / 2);
        double sinLng = Math.sin(lngDifference / 2);
        double haversine = sinLat * sinLat + Math.cos(Math.toRadians(fromLat))
                * Math.cos(Math.toRadians(toLat)) * sinLng * sinLng;
        return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(Math.clamp(haversine, 0, 1)));
    }
}

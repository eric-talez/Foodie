package com.foodie.api.servicearea;

public record DeliveryEligibility(double distanceMiles, boolean inCoverage,
                                  boolean groupedAvailable, boolean directAvailable) {

    public static DeliveryEligibility forDistance(double distanceMiles, boolean inCoverage,
                                                  double groupedMaxMiles, double directMaxMiles) {
        return new DeliveryEligibility(distanceMiles, inCoverage,
                inCoverage && distanceMiles <= groupedMaxMiles, inCoverage && distanceMiles <= directMaxMiles);
    }
}

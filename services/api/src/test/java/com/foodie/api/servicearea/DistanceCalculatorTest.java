package com.foodie.api.servicearea;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class DistanceCalculatorTest {

    @Test
    void identicalCoordinatesHaveZeroDistance() {
        assertThat(DistanceCalculator.miles(37.3541, -121.9552, 37.3541, -121.9552)).isZero();
    }

    @Test
    void oneEquatorialDegreeIsAbout69Miles() {
        assertThat(DistanceCalculator.miles(0, 0, 0, 1)).isCloseTo(69.0934, within(0.1));
    }

    @Test
    void distanceIsSymmetricAcrossTheDateLine() {
        assertThat(DistanceCalculator.miles(0, 179.5, 0, -179.5)).isCloseTo(69.0934, within(0.1));
        assertThat(DistanceCalculator.miles(37.3541, -121.9552, 37.333, -121.89))
                .isEqualTo(DistanceCalculator.miles(37.333, -121.89, 37.3541, -121.9552));
    }

    @Test
    void antipodalCoordinatesProduceAFiniteHalfCircumference() {
        assertThat(DistanceCalculator.miles(90, 0, -90, 180)).isCloseTo(12436.8, within(0.1));
    }
}

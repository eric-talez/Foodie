package com.foodie.api.servicearea;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DeliveryEligibilityTest {

    @Test
    void groupedIncludesExactlyFourMilesButExcludesTheNextRawValue() {
        assertThat(DeliveryEligibility.forDistance(4.0, true, 4.0, 6.0).groupedAvailable()).isTrue();
        var justOverFour = DeliveryEligibility.forDistance(Math.nextUp(4.0), true, 4.0, 6.0);
        assertThat(justOverFour.groupedAvailable()).isFalse();
        assertThat(justOverFour.directAvailable()).isTrue();
    }

    @Test
    void directIncludesExactlySixMilesButExcludesTheNextRawValue() {
        assertThat(DeliveryEligibility.forDistance(6.0, true, 4.0, 6.0).directAvailable()).isTrue();
        assertThat(DeliveryEligibility.forDistance(Math.nextUp(6.0), true, 4.0, 6.0).directAvailable()).isFalse();
    }

    @Test
    void outsideCoverageDisablesBothModesEvenAtZeroDistance() {
        var eligibility = DeliveryEligibility.forDistance(0, false, 4.0, 6.0);
        assertThat(eligibility.inCoverage()).isFalse();
        assertThat(eligibility.groupedAvailable()).isFalse();
        assertThat(eligibility.directAvailable()).isFalse();
    }
}

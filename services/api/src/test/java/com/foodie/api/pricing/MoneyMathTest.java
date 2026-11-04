package com.foodie.api.pricing;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class MoneyMathTest {
    @Test
    void calculatesPositiveIntegerPercentagesWithHalfUpRounding() {
        assertThat(MoneyMath.percentageCents(110, 500)).isEqualTo(6);
        assertThat(MoneyMath.percentageCents(3500, 500)).isEqualTo(175);
        assertThat(MoneyMath.percentageCents(3500, 1200)).isEqualTo(420);
        assertThat(MoneyMath.percentageCents(109, 500)).isEqualTo(5);
        assertThat(MoneyMath.percentageCents(0, 900)).isZero();
        assertThat(MoneyMath.percentageCents(Long.MAX_VALUE, 10000)).isEqualTo(Long.MAX_VALUE);
    }

    @Test
    void rejectsNegativeInputsAndOverflow() {
        assertThatIllegalArgumentException().isThrownBy(() -> MoneyMath.percentageCents(-1, 500));
        assertThatIllegalArgumentException().isThrownBy(() -> MoneyMath.percentageCents(100, -1));
        assertThatExceptionOfType(ArithmeticException.class)
                .isThrownBy(() -> MoneyMath.percentageCents(Long.MAX_VALUE, 20000));
    }
}

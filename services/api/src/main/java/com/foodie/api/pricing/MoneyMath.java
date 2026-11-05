package com.foodie.api.pricing;

public final class MoneyMath {
    private MoneyMath() {}

    public static long percentageCents(long amountCents, int basisPoints) {
        if (amountCents < 0 || basisPoints < 0) throw new IllegalArgumentException("Amounts and rates must be nonnegative");
        // Split the amount so a representable result does not overflow during multiplication.
        return Math.addExact(Math.multiplyExact(amountCents / 10000, basisPoints),
                (amountCents % 10000 * basisPoints + 5000) / 10000);
    }
}

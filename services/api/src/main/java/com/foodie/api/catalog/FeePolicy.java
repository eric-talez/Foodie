package com.foodie.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "fee_policy")
public class FeePolicy {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "label", nullable = false, length = 160)
    private String label;

    @Column(name = "restaurant_commission_basis_points", nullable = false)
    private int restaurantCommissionBasisPoints;

    @Column(name = "service_fee_basis_points", nullable = false)
    private int serviceFeeBasisPoints;

    @Column(name = "service_fee_cap_cents", nullable = false)
    private int serviceFeeCapCents;

    @Column(name = "grouped_delivery_fee_cents", nullable = false)
    private int groupedDeliveryFeeCents;

    @Column(name = "direct_surcharge_cents", nullable = false)
    private int directSurchargeCents;

    @Column(name = "grouped_max_distance_miles", nullable = false)
    private double groupedMaxDistanceMiles;

    @Column(name = "direct_max_distance_miles", nullable = false)
    private double directMaxDistanceMiles;

    @Column(name = "demo_tax_basis_points", nullable = false)
    private int demoTaxBasisPoints;

    @Column(name = "demo", nullable = false)
    private boolean demo;

    @Column(name = "active", nullable = false)
    private boolean active;

    protected FeePolicy() {}

    public UUID id() { return id; }

    public String label() { return label; }

    public int restaurantCommissionBasisPoints() { return restaurantCommissionBasisPoints; }

    public int serviceFeeBasisPoints() { return serviceFeeBasisPoints; }

    public int serviceFeeCapCents() { return serviceFeeCapCents; }

    public int groupedDeliveryFeeCents() { return groupedDeliveryFeeCents; }

    public int directSurchargeCents() { return directSurchargeCents; }

    public double groupedMaxDistanceMiles() { return groupedMaxDistanceMiles; }

    public double directMaxDistanceMiles() { return directMaxDistanceMiles; }

    public int demoTaxBasisPoints() { return demoTaxBasisPoints; }

    public boolean demo() { return demo; }

    public boolean active() { return active; }
}

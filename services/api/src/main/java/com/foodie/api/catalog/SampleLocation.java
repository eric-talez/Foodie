package com.foodie.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "sample_location")
public class SampleLocation {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "label", nullable = false, length = 160)
    private String label;

    @Column(name = "city", nullable = false, length = 80)
    private String city;

    @Column(name = "latitude", nullable = false)
    private double latitude;

    @Column(name = "longitude", nullable = false)
    private double longitude;

    @Column(name = "in_coverage", nullable = false)
    private boolean inCoverage;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "active", nullable = false)
    private boolean active;

    protected SampleLocation() {}

    public UUID id() { return id; }

    public String label() { return label; }

    public String city() { return city; }

    public double latitude() { return latitude; }

    public double longitude() { return longitude; }

    public boolean inCoverage() { return inCoverage; }

    public int displayOrder() { return displayOrder; }

    public boolean active() { return active; }
}

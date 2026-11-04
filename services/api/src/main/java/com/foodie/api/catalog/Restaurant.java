package com.foodie.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "restaurant")
public class Restaurant {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "slug", nullable = false, length = 100)
    private String slug;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "description", nullable = false, length = 500)
    private String description;

    @Column(name = "city", nullable = false, length = 80)
    private String city;

    @Column(name = "cuisine", nullable = false, length = 80)
    private String cuisine;

    @Column(name = "latitude", nullable = false)
    private double latitude;

    @Column(name = "longitude", nullable = false)
    private double longitude;

    @Column(name = "active", nullable = false)
    private boolean active;

    @OneToMany(mappedBy = "restaurant")
    @OrderBy("displayOrder ASC, id ASC")
    private List<MenuCategory> categories = new ArrayList<>();

    protected Restaurant() {}

    public UUID id() { return id; }

    public String slug() { return slug; }

    public String name() { return name; }

    public String description() { return description; }

    public String city() { return city; }

    public String cuisine() { return cuisine; }

    public double latitude() { return latitude; }

    public double longitude() { return longitude; }

    public boolean active() { return active; }

    public List<MenuCategory> categories() { return categories; }
}

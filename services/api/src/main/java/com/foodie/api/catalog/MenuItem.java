package com.foodie.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "menu_item")
public class MenuItem {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "description", nullable = false, length = 500)
    private String description;

    @Column(name = "price_cents", nullable = false)
    private int priceCents;

    @Column(name = "image_reference", nullable = true, length = 255)
    private String imageReference;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "active", nullable = false)
    private boolean active;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private MenuCategory category;

    @OneToMany(mappedBy = "item")
    @OrderBy("displayOrder ASC, id ASC")
    private List<ModifierGroup> modifierGroups = new ArrayList<>();

    protected MenuItem() {}

    public UUID id() { return id; }

    public String name() { return name; }

    public String description() { return description; }

    public int priceCents() { return priceCents; }

    public String imageReference() { return imageReference; }

    public int displayOrder() { return displayOrder; }

    public boolean active() { return active; }

    public MenuCategory category() { return category; }

    public List<ModifierGroup> modifierGroups() { return modifierGroups; }
}

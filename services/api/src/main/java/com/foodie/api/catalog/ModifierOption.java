package com.foodie.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "modifier_option")
public class ModifierOption {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "label", nullable = false, length = 120)
    private String label;

    @Column(name = "price_delta_cents", nullable = false)
    private int priceDeltaCents;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "active", nullable = false)
    private boolean active;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "modifier_group_id", nullable = false)
    private ModifierGroup group;

    protected ModifierOption() {}

    public UUID id() { return id; }

    public String label() { return label; }

    public int priceDeltaCents() { return priceDeltaCents; }

    public int displayOrder() { return displayOrder; }

    public boolean active() { return active; }

    public ModifierGroup group() { return group; }
}

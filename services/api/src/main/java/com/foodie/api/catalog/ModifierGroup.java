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
@Table(name = "modifier_group")
public class ModifierGroup {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "min_selections", nullable = false)
    private int minSelections;

    @Column(name = "max_selections", nullable = false)
    private int maxSelections;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "active", nullable = false)
    private boolean active;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "menu_item_id", nullable = false)
    private MenuItem item;

    @OneToMany(mappedBy = "group")
    @OrderBy("displayOrder ASC, id ASC")
    private List<ModifierOption> options = new ArrayList<>();

    protected ModifierGroup() {}

    public UUID id() { return id; }

    public String name() { return name; }

    public int minSelections() { return minSelections; }

    public int maxSelections() { return maxSelections; }

    public int displayOrder() { return displayOrder; }

    public boolean active() { return active; }

    public MenuItem item() { return item; }

    public List<ModifierOption> options() { return options; }
}

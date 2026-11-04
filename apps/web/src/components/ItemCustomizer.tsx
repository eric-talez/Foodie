"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useCart } from "../features/cart/CartProvider";
import { lineIdentity } from "../features/cart/cartReducer";
import type { MenuItem } from "../lib/types";

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function ItemCustomizer({ item, restaurantId }: { item: MenuItem; restaurantId: string }) {
  const { addLine, ready, state } = useCart();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const options = item.modifierGroups.flatMap((group) => group.options).filter((option) => selected.includes(option.id));
  const modifierTotalCents = options.reduce((sum, option) => sum + option.priceDeltaCents, 0);
  const valid = item.modifierGroups.every((group) => {
    const count = group.options.filter((option) => selected.includes(option.id)).length;
    return count >= group.minSelections && count <= group.maxSelections;
  });

  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const opener = trigger.current;
    element.showModal();
    close.current?.focus();
    return () => { element.close(); opener?.focus(); };
  }, [open]);

  function handleKey(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    if (event.key !== "Tab") return;
    const controls = [...dialog.current!.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")].filter((control) => !control.disabled);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function add() {
    if (!valid) return;
    if (addLine({
      lineId: lineIdentity(item.id, selected), restaurantId, menuItemId: item.id, itemName: item.name,
      unitPriceCents: item.priceCents, quantity: 1, modifierOptionIds: selected,
      modifierLabels: options.map((option) => option.label), modifierTotalCents,
    })) {
      setOpen(false);
      setAnnouncement(`${item.name} added to cart`);
    } else {
      setError(state.restaurantId && state.restaurantId !== restaurantId
        ? "Your cart can contain items from only one restaurant. Remove its items before adding from another restaurant."
        : "You can add up to 20 of each customized item.");
    }
  }

  return (
    <>
      <button ref={trigger} type="button" disabled={!ready} aria-label={`Customize ${item.name}`} onClick={() => {
        setSelected([]); setError(""); setAnnouncement(""); setOpen(true);
      }}>Customize · {dollars(item.priceCents)}</button>
      <p className="status-message" role="status">{announcement}</p>
      {open && <dialog ref={dialog} className="item-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
        onCancel={(event) => { event.preventDefault(); setOpen(false); }} onKeyDown={handleKey}>
        <button ref={close} className="dialog-close" type="button" aria-label="Close customization" onClick={() => setOpen(false)}>Close</button>
        <h2 id={titleId}>{item.name}</h2>
        <p id={descriptionId}>{item.description}</p>
        {item.modifierGroups.map((group) => {
          const count = group.options.filter((option) => selected.includes(option.id)).length;
          return <fieldset className="modifier-group" key={group.id}>
            <legend>{group.name} · {group.minSelections > 0 ? "Required" : "Optional"} · Select {group.minSelections}–{group.maxSelections}</legend>
            {group.options.map((option) => {
              const checked = selected.includes(option.id);
              return <label key={option.id}>
                <input type="checkbox" checked={checked} disabled={!checked && count >= group.maxSelections} onChange={() => {
                  setSelected((current) => checked ? current.filter((id) => id !== option.id) : [...current, option.id]);
                  setError("");
                }} />
                <span>{option.label} · +{dollars(option.priceDeltaCents)}</span>
              </label>;
            })}
          </fieldset>;
        })}
        <p className="item-estimate">Estimated item total: {dollars(item.priceCents + modifierTotalCents)}</p>
        <p className="estimate-note">Prices are estimates. Delivery fees and final pricing are calculated later.</p>
        {error && <p className="status-error" role="alert">{error}</p>}
        <button type="button" disabled={!valid || !ready} onClick={add}>Add to cart</button>
      </dialog>}
    </>
  );
}

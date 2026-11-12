---
name: ui-ux-best-practices
description: A set of opinionated UI/UX design and interaction rules to apply whenever building, reviewing, or giving feedback on user interfaces — forms, mobile apps, dashboards, search, filters, buttons, and general layout. Use this skill any time the user asks to design, build, mock up, critique, or improve a UI/UX, screen, form, component, or app, even if they don't explicitly ask for "best practices." Also use it when generating HTML/React mockups, Figma-style descriptions, or artifacts that involve interface design decisions.
---

# UI/UX Best Practices

A checklist of concrete, opinionated interface rules. Apply these by default when designing or reviewing any UI — don't wait for the user to ask for "best practices" explicitly. When a rule would conflict with an explicit user instruction, follow the user's instruction but mention the tradeoff.

Treat this as a checklist to run through before finalizing any interface: forms, mobile screens, dashboards, filters, and general layout should all be checked against the relevant sections below.

## Forms & Inputs

- **No placeholder-as-label.** Every text field needs a real, persistent label. A placeholder disappears the moment the user starts typing, so it can't substitute for a label — the user loses context on what they're filling in.
- **Use input masks.** For structured data (phone numbers, dates, credit cards, currency), format-as-you-type so the user sees the expected pattern (e.g. `(___) ___-____`) instead of guessing the format.
- **Match field type to input type.** A phone number gets a numeric keypad, an email field gets an email keyboard with `@` visible, a date gets a date picker — don't make every field a generic text box.
- **Boxes over underlines.** Bordered/boxed input fields read as more tappable and clearly delineate the input area, versus a bottom-border-only style which is easy to miss, especially on mobile.
- **Use placeholders in search bars.** This is the one place placeholder text is the right call — inside a search input, placeholder text (e.g. "Search products…") functions as a hint, not a label, since there's no ambiguity about what the field does.
- **Sliders for filters.** For range-based filters (price, distance, rating), a slider is faster to operate than typing two numbers into min/max fields.

## Loading & Feedback

- **Skeleton loading over spinners.** Show a low-fidelity skeleton of the content's shape while it loads, rather than a generic spinner — it reduces perceived wait time and prevents layout jump when content arrives.

## Selection & Navigation

- **Show all options for 2–3 choices.** If the user must pick from only 2–3 values, display them all (segmented control, radio buttons, chips) rather than hiding them behind a dropdown that requires an extra tap.
- **Toggle tokens for large lists.** For long option lists (tags, categories, filters), use tappable toggle chips/tokens instead of checkboxes in a long vertical list — they're scannable and compact.
- **Search + scroll together.** Any searchable list should also remain scrollable — don't force the user to search; let them browse manually too.

## Buttons & CTAs

- **One primary button per action/screen.** Multiple competing primary-styled buttons create decision paralysis. Pick one primary action; everything else is secondary/tertiary styled.
- **Actionable, specific button text.** Avoid vague labels like "Submit" or "OK." Say what will happen: "Save Changes," "Send Invite," "Start Free Trial."
- **Keep the CTA thumb-reachable.** On mobile, place the primary action within easy thumb range (generally lower half of the screen) rather than top-right, which requires an awkward reach.

## Visual Design

- **Limit saturation, especially in dark mode.** Highly saturated colors vibrate and cause eye strain on dark backgrounds. Prefer desaturated/muted tones for dark-mode surfaces and accents.
- **Decrease inner-element corner radius relative to its container.** Nested elements should have a smaller border-radius than their parent container (e.g. an 8px-radius card holding a 4px-radius button) — matching or exceeding the parent's radius looks visually off.
- **Keep the style consistent.** Spacing units, corner radii, color usage, typography scale, and iconography style should all follow one consistent system throughout — don't mix design languages within a single product.

## Layout & Spacing

- **Prioritize important information.** Visually establish hierarchy — size, weight, position, and contrast should draw the eye to what matters most first; don't give every element equal visual weight.
- **Group related items with proximity.** Tighter spacing between related fields/elements and looser spacing between unrelated groups makes grouping legible at a glance (Gestalt proximity principle).
- **Consistent grid gaps.** Use a fixed spacing scale (e.g. 4/8/16/24/32px) for gutters and gaps across a grid — inconsistent gaps make a layout feel unpolished even if individual elements are fine.

## Content Display

- **"Read More" for long text.** Truncate long blocks of text (reviews, descriptions, comments) with a "Read More" expansion rather than dumping the full block, to keep scannability high.

## How to apply this

When designing a new UI:
1. Sketch the layout with hierarchy in mind (prioritize section) before styling.
2. Pick field types and matching input methods/masks for every form input.
3. Choose loading states (skeleton) and empty/error states up front.
4. Audit for exactly one primary CTA per screen, positioned for thumb reach on mobile.
5. Apply the spacing/radius/saturation rules as a final polish pass.

When reviewing an existing UI, walk each section above as a checklist and flag violations concretely (e.g. "the phone field has no input mask" rather than just "improve the form").

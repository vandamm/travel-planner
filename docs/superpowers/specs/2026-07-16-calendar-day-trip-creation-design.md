# Calendar day trip creation

## Interaction

Each empty, in-month calendar day reveals a square `[ + ]` control on hover or keyboard focus. The control fills the day cell. Dates that already contain a trip and dates outside the month keep their current behavior.

Activating the control opens the existing **Plan new trip** modal. The selected date fills both Start and End, creating a one-day trip draft. Closing the modal returns to the calendar without changing data.

## Accessibility

The overlay is a button named `Plan trip starting <date>`. Keyboard focus reveals the same full-cell treatment as pointer hover. The date number remains available to assistive technology.

## Implementation

`Month` receives an `onAddTrip(date)` callback from `HomeShell`. Empty dates render the button overlay; occupied dates retain their trip links. `HomeShell` passes the selected date to the existing `NewTripModal`, which already initializes both date fields from one date.

## Tests

- An empty date exposes the add-trip button.
- A trip date does not expose the button.
- Activating the button opens the modal with Start and End set to the selected date.

# ADR 0004: Phase 3 Design System Decision (Figma-First Waiver)

- Status: accepted
- Date: 2026-02-28

## Context
The original Phase 3 direction required a Figma-first design-system handoff before Wave 1 redo implementation. In this release cycle, implementation progressed via a code-first track to maintain delivery velocity and preserve release safety on a live system.

Without an explicit decision record, internal docs can conflict:
- some docs enforce Figma-first as a hard gate
- actual implementation and QA evidence are code-first

## Decision
Adopt a documented code-first waiver for Phase 3 in this release window.

Rules:
1. Figma-first remains the default preferred mode.
2. Code-first is allowed only when this ADR is accepted and referenced in release artifacts.
3. Code-first path must still satisfy:
- token consistency
- component reuse/ownership mapping
- responsive evidence (desktop/tablet/mobile)
- accessibility and rollback expectations
4. No backend contract changes are allowed under this waiver.

## Consequences
Positive:
- Aligns documented process with actual delivery mode
- Avoids blocking release on missing Figma artifacts
- Preserves quality gates through alternate evidence requirements

Tradeoffs:
- Reduced direct design-source traceability versus Figma-first
- Stronger dependence on disciplined UI evidence capture and review

## Exit and Revisit
This waiver applies to the current release cycle and should be revisited when:
1. new major route families are redesigned, or
2. dedicated design-system governance is reinstated.

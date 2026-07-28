# FR-1: API key gate

| Field | Value |
|---|---|
| Parent | [PRD](./index.md) |
| Priority | P0 |
| Status | Draft |
| Implementation | Built, partially verified - 8 of 22 scenarios automated |
| Depends on | None |
| Tests | [FR-1 test plan](../../tests/chiri/fr-1.md) |

## Summary

Chiri requires the user's own OpenRouter API key, entered at runtime in a modal, and validates it with a live call to OpenRouter before unblocking the app.
No key ships in the build, the key is stored only on the user's machine, and the app sends it nowhere except OpenRouter.
Until a key is confirmed valid, the editor is not reachable.

## User Stories

As a first-time user, I want to paste my OpenRouter key and be told immediately whether it works, so that I do not discover a bad key three paragraphs into writing.

As a privacy-conscious user, I want to know where my key goes before I paste it, so that I can decide whether to trust this app with a credential that costs me money.

As a returning user, I want the app to remember my key, so that entering it is a one-time cost rather than a per-session ritual.

As a user whose key stopped working, I want the app to tell me and let me fix it without losing my document, so that a revoked credential is an inconvenience and not a data loss event.

## Behavior

The application has exactly two top-level states with respect to the key: blocked and unblocked.
The app is unblocked only while a key that has been confirmed valid is present.
In the blocked state the editor is not reachable, not visible behind the modal in an interactive form, and no document edits are possible.

### Gate states

| State | Entered when | User can do | Exits to |
|---|---|---|---|
| Blocked, empty | App loads with no stored key | Enter a key, read where the key goes | Validating |
| Validating | User submits a key | Cancel the attempt | Unblocked, or Blocked with error |
| Blocked, error | Validation returns anything other than confirmed-valid | Correct the key and resubmit | Validating |
| Unblocked | Validation confirms the key | Everything in FR-3 onward | Blocked, revoked |
| Blocked, revoked | Provider rejects the stored key during a later request | Enter a new key | Validating |

### Validation

Validation is a live request to OpenRouter made at submit time using the entered key.
A key is treated as valid only on a confirmed successful authenticated response.
Every other outcome, including a malformed key, a rejected key, a network failure, and an ambiguous response, leaves the app blocked.
The failure message distinguishes at minimum three causes: the key was rejected, the key was accepted but the account cannot make requests, and the check could not be completed.
These are distinguished because the user's next action differs in each case, and a single generic failure would send them to the wrong fix.

### Storage and transmission

The key is written to browser-local storage on the user's machine only after it validates.
The key is sent only to OpenRouter and to no other destination, and it never appears in logs, error reports, or the URL, per NFR-3.
Chiri has no backend and collects no analytics, so OpenRouter is the only network destination the key can reach.
The gate states, in the interface, where the key is stored and where it is sent, before the user submits.

### Clearing

The user can clear the stored key from within the app at any time.
Clearing removes the key from local storage and returns the app to the blocked, empty state.
Clearing the key does not delete the document, because the key and the document are independent and losing work is not an acceptable price for rotating a credential.

### Revocation mid-session

If OpenRouter rejects the stored key during any later request, the app discards the stored key and returns to the blocked, revoked state.
The document is preserved in full, including any unsaved-to-storage recent edits, and is restored intact when a new valid key is entered.
Any continuation or pending revision on screen is discarded on entering the blocked state, because AI output the user did not accept is not part of the document.

## Acceptance Criteria

AC-1.1 Given no stored key, when the app finishes launching, then the key modal is presented and the editor cannot receive input.
AC-1.2 Given the key modal is presented, when the user reads it before submitting, then it states that the key is stored on this device and sent only to OpenRouter.
AC-1.3 Given a valid OpenRouter key, when the user submits it, then a live request is made to OpenRouter and the app unblocks to the editor within 10 seconds of a successful response.
AC-1.4 Given an invalid or rejected key, when the user submits it, then the app remains blocked, the editor is not reachable, and a message identifies the key as rejected.
AC-1.5 Given a key submitted while the network is unavailable, when validation cannot complete, then the app remains blocked and the message identifies the check as incomplete rather than the key as invalid.
AC-1.6 Given a key that authenticates but whose account cannot make requests, when the user submits it, then the app remains blocked and the message names the account condition rather than reporting a rejected key.
AC-1.7 Given a validation request is in flight, when the user cancels, then the request is abandoned and the app returns to the blocked, empty state with the entered value retained for editing.
AC-1.8 Given a previously validated key, when the user reloads the page, then the app unblocks without presenting the modal.
AC-1.9 Given a stored key, when the user clears it, then the modal is presented, the key is absent from local storage, and the document content is unchanged when a new key is validated.
AC-1.10 Given OpenRouter rejects the stored key during a later request, when the rejection is received, then the app returns to the blocked state, the stored key is removed, and the document is intact after a new key validates.
AC-1.11 Given any point in the key flow, when outbound network traffic is inspected, then the only destination the key is sent to is OpenRouter, and no error report or log line contains the key or any substring of it.
AC-1.12 Given the key modal is presented, when the user operates it with the keyboard only, then they can enter, submit, cancel, and read every message without a pointer, per NFR-6.

## Edge Cases and Error States

| Condition | Expected behavior | Criterion |
|---|---|---|
| Key field empty on submit | Submit is not accepted and no request is made | AC-1.4 |
| Key with leading or trailing whitespace | Whitespace is trimmed before validation and the key validates normally | AC-1.3 |
| Key rejected by provider | Blocked with a rejected-key message | AC-1.4 |
| Network failure during validation | Blocked with an incomplete-check message, distinct from rejection | AC-1.5 |
| Key valid but account has no credit or is restricted | Blocked with an account-condition message | AC-1.6 |
| Provider rate-limits the validation request | Treated as an incomplete check, retry available | AC-1.5 |
| Validation cancelled by the user mid-flight | Request abandoned, entered value retained | AC-1.7 |
| Stored key rejected mid-session | Return to blocked, key discarded, document preserved | AC-1.10 |
| Local storage unavailable or write-blocked | App still unblocks for this session, and warns that the key will not persist | AC-1.8 does not apply, session continues |

## Open Questions

Q1-a Does the gate offer a link out to where an OpenRouter key is obtained, or assume the user arrives holding one.
The evaluator arrives holding one, but a wider audience may not, and this changes the modal's content.

Q1-b If local storage is unavailable, does the app run for the session with an in-memory key or refuse to run at all.
This PRD assumes it runs and warns, and that call should be confirmed.

Both are scoped to this requirement and neither blocks other work.

# Test Review Guidelines

This document defines how tests in this project should be written and reviewed.

These rules apply to:
- Manual code reviews
- AI-assisted reviews
- Pull Request discussions

The goal is:
- Reliable tests
- Predictable CI behavior
- Clear intent
- Consistent use of the framework

---

## 1. Framework Usage Rules

- Tests must NOT use raw Playwright APIs directly (page.locator, page.click, etc.).
- All UI interactions must go through framework abstractions (POMs, managers, helpers).
- Tests must not reimplement waits, retries, or selectors.
- If a required capability is missing, tests should FAIL clearly rather than hack around it.

---

## 2. Test Stability & Flakiness

- Avoid waitForTimeout, sleep, or hard-coded delays.
- Avoid force clicks unless explicitly justified in a comment.
- Tests must not depend on execution order.
- Tests must clean up any state they create.
- Tests should be deterministic and repeatable.

---

## 3. Async & Concurrency Rules

- All async operations must be awaited.
- Do not use async functions inside Array.forEach.
- Avoid shared mutable state across tests.
- Be aware of Playwright parallel execution and worker isolation.

---

## 4. Readability & Intent

- Each test should have a single clear intent.
- Test names must describe behavior, not implementation.
- Avoid magic values; prefer named constants or helper methods.
- Tests should read like a scenario, not a script.

---

## 5. Assertions

- Assertions should validate observable behavior, not internal state.
- Avoid asserting intermediate UI states unless required.
- Prefer fewer meaningful assertions over many shallow ones.

---

## 6. Logging & Debuggability

- Tests should produce enough logs to debug failures in CI.
- A failed test should be understandable without re-running locally.
- Avoid silent failures or swallowed errors.

---

## 7. Out of Scope for Test Review

The following topics are intentionally out of scope:
- Framework architecture changes
- Framework performance optimizations
- Refactoring framework internals
- Redesigning APIs

If a test exposes a framework limitation:
- Document it as feedback
- Do NOT attempt to work around it in the test

---

## 8. Reference Example (For Orientation Only)

The following is an example of a well-written test.
It is provided for REFERENCE ONLY.

- This is NOT a template.
- Tests do NOT need to look identical.
- Focus on intent, clarity, and framework usage.

```ts
test("user can select a value from dropdown", async ({ app }) => {
  const settings = app.settingsPage;

  await settings.open();
  await settings.selectCurrency("USD");

  await expect(settings.selectedCurrency).toBe("USD");
});

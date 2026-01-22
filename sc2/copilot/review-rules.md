# Review Rules (Test Files Only)

## ❌ Absolute Violations
- Modifying or suggesting framework changes
- Referencing code outside this file
- Assuming behavior from other files

---

## ❌ Comment Anti-patterns
- Comment claims wait, but no wait exists
- Comment says "safe" but unsafe action used
- Comment describes UI state not asserted

---

## ❌ Code Anti-patterns
- page.locator()
- page.waitForTimeout()
- force: true without explanation
- nth() on dynamic UI

---

## ✅ Expectations
- Intent-driven comments
- One scenario per test
- Framework abstractions preferred

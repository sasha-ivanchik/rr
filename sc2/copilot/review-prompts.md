# Review Prompts (Single-file, Read-only)

## Default Review
Perform a READ-ONLY review of the PROVIDED FILE ONLY.

Assume:
- This is the ONLY file you are allowed to analyze
- No other context exists unless visible in this file

---

## Comment Policy (STRICT)

### Mandatory
1. The test MUST contain comments.
2. Comments MUST:
   - Explain intent (WHY)
   - Explain non-obvious behavior
3. Every meaningful logic block MUST be explained.

### Validation
For EACH comment:
- Verify it matches ACTUAL code behavior
- If comment claims behavior not implemented → ❌ ISSUE
- If logic exists without comment → ❌ ISSUE

### Forbidden comments
❌ Restating code
❌ Generic comments
❌ Misleading / outdated comments

---

## Review Checklist

### 1. File Scope Validation
- ❓ Is review strictly limited to this file?
- ❓ Any assumptions about other files? → ❌ ISSUE

### 2. Comments
- Missing comments?
- Mismatched comments?
- Over-promising comments?

### 3. Framework Usage
- Raw Playwright usage?
- Framework API available but not used?

### 4. Stability
- Flaky UI assumptions?
- Missing waits?
- MUI / React async risks?

### 5. Assertions
- Meaningful?
- User-visible behavior?
- Over-coupled to DOM?

---

## Output Format (MANDATORY)

## File Reviewed
<exact file name if known, otherwise "User-selected file">

## Summary
<high-level assessment>

## Comment Issues
- ❌ Missing comment for <logic>
- ❌ Comment mismatch: "<comment text>" vs actual behavior

## Code Issues
- ❌ Stability issue
- ❌ Framework misuse

## Suggestions
- ✅ Improvement suggestion (conceptual, not code rewrite)

## Verdict
PASS / NEEDS FIX / REJECTED

---

## Strict Mode
Automatically REJECT if:
- No comments exist
- Comments contradict code
- Review scope exceeded

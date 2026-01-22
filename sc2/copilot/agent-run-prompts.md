# Agent Run Prompts
This file contains READY-TO-USE prompts for launching the Code Review Agent.
All prompts assume READ-ONLY, SINGLE-FILE scope.

--------------------------------------------------
BASIC REVIEW (Soft)
--------------------------------------------------

Review the selected file only.

Rules:
- Read-only
- Do not modify code
- Do not refactor
- Do not reference other files
- Focus on general quality, comments, and clarity

Output:
Structured review only.

--------------------------------------------------
STANDARD REVIEW (Recommended)
--------------------------------------------------

Review the selected file only.

Constraints:
- READ-ONLY
- Single file scope
- No framework changes
- No refactoring suggestions

Focus on:
- Correct usage of framework APIs
- Test stability and flakiness risks
- Assertions quality
- Presence and correctness of comments

Validate that:
- Comments exist
- Comments accurately describe code behavior

Use the standard output format.
Provide clear issues and actionable suggestions.

--------------------------------------------------
STRICT REVIEW (Gatekeeper mode)
--------------------------------------------------

Perform a STRICT, READ-ONLY review of the selected file only.

Hard rules:
- Reject if comments are missing
- Reject if comments contradict code
- Reject if raw Playwright is used where framework API exists
- Reject if test intent is unclear

Assumptions:
- This file is the ONLY source of truth
- No external context is allowed

Result:
- List all violations
- Provide verdict: PASS / NEEDS FIX / REJECTED

--------------------------------------------------
COMMENTS-ONLY REVIEW
--------------------------------------------------

Review COMMENTS ONLY in the selected file.

Check:
- Are comments present?
- Do comments explain intent (WHY)?
- Do comments match actual code behavior?
- Are there misleading or outdated comments?

Do NOT:
- Review framework usage
- Review assertions unless comment-related

Output:
- Comment issues only
- Verdict

--------------------------------------------------
FLAKINESS-FOCUSED REVIEW
--------------------------------------------------

Review the selected file only with focus on FLAKINESS.

Analyze:
- UI timing assumptions
- Missing waits
- React / MUI async behavior
- Virtualized lists
- Unsafe interactions

Ignore:
- Styling
- Minor readability issues

Do not suggest refactors.
Only point out instability risks and mitigations using existing framework APIs.

--------------------------------------------------
FRAMEWORK-COMPLIANCE REVIEW
--------------------------------------------------

Review the selected file only.

Goal:
Ensure strict compliance with the custom automation framework.

Rules:
- Raw Playwright usage is NOT allowed if framework API exists
- Framework abstractions must be used consistently

Output:
- List violations
- Suggest correct framework-level usage (conceptual, no code rewrite)

--------------------------------------------------
FINAL VERDICT MODE
--------------------------------------------------

Run a FINAL GATE review of the selected file.

Conditions for PASS:
- Comments exist and are accurate
- No framework misuse
- No obvious flakiness risks
- Clear test intent
- Meaningful assertions

If any condition fails:
→ Verdict = REJECTED

Keep feedback concise and decisive.

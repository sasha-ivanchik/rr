# Copilot Usage Guide for Testers (Playwright + TypeScript Framework)

This document explains how to use GitHub Copilot effectively when writing or extending tests in our Playwright TypeScript framework.

---

## 1. General Workflow

1. **Open the Right Files**  
   - Keep the framework helper files (API, utilities, BasePage, UI managers, etc.) open in your editor.  
   - Keep at least one existing test open as a reference.  
   - Copilot provides better suggestions when it "sees" relevant code.

2. **Always Add Step Comments Before Writing Code**  
   - Describe the test case logic in numbered steps:  

     ```ts
     // Step 1: Open login page
     // Step 2: Enter username and password
     // Step 3: Click login button
     // Step 4: Verify user is redirected to dashboard
     ```

   - This helps Copilot generate meaningful code aligned with your plan.  

3. **Use Docstrings and Instructions**  
   - Our methods have detailed docstrings.  
   - Read them before using a method — Copilot suggestions will respect available parameters.  

---

## 2. Best Practices for Prompting Copilot

- **Start small**: Write one step (comment) at a time, then trigger Copilot.  
- **Be specific**: Use exact names of methods or locators from the framework.  
- **Leverage examples**: Copy structure from an existing test and adapt it.  
- **Accept / edit / retry**: If the suggestion is wrong, reject and rewrite the step comment more clearly.  

---

## 3. Writing a New Test

Example workflow:

```ts
test('User can log in successfully', async ({ page }) => {
  // Step 1: Navigate to login page
  // Step 2: Fill in username and password
  // Step 3: Submit login form
  // Step 4: Assert dashboard is visible
});
```

- After writing these comments, let Copilot propose the implementation.
- Verify that generated code uses **framework methods** (not raw Playwright calls).
- If Copilot suggests raw Playwright code, replace it with our framework API.

---

## 4. Debugging with Copilot

- Use Copilot inline to **refactor repetitive code** into helper functions.  
- Ask Copilot to **generate variations** (e.g., login with invalid credentials).  
- Use Copilot to suggest **assertions** based on UI state.  

---

## 5. Pitfalls to Avoid

- ❌ Don’t accept raw Playwright locators unless explicitly required.  
- ❌ Don’t rely on Copilot for test logic planning — always outline steps first.  
- ❌ Don’t forget to check generated code against our style and framework conventions.  

---

## 6. Summary

✅ Write steps as comments before code.  
✅ Use framework methods, not raw Playwright.  
✅ Keep helper files + test examples open.  
✅ Iterate: refine comments → regenerate suggestions if needed.  

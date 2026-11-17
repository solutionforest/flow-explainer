# What the sign-in feature must do

```mermaid
requirementDiagram
    requirement sign_in {
        id: 1
        text: Customers can sign in with email and a code
        risk: high
        verifymethod: test
    }
    functionalRequirement code_expiry {
        id: 1.1
        text: A sign-in code stops working after 10 minutes
        risk: medium
        verifymethod: test
    }
    performanceRequirement fast_email {
        id: 1.2
        text: The code email arrives within 30 seconds
        risk: low
        verifymethod: demonstration
    }
    element login_page {
        type: web page
    }
    element login_tests {
        type: automated tests
    }
    sign_in - contains -> code_expiry
    sign_in - contains -> fast_email
    login_page - satisfies -> sign_in
    login_tests - verifies -> code_expiry
```

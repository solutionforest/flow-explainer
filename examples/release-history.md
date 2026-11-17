# How the checkout feature was built

The new checkout was built on its own copy of the code, then merged back once it was ready.

```mermaid
gitGraph
    commit id: "Start project"
    commit id: "Add home page"
    branch checkout
    checkout checkout
    commit id: "Build checkout"
    commit id: "Fix card bug"
    checkout main
    commit id: "Update prices"
    merge checkout id: "Release checkout" tag: "v1.0"
    commit id: "Small text fix"
```

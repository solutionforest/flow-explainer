# Website launch plan

```mermaid
gantt
    title Website launch plan
    dateFormat YYYY-MM-DD
    section Design
    Wireframes      :done, w1, 2026-01-05, 5d
    Visual design   :active, v1, after w1, 2w
    section Build
    Front end       :f1, after v1, 10d
    Back end        :b1, 2026-01-12, 3w
    Testing         :crit, t1, after f1 b1, 5d
    section Launch
    Go live         :milestone, after t1, 0d
```

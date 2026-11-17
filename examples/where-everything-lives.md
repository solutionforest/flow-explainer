# Where everything lives

```mermaid
flowchart LR
  subgraph Customer side
    B[Browser]
    M[Mobile App]
  end
  subgraph Our system
    G[API Gateway]
    O[Order Service]
    Q[Job Queue]
    DB[(Database)]
  end
  subgraph Outside partners
    P[Stripe Payments]
    E[Email Provider]
  end
  B --> G
  M --> G
  G --> O
  O --> DB
  O --> P
  O -.-> Q
  Q -.-> E
```

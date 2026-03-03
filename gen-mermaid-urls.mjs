const diagrams = {
  hero: `graph LR
    A["Tab A\\n👑 Leader"] <-->|"realtime sync"| B["Tab B\\nFollower"]
    B <-->|"realtime sync"| C["Tab C\\nFollower"]
    A <-->|"realtime sync"| C
    style A fill:#4f46e5,stroke:#4338ca,color:#fff,stroke-width:2px
    style B fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px
    style C fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px`,

  middleware: `graph LR
    A["set(age, -5)"] --> B{Middleware Pipeline}
    B -->|"age < 0 reject"| C["Blocked"]
    D["set(name, Alice)"] --> B
    B -->|"trim"| E["Alice"]
    style A fill:#f59e0b,stroke:#d97706,color:#fff
    style D fill:#f59e0b,stroke:#d97706,color:#fff
    style B fill:#6366f1,stroke:#4f46e5,color:#fff
    style C fill:#ef4444,stroke:#dc2626,color:#fff
    style E fill:#22c55e,stroke:#16a34a,color:#fff`,

  architecture: `graph TB
    subgraph API["Public API - createTabSync"]
        SM["State Manager"]
        LE["Leader Election"]
        RPC["RPC Handler"]
    end
    subgraph CORE["Core Layer"]
        TR["Tab Registry"]
        MW["Middleware Pipeline"]
    end
    subgraph TRANSPORT["Transport Layer"]
        BC["BroadcastChannel"]
        LS["localStorage"]
    end
    SM --> TR
    LE --> TR
    RPC --> TR
    TR --> MW
    MW --> BC
    MW --> LS
    style API fill:#4f46e5,stroke:#4338ca,color:#fff,stroke-width:2px
    style CORE fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
    style TRANSPORT fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px`,

  stateSync: `sequenceDiagram
    participant A as Tab A Leader
    participant BC as BroadcastChannel
    participant B as Tab B
    participant C as Tab C
    A->>A: set theme dark
    Note over A: Local state updated
    A->>BC: STATE_UPDATE
    BC-->>B: message
    BC-->>C: message
    B->>B: Apply + notify
    C->>C: Apply + notify`,

  leaderElection: `sequenceDiagram
    participant A as Tab A oldest
    participant B as Tab B
    participant C as Tab C newest
    Note over A,C: Leader Tab A closes
    B->>B: 3 missed heartbeats
    B->>C: LEADER_CLAIM
    C->>C: Tab B is older yield
    Note over B: Wait 300ms
    B->>C: LEADER_ACK
    Note over B: Tab B is now leader
    B->>C: LEADER_HEARTBEAT`,

  websocket: `graph LR
    Server["Server"] <-->|WebSocket| A["Tab A Leader"]
    A -->|state sync| B["Tab B"]
    A -->|state sync| C["Tab C"]
    style Server fill:#059669,stroke:#047857,color:#fff
    style A fill:#4f46e5,stroke:#4338ca,color:#fff
    style B fill:#6366f1,stroke:#4f46e5,color:#fff
    style C fill:#6366f1,stroke:#4f46e5,color:#fff`
};

for (const [name, code] of Object.entries(diagrams)) {
  const encoded = Buffer.from(code).toString('base64url');
  console.log(`${name}:`);
  console.log(`  https://mermaid.ink/img/${encoded}?theme=dark&bgColor=0d1117`);
  console.log();
}

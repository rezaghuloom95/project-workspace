# Permission System

Permission checks belong in server code. Interface controls are a convenience, never the security boundary. Every API operation first resolves the authenticated member and organisation, then verifies the required capability.

| Capability | Club admin | Marketing manager | Media officer | Contributor / videographer | Designer / creator | Viewer / management |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| View calendar and reports | ✓ | ✓ | ✓ | Assigned | Assigned | ✓ |
| Create events | ✓ | ✓ | ✓ | — | — | — |
| Edit all events | ✓ | ✓ | ✓ | — | — | — |
| Delete/archive events | ✓ | — | — | — | — | — |
| Assign members | ✓ | ✓ | ✓ | — | — | — |
| Manage campaign/content | ✓ | ✓ | ✓ | — | Assigned | — |
| Approve content | ✓ | ✓ | Optional | — | — | — |
| Update assigned work | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Confirm attendance/status | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Edit shot/equipment lists | ✓ | ✓ | ✓ | Assigned | — | — |
| Manage team/settings | ✓ | — | — | — | — | — |
| View activity log | ✓ | ✓ | ✓ | Related | Related | Summary |

The API capability map lives beside the worker handlers so a new endpoint cannot accidentally rely on a hidden button. Organisation IDs supplied by a client are ignored; the server derives organisation scope from membership.

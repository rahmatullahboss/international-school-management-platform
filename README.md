# International School Management Platform

Public planning and implementation repository for an international, multi-tenant K–12 Student Information System and School ERP.

## Start here

- [Documentation index](docs/README.md)
- [Foundation one-shot agent prompt](docs/execution/FND-01-ONE-SHOT-PROMPT.md)
- [Whole-module execution system](docs/execution/README.md)
- [Product and architecture summary](docs/01-executive-summary.md)

## Architecture baseline

- Cloudflare Workers and related edge services
- Neon Serverless PostgreSQL through `@neondatabase/serverless`
- Domain-oriented modular monolith
- One complete large module per agent/branch/worktree/Neon branch
- International country/curriculum packs
- Finance-grade immutable double-entry accounting

## Repository status

The repository currently contains the approved research, architecture and multi-agent execution baseline. Implementation begins with the `FND-01` foundation stream.

## Licensing

This repository is publicly visible, but no open-source license grant is implied. See [LICENSE](LICENSE). Third-party components used later must follow the documented provenance, SBOM and license-review process.

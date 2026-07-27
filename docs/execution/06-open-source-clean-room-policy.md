# Open-Source Clean-Room and Reuse Policy

## 1. Direct answer

এই proprietary TypeScript/Cloudflare product-এর core-এ Frappe Education, ERPNext, Gibbon বা openSIS-এর source সরাসরি copy করা defaultভাবে অনুমোদিত নয়। এগুলোর workflow, public documentation, terminology, user journey, edge cases এবং domain concepts গবেষণা করে নিজের specification ও original implementation তৈরি করা যাবে।

OpenEduCat Community Edition LGPL হওয়ায় কিছু isolated library/component reuse সম্ভব হতে পারে, কিন্তু Odoo module combination, modified files, bundled assets এবং dependencies file-by-file review ছাড়া copy করা যাবে না।

This document is an engineering policy, not legal advice.

## 2. License decision matrix

| Category | Default decision | Required action |
|---|---|---|
| MIT / BSD / Apache-2.0 | Allowed with review | Preserve notices, record exact version/commit, add SBOM and attribution |
| LGPL | Conditional | Keep component replaceable/isolated, provide required notices/source/relinking compliance, review combined-work obligations |
| GPL | Reference-only for proprietary core | Do not copy/translate/combine source without written product/legal decision; separate service use requires architecture and license review |
| AGPL | Prohibited by default in proprietary hosted core | Network-source obligations require explicit open-source product strategy and legal approval |
| No license | Prohibited | Public visibility is not permission to reproduce, modify or distribute |
| Proprietary competitor | Prohibited | Use only public product research; never copy source, assets, screens or confidential materials |

## 3. Approved research outputs

A research owner may create original internal documents containing:

- feature and workflow descriptions in original words;
- actors, permissions, inputs, outputs and state transitions;
- domain glossary and conceptual entity relationships;
- identified usability problems and product gaps;
- independently designed acceptance tests and edge cases;
- migration mappings based on customer-owned exports/public formats;
- public standard mappings such as OneRoster/LTI;
- comparative decision tables without copied code or protected assets.

## 4. Prohibited research outputs

- pasted source files or substantial fragments;
- line-by-line translations into another language/framework;
- copied comments, internal identifiers or function/class structures;
- copied database DDL or migrations without license approval;
- copied icons, images, translations, templates or sample data without their own license review;
- pixel-identical screen reproduction;
- instructions telling an implementation agent where to find and port exact GPL source.

## 5. Clean-room roles

### Research/specification role

- May inspect approved public documentation, product behavior and repositories for license classification.
- Records source provenance and license.
- Produces original behavior/specification documents.
- Does not place source code into implementation prompts or the product repository.

### Implementation role

- Receives approved internal specifications, public standards and approved dependencies.
- Writes original TypeScript, SQL and UI code.
- Does not inspect restricted GPL/AGPL source while implementing the corresponding module when clean-room separation is required.
- Records every third-party dependency and copied permissive snippet.

### Review role

- Compares implementation against internal requirements, not against the original GPL source structure.
- Scans for copied comments, unusual identifiers, assets and source fragments.
- Verifies notices, SBOM, dependency licenses and provenance records.

## 6. Component intake record

Before copying any source or asset, create an intake record containing:

```text
Component/project:
Canonical repository:
Exact commit/tag:
Exact files/assets:
SPDX license:
Copyright holders/notices:
Transitive dependencies and asset licenses:
Intended use: library / separate service / modified source / reference only
Distribution modes: hosted SaaS / browser bundle / mobile / on-premise / customer export
Modification plan:
Required source/notice/relinking obligations:
Security and maintenance assessment:
Architecture fit:
Decision and approver:
SBOM/THIRD_PARTY_NOTICES entry:
```

No record means no direct copying.

## 7. Project-specific classifications

### Frappe Education

- Repository-level license observed: GPLv3.
- Default: workflow and domain reference only.
- Do not port its source, doctypes, screens or server/client logic into proprietary core without a written GPL strategy.

### ERPNext

- Repository-level license observed: GPLv3.
- Default: accounting/ERP workflow reference and optional external integration target.
- Do not copy ledger, reports or modules into proprietary core by default.

### Gibbon

- Repository-level license observed: GPLv3.
- Default: UX/workflow/reference and migration-source research.
- Do not translate PHP module source into TypeScript.

### OpenEduCat Community

- Repository-level license observed: LGPL-3.0 for the community repository, with possible differing licenses in dependencies/assets/modules.
- Default: reference; isolated reuse only after file-level review.
- Odoo framework/module coupling must be assessed before assuming LGPL-library treatment.

### openSIS Classic

- Repository documentation indicates GNU GPL; exact version, canonical commit and file licenses must be confirmed.
- Default: reference only until the intake review passes.

### Frappe Framework

- The framework repository uses a permissive MIT license, but adopting the framework is a major stack decision and does not make GPL Frappe Education/ERPNext application code permissive.
- Default: do not adopt merely to copy school modules; evaluate only through a separate architecture decision.

## 8. SaaS and distribution warning

Ordinary GPL network use may differ from distribution, but this does not make GPL code equivalent to permissive code. The product may later ship browser JavaScript, mobile applications, dedicated/on-premise installations, customer-specific distributions or combined binaries/packages. Therefore the proprietary core uses the conservative reference-only default unless counsel approves a specific model.

AGPL is stricter for network interaction and is prohibited by default.

## 9. Enforcement in agent streams

Every agent prompt includes the clean-room rule. A module agent that discovers useful restricted source must:

1. stop copying immediately;
2. record the project, license and desired behavior;
3. create an original requirement/acceptance-test description without source fragments;
4. request review if direct reuse is still proposed;
5. continue only with approved specifications or approved dependencies.

A violation blocks integration until copied material is removed or licensing is formally resolved.

## 10. Required repository artifacts after foundation

- `THIRD_PARTY_NOTICES`
- machine-readable SBOM
- dependency license report
- `docs/provenance/` intake and research-source records
- CI gate for denied licenses and unlicensed packages
- code-review checklist for copied snippets/assets

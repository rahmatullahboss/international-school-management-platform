# Guided web walkthrough v1

## Purpose

Provide a role-aware, permission-preserving product walkthrough after a user enters a signed-in web workspace so a first-time user can understand where tasks live and how to move through the system without external training.

## Scope

- automatic first-run walkthrough for Admin, Teacher, Guardian, Student, Admissions, Finance/Cashier and Platform/Support workspaces;
- role-specific explanations for every published core navigation area;
- operator walkthroughs bounded to their scoped workspace surfaces;
- persistent per-role completion state stored only in browser local storage;
- an always-available **Show walkthrough** launcher so users can restart training;
- keyboard Escape dismissal and Back/Next/Finish controls;
- target highlighting without changing authorization, navigation visibility or server scope;
- missing or capability-filtered targets are skipped rather than invented.

## Security and authority boundary

The walkthrough is presentation-only. It does not grant capabilities, create routes, alter tenant/campus/persona scope, submit mutations, bypass step-up authentication or expose hidden navigation. It can only point at elements already rendered for the current authorised role.

## Verification

- unit coverage verifies role/path mapping, versioned completion keys and published navigation coverage;
- Playwright verifies first-run automatic display for all seven principal personas, governed Admin module guidance, completion persistence, restart and keyboard dismissal;
- canonical repository CI remains the release gate before merge.

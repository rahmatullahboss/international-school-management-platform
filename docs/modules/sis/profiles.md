# SIS Student and Staff Profiles

Student and staff profiles are role records linked to a person, not replacements for the person master. The module stores effective status history, tenant-unique profile identifiers, secure document references and explicit access effects derived from lifecycle status.

Student statuses are prospective, active, leave, withdrawn, graduated and alumni. Staff profile statuses are active, leave, inactive and terminated. Every transition closes the prior effective period and appends a new history entry.

Access effects are deterministic: active profiles retain interactive and operational access; leave/prospective profiles are paused or suspended; withdrawn, graduated, alumni, inactive and terminated profiles retain historical records but lose active operational access.

Migration `202607280102_SIS-01_profiles` creates seven forced-RLS tables in `student_lifecycle`. Synthetic Neon proof showed zero rows without tenant context and Tenant A saw one own profile with zero foreign rows.

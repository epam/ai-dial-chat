## Implementation

- [x] 1. Configure count and archive limits for writes and snapshot reads. Cover boundary cases.
- [x] 2. Publish the count through client-config, regenerate the SDK and validate both project forms.
- [x] 3. Document deployment settings and run the regression checks.
- [x] 4. Check file-manager quotas before downloading and enforce actual byte limits during downloads.
- [x] 5. Size multipart name fields for the configured count and test the boundary above 1 MiB.
- [x] 6. Document snapshot slot and buffer lifetimes, sync the specs and verify the changes.

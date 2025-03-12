# `ENABLED_FEATURES` and `ENABLED_FEATURES_ROLES` environment variables

## Description

Our application uses the `ENABLED_FEATURES` required parameter to control which features are enabled in the system. This parameter accepts a comma-separated list of feature identifiers (see [Features](../libs/shared/src/types/features.ts)).

The optional environment variable `ENABLED_FEATURES_ROLES` maps specific features to the roles required to access them. This provides granular control over feature access based on user roles.

### Configuration Format

The `ENABLED_FEATURES_ROLES` parameter accepts a JSON object where:

- Keys represent feature identifiers (matching those in `ENABLED_FEATURES`)
- Values represent the roles required to access that feature (string array of roles or comma-separated list of roles)

#### Supported Formats

The parameter supports the following formats into `.env`:

- **JSON Object Format**:

```env
ENABLED_FEATURES_ROLES: {"code-apps":["code-app-developer", "admin"],"marketplace-table-view":["quick-app-developer"],"message-templates":["admin"]}
```

- **Escaped JSON String Format**:

```env
ENABLED_FEATURES_ROLES: "{\"code-apps\":[\"code-app-developer\", \"admin\"],\"marketplace-table-view\":[\"quick-app-developer\"],\"message-templates\":[\"admin\"]}"
```

- **Multi-line Escaped JSON String Format**:

```env
ENABLED_FEATURES_ROLES: "{
  \"code-apps\":[\"code-app-developer\", \"admin\"],
  \"quick-apps\":[\"quick-app-developer\"],
  \"message-templates\": [\"admin\"]
}"
```

### Relationship with ENABLED_FEATURES

The `ENABLED_FEATURES_ROLES` parameter works in conjunction with the `ENABLED_FEATURES` parameter. For example:

```env
ENABLED_FEATURES="custom-applications,message-templates,marketplace,quick-apps,code-apps"
```

In this scenario:

- All features listed in `ENABLED_FEATURES` are enabled in the system
- Only users with the role `code-app-developer` or `admin` can access the `code-apps` feature
- Only users with the role `quick-app-developer` can access the `quick-apps` feature
- Only users with the role `admin` can access the `message-templates` feature
- All other enabled features will be accessible to all users (no role restriction)

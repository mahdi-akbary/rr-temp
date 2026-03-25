import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const METAOBJECT_TYPE = "customer_profile";

const FIELD_DEFS = [
  {
    key: "full_name",
    name: "Full name",
    type: "single_line_text_field",
  },
  {
    key: "email",
    name: "Email",
    type: "single_line_text_field",
  },
  {
    key: "loyalty_tier",
    name: "Loyalty tier",
    type: "single_line_text_field",
  },
  {
    key: "last_purchase",
    name: "Last purchase",
    type: "date",
  },
];

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const definitionResponse = await admin.graphql(
    `#graphql
      query MetaobjectDefinition($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
          name
          type
          fieldDefinitions {
            name
            key
            type {
              name
            }
          }
        }
      }`,
    { variables: { type: METAOBJECT_TYPE } },
  );

  const metaobjectsResponse = await admin.graphql(
    `#graphql
      query Metaobjects($type: String!) {
        metaobjects(first: 25, type: $type) {
          edges {
            node {
              id
              type
              handle
              fields {
                key
                value
                type
              }
            }
          }
        }
      }`,
    { variables: { type: METAOBJECT_TYPE } },
  );

  const definitionJson = await definitionResponse.json();
  const metaobjectsJson = await metaobjectsResponse.json();

  return {
    type: METAOBJECT_TYPE,
    definition: definitionJson.data.metaobjectDefinitionByType,
    metaobjects: metaobjectsJson.data.metaobjects.edges.map((edge) => edge.node),
  };
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40);

const getFieldValue = (event) => {
  if (!event) {
    return "";
  }
  if (event.detail && typeof event.detail.value !== "undefined") {
    return event.detail.value;
  }
  const target = event.target || event.currentTarget;
  if (target && typeof target.value !== "undefined") {
    return target.value;
  }
  return "";
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-definition") {
    const response = await admin.graphql(
      `#graphql
        mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition {
              id
              name
              type
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          definition: {
            name: "Customer profile",
            type: METAOBJECT_TYPE,
            fieldDefinitions: FIELD_DEFS.map((field) => ({
              name: field.name,
              key: field.key,
              type: field.type,
              required: false,
            })),
            access: {
              admin: "MERCHANT_READ_WRITE",
            },
          },
        },
      },
    );

    const json = await response.json();
    return {
      intent,
      errors: json.data.metaobjectDefinitionCreate.userErrors,
    };
  }

  if (intent === "create") {
    const fullName = formData.get("full_name") || "";
    const email = formData.get("email") || "";
    const handleSeed = fullName || email || `customer-${Date.now()}`;
    const response = await admin.graphql(
      `#graphql
        mutation MetaobjectCreate($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject {
              id
              handle
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          metaobject: {
            type: METAOBJECT_TYPE,
            handle: slugify(String(handleSeed)) || `customer-${Date.now()}`,
            fields: FIELD_DEFS.map((field) => ({
              key: field.key,
              value: formData.get(field.key) || "",
            })),
          },
        },
      },
    );

    const json = await response.json();
    return { intent, errors: json.data.metaobjectCreate.userErrors };
  }

  if (intent === "update") {
    const response = await admin.graphql(
      `#graphql
        mutation MetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            metaobject {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          id: formData.get("id"),
          metaobject: {
            fields: FIELD_DEFS.map((field) => ({
              key: field.key,
              value: formData.get(field.key) || "",
            })),
          },
        },
      },
    );

    const json = await response.json();
    return { intent, errors: json.data.metaobjectUpdate.userErrors };
  }

  if (intent === "delete") {
    const response = await admin.graphql(
      `#graphql
        mutation MetaobjectDelete($id: ID!) {
          metaobjectDelete(id: $id) {
            deletedId
            userErrors {
              field
              message
            }
          }
        }`,
      { variables: { id: formData.get("id") } },
    );

    const json = await response.json();
    return { intent, errors: json.data.metaobjectDelete.userErrors };
  }

  return { intent: "unknown", errors: [{ message: "Unknown action." }] };
};

export default function MetaobjectDashboard() {
  const { definition, metaobjects, type } = useLoaderData();
  const createFetcher = useFetcher();
  const updateFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const definitionFetcher = useFetcher();
  const createModalRef = useRef(null);
  const editModalRef = useRef(null);
  const deleteModalRef = useRef(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [createValues, setCreateValues] = useState({
    full_name: "",
    email: "",
    loyalty_tier: "",
    last_purchase: "",
  });
  const [editValues, setEditValues] = useState({
    full_name: "",
    email: "",
    loyalty_tier: "",
    last_purchase: "",
  });

  const rows = useMemo(
    () =>
      metaobjects.map((item) => {
        const fieldMap = item.fields.reduce((acc, field) => {
          acc[field.key] = field.value;
          return acc;
        }, {});
        return { ...item, fieldMap };
      }),
    [metaobjects],
  );

  const errors = [
    createFetcher.data?.errors,
    updateFetcher.data?.errors,
    deleteFetcher.data?.errors,
    definitionFetcher.data?.errors,
  ]
    .flat()
    .filter(Boolean);

  const submitCreate = () => {
    createFetcher.submit(
      {
        intent: "create",
        ...createValues,
      },
      { method: "post" },
    );
  };

  const submitUpdate = () => {
    if (!active) {
      return;
    }
    updateFetcher.submit(
      {
        intent: "update",
        id: active.id,
        ...editValues,
      },
      { method: "post" },
    );
  };

  const submitDelete = () => {
    if (!active) {
      return;
    }
    deleteFetcher.submit(
      {
        intent: "delete",
        id: active.id,
      },
      { method: "post" },
    );
  };

  const submitDefinition = () => {
    console.log("Create definition clicked");
    definitionFetcher.submit(
      { intent: "create-definition" },
      { method: "post" },
    );
  };

  useEffect(() => {
    if (!createModalRef.current) {
      return;
    }
    if (createOpen) {
      createModalRef.current.showOverlay();
    } else {
      createModalRef.current.hideOverlay();
    }
  }, [createOpen]);

  useEffect(() => {
    if (!editModalRef.current) {
      return;
    }
    if (editOpen && active) {
      editModalRef.current.showOverlay();
    } else {
      editModalRef.current.hideOverlay();
    }
  }, [editOpen, active]);

  useEffect(() => {
    if (!deleteModalRef.current) {
      return;
    }
    if (deleteOpen && active) {
      deleteModalRef.current.showOverlay();
    } else {
      deleteModalRef.current.hideOverlay();
    }
  }, [deleteOpen, active]);

  useEffect(() => {
    const modal = createModalRef.current;
    if (!modal) {
      return;
    }
    const handleHide = () => setCreateOpen(false);
    modal.addEventListener("hide", handleHide);
    return () => modal.removeEventListener("hide", handleHide);
  }, []);

  useEffect(() => {
    const modal = editModalRef.current;
    if (!modal) {
      return;
    }
    const handleHide = () => setEditOpen(false);
    modal.addEventListener("hide", handleHide);
    return () => modal.removeEventListener("hide", handleHide);
  }, []);

  useEffect(() => {
    const modal = deleteModalRef.current;
    if (!modal) {
      return;
    }
    const handleHide = () => setDeleteOpen(false);
    modal.addEventListener("hide", handleHide);
    return () => modal.removeEventListener("hide", handleHide);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    setEditValues({
      full_name: active.fieldMap.full_name || "",
      email: active.fieldMap.email || "",
      loyalty_tier: active.fieldMap.loyalty_tier || "",
      last_purchase: active.fieldMap.last_purchase || "",
    });
  }, [active]);

  const openCreateModal = () => {
    console.log("Add profile clicked");
    setCreateValues({
      full_name: "",
      email: "",
      loyalty_tier: "",
      last_purchase: "",
    });
    setCreateOpen(true);
  };

  const openEditModal = (row) => {
    setActive(row);
    setEditOpen(true);
  };

  const openDeleteModal = (row) => {
    setActive(row);
    setDeleteOpen(true);
  };

  const closeCreateModal = () => {
    createModalRef.current?.hideOverlay();
    setCreateOpen(false);
  };

  const closeEditModal = () => {
    editModalRef.current?.hideOverlay();
    setEditOpen(false);
  };

  const closeDeleteModal = () => {
    deleteModalRef.current?.hideOverlay();
    setDeleteOpen(false);
  };

  return (
    <s-page heading="Customer profiles">
      <s-section>
        <s-stack direction="inline" gap="base">
          <s-button onClick={openCreateModal}>Add profile</s-button>
          <s-text>Metaobject type: {type}</s-text>
        </s-stack>
      </s-section>

      {!definition && (
        <s-section heading="Set up metaobject definition">
          <s-paragraph>
            The metaobject definition for {type} is missing. Create it to start
            storing customer profiles.
          </s-paragraph>
          <s-button
            {...(definitionFetcher.state !== "idle" ? { loading: true } : {})}
            onClick={submitDefinition}
            type="button"
          >
            Create definition
          </s-button>
        </s-section>
      )}

      {errors.length > 0 && (
        <s-section>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>Something needs attention</s-heading>
            <s-unordered-list>
              {errors.map((error, index) => (
                <s-list-item key={`${error.message}-${index}`}>
                  {error.message}
                </s-list-item>
              ))}
            </s-unordered-list>
          </s-box>
        </s-section>
      )}

      <s-section heading="Stored profiles">
        {rows.length === 0 ? (
          <s-paragraph>No profiles yet. Add your first one.</s-paragraph>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 720,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>
                    Loyalty tier
                  </th>
                  <th style={{ textAlign: "left", padding: "8px" }}>
                    Last purchase
                  </th>
                  <th style={{ textAlign: "right", padding: "8px" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "8px" }}>
                      {row.fieldMap.full_name || "—"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {row.fieldMap.email || "—"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {row.fieldMap.loyalty_tier || "—"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {row.fieldMap.last_purchase || "—"}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <s-stack direction="inline" gap="base">
                        <s-button
                          variant="tertiary"
                          onClick={() => openEditModal(row)}
                        >
                          Edit
                        </s-button>
                        <s-button
                          variant="tertiary"
                          onClick={() => openDeleteModal(row)}
                        >
                          Delete
                        </s-button>
                      </s-stack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>

      <s-modal
        ref={createModalRef}
        heading="Create customer profile"
        accessibilityLabel="Create customer profile"
      >
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Full name"
            name="full_name"
            value={createValues.full_name}
            onChange={(event) =>
              setCreateValues((current) => ({
                ...current,
                full_name: getFieldValue(event),
              }))
            }
          />
          <s-text-field
            label="Email"
            name="email"
            value={createValues.email}
            onChange={(event) =>
              setCreateValues((current) => ({
                ...current,
                email: getFieldValue(event),
              }))
            }
          />
          <s-text-field
            label="Loyalty tier"
            name="loyalty_tier"
            value={createValues.loyalty_tier}
            onChange={(event) =>
              setCreateValues((current) => ({
                ...current,
                loyalty_tier: getFieldValue(event),
              }))
            }
          />
          <s-text-field
            label="Last purchase"
            name="last_purchase"
            type="date"
            value={createValues.last_purchase}
            onChange={(event) =>
              setCreateValues((current) => ({
                ...current,
                last_purchase: getFieldValue(event),
              }))
            }
          />
          <s-stack direction="inline" gap="base">
            <s-button
              {...(createFetcher.state !== "idle"
                ? { loading: true }
                : {})}
              onClick={submitCreate}
              type="button"
            >
              Save profile
            </s-button>
            <s-button
              variant="tertiary"
              onClick={closeCreateModal}
              type="button"
            >
              Cancel
            </s-button>
          </s-stack>
        </s-stack>
      </s-modal>

      <s-modal
        ref={editModalRef}
        heading="Edit customer profile"
        accessibilityLabel="Edit customer profile"
      >
        {active ? (
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Full name"
              name="full_name"
              value={editValues.full_name}
              onChange={(event) =>
                setEditValues((current) => ({
                  ...current,
                  full_name: getFieldValue(event),
                }))
              }
            />
            <s-text-field
              label="Email"
              name="email"
              value={editValues.email}
              onChange={(event) =>
                setEditValues((current) => ({
                  ...current,
                  email: getFieldValue(event),
                }))
              }
            />
            <s-text-field
              label="Loyalty tier"
              name="loyalty_tier"
              value={editValues.loyalty_tier}
              onChange={(event) =>
                setEditValues((current) => ({
                  ...current,
                  loyalty_tier: getFieldValue(event),
                }))
              }
            />
            <s-text-field
              label="Last purchase"
              name="last_purchase"
              type="date"
              value={editValues.last_purchase}
              onChange={(event) =>
                setEditValues((current) => ({
                  ...current,
                  last_purchase: getFieldValue(event),
                }))
              }
            />
            <s-stack direction="inline" gap="base">
              <s-button
                {...(updateFetcher.state !== "idle"
                  ? { loading: true }
                  : {})}
                onClick={submitUpdate}
                type="button"
              >
                Save changes
              </s-button>
              <s-button
                variant="tertiary"
                onClick={closeEditModal}
                type="button"
              >
                Cancel
              </s-button>
            </s-stack>
          </s-stack>
        ) : (
          <s-paragraph>Select a profile to edit.</s-paragraph>
        )}
      </s-modal>

      <s-modal
        ref={deleteModalRef}
        heading="Delete profile"
        accessibilityLabel="Delete profile"
      >
        {active ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Delete {active.fieldMap.full_name || "this profile"}? This cannot
              be undone.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button
                {...(deleteFetcher.state !== "idle"
                  ? { loading: true }
                  : {})}
                onClick={submitDelete}
                type="button"
              >
                Delete profile
              </s-button>
              <s-button
                variant="tertiary"
                onClick={closeDeleteModal}
                type="button"
              >
                Cancel
              </s-button>
            </s-stack>
          </s-stack>
        ) : (
          <s-paragraph>Select a profile to delete.</s-paragraph>
        )}
      </s-modal>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

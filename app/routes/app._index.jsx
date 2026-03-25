import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

const kpis = [
  { label: "Gross sales", value: "$12,480", change: "+8.4%" },
  { label: "Orders", value: "186", change: "+12%" },
  { label: "Conversion", value: "3.2%", change: "+0.4%" },
  { label: "Returning", value: "41%", change: "+2.1%" },
];

const channels = [
  { name: "Online store", value: "$6,240", note: "48% of sales" },
  { name: "Instagram", value: "$2,960", note: "24% of sales" },
  { name: "Email", value: "$1,740", note: "14% of sales" },
  { name: "Wholesale", value: "$1,540", note: "12% of sales" },
];

const tasks = [
  {
    title: "Restock top sellers",
    detail: "3 variants below safety stock",
  },
  {
    title: "Review abandoned checkouts",
    detail: "14 carts to recover",
  },
  {
    title: "Ship ready-to-go orders",
    detail: "9 orders packed, waiting carrier",
  },
];

const insights = [
  "Best seller: Powder Board in Large",
  "Peak traffic: 11:00 AM - 2:00 PM",
  "Top region: California (28% of revenue)",
];

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Store dashboard">
      <s-button slot="primary-action" onClick={generateProduct}>
        Create test product
      </s-button>

      <s-section>
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
          style={{
            background:
              "linear-gradient(135deg, #f4f7ff 0%, #f7f3ff 55%, #fdf7f0 100%)",
          }}
        >
          <s-stack direction="block" gap="base">
            <s-heading>Welcome back</s-heading>
            <s-paragraph>
              Here is a quick pulse on your store. Keep momentum with a fresh
              product, check fulfillment, and follow up on conversion levers.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button
                onClick={generateProduct}
                {...(isLoading ? { loading: true } : {})}
              >
                Generate a product
              </s-button>
              <s-button
                variant="tertiary"
                onClick={() =>
                  shopify.intents.invoke?.("navigate:admin", {
                    url: "/products",
                  })
                }
              >
                Open products
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Today at a glance">
        <s-stack direction="inline" gap="base">
          {kpis.map((kpi) => (
            <s-box
              key={kpi.label}
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
              style={{ minWidth: 180 }}
            >
              <s-stack direction="block" gap="base">
                <s-text>{kpi.label}</s-text>
                <s-heading>{kpi.value}</s-heading>
                <s-text>{kpi.change} vs last week</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Channel mix">
        <s-stack direction="block" gap="base">
          {channels.map((channel) => (
            <s-box
              key={channel.name}
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="inline" gap="base">
                <s-stack direction="block" gap="base">
                  <s-heading>{channel.name}</s-heading>
                  <s-text>{channel.note}</s-text>
                </s-stack>
                <s-text style={{ marginLeft: "auto", fontWeight: 600 }}>
                  {channel.value}
                </s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Priority tasks">
        <s-stack direction="block" gap="base">
          {tasks.map((task) => (
            <s-box
              key={task.title}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="base">
                <s-heading>{task.title}</s-heading>
                <s-text>{task.detail}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Insight highlights">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-unordered-list>
            {insights.map((insight) => (
              <s-list-item key={insight}>{insight}</s-list-item>
            ))}
          </s-unordered-list>
        </s-box>
      </s-section>

      {fetcher.data?.product && (
        <s-section heading="Latest product run">
          <s-stack direction="block" gap="base">
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="base">
                <s-heading>{fetcher.data.product.title}</s-heading>
                <s-text>Status: {fetcher.data.product.status}</s-text>
                <s-text>Handle: {fetcher.data.product.handle}</s-text>
                <s-stack direction="inline" gap="base">
                  <s-button
                    onClick={() => {
                      shopify.intents.invoke?.("edit:shopify/Product", {
                        value: fetcher.data?.product?.id,
                      });
                    }}
                    target="_blank"
                    variant="tertiary"
                  >
                    Edit product
                  </s-button>
                  <s-button
                    variant="tertiary"
                    onClick={() =>
                      shopify.intents.invoke?.("navigate:admin", {
                        url: `/products/${fetcher.data.product.handle}`,
                      })
                    }
                  >
                    View in admin
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>

            <s-section heading="productCreate mutation">
              <s-stack direction="block" gap="base">
                <s-box
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <pre style={{ margin: 0 }}>
                    <code>{JSON.stringify(fetcher.data.product, null, 2)}</code>
                  </pre>
                </s-box>

                <s-heading>productVariantsBulkUpdate mutation</s-heading>
                <s-box
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <pre style={{ margin: 0 }}>
                    <code>{JSON.stringify(fetcher.data.variant, null, 2)}</code>
                  </pre>
                </s-box>
              </s-stack>
            </s-section>
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="Quick actions">
        <s-stack direction="block" gap="base">
          <s-button onClick={generateProduct}>Generate a product</s-button>
          <s-button
            variant="tertiary"
            onClick={() =>
              shopify.intents.invoke?.("navigate:admin", { url: "/orders" })
            }
          >
            Review orders
          </s-button>
          <s-button
            variant="tertiary"
            onClick={() =>
              shopify.intents.invoke?.("navigate:admin", { url: "/analytics" })
            }
          >
            Open analytics
          </s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Store health">
        <s-paragraph>
          Keep these items on track to protect conversion and fulfillment.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Online store speed score: 83</s-list-item>
          <s-list-item>Payment methods enabled: 4</s-list-item>
          <s-list-item>Shipping profiles active: 2</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

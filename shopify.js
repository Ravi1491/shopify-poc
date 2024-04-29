const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");

const app = express();
const port = 3000;

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const scopes =
  "read_products,read_orders, read_analytics, read_orders, read_product_feeds, read_product_listings, read_products";

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/install", (req, res) => {
  const shop = req.query.shop || "xg-dev";

  if (!shop) {
    res.send("Shop parameter is missing");
    return;
  }

  const nonce = crypto.randomBytes(8).toString("hex");
  const redirectUri = `https://0ab5-112-196-47-10.ngrok-free.app/oauth/callback`;

  const authUrl = `https://${shop}.myshopify.com/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${redirectUri}&state=${nonce}`;

  res.redirect(authUrl);
});

app.get("/oauth/callback", async (req, res) => {
  const { code, shop, state } = req.query;

  if (!code || !shop) {
    res.send("Missing code or shop parameter");
    return;
  }

  const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
  const accessParams = {
    client_id: apiKey,
    client_secret: apiSecret,
    code,
  };

  try {
    const response = await axios.post(
      accessTokenUrl,
      querystring.stringify(accessParams),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token } = response.data;
    console.log("Access Token ", access_token);

    // Fetch products
    const productsUrl = `https://${shop}/admin/api/2022-01/products.json`;
    const productsResponse = await axios.get(productsUrl, {
      headers: {
        "X-Shopify-Access-Token": access_token,
      },
    });

    const products = productsResponse.data.products;
    // console.log("Products:", products);

    // Fetch product reviews (assuming there is a product ID)
    if (products.length < 0) {
      const productId = products[0].id;
      const reviewsUrl = `https://${shop}/admin/api/2022-01/products/${productId}/reviews.json`;
      const reviewsResponse = await axios.get(reviewsUrl, {
        headers: {
          "X-Shopify-Access-Token": access_token,
        },
      });

      const reviews = reviewsResponse.data.reviews;
      console.log("Reviews:", reviews);
    }

    const webhookUrl = `https://f868-112-196-47-10.ngrok-free.app/webhook/order_placed`;

    const webhookParams = {
      webhook: {
        topic: "orders/create",
        address: webhookUrl,
        format: "json",
      },
    };

    axios
      .post(
        `https://${shop}.myshopify.com/admin/webhooks.json`,
        webhookParams,
        {
          headers: {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
          },
        }
      )
      .then(() => {
        console.log("Webhook created successfully");
      })
      .catch((error) => {
        console.error("Error creating webhook:", error);
      });

    res.send("Successfully fetched products and reviews");
  } catch (error) {
    console.log("ERROR", error);
    res.send("Error fetching products and reviews");
  }
});

app.post("/webhook/order_placed", (req, res) => {
  const { headers, body } = req;

  // Verify webhook integrity using HMAC validation (you may need to implement this)

  try {
    const orderData = JSON.parse(body);

    // Extract relevant data from the order payload
    const { id: orderId, line_items, customer } = orderData;

    // Log or process the extracted data as needed
    console.log("Order ID:", orderId);
    console.log("Line Items:", line_items);
    console.log("Customer Data:", customer);

    res.status(200).send("Webhook received successfully");
  } catch (error) {
    console.error("Error parsing webhook payload:", error);
    res.status(400).send("Invalid webhook payload");
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

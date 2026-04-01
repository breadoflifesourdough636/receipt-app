const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.status(200).send("Receipt app is running");
});

app.post("/upload", async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body;

    console.log("Incoming upload:", { fileName, fileUrl });

    if (!fileUrl) {
      return res.status(400).json({ error: "Missing fileUrl" });
    }

    // Only test image receipts for now
    const lower = (fileName || "").toLowerCase();
    const isImage =
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".heic");

    if (!isImage) {
      return res.status(400).json({
        success: false,
        error: "This extraction step currently supports image receipts only. PDF/document uploads need a separate path."
      });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract this receipt into structured JSON.
Return best-effort values.
If something is unclear, use null.
If line items are missing, return an empty array.

Top-level categories:
- Advertising & Marketing
- Office Expenses & Supplies
- Rent and Utilities
- Payroll and Employee Benefits
- Professional Services
- Travel and Meals
- Vehicle Expenses
- Taxes and Licenses
- Insurance
- Cost of Goods Sold (COGS)

COGS subcategories:
- Ingredients
- Packaging
- Baking Supplies`
            },
            {
              type: "input_image",
              image_url: fileUrl
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_extraction",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              merchant_name: { type: ["string", "null"] },
              receipt_date: { type: ["string", "null"] },
              receipt_time: { type: ["string", "null"] },
              subtotal: { type: ["number", "null"] },
              tax: { type: ["number", "null"] },
              total: { type: ["number", "null"] },
              suggested_category: { type: ["string", "null"] },
              suggested_subcategory: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
              line_items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    item_name: { type: ["string", "null"] },
                    quantity: { type: ["number", "null"] },
                    unit_price: { type: ["number", "null"] },
                    line_total: { type: ["number", "null"] },
                    suggested_category: { type: ["string", "null"] },
                    suggested_subcategory: { type: ["string", "null"] }
                  },
                  required: [
                    "item_name",
                    "quantity",
                    "unit_price",
                    "line_total",
                    "suggested_category",
                    "suggested_subcategory"
                  ]
                }
              }
            },
            required: [
              "merchant_name",
              "receipt_date",
              "receipt_time",
              "subtotal",
              "tax",
              "total",
              "suggested_category",
              "suggested_subcategory",
              "notes",
              "line_items"
            ]
          }
        }
      }
    });

    console.log("Raw OpenAI response:", JSON.stringify(response, null, 2));

    const parsedText = response.output_text;
    if (!parsedText) {
      throw new Error("No output_text returned from OpenAI");
    }

    const parsed = JSON.parse(parsedText);

    console.log("Parsed receipt:", parsed);

    res.status(200).json({
      success: true,
      fileName,
      extracted: parsed
    });
  } catch (error) {
    console.error("Extraction failed FULL ERROR:", error);
    console.error("Extraction failed MESSAGE:", error?.message);
    console.error("Extraction failed STATUS:", error?.status);
    console.error("Extraction failed RESPONSE:", error?.response?.data || error?.error || null);

    res.status(500).json({
      success: false,
      error: error?.message || "Unknown extraction error"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function buildSchema() {
  return {
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
  };
}

function buildPrompt(isPdf) {
  if (isPdf) {
    return `This is a PDF receipt or invoice.

Read the entire PDF carefully and extract receipt data into structured JSON.
Use the PDF text and visual layout together.
If the PDF has multiple pages, use the page that contains the actual receipt totals and line items.

Rules:
- Return best-effort values.
- If something is unclear, use null.
- If line items are missing, return an empty array.
- Do not invent values.
- If you can identify the merchant but not line items, still return the merchant and totals.
- Notes should briefly explain anything unusual, like "multi-page PDF", "scanned image PDF", or "totals unclear".

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
- Baking Supplies`;
  }

  return `Extract this receipt into structured JSON.
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
- Baking Supplies`;
}

app.get("/", (req, res) => {
  res.status(200).send("Receipt app is running");
});

app.post("/upload", async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing fileUrl"
      });
    }

    const lower = (fileName || "").toLowerCase();
    const isPdf = lower.endsWith(".pdf");
    const isImage =
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".heic");

    if (!isPdf && !isImage) {
      return res.status(400).json({
        success: false,
        error: "Only image files and PDFs are supported"
      });
    }

    let content;
    let model = "gpt-4.1-mini";

    if (isPdf) {
      model = "gpt-4.1";

      const pdfResponse = await fetch(fileUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
      }

      const arrayBuffer = await pdfResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      content = [
        {
          type: "input_text",
          text: buildPrompt(true)
        },
        {
          type: "input_file",
          filename: fileName || "receipt.pdf",
          file_data: `data:application/pdf;base64,${base64}`
        }
      ];
    } else {
      content = [
        {
          type: "input_text",
          text: buildPrompt(false)
        },
        {
          type: "input_image",
          image_url: fileUrl
        }
      ];
    }

    const openaiResponse = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_extraction",
          schema: buildSchema()
        }
      }
    });

    console.log("UPLOAD TYPE:", isPdf ? "pdf" : "image");
    console.log("RAW OUTPUT TEXT:", openaiResponse.output_text);

    if (!openaiResponse.output_text) {
      return res.status(500).json({
        success: false,
        error: "OpenAI returned no output_text"
      });
    }

    const parsed = JSON.parse(openaiResponse.output_text);

    return res.status(200).json({
      success: true,
      fileName,
      extracted: parsed,
      uploadType: isPdf ? "pdf" : "image"
    });
  } catch (error) {
    console.error("RAILWAY /upload ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Upload extraction failed"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
